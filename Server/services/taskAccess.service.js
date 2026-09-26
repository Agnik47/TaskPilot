import clerkClient from '../config/clerk.js';
import { openBlockersAccessSelect } from './blockers.service.js';

// Who a task involves beyond its creator and assignee: people it's waiting on
// (open blockers) and owners of its checklist items. They can see the task.
// Spread into a Prisma `select` used for access checks.
export const taskAccessSelect = {
  blockers: openBlockersAccessSelect,
  checklist: { where: { assigneeId: { not: null } }, select: { assigneeId: true } },
};

const publicUser = { select: { id: true, name: true, email: true, image: true } };

// Checklist items in their manual order, with who owns / ticked each one.
export const checklistInclude = {
  orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
  include: { assignee: publicUser, doneBy: { select: { id: true, name: true } } },
};

export async function isOrgMember(organizationId, userId) {
  const { data } = await clerkClient.organizations.getOrganizationMembershipList({ organizationId, limit: 500 });
  return data.some((m) => m.publicUserData?.userId === userId);
}
