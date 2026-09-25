import clerkClient from '../config/clerk.js';

// Workspace-level preferences live in the Clerk organization's publicMetadata
// (Clerk already owns the workspace record), so no local table is needed.
// Task rules (e.g. whether completion needs approval) read these on the
// request path, so they're cached in-process briefly instead of calling Clerk
// every time; saving settings refreshes the cache immediately.
export const DEFAULT_SETTINGS = {
  defaultTaskPriority: 'MEDIUM',
  defaultTaskType: 'TASK',
  weekStartsOn: 0, // 0 = Sunday, 1 = Monday
  defaultTaskView: 'table', // 'table' | 'sheet' — how a project's tasks open
  requireApproval: true, // tasks assigned by someone else need an owner to approve completion
};

const CACHE_TTL_MS = 60 * 1000;
const cache = new Map(); // workspaceId -> { settings, expiresAt }

const merge = (stored) => ({ ...DEFAULT_SETTINGS, ...(stored || {}) });

const RETRY_AFTER_FAILURE_MS = 10 * 1000;

export async function getWorkspaceSettings(workspaceId) {
  const hit = cache.get(workspaceId);
  if (hit && hit.expiresAt > Date.now()) return hit.settings;

  try {
    const org = await clerkClient.organizations.getOrganization({ organizationId: workspaceId });
    const settings = merge(org.publicMetadata?.settings);
    cache.set(workspaceId, { settings, expiresAt: Date.now() + CACHE_TTL_MS });
    return settings;
  } catch (err) {
    // Core task actions shouldn't fail because Clerk is briefly unreachable:
    // use the last known settings (or the defaults, where approval is on —
    // the stricter choice) and try Clerk again shortly.
    console.error(`Workspace settings unavailable for ${workspaceId}, using ${hit ? 'last known' : 'default'} settings:`, err.message);
    const fallback = hit?.settings ?? merge();
    cache.set(workspaceId, { settings: fallback, expiresAt: Date.now() + RETRY_AFTER_FAILURE_MS });
    return fallback;
  }
}

export async function saveWorkspaceSettings(workspaceId, changes) {
  const org = await clerkClient.organizations.getOrganization({ organizationId: workspaceId });
  const settings = { ...merge(org.publicMetadata?.settings), ...changes };
  await clerkClient.organizations.updateOrganizationMetadata(workspaceId, { publicMetadata: { settings } });
  cache.set(workspaceId, { settings, expiresAt: Date.now() + CACHE_TTL_MS });
  return settings;
}
