// Factory: requireRole('org:admin') — gates owner-only routes.
// Must run after requireOrg (needs req.orgRole).
export default function requireRole(role) {
  return (req, res, next) => {
    if (req.orgRole !== role) {
      return res.status(403).json({ error: 'FORBIDDEN', message: 'You do not have permission to perform this action.' });
    }
    next();
  };
}
