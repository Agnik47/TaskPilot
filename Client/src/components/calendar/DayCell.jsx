import { memo } from "react";
import { useDroppable } from "@dnd-kit/core";
import { Flag, Plus } from "lucide-react";
import { STATUS_META } from "../../lib/taskWorkflow";
import { ChecklistChip, TaskChip } from "./TaskChip";

const MAX_CHIPS = 3;

function DayCell({ day, tasks, items, milestone, inMonth, isToday, isPast, isSelected, canEdit, onSelect, onCreate }) {
    const { setNodeRef, isOver } = useDroppable({ id: day.key });
    const count = tasks.length + items.length;
    const shownTasks = tasks.slice(0, MAX_CHIPS);
    const shownItems = items.slice(0, MAX_CHIPS - shownTasks.length);
    const hidden = count - shownTasks.length - shownItems.length;
    const isLate = (task) => isPast && task.status !== "DONE" && task.status !== "IN_REVIEW";

    return (
        <div
            ref={setNodeRef}
            onClick={() => onSelect(day.key)}
            className={`group relative flex flex-col gap-1 min-h-14 sm:min-h-24 p-1 sm:p-1.5 rounded-md border text-left cursor-pointer transition-colors
                ${isOver ? "border-blue-500 bg-blue-50 dark:bg-blue-500/15"
                    : isSelected ? "border-blue-400 bg-blue-50/70 dark:border-blue-500/60 dark:bg-blue-500/10"
                    : inMonth ? "border-transparent bg-zinc-50 hover:bg-zinc-100 dark:bg-zinc-800/40 dark:hover:bg-zinc-800/70"
                    : "border-transparent bg-transparent hover:bg-zinc-50 dark:hover:bg-zinc-800/30"}`}
        >
            <div className="flex items-center justify-between gap-1">
                <button
                    type="button"
                    data-day={day.key}
                    aria-pressed={isSelected}
                    aria-label={`${day.label}${count ? `, ${count} due` : ""}${milestone ? `, ${milestone}` : ""}`}
                    className={`grid size-6 place-items-center rounded-full text-xs tabular-nums
                        ${isToday ? "bg-blue-600 font-semibold text-white" : inMonth ? "text-zinc-900 dark:text-zinc-200" : "text-zinc-400 dark:text-zinc-600"}`}
                >
                    {day.number}
                </button>
                <span className="flex items-center gap-1">
                    {milestone && <span title={milestone}><Flag className="size-3 text-amber-600 dark:text-amber-400" aria-hidden /></span>}
                    {!isPast && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onCreate(day.key); }}
                            aria-label={`Add a task due ${day.label}`}
                            title="Add a task due this day"
                            className="max-sm:hidden grid size-5 place-items-center rounded text-zinc-500 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-zinc-200 hover:text-zinc-900 dark:hover:bg-zinc-700 dark:hover:text-white"
                        >
                            <Plus className="size-3.5" />
                        </button>
                    )}
                </span>
            </div>

            {/* Desktop: the work itself. */}
            <div className="max-sm:hidden flex flex-col gap-0.5 min-w-0">
                {shownTasks.map((task) => <TaskChip key={task.id} task={task} overdue={isLate(task)} draggable={canEdit(task)} />)}
                {shownItems.map(({ item, task }) => <ChecklistChip key={item.id} item={item} task={task} />)}
                {hidden > 0 && <span className="px-1 text-[11px] text-zinc-500 dark:text-zinc-400">+{hidden} more</span>}
            </div>

            {/* Phones: a dot per task; the day's list is shown below the grid. */}
            {count > 0 && (
                <div className="sm:hidden flex flex-wrap justify-center gap-0.5">
                    {tasks.slice(0, 4).map((task) => (
                        <span key={task.id} className={`size-1.5 rounded-full ${isLate(task) ? "bg-red-500" : STATUS_META[task.status]?.dot}`} />
                    ))}
                    {count > 4 && <span className="text-[9px] leading-none text-zinc-500">+</span>}
                </div>
            )}
        </div>
    );
}

const sameList = (a, b) => a === b || (a.length === b.length && a.every((x, i) => x === b[i]));
const sameItems = (a, b) => a === b || (a.length === b.length && a.every((x, i) => x.item === b[i].item && x.task === b[i].task));

// The day index is rebuilt whenever a task changes; compare contents so only
// the days that actually changed re-render (e.g. the two ends of a drag).
export default memo(DayCell, (prev, next) =>
    prev.day.key === next.day.key && prev.inMonth === next.inMonth && prev.isToday === next.isToday && prev.isPast === next.isPast &&
    prev.isSelected === next.isSelected && prev.milestone === next.milestone && prev.canEdit === next.canEdit &&
    prev.onSelect === next.onSelect && prev.onCreate === next.onCreate &&
    sameList(prev.tasks, next.tasks) && sameItems(prev.items, next.items)
);
