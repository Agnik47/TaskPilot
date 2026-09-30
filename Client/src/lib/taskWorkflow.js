// Client mirror of Server/services/taskWorkflow.service.js — used to show the
// right options and to update the UI instantly. The server stays the
// authority: it re-applies these rules and its response wins.

export const STATUS_META = {
    TODO: { label: "To Do", pill: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", dot: "bg-zinc-400" },
    IN_PROGRESS: { label: "In Progress", pill: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", dot: "bg-blue-500" },
    BLOCKED: { label: "Blocked", pill: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300", dot: "bg-red-500" },
    IN_REVIEW: { label: "In Review", pill: "bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", dot: "bg-violet-500" },
    DONE: { label: "Done", pill: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", dot: "bg-emerald-500" },
};

// Work that's finished from the assignee's side (not "pending" for them).
export const isSettled = (status) => status === "DONE" || status === "IN_REVIEW";

// 'all' | 'important' (High & Urgent only) | 'none'. Workspaces saved before
// approvalFor existed only have the on/off requireApproval flag.
export function approvalMode(settings) {
    return settings?.approvalFor ?? (settings?.requireApproval === false ? "none" : "all");
}

export function needsApproval(task, settings) {
    const mode = approvalMode(settings);
    if (mode === "none" || task.creatorId === task.assigneeId) return false;
    return mode === "all" || task.priority === "HIGH" || task.priority === "URGENT";
}

// Priority decides whether finished work needs approval, so only owners and
// the task's creator can change it (mirrors the server).
export const canChangePriority = (task, { isOwner, me }) => isOwner || task.creatorId === me;

// Employees can send work for review even when it doesn't need approval
// (e.g. a task they created themselves); owners are the reviewers.
export const canRequestReview = (task, { isOwner, settings }) => !isOwner && !!task && !needsApproval(task, settings);

// Who reviews a task: the owner who assigned it, or any owner for work the
// employee sent for review on their own.
export const reviewerName = (task, settings) =>
    needsApproval(task, settings) ? task.creator?.name || "the owner" : "the workspace owners";

// Status choices for a picker. For work that needs sign-off "Done" means
// "send for approval", so "In Review" is only listed while it's current; for
// other work employees can pick it to ask for a review.
export function statusOptionsFor(task, { isOwner, settings }) {
    const approval = !isOwner && task && needsApproval(task, settings);
    const optIn = canRequestReview(task, { isOwner, settings });
    const lockedDone = approval && task.status === "DONE"; // approved: only an owner can reopen
    const awaiting = !isOwner && task?.status === "IN_REVIEW"; // only an owner can approve
    return ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE"]
        .filter((s) => s !== "IN_REVIEW" || task?.status === "IN_REVIEW" || optIn)
        .map((s) => {
            const disabledReason =
                lockedDone && s !== "DONE" ? "Approved by an owner — only an owner can reopen it"
                : awaiting && s === "DONE" ? "Waiting for an owner's approval"
                : undefined;
            return {
                value: s,
                label: s === "DONE" && approval && task.status !== "DONE" ? "Done — send for approval"
                    : s === "IN_REVIEW" && optIn && task.status !== "IN_REVIEW" ? "Send for review"
                    : STATUS_META[s].label,
                dot: STATUS_META[s].dot,
                disabled: !!disabledReason,
                disabledReason,
            };
        });
}

// Board columns, in workflow order.
export const BOARD_COLUMNS = ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE"];

// The status to request when a task is dropped on a board column, or null if
// it can't go there. Dropping on "In Review" means "I'm done, please review":
// a Done request for work that needs sign-off, an opt-in review otherwise.
// Owners are the reviewers, so they can't drop there. Only owners can drop on
// "Done"; employees finish work by dropping it on "In Review".
export function boardTargetStatus(task, column, { isOwner, settings }) {
    if (column === task.status) return column;
    const approval = !isOwner && needsApproval(task, settings);
    if (approval && task.status === "DONE") return null; // approved: only an owner can reopen
    if (!isOwner && column === "DONE") return null; // only an owner moves work to Done
    if (column === "IN_REVIEW") return isOwner ? null : approval ? "DONE" : "IN_REVIEW";
    return column;
}

// What the server will turn a requested status into (for optimistic UI).
export function expectedStatus(task, requested, { isOwner, settings }) {
    if (requested === "DONE" && !isOwner && (needsApproval(task, settings) || task.status === "IN_REVIEW")) return "IN_REVIEW";
    return requested;
}
