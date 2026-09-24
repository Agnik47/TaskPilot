import prisma from '../config/prisma.js';
import { emitToTask } from '../realtime.js';

// Writes several activity rows in one INSERT without holding up the response.
// The activity feed is an audit trail, not part of the user's write: if this
// insert fails, the task/comment change still stands and the error is logged.
// Once stored, rows are pushed live to anyone viewing the task. `actor` is the
// user who acted (always the caller), attached so clients get the same shape
// as GET /tasks/:id/activity.
export function logActivitiesInBackground(rows, actor) {
  if (!rows.length) return;

  prisma.activity
    .createManyAndReturn({
      data: rows.map(({ workspaceId, type, message, metadata, actorId, taskId, projectId }) => ({
        workspaceId, type, message, metadata, actorId, taskId, projectId,
      })),
    })
    .then((created) => {
      for (const row of created) {
        if (row.taskId) emitToTask(row.taskId, 'activity:new', { ...row, actor });
      }
    })
    .catch((err) => console.error('Failed to log activity:', err));
}
