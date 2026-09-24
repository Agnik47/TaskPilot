import prisma from '../config/prisma.js';
import { logActivitiesInBackground } from '../services/activity.service.js';
import { notifyInBackground } from '../services/notifications.service.js';
import {
  isTaskVisibleTo,
  filterTasksForRole,
  resolveAssigneeId,
  canEditTask,
  canSetAssignee,
  canDeleteTask,
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

    if (status !== undefined && status !== existing.status) {
      data.status = status;
      activities.push({
        type: 'STATUS_CHANGED',
        message: `${req.dbUser.name} changed status from ${existing.status} to ${status}`,
        metadata: { from: existing.status, to: status },
      });

      if (status === 'DONE') {
        data.completedAt = new Date();
        activities.push({ type: 'TASK_COMPLETED', message: `${req.dbUser.name} completed this task` });
      } else if (existing.status === 'DONE') {
        data.completedAt = null;
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

    if (data.assigneeId !== undefined) {
      notifyInBackground([{
        workspaceId: req.workspaceId,
        userId: data.assigneeId,
        type: 'TASK_ASSIGNED',
        message: `${req.dbUser.name} assigned you "${task.title}"`,
        taskId: task.id,
        projectId: task.projectId,
      }], req.dbUser);
    }

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
