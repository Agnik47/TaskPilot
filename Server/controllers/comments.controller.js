import prisma from '../config/prisma.js';
import { logActivitiesInBackground } from '../services/activity.service.js';
import { isTaskVisibleTo } from '../services/authorization.service.js';
import { emitToTask } from '../realtime.js';
import { notifyInBackground } from '../services/notifications.service.js';
import { sanitizeMentions } from '../services/mentions.service.js';
import { openBlockersAccessSelect } from '../services/blockers.service.js';

function checkTaskAccess(req, task) {
  if (!task || task.workspaceId !== req.workspaceId) return 404;
  if (!isTaskVisibleTo(req.dbUser.id, req.orgRole, task)) return 403;
  return null;
}

const accessTaskSelect = { id: true, workspaceId: true, projectId: true, creatorId: true, assigneeId: true, blockers: openBlockersAccessSelect };

export async function listComments(req, res, next) {
  try {
    // The access check and the comment read are independent, so run them in
    // parallel; comments are only returned once access is confirmed.
    const [task, comments] = await Promise.all([
      prisma.task.findUnique({ where: { id: req.params.id }, select: accessTaskSelect }),
      prisma.comment.findMany({
        where: { taskId: req.params.id },
        include: { user: true },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const error = checkTaskAccess(req, task);
    if (error) return res.status(error).json({ error: error === 404 ? 'NOT_FOUND' : 'FORBIDDEN' });

    res.json(comments);
  } catch (err) {
    next(err);
  }
}

export async function createComment(req, res, next) {
  try {
    const { content } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Comment content is required.' });
    }

    // Creator/assignee come back in the same (joined) query; they're the
    // people who can be @mentioned on this task.
    const task = await prisma.task.findUnique({
      where: { id: req.params.id },
      select: {
        ...accessTaskSelect,
        title: true,
        creator: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true } },
        // People the task is waiting on can be @mentioned too.
        blockers: { where: { resolvedAt: null }, select: { waitingOnId: true, waitingOn: { select: { id: true, name: true } } } },
      },
    });
    const error = checkTaskAccess(req, task);
    if (error) return res.status(error).json({ error: error === 404 ? 'NOT_FOUND' : 'FORBIDDEN' });

    const { content: safeContent, mentioned } = sanitizeMentions(content, { task, authorId: req.dbUser.id });

    // No `include: { user }` — the author is the caller, already loaded.
    const created = await prisma.comment.create({
      data: { workspaceId: req.workspaceId, content: safeContent, userId: req.dbUser.id, taskId: task.id },
    });

    logActivitiesInBackground([{
      workspaceId: req.workspaceId,
      type: 'COMMENT_ADDED',
      message: `${req.dbUser.name} commented on this task`,
      actorId: req.dbUser.id,
      taskId: task.id,
      projectId: task.projectId,
    }], req.dbUser);

    const comment = { ...created, user: req.dbUser };
    // Everyone viewing this task (including the author's other tabs) gets it
    // live; clients de-duplicate by comment id.
    emitToTask(task.id, 'comment:new', comment);

    // Notify mentioned people wherever they are in the app.
    notifyInBackground(
      mentioned.map((user) => ({
        workspaceId: req.workspaceId,
        userId: user.id,
        type: 'MENTION',
        message: `${req.dbUser.name} mentioned you in "${task.title}"`,
        taskId: task.id,
        projectId: task.projectId,
      })),
      req.dbUser
    );

    res.status(201).json(comment);
  } catch (err) {
    next(err);
  }
}
