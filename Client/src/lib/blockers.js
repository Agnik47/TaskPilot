import { formatDistanceToNowStrict } from "date-fns";

// Client mirror of the blocker rules in Server/controllers/blockers.controller.js.

export const NUDGE_COOLDOWN_MS = 4 * 60 * 60 * 1000;

// Quick picks for "what do you need?" — the most common reasons work stalls.
export const REASON_SUGGESTIONS = [
    "Need information",
    "Need approval",
    "Need access",
    "Waiting for files / assets",
    "Waiting for a decision",
];

export const openBlockers = (task) => task?.blockers || [];

export const isWaitingOn = (task, userId) => openBlockers(task).some((b) => b.waitingOnId === userId);

// "2 days", "3 hours" since the blocker was raised.
export const waitingFor = (blocker) => formatDistanceToNowStrict(new Date(blocker.createdAt));

// Milliseconds until the next nudge is allowed (0 = now).
export function nudgeAvailableIn(blocker, now = Date.now()) {
    const last = new Date(blocker.lastNudgedAt || blocker.createdAt).getTime();
    return Math.max(0, last + NUDGE_COOLDOWN_MS - now);
}

// ---- global "what's blocking this?" dialog ----
// Any status picker can ask for it (choosing "Blocked" opens it); a single
// host mounted in the layout renders it.
let listener = null;
export const onBlockerDialogRequest = (fn) => {
    listener = fn;
    return () => {
        if (listener === fn) listener = null;
    };
};
export const requestBlockerDialog = (task, options = {}) => listener?.(task, options);
