import prisma from '../config/prisma.js';
import { logActivitiesInBackground } from '../services/activity.service.js';
import { notifyInBackground } from '../services/notifications.service.js';
import { planStatusChange, describeStatusEvent } from '../services/taskWorkflow.service.js';
import { getWorkspaceSettings } from '../services/workspaceSettings.service.js';
import { workspaceOwnerIds } from '../services/owners.service.js';
import { emitToTask } from '../realtime.js';
import { openBlockersInclude } from '../services/blockers.service.js';
import { checklistInclude } from '../services/taskAccess.service.js';
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
export const taskInclude = {
  assignee: true,
  creator: true,
  project: { select: { id: true, name: true, workspaceId: true } },
  blockers: openBlockersInclude,
  checklist: checklistInclude,
};

// Due dates are optional: empty -> null, garbage -> undefined (invalid).
function parseDueDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// New tasks go to the bottom of their project's manual order.
async function nextPosition(projectId) {
  const { _max } = await prisma.task.aggregate({ where: { projectId }, _max: { position: true } });
  return (_max.position ?? 0) + 1;
}

const TASK_TYPES = ['TASK', 'BUG', 'FEATURE', 'IMPROVEMENT', 'OTHER'];
const PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const CREATE_STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']; // IN_REVIEW is only reached by finishing a task
const MAX_TITLE = 500;

// Validates one new task's fields. Single and bulk creation both use this, so
// they accept exactly the same input. `row` (1-based, bulk only) prefixes the
// messages so the sheet can point at the bad row.
function validateNewTask(input, row) {
  const errors = [];
  const fail = (field, text) =>
    errors.push({ ...(row ? { row } : {}), field, message: row ? `Row ${row}: ${text}` : text[0].toUpperCase() + text.slice(1) });

  const title = typeof input?.title === 'string' ? input.title.trim() : '';
  const due = parseDueDate(input?.due_date);

  if (!title) fail('title', 'title is required.');
  else if (title.length > MAX_TITLE) fail('title', 'title is too long.');
  if (due === undefined) fail('due_date', "the due date isn't a valid date.");
  if (input?.type && !TASK_TYPES.includes(input.type)) fail('type', 'invalid type.');
  if (input?.priority && !PRIORITIES.includes(input.priority)) fail('priority', 'invalid priority.');
  if (input?.status === 'IN_REVIEW') fail('status', "a new task can't start in review.");
  else if (input?.status && !CREATE_STATUSES.includes(input.status)) fail('status', 'invalid status.');

  const description = typeof input?.description === 'string' && input.description.trim() ? input.description.trim() : null;
  const status = input?.status || undefined;

  return {
    errors,
    fields: {
      title,
      description,
      type: input?.type || undefined,
      priority: input?.priority || undefined,
      status,
      due_date: due,
      completedAt: status === 'DONE' ? new Date() : null,
    },
  };
}

// Tasks can be assigned to project members, or to the person creating them.
const projectForCreate = { id: true, name: true, workspaceId: true, members: { select: { userId: true } } };
const assignableIn = (project, dbUserId) => new Set([...project.members.map((m) => m.userId), dbUserId]);
const projectRef = ({ id, name, workspaceId }) => ({ id, name, workspaceId });

const validationError = (res, errors) =>
  res.status(400).json({ error: 'VALIDATION_ERROR', message: errors[0].message, errors });

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
    const { projectId } = req.body;
    if (!projectId) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'projectId is required.' });
    }
    const { errors, fields } = validateNewTask(req.body);
    if (errors.length) return validationError(res, errors);

    const [project, position] = await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: projectForCreate }),
      nextPosition(projectId),
    ]);
    if (!project || project.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    }

    const finalAssigneeId = resolveAssigneeId(req.dbUser.id, req.orgRole, req.body.assigneeId);
    if (!assignableIn(project, req.dbUser.id).has(finalAssigneeId)) {
      return validationError(res, [{ field: 'assigneeId', message: "The assignee isn't a member of this project." }]);
    }

    const [created, assignee] = await Promise.all([
      prisma.task.create({
        data: {
          ...fields,
          workspaceId: req.workspaceId,
          projectId,
          creatorId: req.dbUser.id,
          assigneeId: finalAssigneeId,
          position,
        },
      }),
      finalAssigneeId === req.dbUser.id ? req.dbUser : prisma.user.findUnique({ where: { id: finalAssigneeId } }),
    ]);

    // Same shape as `include: taskInclude`, assembled from data already in hand.
    const task = { ...created, assignee, creator: req.dbUser, project: projectRef(project), blockers: [], checklist: [] };

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

    const { title, description, type, priority, status, assigneeId, due_date, position } = req.body;
    const data = {};
    const activities = [];

    // Drag-to-reorder: the client sends a position between the new neighbours.
    if (position !== undefined) {
      if (typeof position !== 'number' || !Number.isFinite(position)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'position must be a number.' });
      }
      data.position = position;
    }

    if (title !== undefined) data.title = title;
    if (description !== undefined) data.description = description;
    if (type !== undefined) data.type = type;

    if (priority !== undefined && priority !== existing.priority) {
      // Priority decides whether finished work needs approval, so the person
      // doing assigned work can't change it (e.g. to skip review).
      if (!isOwner(req.orgRole) && existing.creatorId !== req.dbUser.id) {
        return res.status(403).json({ error: 'FORBIDDEN', message: 'Only an owner can change the priority of a task assigned to you.' });
      }
      data.priority = priority;
      activities.push({
        type: 'PRIORITY_CHANGED',
        message: `${req.dbUser.name} changed priority from ${existing.priority} to ${priority}`,
        metadata: { from: existing.priority, to: priority },
      });
    }

    const due = due_date === undefined ? undefined : parseDueDate(due_date);
    if (due_date !== undefined && due === undefined) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'due_date is not a valid date.' });
    }
    if (due !== undefined && due?.getTime() !== existing.due_date?.getTime()) {
      data.due_date = due;
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
      const subject = { ...existing, assigneeId: data.assigneeId ?? existing.assigneeId, priority: data.priority ?? existing.priority };
      const plan = planStatusChange({ task: subject, requested: status, actorIsOwner: isOwner(req.orgRole), settings });
      if (plan.error) return res.status(400).json({ error: 'INVALID_TRANSITION', message: plan.error });
      if (!plan.noop) {
        Object.assign(data, plan.data);
        // Work the employee created themselves has no assigning owner to ask, so every owner is asked.
        const reviewerIds = plan.event === 'SUBMITTED' && subject.creatorId === req.dbUser.id ? await workspaceOwnerIds(req.workspaceId) : undefined;
        const effects = describeStatusEvent({ event: plan.event, task: subject, actor: req.dbUser, from: existing.status, to: plan.data.status, reviewerIds });
        activities.push(...effects.activities);
        statusNotifications = effects.notifications;
      }
    }

    // Any status other than Blocked means the wait is over: close the open
    // blockers so the status and the "Waiting on …" list never disagree.
    // ("Blocked" with no blockers is fine: waiting on something, not someone.)
    // The close-out runs whenever the status changes, not only when the read
    // above saw blockers, so one added concurrently isn't left open.
    const leavingBlocked = data.status !== undefined && data.status !== 'BLOCKED';
    const unblocking = leavingBlocked && existing.blockers.length > 0;
    if (unblocking) {
      activities.push({
        type: 'BLOCKER_RESOLVED',
        message: `${req.dbUser.name} marked this unblocked (was waiting on ${existing.blockers.map((b) => b.waitingOn.name).join(', ')})`,
      });
    }

    // Only a reassignment needs a user we don't already have; fetch it
    // alongside the update rather than after it.
    const [updated, assignee] = await Promise.all([
      prisma.task.update({ where: { id: req.params.id }, data }),
      data.assigneeId !== undefined ? prisma.user.findUnique({ where: { id: data.assigneeId } }) : existing.assignee,
      leavingBlocked
        ? prisma.taskBlocker.updateMany({ where: { taskId: existing.id, resolvedAt: null }, data: { resolvedAt: new Date(), resolvedById: req.dbUser.id } })
        : null,
    ]);

    const task = { ...updated, assignee, creator: existing.creator, project: existing.project, blockers: leavingBlocked ? [] : existing.blockers, checklist: existing.checklist };

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

    const task = { ...updated, assignee: existing.assignee, creator: existing.creator, project: existing.project, blockers: existing.blockers, checklist: existing.checklist };
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
    if (!canDeleteTask(req.orgRole)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'Only the workspace owner can delete tasks.' });
    }

    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found.' });
    }

    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}

const MAX_BULK_TASKS = 200;

// Creates many tasks in one project at once (spreadsheet entry / paste from
// Excel). Same rules as createTask (validateNewTask, assignees limited to
// project members, employees only themselves), plus: every row is validated
// before anything is written, so a batch is all or nothing.
export async function bulkCreateTasks(req, res, next) {
  try {
    const { projectId, tasks: rows } = req.body;

    if (!projectId || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'projectId and a non-empty tasks array are required.' });
    }
    if (rows.length > MAX_BULK_TASKS) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: `You can create up to ${MAX_BULK_TASKS} tasks at once.` });
    }

    const project = await prisma.project.findUnique({ where: { id: projectId }, select: projectForCreate });
    if (!project || project.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Project not found.' });
    }

    const assignable = assignableIn(project, req.dbUser.id);
    const errors = [];

    const data = rows.map((row, i) => {
      const n = i + 1;
      const checked = validateNewTask(row, n);
      errors.push(...checked.errors);

      const assigneeId = resolveAssigneeId(req.dbUser.id, req.orgRole, row?.assigneeId);
      if (!assignable.has(assigneeId)) {
        errors.push({ row: n, field: 'assigneeId', message: `Row ${n}: the assignee isn't a member of this project.` });
      }

      return { ...checked.fields, workspaceId: req.workspaceId, projectId, creatorId: req.dbUser.id, assigneeId };
    });

    if (errors.length) return validationError(res, errors);

    const firstPosition = await nextPosition(projectId);
    data.forEach((d, i) => { d.position = firstPosition + i; });

    const assigneeIds = [...new Set(data.map((d) => d.assigneeId))];
    const [created, users] = await Promise.all([
      prisma.task.createManyAndReturn({ data }),
      prisma.user.findMany({ where: { id: { in: assigneeIds } } }),
    ]);

    const usersById = new Map(users.map((u) => [u.id, u]));
    const ref = projectRef(project);
    const tasks = created.map((t) => ({ ...t, assignee: usersById.get(t.assigneeId) ?? null, creator: req.dbUser, project: ref, blockers: [], checklist: [] }));

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
