import { eachDayOfInterval, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";

// Days are keyed "yyyy-MM-dd". Due dates are stored as UTC midnight of the
// chosen day, so the first ten characters are the calendar day (no Date
// parsing, no time-zone drift).
export const dayKey = (date) => format(date, "yyyy-MM-dd");
export const dueKey = (value) => (value ? String(value).slice(0, 10) : null);

const EMPTY = { tasks: [], items: [] };
export const dayEntries = (index, key) => index.get(key) || EMPTY;

// Map<dayKey, { tasks, items }> built once per task list, so each calendar
// cell is a lookup. `items` are open checklist steps with their own due date.
export function indexByDay(tasks) {
    const index = new Map();
    const slot = (key) => {
        if (!index.has(key)) index.set(key, { tasks: [], items: [] });
        return index.get(key);
    };
    for (const task of tasks) {
        const key = dueKey(task.due_date);
        if (key) slot(key).tasks.push(task);
        for (const item of task.checklist || []) {
            const itemKey = dueKey(item.dueDate);
            if (itemKey && !item.done) slot(itemKey).items.push({ item, task });
        }
    }
    return index;
}

// Every day shown for a month: whole weeks, including the neighbouring
// months' days that fill the first and last rows.
export function monthDays(month, weekStartsOn = 0) {
    return eachDayOfInterval({
        start: startOfWeek(startOfMonth(month), { weekStartsOn }),
        end: endOfWeek(endOfMonth(month), { weekStartsOn }),
    });
}
