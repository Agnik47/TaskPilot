import { getAuth } from '@clerk/express';

// Ensures the caller has an active Clerk organization selected. All workspace
// data is scoped by organization id, so nothing downstream can run without one.
export default function requireOrg(req, res, next) {
  const { orgId, orgRole } = getAuth(req);

  if (!orgId) {
    return res.status(400).json({ error: 'NO_ACTIVE_ORG', message: 'No active workspace selected.' });
  }

  req.workspaceId = orgId;
  req.orgRole = orgRole;
  next();
}
