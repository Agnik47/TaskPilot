import prisma from '../config/prisma.js';
import { emitToUser } from '../realtime.js';

// Stores notifications in one INSERT without holding up the response, then
// pushes each to its recipient live. Like the activity log, a failure here
// never undoes the task/comment change that triggered it; it's logged instead.
// `actor` is the user who acted (always the caller), attached so the payload
// matches GET /api/notifications items.
export function notifyInBackground(rows, actor) {
  const recipients = rows.filter((r) => r.userId && r.userId !== actor.id);
  if (!recipients.length) return;

  prisma.notification
    .createManyAndReturn({
      data: recipients.map(({ workspaceId, userId, type, message, taskId, projectId }) => ({
        workspaceId, userId, actorId: actor.id, type, message, taskId, projectId,
      })),
    })
    .then((created) => {
      const publicActor = { id: actor.id, name: actor.name, image: actor.image };
      for (const n of created) {
        emitToUser(n.workspaceId, n.userId, 'notification:new', { ...n, actor: publicActor });
      }
    })
    .catch((err) => console.error('Failed to create notifications:', err));
}
