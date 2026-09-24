import { getAuth } from '@clerk/express';
import prisma from '../config/prisma.js';
import clerkClient from '../config/clerk.js';

// Every API request runs through here, so the local user row is cached
// in-process to avoid a DB round trip per request. The row only mirrors
// name/email/image, so a few minutes of staleness is harmless.
const USER_CACHE_TTL_MS = 10 * 60 * 1000;
const userCache = new Map(); // userId -> { user, expiresAt }

// Just-in-time local User upsert. Clerk is the source of truth for identity;
// we only mirror the minimum fields locally so Task/Comment/Activity can hold
// real relational foreign keys. Runs once per user (cheap after first sight).
export default async function syncUser(req, res, next) {
  try {
    const { userId } = getAuth(req);

    const cached = userCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
      req.dbUser = cached.user;
      return next();
    }

    let user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      const cu = await clerkClient.users.getUser(userId);
      const email =
        cu.emailAddresses.find((e) => e.id === cu.primaryEmailAddressId)?.emailAddress ??
        cu.emailAddresses[0]?.emailAddress ??
        '';

      user = await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
          id: userId,
          name: `${cu.firstName ?? ''} ${cu.lastName ?? ''}`.trim() || cu.username || 'Unknown',
          email,
          image: cu.imageUrl ?? '',
        },
      });
    }

    userCache.set(userId, { user, expiresAt: Date.now() + USER_CACHE_TTL_MS });
    req.dbUser = user;
    next();
  } catch (err) {
    next(err);
  }
}
