import prisma from '../config/prisma.js';
import clerkClient from '../config/clerk.js';
import { logActivitiesInBackground } from '../services/activity.service.js';
import { notifyInBackground } from '../services/notifications.service.js';
import { canEditTask, canResolveBlocker } from '../services/authorization.service.js';
import { NUDGE_COOLDOWN_MS } from '../services/blockers.service.js';
import { emitToTask } from '../realtime.js';
import { taskInclude } from './tasks.controller.js';

// "Waiting on someone": a task is blocked until a person (anyone in the
// organization) does something. The task's people add blockers and can nudge;
// the person waited on (or the task's people) resolves them. Adding the first
// blocker moves the task to Blocked; resolving the last one moves it back to
// In Progress.

const MAX_REASON = 500;
const MAX_NOTE = 2000;

const short = (text, n = 80) => (text.length > n ? `${text.slice(0, n)}…` : text);

async function isOrgMember(organizationId, userId) {
  const { data } = await clerkClient.organizations.getOrganizationMembershipList({ organizationId, limit: 500 });
  return data.some((m) => m.publicUserData?.userId === userId);
}

async function loadTask(req) {
  const task = await prisma.task.findUnique({ where: { id: req.params.id }, include: taskInclude });
  return task && task.workspaceId === req.workspaceId ? task : null;
}

const reload = (taskId) => prisma.task.findUnique({ where: { id: taskId }, include: taskInclude });

function scoped(req, task, rows) {
  return rows.map((r) => ({ ...r, workspaceId: req.workspaceId, taskId: task.id, projectId: task.projectId }));
}

export async function addBlocker(req, res, next) {
  try {
    const waitingOnId = typeof req.body.waitingOnId === 'string' ? req.body.waitingOnId : '';
    const reason = typeof req.body.reason === 'string' ? req.body.reason.trim() : '';

    if (!waitingOnId || !reason) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Choose who you are waiting on and say what you need.' });
    }
    if (reason.length > MAX_REASON) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: `Keep the reason under ${MAX_REASON} characters.` });
    }
    if (waitingOnId === req.dbUser.id) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: "You can't be blocked by yourself." });
    }

    const task = await loadTask(req);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found.' });
    if (!canEditTask(req.dbUser.id, req.orgRole, task)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You cannot change this task.' });
    }
    if (task.status === 'DONE' || task.status === 'IN_REVIEW') {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'This task is already finished.' });
    }
    const duplicate = task.blockers.find((b) => b.waitingOnId === waitingOnId);
    if (duplicate) {
      return res.status(409).json({ error: 'ALREADY_WAITING', message: `You're already waiting on ${duplicate.waitingOn.name} for this task.` });
    }

    const [person, member] = await Promise.all([
      prisma.user.findUnique({ where: { id: waitingOnId }, select: { id: true, name: true } }),
      isOrgMember(req.workspaceId, waitingOnId),
    ]);
    if (!person || !member) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'That person is not in this organization.' });
    }

    const becomesBlocked = task.status !== 'BLOCKED';
    await prisma.$transaction([
      prisma.taskBlocker.create({
        data: { workspaceId: req.workspaceId, taskId: task.id, waitingOnId, reason, createdById: req.dbUser.id },
      }),
      ...(becomesBlocked ? [prisma.task.update({ where: { id: task.id }, data: { status: 'BLOCKED', completedAt: null, submittedAt: null } })] : []),
    ]);

    const me = req.dbUser;
    const activities = [];
    if (becomesBlocked) {
      activities.push({ type: 'STATUS_CHANGED', message: `${me.name} marked this Blocked`, metadata: { from: task.status, to: 'BLOCKED' } });
    }
    activities.push({ type: 'BLOCKER_ADDED', message: `${me.name} is waiting on ${person.name}: ${reason}`, metadata: { waitingOnId, reason } });
    logActivitiesInBackground(scoped(req, task, activities.map((a) => ({ ...a, actorId: me.id }))), me);

    notifyInBackground(scoped(req, task, [{
      userId: waitingOnId,
      type: 'BLOCKER_ADDED',
      message: `${me.name} is waiting on you for "${task.title}": ${short(reason)}`,
    }]), me);

    res.status(201).json(await reload(task.id));
  } catch (err) {
    next(err);
  }
}

export async function resolveBlocker(req, res, next) {
  try {
    const note = typeof req.body?.note === 'string' ? req.body.note.trim().slice(0, MAX_NOTE) : '';

    const task = await loadTask(req);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found.' });

    const blocker = await prisma.taskBlocker.findUnique({ where: { id: req.params.blockerId }, include: { waitingOn: true } });
    if (!blocker || blocker.taskId !== task.id) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Blocker not found.' });
    }
    if (blocker.resolvedAt) {
      return res.status(409).json({ error: 'ALREADY_RESOLVED', message: 'This is already unblocked.' });
    }
    if (!canResolveBlocker(req.dbUser.id, req.orgRole, task, blocker)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You cannot resolve this.' });
    }

    const me = req.dbUser;
    const lastOne = task.blockers.every((b) => b.id === blocker.id);
    const backToWork = lastOne && task.status === 'BLOCKED';

    const [, , comment] = await Promise.all([
      prisma.taskBlocker.update({
        where: { id: blocker.id },
        data: { resolvedAt: new Date(), resolvedById: me.id, resolutionNote: note || null },
      }),
      backToWork ? prisma.task.update({ where: { id: task.id }, data: { status: 'IN_PROGRESS' } }) : null,
      note ? prisma.comment.create({ data: { workspaceId: req.workspaceId, content: note, userId: me.id, taskId: task.id } }) : null,
    ]);
    if (comment) emitToTask(task.id, 'comment:new', { ...comment, user: me });

    const byWaitedOn = blocker.waitingOnId === me.id;
    const activities = [{
      type: 'BLOCKER_RESOLVED',
      message: byWaitedOn ? `${me.name} unblocked this` : `${me.name} is no longer waiting on ${blocker.waitingOn.name}`,
      metadata: { waitingOnId: blocker.waitingOnId, note: note || undefined },
    }];
    if (backToWork) {
      activities.push({ type: 'STATUS_CHANGED', message: 'Moved back to In Progress — nothing left blocking it', metadata: { from: 'BLOCKED', to: 'IN_PROGRESS' } });
    }
    logActivitiesInBackground(scoped(req, task, activities.map((a) => ({ ...a, actorId: me.id }))), me);

    // Tell the task's people it can move again; tell the person waited on
    // they're off the hook if someone else closed it.
    const message = byWaitedOn
      ? `${me.name} unblocked "${task.title}"${note ? `: ${short(note)}` : ''}`
      : `${me.name} is no longer waiting on ${blocker.waitingOn.name} for "${task.title}"`;
    const recipients = new Set([task.assigneeId, task.creatorId]);
    const notifications = [...recipients].map((userId) => ({ userId, type: 'BLOCKER_RESOLVED', message }));
    if (!byWaitedOn) {
      notifications.push({ userId: blocker.waitingOnId, type: 'BLOCKER_RESOLVED', message: `${me.name} no longer needs you on "${task.title}"` });
    }
    notifyInBackground(scoped(req, task, notifications), me);

    res.json(await reload(task.id));
  } catch (err) {
    next(err);
  }
}

export async function nudgeBlocker(req, res, next) {
  try {
    const task = await loadTask(req);
    if (!task) return res.status(404).json({ error: 'NOT_FOUND', message: 'Task not found.' });
    if (!canEditTask(req.dbUser.id, req.orgRole, task)) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You cannot change this task.' });
    }

    const blocker = task.blockers.find((b) => b.id === req.params.blockerId);
    if (!blocker) return res.status(404).json({ error: 'NOT_FOUND', message: 'This blocker is already resolved.' });

    // They were notified when it was added; after that, at most one reminder per cooldown.
    const last = new Date(blocker.lastNudgedAt || blocker.createdAt).getTime();
    const waitMs = last + NUDGE_COOLDOWN_MS - Date.now();
    if (waitMs > 0) {
      const hours = Math.ceil(waitMs / (60 * 60 * 1000));
      return res.status(429).json({
        error: 'TOO_SOON',
        message: `${blocker.waitingOn.name} was notified recently. You can nudge again in ${hours === 1 ? 'about an hour' : `${hours} hours`}.`,
      });
    }

    await prisma.taskBlocker.update({ where: { id: blocker.id }, data: { lastNudgedAt: new Date() } });

    const days = Math.floor((Date.now() - new Date(blocker.createdAt).getTime()) / (24 * 60 * 60 * 1000));
    const since = days >= 1 ? ` (${days} ${days === 1 ? 'day' : 'days'} so far)` : '';
    notifyInBackground(scoped(req, task, [{
      userId: blocker.waitingOnId,
      type: 'BLOCKER_NUDGE',
      message: `Reminder: ${req.dbUser.name} is still waiting on you for "${task.title}"${since}: ${short(blocker.reason)}`,
    }]), req.dbUser);

    res.json(await reload(task.id));
  } catch (err) {
    next(err);
  }
}
