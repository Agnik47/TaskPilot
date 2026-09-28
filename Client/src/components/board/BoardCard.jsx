import { Link } from "react-router-dom";
import { Bug, CalendarDays, GitCommit, MessageSquare, Square, Zap } from "lucide-react";
import { dueInfo } from "../../lib/dates";
import WaitingOnBadge from "../blockers/WaitingOnBadge";
import ChecklistProgress from "../checklist/ChecklistProgress";

const TYPE_ICON = {
    TASK: { icon: Square, cls: "text-green-600 dark:text-green-400" },
    BUG: { icon: Bug, cls: "text-red-600 dark:text-red-400" },
    FEATURE: { icon: Zap, cls: "text-blue-600 dark:text-blue-400" },
    IMPROVEMENT: { icon: GitCommit, cls: "text-purple-600 dark:text-purple-400" },
    OTHER: { icon: MessageSquare, cls: "text-amber-600 dark:text-amber-400" },
};

const PRIORITY = {
    LOW: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    MEDIUM: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300",
    HIGH: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    URGENT: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

// One task on the board. `overlay` renders the lifted copy that follows the
// pointer while dragging.
export default function BoardCard({ task, overlay = false, draggable = true }) {
    const type = TYPE_ICON[task.type] || TYPE_ICON.TASK;
    const due = dueInfo(task);
    const href = `/taskDetails?projectId=${task.projectId}&taskId=${task.id}`;

    return (
        <article
            className={`group rounded-lg border bg-white dark:bg-zinc-950 p-3 text-left transition ${overlay
                ? "shadow-xl ring-1 ring-blue-500/40 rotate-[1.5deg] cursor-grabbing border-zinc-200 dark:border-zinc-700"
                : `border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-sm ${draggable ? "cursor-grab" : ""}`}`}
        >
            <Link
                to={href}
                draggable={false}
                className="block text-sm font-medium leading-snug text-zinc-900 dark:text-zinc-100 line-clamp-3 break-words hover:underline focus:outline-none focus-visible:underline"
            >
                {task.title}
            </Link>

            <WaitingOnBadge task={task} className="mt-2" />

            {/* Meta chips wrap as a group in narrow columns; each chip stays on one
                line and the avatar keeps its own slot so nothing collides. */}
            <div className="flex items-end gap-2 mt-2.5">
                <div className="flex flex-1 min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <type.icon className={`size-3.5 shrink-0 ${type.cls}`} aria-label={task.type} />
                    <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] leading-4 font-semibold uppercase tracking-wide ${PRIORITY[task.priority] || PRIORITY.MEDIUM}`}>
                        {task.priority}
                    </span>
                    {due && (
                        <span
                            className={`inline-flex shrink-0 items-center gap-1 text-xs whitespace-nowrap ${due.overdue ? "text-red-600 dark:text-red-400 font-medium" : due.soon ? "text-amber-700 dark:text-amber-300" : "text-zinc-500 dark:text-zinc-400"}`}
                            title={due.overdue ? "Overdue" : "Due date"}
                        >
                            <CalendarDays className="size-3.5 shrink-0" /> {due.label}
                        </span>
                    )}
                    <ChecklistProgress task={task} className="shrink-0" />
                </div>
                {task.assignee && (
                    <img
                        src={task.assignee.image}
                        alt={task.assignee.name}
                        title={task.assignee.name}
                        className="size-6 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700 ring-2 ring-white dark:ring-zinc-950"
                    />
                )}
            </div>
        </article>
    );
}
