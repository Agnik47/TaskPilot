import prisma from '../config/prisma.js';
import { isOwner, isTaskVisibleTo } from '../services/authorization.service.js';
import { openBlockersAccessSelect } from '../services/blockers.service.js';

export async function listTaskActivity(req, res, next) {
  try {
    // Access check and activity read are independent; run them in parallel
    // and only return the activity once access is confirmed.
    const [task, activity] = await Promise.all([
      prisma.task.findUnique({
        where: { id: req.params.id },
        select: { id: true, workspaceId: true, creatorId: true, assigneeId: true, blockers: openBlockersAccessSelect },
      }),
      prisma.activity.findMany({
        where: { taskId: req.params.id },
        include: { actor: true },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    if (!task || task.workspaceId !== req.workspaceId) {
      return res.status(404).json({ error: 'NOT_FOUND' });
    }
    if (!isTaskVisibleTo(req.dbUser.id, req.orgRole, task)) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    res.json(activity);
  } catch (err) {
    next(err);
  }
}

// Workspace-wide recent activity feed: owner sees everything, employees see
// only activity they generated or that touches their own tasks.
export async function listWorkspaceActivity(req, res, next) {
  try {
    const where = { workspaceId: req.workspaceId };

    if (!isOwner(req.orgRole)) {
      where.OR = [
        { actorId: req.dbUser.id },
        { task: { OR: [{ creatorId: req.dbUser.id }, { assigneeId: req.dbUser.id }] } },
      ];
    }

    const activity = await prisma.activity.findMany({
      where,
      include: { actor: true, task: { select: { id: true, title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    res.json(activity);
  } catch (err) {
    next(err);
  }
}
