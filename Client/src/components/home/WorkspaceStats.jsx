import { useMemo } from "react";
import { useSelector } from "react-redux";
import { startOfDay, subDays } from "date-fns";
import { dueDateOf } from "../../lib/dates";
import { isSettled } from "../../lib/taskWorkflow";

// Owner's read on the whole workspace. Counted from the loaded tasks so the
// numbers move the moment something is approved or completed.
export default function WorkspaceStats() {
    const projects = useSelector((state) => state.workspace.projects);

    const stats = useMemo(() => {
        const today = startOfDay(new Date());
        const weekAgo = subDays(today, 7);
        const tasks = projects.flatMap((p) => p.tasks || []);
        const open = tasks.filter((t) => !isSettled(t.status));
        return [
            { label: "Open tasks", value: open.length, hint: `across ${projects.length} ${projects.length === 1 ? "project" : "projects"}` },
            { label: "Overdue", value: open.filter((t) => dueDateOf(t) && dueDateOf(t) < today).length, hint: "past their due date", tone: "text-red-600 dark:text-red-400" },
            { label: "Blocked", value: tasks.filter((t) => t.status === "BLOCKED").length, hint: "waiting on someone", tone: "text-amber-600 dark:text-amber-400" },
            { label: "Completed", value: tasks.filter((t) => t.status === "DONE" && t.completedAt && new Date(t.completedAt) >= weekAgo).length, hint: "in the last 7 days" },
        ];
    }, [projects]);

    return (
        <dl className="grid grid-cols-2 lg:grid-cols-4 gap-px mb-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
            {stats.map(({ label, value, hint, tone }) => (
                <div key={label} className="px-4 py-3.5 bg-white dark:bg-zinc-950">
                    <dt className="text-sm text-zinc-500 dark:text-zinc-400">{label}</dt>
                    <dd className={`mt-0.5 text-2xl font-semibold tabular-nums ${value > 0 && tone ? tone : "text-zinc-900 dark:text-white"}`}>{value}</dd>
                    <dd className="text-xs text-zinc-400 dark:text-zinc-500">{hint}</dd>
                </div>
            ))}
        </dl>
    );
}
