import { addDays, startOfDay, subDays } from "date-fns";
import { dueDateOf } from "./dates";
import { sortByPosition } from "./taskOrder";

// Grouping for the My Work page. Every task lands in exactly one group:
// status decides first (blocked / in review / done), then the due date.

export const GROUPS = [
    { key: "overdue", label: "Overdue", tone: "red" },
    { key: "today", label: "Today", tone: "amber" },
    { key: "week", label: "Next 7 days" },
    { key: "later", label: "Later" },
    { key: "nodate", label: "No due date" },
    { key: "blocked", label: "Waiting on others", tone: "red" },
    { key: "review", label: { mine: "Waiting for approval", delegated: "Ready for your review" }, tone: "violet" },
    { key: "done", label: "Completed in the last 14 days", tone: "emerald", collapsedByDefault: true },
];

const RECENT_DONE_DAYS = 14;
const PRIORITY_RANK = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

export function groupOf(task, now = new Date()) {
    const today = startOfDay(now);
    if (task.status === "DONE") {
        const done = task.completedAt ? new Date(task.completedAt) : new Date(task.updatedAt);
        return done >= subDays(today, RECENT_DONE_DAYS) ? "done" : null;
    }
    if (task.status === "IN_REVIEW") return "review";
    if (task.status === "BLOCKED") return "blocked";
    const due = dueDateOf(task);
    if (!due) return "nodate";
    if (due < today) return "overdue";
    if (due < addDays(today, 1)) return "today";
    if (due < addDays(today, 8)) return "week";
    return "later";
}

// Earliest due first, then most urgent, then the project's manual order.
// Completed work: most recently finished first.
function sortGroup(key, tasks) {
    if (key === "done") {
        return [...tasks].sort((a, b) => new Date(b.completedAt || b.updatedAt) - new Date(a.completedAt || a.updatedAt));
    }
    return sortByPosition(tasks).sort((a, b) => {
        const da = dueDateOf(a)?.getTime() ?? Infinity;
        const db = dueDateOf(b)?.getTime() ?? Infinity;
        return da - db || (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    });
}

// "mine": assigned to me. "delegated": I created it for someone else.
export function selectTasks(projects, me, mode) {
    return projects.flatMap((p) =>
        (p.tasks || [])
            .filter((t) => (mode === "delegated" ? t.creatorId === me && t.assigneeId !== me : t.assigneeId === me))
            .map((t) => ({ ...t, projectName: p.name }))
    );
}

export function groupTasks(tasks, now = new Date()) {
    const buckets = Object.fromEntries(GROUPS.map((g) => [g.key, []]));
    tasks.forEach((t) => {
        const key = groupOf(t, now);
        if (key) buckets[key].push(t);
    });
    return Object.fromEntries(Object.entries(buckets).map(([key, list]) => [key, sortGroup(key, list)]));
}
