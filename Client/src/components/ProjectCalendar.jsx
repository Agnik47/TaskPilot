import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useUser } from "@clerk/clerk-react";
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { addDays, addMonths, differenceInCalendarDays, format, isSameMonth, startOfDay, startOfMonth } from "date-fns";
import toast from "react-hot-toast";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import useOrgRole from "../hooks/useOrgRole";
import { updateTask } from "../features/workspaceSlice";
import { dayEntries, dayKey, dueKey, indexByDay, monthDays } from "../lib/calendar";
import { dueDateOf, dueInfo } from "../lib/dates";
import { isSettled } from "../lib/taskWorkflow";
import { peopleOptions } from "../lib/people";
import Card from "./Card";
import FilterSelect from "./FilterSelect";
import CompletedToggle from "./CompletedToggle";
import CreateTaskDialog from "./CreateTaskDialog";
import DayCell from "./calendar/DayCell";
import DayPanel from "./calendar/DayPanel";
import { TaskChip } from "./calendar/TaskChip";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ARROWS = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
const keyToDate = (key) => dueDateOf({ due_date: key });

// Upcoming work in the order people plan it: today, tomorrow, this week, later.
function groupUpcoming(tasks, today) {
    const groups = [
        { label: "Today", tasks: [] },
        { label: "Tomorrow", tasks: [] },
        { label: "Next 7 days", tasks: [], showDue: true },
        { label: "Later", tasks: [], showDue: true },
    ];
    for (const task of tasks) {
        const days = differenceInCalendarDays(dueDateOf(task), today);
        groups[days <= 0 ? 0 : days === 1 ? 1 : days <= 7 ? 2 : 3].tasks.push(task);
    }
    return groups.filter((g) => g.tasks.length > 0);
}

const ProjectCalendar = ({ tasks, project }) => {
    const dispatch = useDispatch();
    const { user } = useUser();
    const { isOwner } = useOrgRole();
    const weekStartsOn = useSelector((state) => state.workspace.settings.weekStartsOn);

    const [today] = useState(() => startOfDay(new Date()));
    const todayKey = dayKey(today);
    const [month, setMonth] = useState(() => startOfMonth(today));
    const [selectedKey, setSelectedKey] = useState(todayKey);
    const [assignee, setAssignee] = useState("");
    const [showCompleted, setShowCompleted] = useState(false);
    const [createFor, setCreateFor] = useState(null);
    const [dragging, setDragging] = useState(null);
    const gridRef = useRef(null);
    const focusKey = useRef(null);

    const me = user?.id;
    // Same rule as the task table: being waited on lets you see a task, not change it.
    const canEdit = useCallback((task) => isOwner || task.creatorId === me || task.assigneeId === me, [isOwner, me]);

    const assigneeOptions = useMemo(() => peopleOptions(tasks.map((t) => t.assignee).filter(Boolean), me), [tasks, me]);
    const completedCount = useMemo(() => tasks.filter((t) => t.status === "DONE").length, [tasks]);

    const visible = useMemo(
        () => tasks.filter((t) => (!assignee || t.assigneeId === assignee) && (showCompleted || t.status !== "DONE")),
        [tasks, assignee, showCompleted]
    );
    const index = useMemo(() => indexByDay(visible), [visible]);

    const { overdue, upcoming, undated } = useMemo(() => {
        const byDue = (a, b) => dueDateOf(a) - dueDateOf(b);
        const open = visible.filter((t) => !isSettled(t.status));
        return {
            overdue: open.filter((t) => dueInfo(t, today)?.overdue).sort(byDue),
            upcoming: groupUpcoming(open.filter((t) => t.due_date && !dueInfo(t, today).overdue).sort(byDue), today),
            undated: visible.filter((t) => !t.due_date && t.status !== "DONE"),
        };
    }, [visible, today]);

    const days = useMemo(
        () => monthDays(month, weekStartsOn).map((date) => ({ key: dayKey(date), number: date.getDate(), label: format(date, "EEEE, d MMMM"), inMonth: isSameMonth(date, month) })),
        [month, weekStartsOn]
    );
    const weekdays = [...WEEKDAYS.slice(weekStartsOn), ...WEEKDAYS.slice(0, weekStartsOn)];

    // Project start and deadline, shown as a flag on their day.
    const milestones = useMemo(() => {
        const map = {};
        const start = dueKey(project?.start_date);
        const end = dueKey(project?.end_date);
        if (start) map[start] = "Project starts";
        if (end) map[end] = start === end ? "Project starts and is due" : "Project deadline";
        return map;
    }, [project?.start_date, project?.end_date]);

    const select = useCallback((key) => setSelectedKey(key), []);
    const openCreate = useCallback((key) => setCreateFor(key), []);

    const goTo = (date) => {
        setMonth(startOfMonth(date));
        setSelectedKey(dayKey(date));
    };

    // Arrow keys move the selected day (and the month with it).
    const onGridKeyDown = (e) => {
        const step = ARROWS[e.key];
        if (!step || !e.target.dataset?.day) return;
        e.preventDefault();
        const next = addDays(keyToDate(e.target.dataset.day), step);
        focusKey.current = dayKey(next);
        goTo(next);
    };
    useEffect(() => {
        if (!focusKey.current) return;
        gridRef.current?.querySelector(`[data-day="${focusKey.current}"]`)?.focus();
        focusKey.current = null;
    }, [selectedKey, month]);

    // A small movement threshold keeps a click on a chip a click.
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const onDragEnd = async ({ active, over }) => {
        setDragging(null);
        const task = active.data.current?.task;
        if (!task || !over || over.id === dueKey(task.due_date)) return;
        try {
            await dispatch(updateTask({ id: task.id, due_date: over.id })).unwrap();
            toast.success(`Due ${format(keyToDate(over.id), "EEE, d MMM")}`);
        } catch (error) {
            toast.error(error?.message || "Couldn't change the due date");
        }
    };

    const selected = { key: selectedKey, date: keyToDate(selectedKey) };

    return (
        <DndContext sensors={sensors} onDragStart={({ active }) => setDragging(active.data.current?.task || null)} onDragEnd={onDragEnd} onDragCancel={() => setDragging(null)}>
            <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
                <Card className="lg:col-span-2 self-start">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div className="flex items-center gap-1">
                            <h2 className="mr-2 flex items-center gap-2 font-medium text-zinc-900 dark:text-white">
                                <CalendarIcon className="size-4 text-zinc-500 dark:text-zinc-400" />
                                <span className="min-w-32" aria-live="polite">{format(month, "MMMM yyyy")}</span>
                            </h2>
                            <button type="button" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month" className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                <ChevronLeft className="size-5" />
                            </button>
                            <button type="button" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month" className="p-1 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                <ChevronRight className="size-5" />
                            </button>
                            <button type="button" onClick={() => goTo(today)} className="ml-1 px-2.5 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                                Today
                            </button>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {isOwner && assigneeOptions.length > 1 && (
                                <FilterSelect
                                    label="Assignee"
                                    value={assignee}
                                    options={[{ value: "", label: "All assignees" }, ...assigneeOptions]}
                                    onChange={setAssignee}
                                    searchPlaceholder="Search people by name or email…"
                                    menuWidth={280}
                                    showImage
                                />
                            )}
                            <CompletedToggle shown={showCompleted} count={completedCount} onChange={setShowCompleted} />
                        </div>
                    </div>

                    <div className="grid grid-cols-7 gap-1 sm:gap-1.5 mb-1.5 text-center text-xs text-zinc-500 dark:text-zinc-400">
                        {weekdays.map((day) => <div key={day}>{day}</div>)}
                    </div>

                    <div ref={gridRef} onKeyDown={onGridKeyDown} className="grid grid-cols-7 gap-1 sm:gap-1.5">
                        {days.map((day) => {
                            const entries = dayEntries(index, day.key);
                            return (
                                <DayCell
                                    key={day.key}
                                    day={day}
                                    tasks={entries.tasks}
                                    items={entries.items}
                                    milestone={milestones[day.key]}
                                    inMonth={day.inMonth}
                                    isToday={day.key === todayKey}
                                    isPast={day.key < todayKey}
                                    isSelected={day.key === selectedKey}
                                    canEdit={canEdit}
                                    onSelect={select}
                                    onCreate={openCreate}
                                />
                            );
                        })}
                    </div>
                    <p className="max-sm:hidden mt-3 text-xs text-zinc-500 dark:text-zinc-400">Drag a task to another day to change its due date.</p>
                </Card>

                <DayPanel
                    selected={selected}
                    entries={dayEntries(index, selectedKey)}
                    milestone={milestones[selectedKey]}
                    isPast={selectedKey < todayKey}
                    overdue={overdue}
                    upcoming={upcoming}
                    undated={undated}
                    canEdit={canEdit}
                    onCreate={openCreate}
                />
            </div>

            <DragOverlay dropAnimation={null}>{dragging && <TaskChip task={dragging} overlay />}</DragOverlay>

            {createFor && (
                <CreateTaskDialog showCreateTask setShowCreateTask={(open) => !open && setCreateFor(null)} projectId={project?.id} initialDueDate={createFor} />
            )}
        </DndContext>
    );
};

export default ProjectCalendar;
