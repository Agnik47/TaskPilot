import { useState } from "react";

// Task lists hide Done work by default so they stay about what's left to do;
// completed tasks are kept, just out of the way ("Show completed" brings them
// back). In Review isn't done yet (it waits on an owner), so it stays listed.
//
// A task finished while you're looking at the list stays until you leave, so
// the row doesn't vanish under your cursor and a mis-click is easy to undo.
//
// `recentDays`: also show work completed in the last N days (the Board keeps a
// short "recently done" window; lists hide all of it).
export default function useCompletedTasks(tasks, { recentDays = 0 } = {}) {
    const [showCompleted, setShowCompleted] = useState(false);
    const [kept, setKept] = useState(() => new Set());
    const [prevTasks, setPrevTasks] = useState(tasks);

    // Adjust state while rendering (not in an effect) so a just-completed row
    // never disappears for a frame.
    if (tasks !== prevTasks) {
        const before = new Map(prevTasks.map((t) => [t.id, t.status]));
        const finished = tasks.filter((t) => t.status === "DONE" && before.has(t.id) && before.get(t.id) !== "DONE" && !kept.has(t.id));
        setPrevTasks(tasks);
        if (finished.length) setKept((ids) => new Set([...ids, ...finished.map((t) => t.id)]));
    }

    // Fixed for the visit, so the window doesn't shift between renders.
    const [since] = useState(() => Date.now() - recentDays * 24 * 60 * 60 * 1000);
    const isRecent = (task) => recentDays > 0 && !!task.completedAt && new Date(task.completedAt).getTime() >= since;

    const completedCount = tasks.filter((t) => t.status === "DONE").length;
    // `force`: the caller asked for Done work explicitly (e.g. the status filter is "Done").
    const isShown = (task, force = false) => showCompleted || force || task.status !== "DONE" || kept.has(task.id) || isRecent(task);

    return { showCompleted, setShowCompleted, completedCount, isShown };
}
