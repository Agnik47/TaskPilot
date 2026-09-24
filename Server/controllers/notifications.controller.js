import prisma from '../config/prisma.js';

const PAGE_SIZE = 30;

// Every query is scoped to the caller + active workspace, so users only ever
// see or change their own notifications.
const ownedBy = (req) => ({ userId: req.dbUser.id, workspaceId: req.workspaceId });

export async function listNotifications(req, res, next) {
  try {
    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where: ownedBy(req),
        include: { actor: { select: { id: true, name: true, image: true } } },
        orderBy: { createdAt: 'desc' },
        take: PAGE_SIZE,
      }),
      prisma.notification.count({ where: { ...ownedBy(req), readAt: null } }),
    ]);

    res.json({ items, unreadCount });
  } catch (err) {
    next(err);
  }
}

export async function markRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { ...ownedBy(req), id: req.params.id, readAt: null },
      data: { readAt: new Date() },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

export async function markAllRead(req, res, next) {
  try {
    await prisma.notification.updateMany({
      where: { ...ownedBy(req), readAt: null },
      data: { readAt: new Date() },
    });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
