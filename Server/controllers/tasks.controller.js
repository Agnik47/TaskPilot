import prisma from '../config/prisma.js';
import { logActivitiesInBackground } from '../services/activity.service.js';
import { notifyInBackground } from '../services/notifications.service.js';
import { planStatusChange, describeStatusEvent } from '../services/taskWorkflow.service.js';
import { getWorkspaceSettings } from '../services/workspaceSettings.service.js';
import { emitToTask } from '../realtime.js';
import {
  isTaskVisibleTo,
  filterTasksForRole,
  resolveAssigneeId,
  canEditTask,
  canSetAssignee,
  canDeleteTask,
  isOwner,
} from '../services/authorization.service.js';

// With the relationJoins preview feature this loads in a single SQL statement.
// Writes deliberately avoid `include`: Prisma wraps write+include in a
// transaction with a follow-up SELECT, costing 3-4 extra round trips.
const taskInclude = {
  assignee: true,
  creator: true,
  project: { select: { id: true, name: true, workspaceId: true } },
};

export async function listTasks(req, res, next) {
  try {
    const where = { workspaceId: req.workspaceId };
    if (req.query.projectId) where.projectId = req.query.projectId;

    const tasks = await prisma.task.findMany({
      where,
      include: taskInclude,
      orderBy: { createdAt: 'desc' },
    });

    res.json(filterTasksForRole(req.dbUser.id, req.orgRole, tasks));
  } catch (err) {
    next(err);
  }
}

export async function getTask(req, res, next) {
  try {
    const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: taskInclude });

    if (!task || task.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found.' });
    }

    if (!isTaskVisibleTo(req.dbUser.id, req.orgRole, task)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have access to this task.' });
    }

    res.json(task);
  } catch (err) {
    next(err);
  }
}

export async function createTask(req, res, next) {
  try {
    const { title, description, type, priority, status, assigneeId, due_date, projectId } = req.body;

    if (!title || !projectId || !due_date) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'title, projectId and due_date are required.' });
    }
    if (status === 'IN_REVIEW') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: "A new task can't start in review." });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, workspaceId: true },
    });
    if (!project || project.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    }

    const finalAssigneeId = resolveAssigneeId(req.dbUser.id, req.orgRole, assigneeId);

    const [created, assignee] = await Promise.all([
      prisma.task.create({
        data: {
          workspaceId: req.workspaceId,
          projectId,
          title,
          description,
          type,
          status,
          priority,
          creatorId: req.dbUser.id,
          assigneeId: finalAssigneeId,
          due_date: new Date(due_date),
          completedAt: status === 'DONE' ? new Date() : null,
        },
      }),
      finalAssigneeId === req.dbUser.id ? req.dbUser : prisma.user.findUnique({ where: { id: finalAssigneeId } }),
    ]);

    // Same shape as `include: taskInclude`, assembled from data already in hand.
    const task = { ...created, assignee, creator: req.dbUser, project };

    logActivitiesInBackground([{
      workspaceId: req.workspaceId,
      type: 'TASK_CREATED',
      message: `${req.dbUser.name} created "${task.title}"`,
      actorId: req.dbUser.id,
      taskId: task.id,
      projectId: task.projectId,
    }], req.dbUser);

    // Self-assigned tasks are filtered out inside notifyInBackground.
    notifyInBackground([{
      workspaceId: req.workspaceId,
      userId: task.assigneeId,
      type: 'TASK_ASSIGNED',
      message: `${req.dbUser.name} assigned you "${task.title}"`,
      taskId: task.id,
      projectId: task.projectId,
    }], req.dbUser);

    res.status(201).json(task);
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req, res, next) {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id }, include: taskInclude });
    if (!existing || existing.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found.' });
    }

    if (!canEditTask(req.dbUser.id, req.orgRole, existing)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You cannot edit this task.' });
    }

    const { title, description, type, priority, status, assigneeId, due_date } = req.body;
    const data = {};
    const activities = [];

    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (type !== undefined) data.type = type;

    if (priority !== undefined && priority !== existing.priority) {
      data.priority = priority;
      activities.push({
        type: 'PRIORITY_CHANGED',
        message: `${req.dbUser.name} changed priority from ${existing.priority} to ${priority}`,
        metadata: { from: existing.priority, to: priority },
      });
    }

    if (due_date !== undefined && new Date(due_date).getTime() !== new Date(existing.due_date).getTime()) {
      data.due_date = new Date(due_date);
      activities.push({
        type: 'DUE_DATE_CHANGED',
        message: `${req.dbUser.name} changed the due date`,
        metadata: { from: existing.due_date, to: data.due_date },
      });
    }

    if (assigneeId !== undefined && assigneeId !== existing.assigneeId) {
      if (!canSetAssignee(req.orgRole, assigneeId, req.dbUser.id)) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only assign tasks to yourself.' });
      }
      data.assigneeId = assigneeId;
      activities.push({
        type: 'TASK_REASSIGNED',
        message: `${req.dbUser.name} reassigned this task`,
        metadata: { from: existing.assigneeId, to: assigneeId },
      });
    }

    // Status goes through the completion workflow (Done may become In Review).
    let statusNotifications = [];
    if (status !== undefined && status !== existing.status) {
      const settings = await getWorkspaceSettings(req.workspaceId);
      const subject = { ...existing, assigneeId: data.assigneeId ?? existing.assigneeId };
      const plan = planStatusChange({ task: subject, requested: status, actorIsOwner: isOwner(req.orgRole), settings });
      if (plan.error) return res.status(400).json({ error: 'INVALID_TRANSITION', message: plan.error });
      if (!plan.noop) {
        Object.assign(data, plan.data);
        const effects = describeStatusEvent({ event: plan.event, task: subject, actor: req.dbUser, from: existing.status, to: plan.data.status });
        activities.push(...effects.activities);
        statusNotifications = effects.notifications;
      }
    }

    // Only a reassignment needs a user we don't already have; fetch it
    // alongside the update rather than after it.
    const [updated, assignee] = await Promise.all([
      prisma.task.update({ where: { id: req.params.id }, data }),
      data.assigneeId !== undefined ? prisma.user.findUnique({ where: { id: data.assigneeId } }) : existing.assignee,
    ]);

    const task = { ...updated, assignee, creator: existing.creator, project: existing.project };

    logActivitiesInBackground(
      activities.map((activity) => ({
        workspaceId: req.workspaceId,
        actorId: req.dbUser.id,
        taskId: task.id,
        projectId: task.projectId,
        ...activity,
      })),
      req.dbUser
    );

    const notifications = [...statusNotifications];
    if (data.assigneeId !== undefined) {
      notifications.push({ userId: data.assigneeId, type: 'TASK_ASSIGNED', message: `${req.dbUser.name} assigned you "${task.title}"` });
    }
    notifyInBackground(
      notifications.map((n) => ({ ...n, workspaceId: req.workspaceId, taskId: task.id, projectId: task.projectId })),
      req.dbUser
    );

    res.json(task);
  } catch (err) {
    next(err);
  }
}

// Owner decision on a task waiting in review: approve (-> Done) or request
// changes (-> In Progress). An optional note is posted as a comment so it shows
// in the task discussion (live) and the assignee sees exactly what to fix.
export async function reviewTask(req, res, next) {
  try {
    const { decision, note } = req.body;
    if (decision !== 'approve' && decision !== 'changes') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'decision must be "approve" or "changes".' });
    }
    const trimmedNote = typeof note === 'string' ? note.trim().slice(0, 2000) : '';

    const existing = await prisma.task.findUnique({ where: { id: req.params.id }, include: taskInclude });
    if (!existing || existing.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found.' });
    }
    if (existing.status !== 'IN_REVIEW') {
      return res.status(409).json({ error: 'NOT_IN_REVIEW', message: "This task isn't waiting for review any more." });
    }

    const settings = await getWorkspaceSettings(req.workspaceId);
    const plan = planStatusChange({
      task: existing,
      requested: decision === 'approve' ? 'DONE' : 'IN_PROGRESS',
      actorIsOwner: true,
      settings,
    });

    const [updated, comment] = await Promise.all([
      prisma.task.update({ where: { id: existing.id }, data: plan.data }),
      trimmedNote
        ? prisma.comment.create({ data: { workspaceId: req.workspaceId, content: trimmedNote, userId: req.dbUser.id, taskId: existing.id } })
        : null,
    ]);

    const task = { ...updated, assignee: existing.assignee, creator: existing.creator, project: existing.project };
    const effects = describeStatusEvent({ event: plan.event, task: existing, actor: req.dbUser, from: existing.status, to: plan.data.status, note: trimmedNote });

    if (comment) emitToTask(existing.id, 'comment:new', { ...comment, user: req.dbUser });
    logActivitiesInBackground(
      effects.activities.map((a) => ({ ...a, workspaceId: req.workspaceId, actorId: req.dbUser.id, taskId: task.id, projectId: task.projectId })),
      req.dbUser
    );
    notifyInBackground(
      effects.notifications.map((n) => ({ ...n, workspaceId: req.workspaceId, taskId: task.id, projectId: task.projectId })),
      req.dbUser
    );

    res.json(task);
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(req, res, next) {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found.' });
    }

    if (!canDeleteTask(req.dbUser.id, req.orgRole, existing)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You cannot delete this task.' });
    }

    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

const TASK_TYPES = ['TASK', 'BUG', 'FEATURE', 'IMPROVEMENT', 'OTHER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']; // IN_REVIEW is only reached by finishing a task
const MAX_BULK_TASKS = 200;

// Creates many tasks in one project at once (spreadsheet entry / paste from
// Excel). Same rules as createTask — employees can only assign to themselves —
// plus: every row is validated before anything is written, so a batch is all
// or nothing, and owners can only assign to members of the project.
export async function bulkCreateTasks(req, res, next) {
  try {
    const { projectId, tasks: rows } = req.body;

    if (!projectId || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'projectId and a non-empty tasks array are required.' });
    }
    if (rows.length > MAX_BULK_TASKS) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: `You can create up to ${MAX_BULK_TASKS} tasks at once.` });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, name: true, workspaceId: true, members: { select: { userId: true } } },
    });
    if (!project || project.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    }

    const assignable = new Set([...project.members.map((m) => m.userId), req.dbUser.id]);
    const errors = [];

    const data = rows.map((row, i) => {
      const n = i + 1;
      const title = typeof row?.title === 'string' ? row.title.trim() : '';
      const due = row?.due_date ? new Date(row.due_date) : null;

      if (!title) errors.push({ row: n, field: 'title', message: `Row ${n}: title is required.` });
      else if (title.length > 500) errors.push({ row: n, field: 'title', message: `Row ${n}: title is too long.` });
      if (!due || Number.isNaN(due.getTime())) errors.push({ row: n, field: 'due_date', message: `Row ${n}: a valid due date is required.` });
      if (row?.type && !TASK_TYPES.includes(row.type)) errors.push({ row: n, field: 'type', message: `Row ${n}: invalid type.` });
      if (row?.priority && !PRIORITIES.includes(row.priority)) errors.push({ row: n, field: 'priority', message: `Row ${n}: invalid priority.` });
      if (row?.status && !STATUSES.includes(row.status)) errors.push({ row: n, field: 'status', message: `Row ${n}: invalid status.` });

      const assigneeId = resolveAssigneeId(req.dbUser.id, req.orgRole, row?.assigneeId);
      if (!assignable.has(assigneeId)) {
        errors.push({ row: n, field: 'assigneeId', message: `Row ${n}: the assignee isn't a member of this project.` });
      }

      return {
        workspaceId: req.workspaceId,
        projectId,
        title,
        description: typeof row?.description === 'string' && row.description.trim() ? row.description.trim() : null,
        type: row?.type || undefined,
        priority: row?.priority || undefined,
        status: row?.status || undefined,
        creatorId: req.dbUser.id,
        assigneeId,
        due_date: due,
        completedAt: row?.status === 'DONE' ? new Date() : null,
      };
    });

    if (errors.length) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: errors[0].message, errors });
    }

    const assigneeIds = [...new Set(data.map((d) => d.assigneeId))];
    const [created, users] = await Promise.all([
      prisma.task.createManyAndReturn({ data }),
      prisma.user.findMany({ where: { id: { in: assigneeIds } } }),
    ]);

    const usersById = new Map(users.map((u) => [u.id, u]));
    const projectRef = { id: project.id, name: project.name, workspaceId: project.workspaceId };
    const tasks = created.map((t) => ({ ...t, assignee: usersById.get(t.assigneeId) ?? null, creator: req.dbUser, project: projectRef }));

    logActivitiesInBackground(
      tasks.map((t) => ({
        workspaceId: req.workspaceId,
        type: 'TASK_CREATED',
        message: `${req.dbUser.name} created "${t.title}"`,
        actorId: req.dbUser.id,
        taskId: t.id,
        projectId,
      })),
      req.dbUser
    );

    // One notification per person, not per row: a pasted sheet of 30 tasks
    // shouldn't send someone 30 alerts.
    const byAssignee = new Map();
    for (const t of tasks) byAssignee.set(t.assigneeId, [...(byAssignee.get(t.assigneeId) || []), t]);
    notifyInBackground(
      [...byAssignee.entries()].map(([userId, assigned]) => ({
        workspaceId: req.workspaceId,
        userId,
        type: 'TASK_ASSIGNED',
        message: assigned.length === 1
          ? `${req.dbUser.name} assigned you "${assigned[0].title}"`
          : `${req.dbUser.name} assigned you ${assigned.length} tasks in "${project.name}"`,
        taskId: assigned.length === 1 ? assigned[0].id : null,
        projectId,
      })),
      req.dbUser
    );

    res.status(201).json(tasks);
  } catch (err) {
    next(err);
  }
}
