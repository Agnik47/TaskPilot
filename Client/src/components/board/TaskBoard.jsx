import { useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { useUser } from "@clerk/clerk-react";
import {
    DndContext,
    DragOverlay,
    KeyboardSensor,
    MouseSensor,
    TouchSensor,
    closestCorners,
    useDroppable,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Ban, Search, ShieldCheck, Users, X } from "lucide-react";
import useOrgRole from "../../hooks/useOrgRole";
import useTaskActions from "../../hooks/useTaskActions";
import useCompletedTasks from "../../hooks/useCompletedTasks";
import { BOARD_COLUMNS, STATUS_META, boardTargetStatus } from "../../lib/taskWorkflow";
import { positionBetween, sortByPosition } from "../../lib/taskOrder";
import { PRIORITY_OPTIONS, TYPE_OPTIONS } from "../../lib/sheet";
import BoardCard from "./BoardCard";
import BoardLane from "./BoardLane";
import QuickAdd from "./QuickAdd";

// Kanban board: one column per status. Drag a card to another column to
// change its status (same approval / blocker rules as everywhere else), or
// within a column to reorder it. Columns a card can't move to are dimmed
// while it's dragged. Mouse, touch (press and hold) and keyboard all work.
//
// Built for big teams: employees open on their own tasks, Done shows only the
// last week, and owners can group the board by person (one lane each). Cards
// move between statuses within their lane; dragging never reassigns work.

const COLUMN_HINTS = {
    IN_REVIEW: "Finished work waiting for an owner's approval, oldest first. Drop your task here to ask for a review",
    BLOCKED: "Waiting on someone or something",
    DONE: "Completed in the last 7 days, newest first",
};
// Blocked needs a person and reason (the dialog), In Review/Done are reached by
// finishing work, so quick add lives only where new work starts.
const QUICK_ADD_COLUMNS = new Set(["TODO", "IN_PROGRESS"]);
// These columns are ordered by date, not by hand.
const DATE_ORDERED = new Set(["IN_REVIEW", "DONE"]);
const DONE_RECENT_DAYS = 7;

const GROUP_KEY = "board.groupBy";
const readGroupBy = () => {
    try {
        return localStorage.getItem(GROUP_KEY) === "person" ? "person" : "none";
    } catch {
        return "none";
    }
};

// A column is one status in one lane ("all" when the board isn't grouped).
const ALL = "all";
const keyOf = (lane, status) => `${lane}|${status}`;
const splitKey = (key) => {
    const i = key.lastIndexOf("|");
    return [key.slice(0, i), key.slice(i + 1)];
};
const COLUMN_PREFIX = "column:";
// Missing dates sort as "just now": optimistic updates don't have them yet.
const timeOf = (date) => (date ? new Date(date).getTime() : Date.now());
const NO_TASKS = []; // stable, so "tasks changed" checks don't fire every render

export default function TaskBoard({ project }) {
    const { user } = useUser();
    const me = user?.id;
    const { isOwner, isLoaded: roleLoaded } = useOrgRole();
    const settings = useSelector((state) => state.workspace.settings);
    const { setStatus } = useTaskActions();

    const allTasks = project.tasks || NO_TASKS;
    const tasksById = new Map(allTasks.map((t) => [t.id, t]));
    const canEdit = (t) => isOwner || t.creatorId === me || t.assigneeId === me;

    // You first, then alphabetical.
    const people = [...new Map(allTasks.filter((t) => t.assignee).map((t) => [t.assignee.id, t.assignee])).values()]
        .sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : a.name.localeCompare(b.name)));

    // ---- filters ----
    const [query, setQuery] = useState("");
    // null until someone picks: employees then see their own tasks, owners everyone.
    const [pickedAssignees, setPickedAssignees] = useState(null);
    const mineByDefault = roleLoaded && !isOwner && people.some((p) => p.id === me);
    const assignees = pickedAssignees ?? (mineByDefault ? [me] : []);
    const setAssignees = (update) => setPickedAssignees((prev) => (typeof update === "function" ? update(prev ?? assignees) : update));
    const [type, setType] = useState("");
    const [priority, setPriority] = useState("");
    const filtersActive = !!(query.trim() || assignees.length || type || priority);
    const clearFilters = () => {
        setQuery("");
        setAssignees([]);
        setType("");
        setPriority("");
    };
    const showingMine = !isOwner && people.length > 1 && assignees.length === 1 && assignees[0] === me;

    // ---- grouping ----
    const [groupBy, setGroupBy] = useState(readGroupBy);
    const grouped = groupBy === "person";
    const toggleGrouping = () => {
        const next = grouped ? "none" : "person";
        setGroupBy(next);
        try { localStorage.setItem(GROUP_KEY, next); } catch { /* not persisted */ }
    };
    const [collapsed, setCollapsed] = useState(() => new Set());
    const toggleLane = (id) => setCollapsed((set) => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
    });
    const laneOf = (t) => (grouped ? t.assigneeId : ALL);

    // ---- what's on the board ----
    const q = query.trim().toLowerCase();
    const matching = sortByPosition(allTasks).filter(
        (t) =>
            (!q || t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q)) &&
            (!assignees.length || assignees.includes(t.assigneeId)) &&
            (!type || t.type === type) &&
            (!priority || t.priority === priority)
    );
    // Done keeps a one-week window (plus anything finished during this visit).
    const { showCompleted: showOlderDone, setShowCompleted: setShowOlderDone, isShown } = useCompletedTasks(allTasks, { recentDays: DONE_RECENT_DAYS });
    const shown = matching.filter((t) => isShown(t));
    const olderDone = {};
    matching.forEach((t) => {
        if (!isShown(t)) olderDone[keyOf(laneOf(t), "DONE")] = (olderDone[keyOf(laneOf(t), "DONE")] || 0) + 1;
    });
    const anyOlderDone = matching.some((t) => t.status === "DONE" && !isShown(t)) || showOlderDone;

    const laneIds = grouped ? people.map((p) => p.id).filter((id) => shown.some((t) => t.assigneeId === id)) : [ALL];

    // Column key -> ordered task ids, as stored.
    const stored = {};
    laneIds.forEach((lane) => BOARD_COLUMNS.forEach((s) => (stored[keyOf(lane, s)] = [])));
    shown.forEach((t) => stored[keyOf(laneOf(t), t.status)]?.push(t.id));
    laneIds.forEach((lane) => {
        const by = (id) => tasksById.get(id);
        stored[keyOf(lane, "DONE")].sort((a, b) => timeOf(by(b).completedAt) - timeOf(by(a).completedAt)); // newest first
        stored[keyOf(lane, "IN_REVIEW")].sort((a, b) => timeOf(by(a).submittedAt) - timeOf(by(b).submittedAt)); // oldest first
    });

    // ---- drag state: a live copy of the columns while a card is moving ----
    const [dragItems, setDragItems] = useState(null);
    const [activeId, setActiveId] = useState(null);
    const items = dragItems || stored;
    const activeTask = activeId ? tasksById.get(activeId) : null;

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
        // Press and hold on touch, so swiping still scrolls the board.
        useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    // A card stays in its own lane; within it, the usual status rules apply.
    const allowedIn = (task, key) => {
        if (!task) return false;
        const [lane, status] = splitKey(key);
        return lane === laneOf(task) && boardTargetStatus(task, status, { isOwner, settings }) !== null;
    };
    const containerOf = (id, cols = items) => {
        if (typeof id === "string" && id.startsWith(COLUMN_PREFIX)) return id.slice(COLUMN_PREFIX.length);
        return Object.keys(cols).find((key) => cols[key].includes(id));
    };

    const onDragStart = ({ active }) => {
        setActiveId(active.id);
        setDragItems(stored);
    };

    // Moving across columns: move the card into the new column right away so
    // the other cards make room where it will land.
    const onDragOver = ({ active, over }) => {
        if (!over) return;
        setDragItems((cols) => {
            if (!cols) return cols;
            const from = containerOf(active.id, cols);
            const to = containerOf(over.id, cols);
            if (!from || !to || from === to || !cols[to] || !allowedIn(tasksById.get(active.id), to)) return cols;

            const target = cols[to];
            const overIndex = target.indexOf(over.id);
            const index = overIndex === -1 ? target.length : overIndex;
            return {
                ...cols,
                [from]: cols[from].filter((id) => id !== active.id),
                [to]: [...target.slice(0, index), active.id, ...target.slice(index)],
            };
        });
    };

    const endDrag = () => {
        setActiveId(null);
        setDragItems(null);
    };

    const onDragEnd = ({ active, over }) => {
        const task = tasksById.get(active.id);
        const cols = dragItems;
        endDrag();
        if (!task || !over || !cols) return;

        const key = containerOf(active.id, cols);
        if (!key) return;
        const [, column] = splitKey(key);
        let list = cols[key];
        const overIndex = list.indexOf(over.id);
        const fromIndex = list.indexOf(active.id);
        if (overIndex !== -1 && overIndex !== fromIndex) list = arrayMove(list, fromIndex, overIndex);

        const index = list.indexOf(active.id);
        const neighbour = (i) => (i >= 0 && i < list.length ? tasksById.get(list[i]) : undefined);
        const position = DATE_ORDERED.has(column) ? undefined : positionBetween(neighbour(index - 1), neighbour(index + 1), task.position);

        if (column === task.status) {
            if (DATE_ORDERED.has(column)) return; // ordered by date, not by hand
            const before = stored[key];
            const unchanged = before.indexOf(task.id) === index && before.length === list.length;
            if (!unchanged && position !== task.position) setStatus(task, task.status, { position });
            return;
        }
        const requested = boardTargetStatus(task, column, { isOwner, settings });
        if (requested) setStatus(task, requested, { position });
    };

    const renderColumn = (lane, status) => {
        const key = keyOf(lane, status);
        const ids = items[key] || [];
        const dimmed = activeTask && key !== keyOf(laneOf(activeTask), activeTask.status) && !allowedIn(activeTask, key);
        const older = status === "DONE" ? olderDone[key] || 0 : 0;
        // In a lane, quick add assigns to that person (owners), or appears only in your own lane.
        const quickAdd = QUICK_ADD_COLUMNS.has(status) && (!grouped || isOwner || lane === me);
        const empty = filtersActive
            ? "No matching tasks"
            : status === "IN_REVIEW" ? "Nothing waiting for review"
            : status === "DONE" ? "Nothing completed this week"
            : "No tasks";
        return (
            <BoardColumn
                key={key}
                droppableId={COLUMN_PREFIX + key}
                status={status}
                count={ids.length}
                dimmed={dimmed}
                compact={grouped}
                action={
                    status === "IN_REVIEW" && isOwner && ids.length > 0 && !grouped ? (
                        <Link to="/" title="Approve or send back from your review queue" className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-violet-700 dark:text-violet-300 hover:underline">
                            <ShieldCheck className="size-3.5" /> Review
                        </Link>
                    ) : null
                }
                footer={
                    <>
                        {status === "DONE" && older > 0 && !showOlderDone && (
                            <button type="button" onClick={() => setShowOlderDone(true)} className="w-full py-1.5 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                                {older} older completed · Show
                            </button>
                        )}
                        {quickAdd && <QuickAdd projectId={project.id} status={status} assigneeId={grouped && isOwner ? lane : undefined} />}
                    </>
                }
            >
                <SortableContext items={ids} strategy={verticalListSortingStrategy}>
                    {ids.map((id) => {
                        const task = tasksById.get(id);
                        return task ? <SortableCard key={id} task={task} disabled={!canEdit(task)} /> : null;
                    })}
                </SortableContext>
                {ids.length === 0 && <p className="px-2 py-6 text-center text-xs text-zinc-400 dark:text-zinc-500">{empty}</p>}
            </BoardColumn>
        );
    };

    const columnsRow = (lane) => (
        <div className="flex gap-3 overflow-x-auto pb-3 snap-x snap-mandatory xl:snap-none -mx-1 px-1">
            {BOARD_COLUMNS.map((status) => renderColumn(lane, status))}
        </div>
    );

    const laneCounts = (lane) => {
        const mine = shown.filter((t) => t.assigneeId === lane);
        return {
            open: mine.filter((t) => t.status === "TODO" || t.status === "IN_PROGRESS").length,
            blocked: mine.filter((t) => t.status === "BLOCKED").length,
            review: mine.filter((t) => t.status === "IN_REVIEW").length,
        };
    };

    return (
        <div>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                <label className="relative">
                    <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search tasks"
                        aria-label="Search tasks"
                        className="w-44 h-8 pl-8 pr-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </label>

                {people.length > 0 && (
                    <div className="flex items-center -space-x-1.5 pl-1" role="group" aria-label="Filter by assignee">
                        {people.map((p) => {
                            const on = assignees.includes(p.id);
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    aria-pressed={on}
                                    title={p.id === me ? `${p.name} (you)` : p.name}
                                    onClick={() => setAssignees((list) => (on ? list.filter((x) => x !== p.id) : [...list, p.id]))}
                                    className={`relative rounded-full ring-2 transition hover:z-10 hover:-translate-y-0.5 ${on ? "ring-blue-500 z-10" : "ring-white dark:ring-zinc-950"}`}
                                >
                                    <img src={p.image} alt={p.name} className="size-7 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                                </button>
                            );
                        })}
                    </div>
                )}

                {[
                    ["All types", type, setType, TYPE_OPTIONS],
                    ["All priorities", priority, setPriority, PRIORITY_OPTIONS],
                ].map(([allLabel, value, set, options]) => (
                    <select
                        key={allLabel}
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        aria-label={allLabel}
                        className="h-8 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none px-2 rounded-md text-sm text-zinc-900 dark:text-zinc-200"
                    >
                        <option value="">{allLabel}</option>
                        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                ))}

                {people.length > 1 && (
                    <button
                        type="button"
                        role="switch"
                        aria-checked={grouped}
                        onClick={toggleGrouping}
                        title="One row per person, so you can see everyone's workload"
                        className={`h-8 inline-flex items-center gap-1.5 px-2.5 rounded-md text-sm border transition ${grouped
                            ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300"
                            : "border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                    >
                        <Users className="size-3.5" /> Group by person
                    </button>
                )}

                {(query.trim() || type || priority || (assignees.length > 0 && !showingMine)) && (
                    <button type="button" onClick={clearFilters} className="h-8 inline-flex items-center gap-1 px-2.5 rounded-md text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                        <X className="size-3.5" /> Clear
                    </button>
                )}
            </div>

            {(showingMine || (showOlderDone && anyOlderDone)) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-sm text-zinc-500 dark:text-zinc-400">
                    {showingMine && (
                        <p>
                            Showing your tasks.{" "}
                            <button type="button" onClick={() => setAssignees([])} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                                Show everyone
                            </button>
                        </p>
                    )}
                    {showOlderDone && (
                        <p>
                            Showing all completed work.{" "}
                            <button type="button" onClick={() => setShowOlderDone(false)} className="font-medium text-blue-600 dark:text-blue-400 hover:underline">
                                Only this week
                            </button>
                        </p>
                    )}
                </div>
            )}

            <DndContext
                sensors={sensors}
                collisionDetection={closestCorners}
                onDragStart={onDragStart}
                onDragOver={onDragOver}
                onDragEnd={onDragEnd}
                onDragCancel={endDrag}
            >
                {grouped ? (
                    <div className="space-y-3">
                        {laneIds.map((lane) => (
                            <BoardLane
                                key={lane}
                                person={people.find((p) => p.id === lane)}
                                isMe={lane === me}
                                counts={laneCounts(lane)}
                                collapsed={collapsed.has(lane)}
                                onToggle={() => toggleLane(lane)}
                            >
                                {columnsRow(lane)}
                            </BoardLane>
                        ))}
                        {laneIds.length === 0 && (
                            <p className="py-10 text-center text-sm text-zinc-400 dark:text-zinc-500">{filtersActive ? "No matching tasks" : "No tasks yet"}</p>
                        )}
                    </div>
                ) : (
                    columnsRow(ALL)
                )}
                <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.2, 0, 0, 1)" }}>
                    {activeTask ? <BoardCard task={activeTask} overlay /> : null}
                </DragOverlay>
            </DndContext>
        </div>
    );
}

// `compact`: inside a person's lane the page scrolls, not each column.
function BoardColumn({ droppableId, status, count, dimmed, compact, action, footer, children }) {
    const { setNodeRef, isOver } = useDroppable({ id: droppableId });
    const meta = STATUS_META[status];
    return (
        <section
            aria-label={`${meta.label}, ${count} ${count === 1 ? "task" : "tasks"}`}
            className={`snap-start shrink-0 w-[78vw] sm:w-72 xl:w-auto xl:flex-1 xl:min-w-0 flex flex-col rounded-xl bg-zinc-100/80 dark:bg-zinc-900/60 border transition ${dimmed ? "opacity-40 border-transparent" : isOver ? "border-blue-400/60" : "border-transparent"}`}
        >
            <header className="flex items-center gap-2 px-3 pt-3 pb-2" title={COLUMN_HINTS[status]}>
                <span className={`size-2 rounded-full ${meta.dot}`} />
                <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-300">{meta.label}</h3>
                <span className="text-xs text-zinc-400 tabular-nums">{count}</span>
                {dimmed ? <Ban className="size-3.5 ml-auto text-zinc-400" aria-label="Can't move here" /> : action}
            </header>
            <div ref={setNodeRef} className={`flex-1 flex flex-col gap-2 px-2 pb-1 overflow-x-hidden ${compact ? "min-h-16" : "min-h-24 max-h-[65vh] overflow-y-auto"}`}>
                {children}
            </div>
            <div className="px-2 pb-2">{footer}</div>
        </section>
    );
}

function SortableCard({ task, disabled }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id, disabled });
    return (
        <div
            ref={setNodeRef}
            style={{ transform: CSS.Translate.toString(transform), transition }}
            {...attributes}
            {...listeners}
            className={`outline-none rounded-lg focus-visible:ring-2 focus-visible:ring-blue-500 ${isDragging ? "opacity-40" : ""}`}
        >
            <BoardCard task={task} draggable={!disabled} />
        </div>
    );
}
