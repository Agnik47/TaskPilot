import prisma from '../config/prisma.js';
import clerkClient from '../config/clerk.js';

export async function listMembers(req, res, next) {
  try {
    const { data } = await clerkClient.organizations.getOrganizationMembershipList({
      organizationId: req.workspaceId,
    });

    // One query for all members instead of one per member (N+1).
    const ids = data.map((m) => m.publicUserData.userId);
    const existing = await prisma.user.findMany({ where: { id: { in: ids } } });
    const usersById = new Map(existing.map((u) => [u.id, u]));

    // Mirror any members we haven't seen locally yet, in a single insert.
    const missing = data
      .filter((m) => !usersById.has(m.publicUserData.userId))
      .map((m) => ({
        id: m.publicUserData.userId,
        name:
          `${m.publicUserData.firstName ?? ''} ${m.publicUserData.lastName ?? ''}`.trim() ||
          m.publicUserData.identifier ||
          'Unknown',
        email: m.publicUserData.identifier ?? '',
        image: m.publicUserData.imageUrl ?? '',
      }));

    if (missing.length) {
      await prisma.user.createMany({ data: missing, skipDuplicates: true });
      missing.forEach((u) => usersById.set(u.id, u));
    }

    const members = data.map((m) => {
      const user = usersById.get(m.publicUserData.userId);
      return { id: user.id, name: user.name, email: user.email, image: user.image, role: m.role };
    });

    res.json(members);
  } catch (err) {
    next(err);
  }
}
