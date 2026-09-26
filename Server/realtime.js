import { Server } from 'socket.io';
import { verifyToken } from '@clerk/backend';
import prisma from './config/prisma.js';
import { isTaskVisibleTo } from './services/authorization.service.js';
import { taskAccessSelect } from './services/taskAccess.service.js';

// Realtime layer for task discussions. Writes still go through the REST API
// (single place for validation + authorization); sockets only fan changes out
// to people currently viewing the same task, plus ephemeral typing/presence.
//
// Rooms: `task:<taskId>` — joined only after the same visibility check the
// REST endpoints use. One process holds all rooms in memory, which is plenty
// for ~200 concurrent users; running several instances would need a shared
// adapter (e.g. @socket.io/redis-adapter).

let io = null;

const room = (taskId) => `task:${taskId}`;
// Personal room for direct notifications, scoped to the workspace the socket
// authenticated with so a user only hears about their active workspace.
const userRoom = (workspaceId, userId) => `user:${workspaceId}:${userId}`;

// Session tokens come in two claim formats (v1: org_id/org_role, v2: o.id/o.rol).
function orgFromClaims(claims) {
  if (claims.o?.id) {
    const rol = claims.o.rol;
    return { orgId: claims.o.id, orgRole: rol && !rol.startsWith('org:') ? `org:${rol}` : rol };
  }
  return { orgId: claims.org_id, orgRole: claims.org_role };
}

async function authenticate(socket, next) {
  try {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('UNAUTHENTICATED'));

    const claims = await verifyToken(token, { secretKey: process.env.CLERK_SECRET_KEY });
    const { orgId, orgRole } = orgFromClaims(claims);
    if (!orgId) return next(new Error('NO_ACTIVE_ORG'));

    const user = await prisma.user.findUnique({
      where: { id: claims.sub },
      select: { id: true, name: true, image: true },
    });
    if (!user) return next(new Error('UNKNOWN_USER'));

    socket.data = { user, workspaceId: orgId, orgRole };
    next();
  } catch {
    next(new Error('UNAUTHENTICATED'));
  }
}

// Distinct users currently in a task room (a user may have several tabs open).
async function broadcastPresence(taskId) {
  const sockets = await io.in(room(taskId)).fetchSockets();
  const viewers = new Map(sockets.map((s) => [s.data.user.id, s.data.user]));
  io.to(room(taskId)).emit('presence', { taskId, viewers: [...viewers.values()] });
}

export function initRealtime(httpServer) {
  io = new Server(httpServer, { cors: { origin: true } });
  io.use(authenticate);

  io.on('connection', (socket) => {
    const { user, workspaceId, orgRole } = socket.data;
    socket.join(userRoom(workspaceId, user.id));

    socket.on('task:join', async ({ taskId } = {}, ack = () => {}) => {
      try {
        const task = await prisma.task.findUnique({
          where: { id: String(taskId) },
          select: { id: true, workspaceId: true, creatorId: true, assigneeId: true, ...taskAccessSelect },
        });
        if (!task || task.workspaceId !== workspaceId) return ack({ ok: false, error: 'NOT_FOUND' });
        if (!isTaskVisibleTo(user.id, orgRole, task)) return ack({ ok: false, error: 'FORBIDDEN' });

        await socket.join(room(task.id));
        ack({ ok: true });
        broadcastPresence(task.id);
      } catch (err) {
        console.error('task:join failed:', err);
        ack({ ok: false, error: 'SERVER_ERROR' });
      }
    });

    socket.on('task:leave', async ({ taskId } = {}) => {
      if (!socket.rooms.has(room(taskId))) return;
      await socket.leave(room(taskId));
      socket.to(room(taskId)).emit('typing', { taskId, user, isTyping: false });
      broadcastPresence(taskId);
    });

    // Typing is only relayed within rooms the socket was authorized to join.
    socket.on('typing', ({ taskId, isTyping } = {}) => {
      if (!socket.rooms.has(room(taskId))) return;
      socket.to(room(taskId)).emit('typing', { taskId, user, isTyping: !!isTyping });
    });

    // `disconnecting` still has the socket's rooms; refresh presence after it leaves.
    socket.on('disconnecting', () => {
      const taskIds = [...socket.rooms].filter((r) => r.startsWith('task:')).map((r) => r.slice(5));
      for (const taskId of taskIds) {
        socket.to(room(taskId)).emit('typing', { taskId, user, isTyping: false });
      }
      setImmediate(() => taskIds.forEach(broadcastPresence));
    });
  });

  return io;
}

// Called by REST controllers after a successful write.
export function emitToTask(taskId, event, payload) {
  io?.to(room(taskId)).emit(event, payload);
}

export function emitToUser(workspaceId, userId, event, payload) {
  io?.to(userRoom(workspaceId, userId)).emit(event, payload);
}
