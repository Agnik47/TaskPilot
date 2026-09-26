// Shared Prisma fragments for task blockers.

const publicUser = { select: { id: true, name: true, email: true, image: true } };

// Open blockers with the people involved, oldest first. Included on every task
// the API returns, so lists can show "Waiting on …" without another request.
export const openBlockersInclude = {
  where: { resolvedAt: null },
  include: { waitingOn: publicUser, createdBy: publicUser },
  orderBy: { createdAt: 'asc' },
};

// Minimal form for access checks (who is being waited on).
export const openBlockersAccessSelect = {
  where: { resolvedAt: null },
  select: { waitingOnId: true },
};

export const NUDGE_COOLDOWN_MS = 4 * 60 * 60 * 1000; // one reminder per 4 hours
