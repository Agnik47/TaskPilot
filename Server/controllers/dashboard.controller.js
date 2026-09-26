import prisma from '../config/prisma.js';
import clerkClient from '../config/clerk.js';
import { isOwner } from '../services/authorization.service.js';

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export async function getSummary(req, res, next) {
  try {
    const scoped = isOwner(req.orgRole) ? { workspaceId: req.workspaceId } : { workspaceId: req.workspaceId, assigneeId: req.dbUser.id };

    // The task scan and the (owner-only) Clerk member count are independent
    // network calls, so issue them together.
    const [tasks, memberships] = await Promise.all([
      prisma.task.findMany({ where: scoped, select: { status: true, due_date: true, assigneeId: true } }),
      isOwner(req.orgRole)
        ? clerkClient.organizations.getOrganizationMembershipList({ organizationId: req.workspaceId })
        : null,
    ]);

    const now = new Date();
    const todayStart = startOfDay(now);
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const weekEnd = new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    const counts = { TODO: 0, IN_PROGRESS: 0, BLOCKED: 0, IN_REVIEW: 0, DONE: 0 };
    let overdue = 0;
    let dueToday = 0;
    let dueSoon = 0;

    for (const t of tasks) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;

      if (t.due_date && t.status !== 'DONE' && t.status !== 'IN_REVIEW') {
        const due = new Date(t.due_date);
        if (due < todayStart) overdue += 1;
        else if (due >= todayStart && due < todayEnd) dueToday += 1;
        else if (due >= todayEnd && due < weekEnd) dueSoon += 1;
      }
    }

    const summary = {
      total: tasks.length,
      completed: counts.DONE,
      inProgress: counts.IN_PROGRESS,
      blocked: counts.BLOCKED,
      inReview: counts.IN_REVIEW,
      todo: counts.TODO,
      overdue,
      dueToday,
      dueSoon,
    };

    if (isOwner(req.orgRole)) {
      summary.employeeCount = memberships.data.length;

      const workload = {};
      for (const t of tasks) {
        if (t.status === 'DONE' || t.status === 'IN_REVIEW') continue;
        workload[t.assigneeId] = (workload[t.assigneeId] ?? 0) + 1;
      }
      summary.workloadByAssignee = workload;
    }

    res.json(summary);
  } catch (err) {
    next(err);
  }
}
