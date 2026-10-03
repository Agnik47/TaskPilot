import { addDays, addWeeks, differenceInCalendarDays, differenceInCalendarWeeks, endOfDay, format, startOfDay, startOfWeek } from "date-fns";
import { dueDateOf, dueInfo } from "./dates";
import { isSettled } from "./taskWorkflow";
import { openBlockers } from "./blockers";

// Pure helpers behind the project Analytics tab. Everything is derived from
// the tasks already in the store (no extra requests), one pass each.

const DAY = 24 * 60 * 60 * 1000;
export const STALE_DAYS = 7;

const time = (value) => (value ? new Date(value).getTime() : null);

function median(values) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// Headline numbers. "In range" is the last `rangeDays` days; the previous
// equal stretch gives the comparison.
export function summarize(tasks, { rangeDays, now = new Date() }) {
    const since = now.getTime() - rangeDays * DAY;
    const prevSince = since - rangeDays * DAY;

    const byStatus = { TODO: 0, IN_PROGRESS: 0, BLOCKED: 0, IN_REVIEW: 0, DONE: 0 };
    const byPriority = { URGENT: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    const byType = { TASK: 0, BUG: 0, FEATURE: 0, IMPROVEMENT: 0, OTHER: 0 };
    let completed = 0, prevCompleted = 0, overdue = 0, withDue = 0, onTime = 0;
    const daysToComplete = [];

    for (const t of tasks) {
        if (byStatus[t.status] !== undefined) byStatus[t.status]++;
        if (dueInfo(t, now)?.overdue) overdue++;
        // Breakdowns describe the work that's left.
        if (t.status !== "DONE") {
            if (byPriority[t.priority] !== undefined) byPriority[t.priority]++;
            if (byType[t.type] !== undefined) byType[t.type]++;
        }

        const done = t.status === "DONE" ? time(t.completedAt) : null;
        if (done === null) continue;
        if (done >= since) {
            completed++;
            const created = time(t.createdAt);
            if (created !== null) daysToComplete.push(Math.max(0, done - created) / DAY);
            const due = dueDateOf(t);
            if (due) {
                withDue++;
                if (done <= endOfDay(due).getTime()) onTime++;
            }
        } else if (done >= prevSince) {
            prevCompleted++;
        }
    }

    return {
        total: tasks.length,
        open: tasks.length - byStatus.DONE,
        completed,
        prevCompleted,
        overdue,
        blocked: byStatus.BLOCKED,
        inReview: byStatus.IN_REVIEW,
        onTimeRate: withDue ? Math.round((onTime / withDue) * 100) : null,
        medianDays: median(daysToComplete),
        byStatus,
        byPriority,
        byType,
    };
}

// Tasks created vs completed per bucket: days for a week, weeks beyond that.
// More created than completed, week after week, means the backlog is growing.
export function flow(tasks, { rangeDays, weekStartsOn = 0, now = new Date() }) {
    const daily = rangeDays <= 7;
    const today = startOfDay(now);
    const first = daily ? addDays(today, -(rangeDays - 1)) : startOfWeek(addDays(today, -(rangeDays - 1)), { weekStartsOn });
    const count = daily ? rangeDays : differenceInCalendarWeeks(today, first, { weekStartsOn }) + 1;

    const buckets = Array.from({ length: count }, (_, i) => {
        const start = daily ? addDays(first, i) : addWeeks(first, i);
        return { label: format(start, daily ? "EEE d" : "d MMM"), title: daily ? format(start, "EEE, d MMM") : `Week of ${format(start, "d MMM")}`, created: 0, completed: 0 };
    });
    const indexOf = (value) => {
        if (!value) return -1;
        const date = new Date(value);
        return daily ? differenceInCalendarDays(date, first) : differenceInCalendarWeeks(date, first, { weekStartsOn });
    };

    for (const t of tasks) {
        const c = indexOf(t.createdAt);
        if (buckets[c] && time(t.createdAt) >= first.getTime()) buckets[c].created++;
        if (t.status === "DONE") {
            const d = indexOf(t.completedAt);
            if (buckets[d] && time(t.completedAt) >= first.getTime()) buckets[d].completed++;
        }
    }
    return buckets;
}

// What each person is carrying right now, heaviest first. `people` (project
// members) are listed even with nothing assigned, so spare capacity shows.
export function workloadByPerson(tasks, people, { rangeDays, now = new Date() }) {
    const since = now.getTime() - rangeDays * DAY;
    const rows = new Map();
    const rowFor = (person) => {
        if (!rows.has(person.id)) rows.set(person.id, { person, active: 0, blocked: 0, inReview: 0, overdue: 0, done: 0 });
        return rows.get(person.id);
    };
    people.forEach((p) => p && rowFor(p));

    for (const t of tasks) {
        if (!t.assignee) continue;
        const row = rowFor(t.assignee);
        if (t.status === "DONE") {
            if (time(t.completedAt) >= since) row.done++;
            continue;
        }
        if (t.status === "BLOCKED") row.blocked++;
        else if (t.status === "IN_REVIEW") row.inReview++;
        else row.active++;
        if (dueInfo(t, now)?.overdue) row.overdue++;
    }

    return [...rows.values()]
        .map((r) => ({ ...r, load: r.active + r.blocked + r.inReview }))
        .sort((a, b) => b.load - a.load || (a.person.name || "").localeCompare(b.person.name || ""));
}

// Work that needs someone to act, worst first within each group.
export function attentionList(tasks, { now = new Date() } = {}) {
    const today = startOfDay(now);
    const overdue = [], blocked = [], review = [], stale = [];

    for (const t of tasks) {
        if (t.status === "DONE") continue;
        const late = dueInfo(t, now)?.overdue;
        const blockers = openBlockers(t);
        const isBlocked = t.status === "BLOCKED" || blockers.length > 0;

        if (late) overdue.push({ task: t, days: differenceInCalendarDays(today, dueDateOf(t)) });
        // Blockers arrive oldest first; a Blocked task without one counts from its last update.
        if (isBlocked) blocked.push({ task: t, blocker: blockers[0] || null, since: time(blockers[0]?.createdAt || t.updatedAt) });
        if (t.status === "IN_REVIEW") review.push({ task: t, since: time(t.submittedAt || t.updatedAt) });
        if (!late && !isBlocked && !isSettled(t.status)) {
            const days = Math.floor((now.getTime() - time(t.updatedAt)) / DAY);
            if (days >= STALE_DAYS) stale.push({ task: t, days });
        }
    }

    overdue.sort((a, b) => b.days - a.days);
    blocked.sort((a, b) => a.since - b.since);
    review.sort((a, b) => a.since - b.since);
    stale.sort((a, b) => b.days - a.days);
    return { overdue, blocked, review, stale, count: overdue.length + blocked.length + review.length + stale.length };
}
