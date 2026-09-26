const OWNER_ROLE = 'org:admin';

export function isOwner(orgRole) {
  return orgRole === OWNER_ROLE;
}

// Someone a task is waiting on (an open blocker) can see it, even from outside
// the project, so they have the context to unblock it. Needs `task.blockers`
// (open ones) loaded; without it this is simply false.
export function isWaitingOn(dbUserId, task) {
  return !!task.blockers?.some((b) => b.waitingOnId === dbUserId && !b.resolvedAt);
}

// Employees only ever see/manage tasks they created or are assigned to, plus
// tasks that are waiting on them.
export function isTaskVisibleTo(dbUserId, orgRole, task) {
  if (isOwner(orgRole)) return true;
  return task.creatorId === dbUserId || task.assigneeId === dbUserId || isWaitingOn(dbUserId, task);
}

export function filterTasksForRole(dbUserId, orgRole, tasks) {
  if (isOwner(orgRole)) return tasks;
  return tasks.filter((t) => isTaskVisibleTo(dbUserId, orgRole, t));
}

// Enforces PRD task-creation rules: employees can never assign to someone else,
// even if the request body says otherwise.
export function resolveAssigneeId(dbUserId, orgRole, requestedAssigneeId) {
  if (isOwner(orgRole)) return requestedAssigneeId || dbUserId;
  return dbUserId;
}

// Can this caller edit this existing task (status/priority/assignee/etc.)?
// Being waited on doesn't grant editing — only discussing and unblocking.
export function canEditTask(dbUserId, orgRole, task) {
  if (isOwner(orgRole)) return true;
  return task.creatorId === dbUserId || task.assigneeId === dbUserId;
}

// Employees may only ever "reassign" a task to themselves.
export function canSetAssignee(orgRole, nextAssigneeId, dbUserId) {
  if (isOwner(orgRole)) return true;
  return nextAssigneeId === dbUserId;
}

// Only the workspace owner can delete tasks — not even the task's creator.
export function canDeleteTask(orgRole) {
  return isOwner(orgRole);
}

// A blocker can be resolved by the person it waits on, or by anyone who can
// edit the task (e.g. they found another way).
export function canResolveBlocker(dbUserId, orgRole, task, blocker) {
  return blocker.waitingOnId === dbUserId || canEditTask(dbUserId, orgRole, task);
}
