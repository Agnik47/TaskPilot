import clerkClient from '../config/clerk.js';
import { isOwner } from './authorization.service.js';

// Ids of the workspace's owners (Clerk org admins), e.g. to ask them for a
// review. Best effort: on a Clerk error it returns [] so the change that
// needed them still goes through (only the notification is lost, and logged).
export async function workspaceOwnerIds(workspaceId) {
  try {
    const { data } = await clerkClient.organizations.getOrganizationMembershipList({ organizationId: workspaceId, limit: 100 });
    return data.filter((m) => isOwner(m.role)).map((m) => m.publicUserData.userId);
  } catch (err) {
    console.error('Failed to load workspace owners:', err);
    return [];
  }
}
