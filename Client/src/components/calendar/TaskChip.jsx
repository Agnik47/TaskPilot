import { Link } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { ListChecks } from "lucide-react";
import { STATUS_META } from "../../lib/taskWorkflow";
import { taskHref } from "../../lib/taskMeta";

const BASE = "flex items-center gap-1 min-w-0 px-1.5 py-0.5 rounded border text-[11px] leading-4";

// A task inside a calendar day. Drag it to another day to change its due
// date (when you can edit it); click to open it.
export function TaskChip({ task, overdue = false, draggable = false, overlay = false }) {
    // Pointer dragging only: the chip stays a plain link for the keyboard, and
    // the due date can always be changed on the task itself.
    const { listeners, setNodeRef, isDragging } = useDraggable({ id: `task:${task.id}`, data: { task }, disabled: !draggable || overlay });
    const done = task.status === "DONE";
    const tone = overdue
        ? "border-red-300 bg-red-50 text-red-800 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-200"
        : "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200";

    return (
        <div
            ref={overlay ? undefined : setNodeRef}
            {...(overlay ? {} : listeners)}
            className={`${BASE} ${tone} ${done ? "opacity-60" : ""} ${isDragging ? "opacity-40" : ""} ${overlay ? "shadow-lg cursor-grabbing max-w-48" : draggable ? "cursor-grab touch-none" : ""}`}
        >
            <span className={`size-1.5 shrink-0 rounded-full ${STATUS_META[task.status]?.dot}`} />
            {overlay ? (
                <span className="truncate">{task.title}</span>
            ) : (
                <Link
                    to={taskHref(task)}
                    draggable={false}
                    onClick={(e) => e.stopPropagation()}
                    title={`${task.title} · ${STATUS_META[task.status]?.label}${overdue ? " · overdue" : ""}`}
                    className={`truncate hover:underline ${done ? "line-through" : ""}`}
                >
                    {task.title}
                </Link>
            )}
        </div>
    );
}

// A checklist step that has its own due date; opens the task it belongs to.
export function ChecklistChip({ item, task }) {
    return (
        <Link
            to={taskHref(task)}
            onClick={(e) => e.stopPropagation()}
            title={`Checklist step on "${task.title}"`}
            className={`${BASE} border-dashed border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400 hover:underline`}
        >
            <ListChecks className="size-3 shrink-0" />
            <span className="truncate">{item.title}</span>
        </Link>
    );
}
