import { addDays, format, isToday, isTomorrow, isYesterday, startOfDay } from "date-fns";
import { isSettled } from "./taskWorkflow";

// Due dates are stored as UTC midnight of the chosen day; read them back as
// that calendar day in local time (avoids off-by-one in other time zones).
export function dueDateOf(task) {
    if (!task?.due_date) return null;
    const [y, m, d] = String(task.due_date).slice(0, 10).split("-").map(Number);
    return new Date(y, m - 1, d);
}

// { label, overdue, soon } for showing a task's due date, or null.
export function dueInfo(task, now = new Date()) {
    const date = dueDateOf(task);
    if (!date) return null;
    const today = startOfDay(now);
    const open = !isSettled(task.status);
    const overdue = open && date < today;
    const label = isToday(date) ? "Today" : isTomorrow(date) ? "Tomorrow" : isYesterday(date) ? "Yesterday"
        : format(date, date.getFullYear() === today.getFullYear() ? "d MMM" : "d MMM yyyy");
    return { label, overdue, soon: open && !overdue && date < addDays(today, 2) };
}
