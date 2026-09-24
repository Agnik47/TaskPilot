import { getAuth } from '@clerk/express';

// @clerk/express's own requireAuth() redirects unauthenticated requests to a
// sign-in URL, which is wrong for a JSON API — we want a 401 body instead.
export default function requireAuth(req, res, next) {
  const { userId } = getAuth(req);

  if (!userId) {
    return res.status(401).json({ error: 'UNAUTHENTICATED', message: 'Sign in required.' });
  }

  next();
}
