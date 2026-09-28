// Task completion workflow — the single source of truth for status changes.
//
//   An owner assigns a task to an employee. When the employee finishes it,
//   "Done" becomes IN_REVIEW; an owner then approves it (-> DONE) or requests
//   changes (-> IN_PROGRESS). Tasks people create for themselves, and anything
//   an owner completes, skip review. Owners can switch the rule off per
//   workspace (settings.requireApproval).
//
//   Review is also opt-in: an employee can send any of their tasks (e.g. one
//   they created themselves) for review by picking "In Review". It then works
//   like required review until an owner decides or the employee withdraws it.
//
// planStatusChange is pure (no I/O) so every rule is unit-testable; callers
// persist `data` and act on `event`.

export const STATUSES = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'IN_REVIEW', 'DONE'];

// Assigned by someone else (employees can only assign themselves, so in
// practice: an owner assigned it) and the workspace requires approval.
export function needsApproval(task, settings) {
  return settings.requireApproval !== false && task.creatorId !== task.assigneeId;
}

/**
 * @returns {{ error: string } | { noop: true } | { data: object, event: string }}
 * events: STATUS_CHANGED | COMPLETED | SUBMITTED | APPROVED | CHANGES_REQUESTED | WITHDRAWN
 */
export function planStatusChange({ task, requested, actorIsOwner, settings, now = new Date() }) {
  if (!STATUSES.includes(requested)) return { error: 'Invalid status.' };

  const from = task.status;
  const approval = needsApproval(task, settings);

  // "In Review" means "Done, pending sign-off": it's what "Done" becomes for
  // work that needs approval, and employees can also ask for it on work that
  // doesn't. Owners are the approvers, so they never submit.
  let target = requested;
  let optIn = false;
  if (target === 'IN_REVIEW') {
    if (actorIsOwner) return { error: 'Owners approve work rather than send it for review — mark it Done instead.' };
    optIn = !approval;
    target = 'DONE';
  }

  if (target === from) return { noop: true };

  if (target === 'DONE') {
    if (actorIsOwner) {
      return {
        data: { status: 'DONE', completedAt: now, submittedAt: null },
        event: from === 'IN_REVIEW' ? 'APPROVED' : 'COMPLETED',
      };
    }
    // Waiting for an owner: only they can finish it (the employee can withdraw).
    if (from === 'IN_REVIEW') return { noop: true };
    if (approval || optIn) {
      return { data: { status: 'IN_REVIEW', submittedAt: now, completedAt: null }, event: 'SUBMITTED' };
    }
    return { data: { status: 'DONE', completedAt: now, submittedAt: null }, event: 'COMPLETED' };
  }

  // Moving to TODO / IN_PROGRESS / BLOCKED.
  if (from === 'DONE' && approval && !actorIsOwner) {
    return { error: 'This task was approved by an owner — only an owner can reopen it.' };
  }

  const data = { status: target, completedAt: null, submittedAt: null };
  if (from === 'IN_REVIEW') return { data, event: actorIsOwner ? 'CHANGES_REQUESTED' : 'WITHDRAWN' };
  return { data, event: 'STATUS_CHANGED' };
}

const LABELS = { TODO: 'To Do', IN_PROGRESS: 'In Progress', BLOCKED: 'Blocked', IN_REVIEW: 'In Review', DONE: 'Done' };

/**
 * Activity rows and notifications for a planned change.
 * `note` is the optional "request changes" message (already saved as a comment).
 * `reviewerIds`: who to ask on SUBMITTED — defaults to the task's creator (the
 * owner who assigned it); pass the workspace owners when the employee created
 * it themselves.
 */
export function describeStatusEvent({ event, task, actor, from, to, note, reviewerIds = [task.creatorId] }) {
  const who = actor.name;
  const activities = [];
  const notifications = [];

  switch (event) {
    case 'STATUS_CHANGED':
      activities.push({ type: 'STATUS_CHANGED', message: `${who} changed status from ${LABELS[from]} to ${LABELS[to]}`, metadata: { from, to } });
      break;
    case 'COMPLETED':
      activities.push({ type: 'STATUS_CHANGED', message: `${who} changed status from ${LABELS[from]} to Done`, metadata: { from, to } });
      activities.push({ type: 'TASK_COMPLETED', message: `${who} completed this task` });
      break;
    case 'SUBMITTED':
      activities.push({ type: 'SUBMITTED_FOR_REVIEW', message: `${who} marked this done and sent it for review`, metadata: { from, to } });
      // The owner who assigned it reviews it (any owner may approve).
      for (const userId of reviewerIds) {
        notifications.push({ userId, type: 'REVIEW_REQUESTED', message: `${who} finished "${task.title}" — ready for your review` });
      }
      break;
    case 'APPROVED':
      activities.push({ type: 'TASK_APPROVED', message: `${who} approved this task`, metadata: { from, to } });
      activities.push({ type: 'TASK_COMPLETED', message: `"${task.title}" is done` });
      notifications.push({ userId: task.assigneeId, type: 'TASK_APPROVED', message: `${who} approved "${task.title}"` });
      break;
    case 'CHANGES_REQUESTED':
      activities.push({ type: 'CHANGES_REQUESTED', message: `${who} requested changes`, metadata: { from, to, note: note || undefined } });
      notifications.push({
        userId: task.assigneeId,
        type: 'CHANGES_REQUESTED',
        message: note ? `${who} requested changes on "${task.title}": ${note.length > 80 ? `${note.slice(0, 80)}…` : note}` : `${who} requested changes on "${task.title}"`,
      });
      break;
    case 'WITHDRAWN':
      activities.push({ type: 'STATUS_CHANGED', message: `${who} withdrew the review request (now ${LABELS[to]})`, metadata: { from, to } });
      break;
    default:
  }

  return { activities, notifications };
}
