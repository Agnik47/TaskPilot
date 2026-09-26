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

export function needsApproval(task, settings) {
    return settings?.requireApproval !== false && task.creatorId !== task.assigneeId;
}

// Status choices for a picker. "In Review" isn't pickable — it's what "Done"
// becomes for work that needs sign-off — but it's listed while it's current.
export function statusOptionsFor(task, { isOwner, settings }) {
    const approval = !isOwner && task && needsApproval(task, settings);
    const lockedDone = approval && task.status === "DONE"; // approved: only an owner can reopen
    return ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE"]
        .filter((s) => s !== "IN_REVIEW" || task?.status === "IN_REVIEW")
        .map((s) => ({
            value: s,
            label: s === "DONE" && approval && task.status !== "DONE" ? "Done — send for approval" : STATUS_META[s].label,
            dot: STATUS_META[s].dot,
            disabled: lockedDone && s !== "DONE",
            disabledReason: lockedDone && s !== "DONE" ? "Approved by an owner — only an owner can reopen it" : undefined,
        }));
}

// Board columns, in workflow order.
export const BOARD_COLUMNS = ["TODO", "IN_PROGRESS", "BLOCKED", "IN_REVIEW", "DONE"];

// The status to request when a task is dropped on a board column, or null if
// it can't go there. "In Review" can't be chosen directly: for work that needs
// sign-off, dropping there means "I'm done, please review" (a Done request).
export function boardTargetStatus(task, column, { isOwner, settings }) {
    if (column === task.status) return column;
    const approval = !isOwner && needsApproval(task, settings);
    if (approval && task.status === "DONE") return null; // approved: only an owner can reopen
    if (approval && task.status === "IN_REVIEW" && column === "DONE") return null; // only an owner approves
    if (column === "IN_REVIEW") return approval ? "DONE" : null;
    return column;
}

// What the server will turn a requested status into (for optimistic UI).
export function expectedStatus(task, requested, { isOwner, settings }) {
    if (requested === "DONE" && !isOwner && needsApproval(task, settings)) return "IN_REVIEW";
    return requested;
}
