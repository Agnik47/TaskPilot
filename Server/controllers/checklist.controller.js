import prisma from '../config/prisma.js';
import { logActivitiesInBackground } from '../services/activity.service.js';
import { notifyInBackground } from '../services/notifications.service.js';
import { canEditTask, canToggleChecklistItem } from '../services/authorization.service.js';
import { isOrgMember } from '../services/taskAccess.service.js';
import { emitToTask } from '../realtime.js';
import { taskInclude } from './tasks.controller.js';

// Checklist items (subtasks) inside a task. People who can edit the task
// manage the list; an item's owner can tick their own item off. Every change
// returns the updated task and is pushed live to anyone viewing it.

const MAX_TITLE = 300;
const MAX_ITEMS_PER_REQUEST = 50;
const MAX_ITEMS_PER_TASK = 200;

async function loadTask(req) {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: taskInclude });
  return task && task.workspaceId === req.workspaceId ? task : null;
}

// Reload and broadcast so other viewers' checklists update instantly.
async function respond(res, taskId, status = 200) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });
  emitToTask(taskId, 'checklist:changed', { taskId, checklist: task.checklist });
  res.status(status).json(task);
}

// Empty -> null, invalid -> undefined.
function parseDate(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

// Validates an optional owner: must be a member of this organization.
async function checkAssignee(req, assigneeId) {
  if (!assigneeId) return null;
  const [user, member] = await Promise.all([
    prisma.user.findUnique({ where: { id: assigneeId }, select: { id: true } }),
    isOrgMember(req.workspaceId, assigneeId),
  ]);
  return user && member ? null : 'That person is not in this organization.';
}

function notifyAssigned(req, task, items) {
  notifyInBackground(
    items
      .filter((i) => i.assigneeId)
      .map((i) => ({
        workspaceId: req.workspaceId,
        userId: i.assigneeId,
        type: 'CHECKLIST_ASSIGNED',
        message: `${req.dbUser.name} gave you a checklist item on "${task.title}": ${i.title}`,
        taskId: task.id,
        projectId: task.projectId,
      })),
    req.dbUser
  );
}

// POST /tasks/:id/checklist  { titles: string[] } or { title, assigneeId?, dueDate? }
export async function addItems(req, res, next) {
  try {
    const raw = Array.isArray(req.body.titles) ? req.body.titles : [req.body.title];
    const titles = raw.map((t) => (typeof t === 'string' ? t.trim() : '')).filter(Boolean);
    if (!titles.length) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Give the item a name.' });
    if (titles.length > MAX_ITEMS_PER_REQUEST) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: `Add up to ${MAX_ITEMS_PER_REQUEST} items at once.` });
    }
    if (titles.some((t) => t.length > MAX_TITLE)) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: `Keep each item under ${MAX_TITLE} characters.` });
    }

    const task = await loadTask(req);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found.' });
    if (!canEditTask(req.dbUser.id, req.orgRole, task)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You cannot change this task.' });
    }
    if (task.checklist.length + titles.length > MAX_ITEMS_PER_TASK) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: `A checklist can have up to ${MAX_ITEMS_PER_TASK} items.` });
    }

    // Owner and due date only apply when adding a single item.
    const single = titles.length === 1;
    const assigneeId = single && typeof req.body.assigneeId === 'string' ? req.body.assigneeId : null;
    const dueDate = single ? parseDate(req.body.dueDate) : null;
    if (dueDate === undefined) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'That due date is not valid.' });
    const assigneeError = await checkAssignee(req, assigneeId);
    if (assigneeError) return res.status(400).json({ error: 'VALIDATION_ERROR', message: assigneeError });

    const last = task.checklist.reduce((max, i) => Math.max(max, i.position), 0);
    const created = await prisma.checklistItem.createManyAndReturn({
      data: titles.map((title, i) => ({
        workspaceId: req.workspaceId,
        taskId: task.id,
        title,
        assigneeId,
        dueDate,
        position: last + 1 + i,
        createdById: req.dbUser.id,
      })),
    });

    notifyAssigned(req, task, created);
    await respond(res, task.id, 201);
  } catch (err) {
    next(err);
  }
}

// PATCH /tasks/:id/checklist/:itemId  { title?, done?, assigneeId?, dueDate?, position? }
export async function updateItem(req, res, next) {
  try {
    const task = await loadTask(req);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found.' });
    const item = task.checklist.find((i) => i.id === req.params.itemId);
    if (!item) return res.status(404).json({ error: 'NOT_FOUND', message: 'That item no longer exists.' });

    const me = req.dbUser;
    const editor = canEditTask(me.id, req.orgRole, task);
    const { title, done, assigneeId, dueDate, position } = req.body;
    const onlyToggling = [title, assigneeId, dueDate, position].every((v) => v === undefined);

    if (!editor && !(onlyToggling && canToggleChecklistItem(me.id, req.orgRole, task, item))) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You can only tick off items that are yours.' });
    }

    const data = {};
    if (title !== undefined) {
      const text = typeof title === 'string' ? title.trim() : '';
      if (!text || text.length > MAX_TITLE) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: `An item needs a name (under ${MAX_TITLE} characters).` });
      }
      data.title = text;
    }
    if (done !== undefined && Boolean(done) !== item.done) {
      data.done = Boolean(done);
      data.doneAt = data.done ? new Date() : null;
      data.doneById = data.done ? me.id : null;
    }
    if (assigneeId !== undefined && (assigneeId || null) !== item.assigneeId) {
      const error = await checkAssignee(req, assigneeId || null);
      if (error) return res.status(400).json({ error: 'VALIDATION_ERROR', message: error });
      data.assigneeId = assigneeId || null;
    }
    if (dueDate !== undefined) {
      const parsed = parseDate(dueDate);
      if (parsed === undefined) return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'That due date is not valid.' });
      data.dueDate = parsed;
    }
    if (position !== undefined) {
      if (typeof position !== 'number' || !Number.isFinite(position)) {
        return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'position must be a number.' });
      }
      data.position = position;
    }

    if (Object.keys(data).length) {
      await prisma.checklistItem.update({ where: { id: item.id }, data });
    }

    if (data.done === true) {
      const remaining = task.checklist.filter((i) => !i.done && i.id !== item.id).length;
      logActivitiesInBackground([{
        workspaceId: req.workspaceId,
        type: 'CHECKLIST_ITEM_COMPLETED',
        message: `${me.name} checked off "${data.title ?? item.title}"${remaining === 0 ? ' — checklist complete' : ''}`,
        actorId: me.id,
        taskId: task.id,
        projectId: task.projectId,
      }], me);
    }
    if (data.assigneeId) notifyAssigned(req, task, [{ ...item, ...data }]);

    await respond(res, task.id);
  } catch (err) {
    next(err);
  }
}

// DELETE /tasks/:id/checklist/:itemId
export async function deleteItem(req, res, next) {
  try {
    const task = await loadTask(req);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found.' });
    if (!canEditTask(req.dbUser.id, req.orgRole, task)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You cannot change this task.' });
    }
    const item = task.checklist.find((i) => i.id === req.params.itemId);
    if (!item) return res.status(404).json({ error: 'NOT_FOUND', message: 'That item no longer exists.' });

    await prisma.checklistItem.delete({ where: { id: item.id } });
    await respond(res, task.id);
  } catch (err) {
    next(err);
  }
}
