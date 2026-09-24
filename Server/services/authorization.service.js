const OWNER_ROLE = 'org:admin';

export function isOwner(orgRole) {
  return orgRole === OWNER_ROLE;
}

// Employees only ever see/manage tasks they created or are assigned to.
export function isTaskVisibleTo(dbUserId, orgRole, task) {
  if (isOwner(orgRole)) return true;
  return task.creatorId === dbUserId || task.assigneeId === dbUserId;
}

export function filterTasksForRole(dbUserId, orgRole, tasks) {
  if (isOwner(orgRole)) return tasks;
  return tasks.filter((t) => t.creatorId === dbUserId || t.assigneeId === dbUserId);
}

// Enforces PRD task-creation rules: employees can never assign to someone else,
// even if the request body says otherwise.
export function resolveAssigneeId(dbUserId, orgRole, requestedAssigneeId) {
  if (isOwner(orgRole)) return requestedAssigneeId || dbUserId;
  return dbUserId;
}

// Can this caller edit this existing task (status/priority/assignee/etc.)?
export function canEditTask(dbUserId, orgRole, task) {
  if (isOwner(orgRole)) return true;
  return task.creatorId === dbUserId || task.assigneeId === dbUserId;
}

// Employees may only ever "reassign" a task to themselves.
export function canSetAssignee(orgRole, nextAssigneeId, dbUserId) {
  if (isOwner(orgRole)) return true;
  return nextAssigneeId === dbUserId;
}

export function canDeleteTask(dbUserId, orgRole, task) {
  if (isOwner(orgRole)) return true;
  return task.creatorId === dbUserId;
}
