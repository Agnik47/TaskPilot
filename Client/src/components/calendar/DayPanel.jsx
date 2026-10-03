import { Link } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { format } from "date-fns";
import { AlertTriangle, CalendarClock, CalendarOff, Flag, GripVertical, ListChecks, Plus } from "lucide-react";
import Card from "../Card";
import WaitingOnBadge from "../blockers/WaitingOnBadge";
import { dueInfo } from "../../lib/dates";
import { STATUS_META } from "../../lib/taskWorkflow";
import { PRIORITY_META, taskHref } from "../../lib/taskMeta";

const LIST_LIMIT = 6;

function TaskRow({ task, showDue = false, handle = null }) {
    const due = showDue ? dueInfo(task) : null;
    const priority = PRIORITY_META[task.priority];
    const done = task.status === "DONE";

    return (
        <li className="flex items-start gap-2 py-2">
            {handle}
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${STATUS_META[task.status]?.dot}`} title={STATUS_META[task.status]?.label} />
            <div className="min-w-0 flex-1">
                <Link to={taskHref(task)} className={`block truncate text-sm text-zinc-900 dark:text-zinc-100 hover:underline ${done ? "line-through opacity-60" : ""}`}>
                    {task.title}
                </Link>
                <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {due && <span className={due.overdue ? "font-medium text-red-600 dark:text-red-400" : ""}>{due.overdue ? `Due ${due.label}` : due.label}</span>}
                    <span>{STATUS_META[task.status]?.label}</span>
                    {task.assignee && <span className="truncate">{task.assignee.name}</span>}
                </p>
                <WaitingOnBadge task={task} className="mt-1" />
            </div>
            {priority && <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${priority.pill}`}>{priority.label}</span>}
        </li>
    );
}

// A task with no due date: drag it onto a day to schedule it.
function UndatedRow({ task, draggable }) {
    const { listeners, setNodeRef, isDragging } = useDraggable({ id: `task:${task.id}`, data: { task }, disabled: !draggable });
    return (
        <div ref={setNodeRef} className={isDragging ? "opacity-40" : ""}>
            <ul>
                <TaskRow
                    task={task}
                    handle={draggable && (
                        <span {...listeners} className="mt-0.5 shrink-0 cursor-grab touch-none text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200" title="Drag onto a day to set the due date">
                            <GripVertical className="size-4" />
                        </span>
                    )}
                />
            </ul>
        </div>
    );
}

function TaskList({ tasks, showDue }) {
    return (
        <>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {tasks.slice(0, LIST_LIMIT).map((task) => <TaskRow key={task.id} task={task} showDue={showDue} />)}
            </ul>
            {tasks.length > LIST_LIMIT && <p className="pt-1 text-xs text-zinc-500 dark:text-zinc-400">+{tasks.length - LIST_LIMIT} more</p>}
        </>
    );
}

// Beside the grid: the selected day, then what's late, what's next and what
// hasn't been scheduled.
export default function DayPanel({ selected, entries, milestone, isPast, overdue, upcoming, undated, canEdit, onCreate }) {
    const { tasks, items } = entries;
    const empty = tasks.length + items.length === 0 && !milestone;

    return (
        <div className="space-y-4">
            <Card
                title={format(selected.date, "EEE, d MMM")}
                action={!isPast && (
                    <button type="button" onClick={() => onCreate(selected.key)} className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <Plus className="size-3.5" /> Add task
                    </button>
                )}
            >
                {milestone && (
                    <p className="mb-2 flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300"><Flag className="size-3.5" /> {milestone}</p>
                )}
                {empty ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">Nothing is due this day.</p>
                ) : (
                    <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {tasks.map((task) => <TaskRow key={task.id} task={task} />)}
                        {items.map(({ item, task }) => (
                            <li key={item.id} className="flex items-start gap-2 py-2">
                                <ListChecks className="mt-0.5 size-4 shrink-0 text-zinc-400" />
                                <div className="min-w-0">
                                    <Link to={taskHref(task)} className="block truncate text-sm text-zinc-900 dark:text-zinc-100 hover:underline">{item.title}</Link>
                                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">Step on “{task.title}”{item.assignee ? ` · ${item.assignee.name}` : ""}</p>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </Card>

            {overdue.length > 0 && (
                <Card title={`Overdue (${overdue.length})`} icon={AlertTriangle} className="border-l-4 border-l-red-500 dark:border-l-red-500">
                    <TaskList tasks={overdue} showDue />
                </Card>
            )}

            <Card title="Upcoming" icon={CalendarClock}>
                {upcoming.length === 0 ? (
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">No upcoming due dates.</p>
                ) : (
                    <div className="space-y-3">
                        {upcoming.map((group) => (
                            <div key={group.label}>
                                <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{group.label}</h3>
                                <TaskList tasks={group.tasks} showDue={group.showDue} />
                            </div>
                        ))}
                    </div>
                )}
            </Card>

            {undated.length > 0 && (
                <details className="group not-dark:bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg p-4 sm:p-5">
                    <summary className="flex cursor-pointer items-center gap-2 font-medium text-zinc-900 dark:text-white">
                        <CalendarOff className="size-4 text-zinc-500 dark:text-zinc-400" /> No due date
                        <span className="text-sm font-normal tabular-nums text-zinc-500 dark:text-zinc-400">{undated.length}</span>
                    </summary>
                    <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">Drag a task onto a day to schedule it.</p>
                    <div className="mt-1 divide-y divide-zinc-200 dark:divide-zinc-800">
                        {undated.map((task) => <UndatedRow key={task.id} task={task} draggable={canEdit(task)} />)}
                    </div>
                </details>
            )}
        </div>
    );
}
