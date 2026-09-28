import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { AlignLeft, ArrowUpRight, Bug, GitCommit, Loader2Icon, MessageSquare, Plus, Square, Trash2, X, Zap } from "lucide-react";
import useOrgRole from "../hooks/useOrgRole";
import useTaskActions from "../hooks/useTaskActions";
import useCompletedTasks from "../hooks/useCompletedTasks";
import CompletedToggle from "./CompletedToggle";
import { statusOptionsFor } from "../lib/taskWorkflow";
import { bulkCreateTasks, deleteTask, updateTask } from "../features/workspaceSlice";
import { ConfirmDialog } from "./settings/SettingsUI";
import { SORT_OPTIONS, sortByPosition, sortTasks } from "../lib/taskOrder";
import { SortableItem, SortableTaskList } from "./SortableTasks";
import WaitingOnBadge from "./blockers/WaitingOnBadge";
import ChecklistProgress from "./checklist/ChecklistProgress";
import CellSelect from "./sheet/CellSelect";
import DateCell from "./sheet/DateCell";
import {
    PASTE_ORDER,
    PRIORITY_OPTIONS,
    STATUS_OPTIONS,
    TYPE_OPTIONS,
    dueDateToInput,
    mapHeaderRow,
    parseCellForColumn,
    parseClipboardGrid,
} from "../lib/sheet";

// Spreadsheet-style task entry with two layouts sharing one data model:
//  - Grid (enough width): fixed columns that fit the space, so no sideways
//    scrolling; arrow keys move between cells like a spreadsheet.
//  - Cards (tablet/phone or a narrow pane): each task is a compact card with
//    every field as a tappable chip.
// Existing tasks save per cell; new rows are drafts saved together in one
// request. Rows can be pasted from Excel / Google Sheets (header-aware).

const WIDE_MIN_WIDTH = 900; // below this the grid would need sideways scrolling

const TYPE_META = {
    TASK: { icon: Square, iconClass: "text-green-600 dark:text-green-400" },
    BUG: { icon: Bug, iconClass: "text-red-600 dark:text-red-400" },
    FEATURE: { icon: Zap, iconClass: "text-blue-600 dark:text-blue-400" },
    IMPROVEMENT: { icon: GitCommit, iconClass: "text-purple-600 dark:text-purple-400" },
    OTHER: { icon: MessageSquare, iconClass: "text-amber-600 dark:text-amber-400" },
};
const TYPE_ITEMS = TYPE_OPTIONS.map((o) => ({ ...o, ...TYPE_META[o.value] }));

const TINTS = {
    status: {
        TODO: ["bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", "bg-zinc-400"],
        IN_PROGRESS: ["bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", "bg-blue-500"],
        BLOCKED: ["bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300", "bg-red-500"],
        IN_REVIEW: ["bg-violet-50 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300", "bg-violet-500"],
        DONE: ["bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300", "bg-emerald-500"],
    },
    priority: {
        LOW: ["bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300", "bg-zinc-400"],
        MEDIUM: ["bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", "bg-blue-500"],
        HIGH: ["bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", "bg-amber-500"],
        URGENT: ["bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300", "bg-red-500"],
    },
};
const STATUS_ITEMS = STATUS_OPTIONS.map((o) => ({ ...o, dot: TINTS.status[o.value][1] }));
const PRIORITY_ITEMS = PRIORITY_OPTIONS.map((o) => ({ ...o, dot: TINTS.priority[o.value][1] }));

// Grid columns (Type lives as an icon inside the Task cell; Description is optional).
const COLUMNS = {
    title: { label: "Task", required: true },
    assigneeId: { label: "Assignee", width: 176 },
    status: { label: "Status", width: 140 },
    priority: { label: "Priority", width: 120 },
    due_date: { label: "Due date", width: 132 },
    description: { label: "Description", width: 240 },
};

function Pill({ kind, value, label }) {
    const [tint, dot] = TINTS[kind][value] || TINTS[kind][Object.keys(TINTS[kind])[0]];
    return (
        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${tint}`}>
            <span className={`size-1.5 rounded-full ${dot}`} />
            {label}
        </span>
    );
}

let draftSeq = 0;
const newDraftKey = () => `draft-${Date.now()}-${draftSeq++}`;
const isBlank = (v) => !v.title.trim() && !v.description.trim() && !v.due_date;

const EMPTY_FILTERS = { status: "", type: "", priority: "", assigneeId: "" };
// Filter can match IN_REVIEW even though it's not a status you can pick in a cell.
const STATUS_FILTER_OPTIONS = [...STATUS_OPTIONS.slice(0, -1), { value: "IN_REVIEW", label: "In Review" }, STATUS_OPTIONS.at(-1)];

const SHOW_DESC_KEY = "sheet.showDescription";
const readShowDescription = () => {
    try {
        return localStorage.getItem(SHOW_DESC_KEY) === "1";
    } catch {
        return false;
    }
};

export default function TaskSheet({ project }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useUser();
    const { isOwner } = useOrgRole();
    const settings = useSelector((state) => state.workspace.settings);
    const { defaultTaskType, defaultTaskPriority } = settings;
    const { setStatus, move } = useTaskActions();
    const containerRef = useRef(null);
    const gridRef = useRef(null);

    // ---- layout: measure the space we actually have (sidebar-aware) ----
    const [wide, setWide] = useState(true);
    useLayoutEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => setWide(el.clientWidth >= WIDE_MIN_WIDTH);
        update();
        const observer = new ResizeObserver(update);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const [showDescription, setShowDescription] = useState(readShowDescription);
    const toggleDescription = () => {
        setShowDescription((v) => {
            try { localStorage.setItem(SHOW_DESC_KEY, v ? "0" : "1"); } catch { /* not persisted */ }
            return !v;
        });
    };
    const columns = ["title", "assigneeId", "status", "priority", "due_date", ...(showDescription ? ["description"] : [])];

    // ---- data ----
    const me = user?.id;
    const tasks = useMemo(
        () => sortByPosition(project.tasks || []),
        [project.tasks]
    );

    // ---- filters (same set as the table view) ----
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const filtersActive = Object.values(filters).some(Boolean);
    // A sorted view can't be dragged: the order shown isn't the stored order.
    const [sort, setSort] = useState("");
    const { showCompleted, setShowCompleted, completedCount, isShown } = useCompletedTasks(tasks);
    const hiddenCompleted = !showCompleted && filters.status !== "DONE" ? completedCount : 0;
    const assigneeFilterOptions = useMemo(() => {
        const byId = new Map();
        tasks.forEach((t) => t.assignee && byId.set(t.assignee.id, t.assignee.name));
        return [...byId].map(([value, label]) => ({ value, label }));
    }, [tasks]);
    // Existing tasks shown in the grid; drafts are never filtered out.
    const visibleTasks = useMemo(
        () =>
            sortTasks(tasks.filter((t) =>
                (!filters.status || t.status === filters.status) &&
                (!filters.type || t.type === filters.type) &&
                (!filters.priority || t.priority === filters.priority) &&
                (!filters.assigneeId || t.assigneeId === filters.assigneeId) &&
                isShown(t, filters.status === "DONE")
            ), sort),
        [tasks, filters, sort, isShown]
    );
    const visibleTaskIds = visibleTasks.map((t) => t.id);
    const handleMove = (activeId, overId) => move(visibleTasks, activeId, overId);

    // Who can be assigned: project members for owners; employees only themselves.
    const people = useMemo(() => {
        const members = (project.members || []).map((m) => m.user).filter(Boolean);
        const self = members.find((u) => u.id === me) || { id: me, name: user?.fullName || "Me", image: user?.imageUrl, email: user?.primaryEmailAddress?.emailAddress };
        return isOwner ? (members.some((u) => u.id === me) ? members : [self, ...members]) : [self];
    }, [project.members, isOwner, me, user]);

    const blankValues = () => ({
        title: "",
        assigneeId: me || "",
        status: "TODO",
        priority: defaultTaskPriority,
        type: defaultTaskType,
        due_date: "",
        description: "",
    });

    const [drafts, setDrafts] = useState(() => [{ key: newDraftKey(), values: blankValues() }]);
    const [showErrors, setShowErrors] = useState(false);
    const [saving, setSaving] = useState(false);
    const [pendingDelete, setPendingDelete] = useState(null);

    const filledDrafts = drafts.filter((d) => !isBlank(d.values));
    const invalidOf = (v) => ({ title: !v.title.trim() });
    const invalidCount = filledDrafts.filter((d) => Object.values(invalidOf(d.values)).some(Boolean)).length;
    const hasUnsaved = filledDrafts.length > 0;

    // Always keep an empty row at the bottom to type into.
    const withTrailingBlank = (list) =>
        list.length && isBlank(list.at(-1).values) ? list : [...list, { key: newDraftKey(), values: blankValues() }];

    const setDraftValue = (key, field, value) =>
        setDrafts((prev) => withTrailingBlank(prev.map((d) => (d.key === key ? { ...d, values: { ...d.values, [field]: value } } : d))));
    const removeDraft = (key) => setDrafts((prev) => withTrailingBlank(prev.filter((d) => d.key !== key)));
    const resetDrafts = () => {
        setDrafts([{ key: newDraftKey(), values: blankValues() }]);
        setShowErrors(false);
    };
    const addRows = (n) =>
        setDrafts((prev) => [...prev.filter((d) => !isBlank(d.values)), ...Array.from({ length: n + 1 }, () => ({ key: newDraftKey(), values: blankValues() }))]);

    // ---- existing tasks: save one field at a time ----
    const canEdit = (t) => isOwner || t.creatorId === me || t.assigneeId === me;
    const canDelete = () => isOwner;

    const commitTask = async (task, field, value) => {
        if (field === "status") return setStatus(task, value);
        if (field === "title" && !value.trim()) {
            toast.error("A task needs a title");
            return false;
        }
        const current = field === "due_date" ? dueDateToInput(task.due_date) : (task[field] ?? "");
        if (value === current) return true;
        try {
            await dispatch(updateTask({ id: task.id, [field]: typeof value === "string" && field !== "due_date" ? value.trim() : value })).unwrap();
            return true;
        } catch (error) {
            toast.error(error?.response?.data?.message || error.message || "Couldn't save that change");
            return false;
        }
    };

    // ---- focus helpers (shared by keyboard nav + validation) ----
    const focusCell = (row, field) => {
        if (row < 0 || !field) return;
        const el = containerRef.current?.querySelector(`[data-cell="${row}:${field}"]`);
        if (!el) return;
        el.focus();
        if (el.tagName === "INPUT") el.select();
        el.scrollIntoView({ block: "nearest", inline: "nearest" });
    };

    const focusFirstInvalid = () => {
        const index = drafts.findIndex((d) => !isBlank(d.values) && Object.values(invalidOf(d.values)).some(Boolean));
        if (index === -1) return;
        requestAnimationFrame(() => focusCell(visibleTasks.length + index, "title"));
    };

    // ---- save all new rows in one request ----
    const saveDrafts = async () => {
        if (saving || !filledDrafts.length) return;
        if (invalidCount) {
            setShowErrors(true);
            toast.error(`${invalidCount} new ${invalidCount === 1 ? "row needs" : "rows need"} a task name`);
            focusFirstInvalid();
            return;
        }
        try {
            setSaving(true);
            const payload = filledDrafts.map(({ values: v }) => ({
                title: v.title.trim(),
                assigneeId: v.assigneeId || undefined,
                status: v.status,
                priority: v.priority,
                type: v.type,
                due_date: v.due_date,
                description: v.description.trim() || undefined,
            }));
            const created = await dispatch(bulkCreateTasks({ projectId: project.id, tasks: payload })).unwrap();
            resetDrafts();
            toast.success(`Created ${created.length} ${created.length === 1 ? "task" : "tasks"}`);
        } catch (error) {
            toast.error(error?.response?.data?.message || error.message || "Couldn't create the tasks");
        } finally {
            setSaving(false);
        }
    };

    // Ctrl/⌘+S saves new rows; warn before leaving with unsaved rows.
    const saveRef = useRef(saveDrafts);
    saveRef.current = saveDrafts;
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                e.preventDefault();
                saveRef.current();
            }
        };
        const onBeforeUnload = (e) => {
            if (hasUnsaved) e.preventDefault();
        };
        window.addEventListener("keydown", onKey);
        window.addEventListener("beforeunload", onBeforeUnload);
        return () => {
            window.removeEventListener("keydown", onKey);
            window.removeEventListener("beforeunload", onBeforeUnload);
        };
    }, [hasUnsaved]);

    // ---- spreadsheet keyboard navigation (grid layout) ----
    const handleGridKeyDown = (e) => {
        // Ignore keys from dropdown menus (portalled outside the grid) and handled keys.
        if (!gridRef.current?.contains(e.target) || e.defaultPrevented || e.nativeEvent.isComposing) return;
        const cell = e.target.closest?.("[data-cell]");
        if (!cell) return;
        const [rowText, field] = cell.dataset.cell.split(":");
        const row = Number(rowText);
        const col = columns.indexOf(field);
        const isText = cell.tagName === "INPUT";
        const move = (dRow, dCol) => {
            e.preventDefault();
            focusCell(row + dRow, columns[col + dCol]);
        };

        switch (e.key) {
            case "Enter":
                if (isText) move(e.shiftKey ? -1 : 1, 0);
                break;
            case "ArrowDown":
                move(1, 0);
                break;
            case "ArrowUp":
                move(-1, 0);
                break;
            case "ArrowLeft":
                if (!isText || (cell.selectionStart === 0 && cell.selectionEnd === 0)) move(0, -1);
                break;
            case "ArrowRight":
                if (!isText || cell.selectionStart === cell.value.length) move(0, 1);
                break;
            default:
        }
    };

    // ---- paste from Excel / Google Sheets ----
    const handlePaste = (e) => {
        const cell = e.target.closest?.("[data-cell]");
        const text = e.clipboardData.getData("text/plain");
        if (!cell || !text || (!text.includes("\t") && !text.includes("\n"))) return; // single value: normal paste

        e.preventDefault();
        let grid = parseClipboardGrid(text);
        const [rowText, startField] = cell.dataset.cell.split(":");
        const row = Number(rowText);

        // A copied header row decides the column mapping; otherwise columns
        // follow the sheet's order starting from the pasted-into column.
        const headerFields = grid[0] ? mapHeaderRow(grid[0]) : null;
        let fieldsForColumns;
        if (headerFields) {
            fieldsForColumns = headerFields;
            grid = grid.slice(1);
        } else {
            fieldsForColumns = PASTE_ORDER.slice(Math.max(0, PASTE_ORDER.indexOf(startField)));
        }
        if (!grid.length) return;

        const unreadable = [];
        const parsedRows = grid.map((cells) => {
            const values = {};
            cells.forEach((raw, i) => {
                const field = fieldsForColumns[i];
                if (!field || (field === "assigneeId" && !isOwner)) return; // employees always assign themselves
                const { value, ok } = parseCellForColumn(field, raw, { people });
                if (!ok) unreadable.push(`"${raw}"`);
                if (value !== undefined) values[field] = value;
            });
            return values;
        });

        // Pasting onto an existing task appends new rows instead of overwriting tasks.
        const startDraft = Math.max(0, row - visibleTasks.length);
        setDrafts((prev) => {
            const next = [...prev];
            parsedRows.forEach((values, i) => {
                const index = startDraft + i;
                if (next[index]) next[index] = { ...next[index], values: { ...next[index].values, ...values } };
                else next.push({ key: newDraftKey(), values: { ...blankValues(), ...values } });
            });
            return withTrailingBlank(next);
        });

        toast.success(`Pasted ${parsedRows.length} ${parsedRows.length === 1 ? "row" : "rows"}${headerFields ? " (matched by column headers)" : ""}. Review, then save.`);
        if (unreadable.length) {
            toast(`${unreadable.length} ${unreadable.length === 1 ? "value wasn't" : "values weren't"} recognised and kept the default: ${unreadable.slice(0, 3).join(", ")}${unreadable.length > 3 ? "…" : ""}`, { duration: 6000 });
        }
    };

    // ---- field editors (shared by grid cells and card chips) ----
    const assigneeOptions = (currentAssignee) => {
        const list = currentAssignee && !people.some((p) => p.id === currentAssignee.id) ? [currentAssignee, ...people] : people;
        return list.map((p) => ({ value: p.id, label: p.name, image: p.image || "", hint: p.id === me ? "You" : undefined }));
    };

    // variant: "cell" (grid) or "chip" (cards)
    const renderField = (field, { row, kind, task, values, onChange, disabled, currentAssignee, variant }) => {
        const dataCell = `${row}:${field}`;
        const cell = variant === "cell";
        const chipBase = "h-8 rounded-md border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-sm";
        const chipClass = `${chipBase} px-2.5`;

        switch (field) {
            case "assigneeId": {
                const options = assigneeOptions(currentAssignee);
                return (
                    <CellSelect
                        dataCell={dataCell}
                        label="Assignee"
                        value={values.assigneeId}
                        options={options}
                        onChange={(v) => onChange("assigneeId", v)}
                        disabled={disabled.assigneeId}
                        searchable={options.length > 6}
                        menuWidth={240}
                        className={cell ? "w-full h-10 px-3" : chipClass}
                        renderValue={(o) =>
                            o ? (
                                <span className="flex items-center gap-2 min-w-0">
                                    <img src={o.image} alt="" className="size-5 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                                    <span className="truncate text-sm text-zinc-800 dark:text-zinc-200">{cell ? o.label : o.label.split(" ")[0]}</span>
                                </span>
                            ) : <span className="text-sm text-zinc-400">Unassigned</span>
                        }
                    />
                );
            }
            case "status":
            case "priority":
                return (
                    <CellSelect
                        dataCell={dataCell}
                        label={COLUMNS[field].label}
                        value={values[field]}
                        options={field === "status" ? (kind === "task" ? statusOptionsFor(task, { isOwner, settings }) : STATUS_ITEMS) : PRIORITY_ITEMS}
                        menuWidth={field === "status" ? 230 : 180}
                        onChange={(v) => onChange(field, v)}
                        disabled={disabled[field]}
                        className={cell ? "w-full h-10 px-3" : `${chipBase} px-1.5`}
                        renderValue={(o) => <Pill kind={field} value={values[field]} label={o?.label ?? values[field]} />}
                    />
                );
            case "due_date":
                return (
                    <DateCell
                        dataCell={dataCell}
                        value={values.due_date}
                        status={values.status}
                        onChange={(v) => onChange("due_date", v)}
                        disabled={disabled.due_date}
                        allowClear
                        className={cell ? "h-10 px-3 text-sm" : `${chipClass} text-sm`}
                    />
                );
            default:
                return null;
        }
    };

    const typePicker = (values, onChange, disabled) => (
        <CellSelect
            label="Type"
            value={values.type}
            options={TYPE_ITEMS}
            onChange={(v) => onChange("type", v)}
            disabled={disabled}
            hideChevron
            menuWidth={180}
            className="shrink-0 size-8 justify-center rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            renderValue={(o) => {
                const Icon = (o && TYPE_META[o.value]?.icon) || Square;
                return <Icon className={`size-4 ${o ? TYPE_META[o.value].iconClass : "text-zinc-400"}`} />;
            }}
        />
    );

    // Normalises existing tasks and drafts into one row model.
    const rows = [
        ...visibleTasks.map((task, i) => ({
            kind: "task",
            key: task.id,
            row: i,
            task,
            values: {
                title: task.title,
                assigneeId: task.assigneeId,
                status: task.status,
                priority: task.priority,
                type: task.type,
                due_date: dueDateToInput(task.due_date),
                description: task.description || "",
            },
            onChange: (field, v) => commitTask(task, field, v),
            editable: canEdit(task),
            disabled: {
                assigneeId: !isOwner || !canEdit(task),
                status: !canEdit(task),
                priority: !canEdit(task),
                due_date: !canEdit(task),
                type: !canEdit(task),
            },
        })),
        ...drafts.map((draft, i) => {
            const blank = isBlank(draft.values);
            return {
                kind: "draft",
                key: draft.key,
                row: visibleTasks.length + i,
                draft,
                blank,
                values: draft.values,
                onChange: (field, v) => setDraftValue(draft.key, field, v),
                editable: true,
                invalid: showErrors && !blank ? invalidOf(draft.values) : {},
                disabled: { assigneeId: !isOwner },
            };
        }),
    ];

    const rowActions = (r) => {
        if (r.kind === "task") {
            return (
                <>
                    <button type="button" onClick={() => navigate(`/taskDetails?projectId=${project.id}&taskId=${r.task.id}`)} title="Open task" aria-label={`Open ${r.task.title}`} className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800">
                        <ArrowUpRight className="size-4" />
                    </button>
                    {canDelete(r.task) && (
                        <button type="button" onClick={() => setPendingDelete(r.task)} title="Delete task" aria-label={`Delete ${r.task.title}`} className="p-1.5 rounded-md text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                            <Trash2 className="size-4" />
                        </button>
                    )}
                </>
            );
        }
        if (r.blank) return null;
        return (
            <button type="button" onClick={() => removeDraft(r.key)} title="Remove row" aria-label="Remove new row" className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800">
                <X className="size-4" />
            </button>
        );
    };

    const titleInput = (r, className) => (
        <TextCell
            dataCell={`${r.row}:title`}
            value={r.values.title}
            onChange={r.kind === "draft" ? (v) => r.onChange("title", v) : undefined}
            onCommit={r.kind === "task" ? (v) => r.onChange("title", v) : undefined}
            disabled={!r.editable}
            placeholder={r.kind === "draft" ? (r.row === 0 ? "Type your first task…" : "Add a task…") : ""}
            className={className}
            ariaLabel="Task name"
        />
    );

    const descriptionInput = (r, className, placeholder = "") => (
        <TextCell
            dataCell={`${r.row}:description`}
            value={r.values.description}
            onChange={r.kind === "draft" ? (v) => r.onChange("description", v) : undefined}
            onCommit={r.kind === "task" ? (v) => r.onChange("description", v) : undefined}
            disabled={!r.editable}
            placeholder={placeholder}
            className={className}
            ariaLabel="Description"
        />
    );

    // ---- layouts ----
    const cellBorder = "border-b border-zinc-200 dark:border-zinc-800";
    const invalidRing = "bg-red-50/70 dark:bg-red-500/10 shadow-[inset_0_0_0_1px_rgb(248_113_113)]";

    // Cells of one grid row. `handle` is the drag grip (existing, editable tasks
    // only); it replaces the row number while the row is hovered or focused.
    const gridRowCells = (r, handle) => (
        <>
            <td className={`${cellBorder} text-center text-xs text-zinc-400 tabular-nums`}>
                {handle ? (
                    <div className="relative flex items-center justify-center h-10">
                        <span className="group-hover:opacity-0 group-focus-within:opacity-0 transition-opacity">{r.row + 1}</span>
                        <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">{handle}</span>
                    </div>
                ) : r.kind === "task" ? r.row + 1 : r.blank ? <Plus className="size-3.5 mx-auto text-zinc-300 dark:text-zinc-600" /> : <span className="inline-block size-1.5 rounded-full bg-blue-500" title="Not saved yet" />}
            </td>
            {columns.map((field) => (
                <td
                    key={field}
                    className={`${cellBorder} p-0 focus-within:shadow-[inset_0_0_0_2px_rgb(59_130_246)] ${r.invalid?.[field] ? invalidRing : ""}`}
                >
                    {field === "title" ? (
                        <div className="flex items-center pl-1.5">
                            {typePicker(r.values, r.onChange, r.kind === "task" && r.disabled.type)}
                            {/* The name always keeps most of the cell; the badges shrink to fit beside it. */}
                            {titleInput(r, "flex-1 min-w-[55%] h-10 pl-1.5 pr-2")}
                            {r.kind === "task" && (
                                <div className="flex items-center justify-end gap-1.5 min-w-0 shrink pr-2">
                                    <ChecklistProgress task={r.task} className="shrink-0" />
                                    <WaitingOnBadge task={r.task} compact className="min-w-0" />
                                </div>
                            )}
                        </div>
                    ) : field === "description" ? (
                        descriptionInput(r, "w-full h-10 px-3")
                    ) : (
                        renderField(field, { ...r, variant: "cell", currentAssignee: r.kind === "task" ? r.task.assignee : null })
                    )}
                </td>
            ))}
            <td className={cellBorder}>
                <div className="flex items-center justify-end gap-0.5 pr-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                    {rowActions(r)}
                </div>
            </td>
        </>
    );

    const gridLayout = (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            <div className="overflow-auto max-h-[68vh]">
                <table
                    ref={gridRef}
                    onKeyDown={handleGridKeyDown}
                    onPaste={handlePaste}
                    // The optional Description column is the only thing that may need sideways scrolling.
                    style={{ minWidth: showDescription ? 1150 : undefined }}
                    className="w-full table-fixed border-separate border-spacing-0 text-sm"
                >
                    <colgroup>
                        <col style={{ width: 44 }} />
                        {columns.map((c) => <col key={c} style={COLUMNS[c].width ? { width: COLUMNS[c].width } : undefined} />)}
                        <col style={{ width: 76 }} />
                    </colgroup>
                    <thead>
                        <tr>
                            <th className={`sticky top-0 z-10 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur ${cellBorder}`} />
                            {columns.map((c) => (
                                <th key={c} scope="col" className={`sticky top-0 z-10 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur ${cellBorder} px-3 h-9 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap`}>
                                    {COLUMNS[c].label}
                                    {COLUMNS[c].required && <span className="text-red-500 ml-0.5" aria-hidden>*</span>}
                                </th>
                            ))}
                            <th className={`sticky top-0 z-10 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur ${cellBorder}`} />
                        </tr>
                    </thead>
                    <SortableTaskList ids={visibleTaskIds} onMove={handleMove}>
                    <tbody>
                        {rows.map((r) => {
                            const rowClass = `group transition-colors ${r.kind === "draft" && !r.blank ? "bg-blue-50/60 dark:bg-blue-500/[0.07]" : "hover:bg-zinc-50/80 dark:hover:bg-zinc-900/70"}`;
                            return r.kind === "task" ? (
                                <SortableItem
                                    as="tr"
                                    key={r.key}
                                    id={r.key}
                                    disabled={!r.editable || !!sort}
                                    className={rowClass}
                                    draggingClassName="bg-white dark:bg-zinc-900 shadow-lg ring-1 ring-blue-500/40"
                                >
                                    {(handle) => gridRowCells(r, handle)}
                                </SortableItem>
                            ) : (
                                <tr key={r.key} className={rowClass}>{gridRowCells(r, null)}</tr>
                            );
                        })}
                    </tbody>
                    </SortableTaskList>
                </table>
                {tasks.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        No tasks yet. Type in the row above, or paste rows copied from Excel or Google Sheets.
                    </p>
                ) : visibleTasks.length === 0 && (
                    <p className="px-4 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">
                        {hiddenCompleted && tasks.every((t) => t.status === "DONE")
                            ? "All caught up. Every task here is done."
                            : hiddenCompleted ? "No open tasks match these filters. Completed tasks are hidden." : "No tasks found for the selected filters."}
                    </p>
                )}
            </div>
        </div>
    );

    const cardClass = (r) =>
        `rounded-xl border p-3 transition-colors ${r.kind === "draft" && !r.blank
            ? "border-blue-200 bg-blue-50/50 dark:border-blue-500/30 dark:bg-blue-500/[0.07]"
            : r.blank
                ? "border-dashed border-zinc-300 dark:border-zinc-700 bg-transparent"
                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"}`;

    const cardsLayout = (
        <div onPaste={handlePaste} className="space-y-2.5">
            <SortableTaskList ids={visibleTaskIds} onMove={handleMove}>
                {rows.map((r) =>
                    r.kind === "task" ? (
                        <SortableItem key={r.key} id={r.key} disabled={!r.editable || !!sort} className={cardClass(r)} draggingClassName="shadow-xl ring-1 ring-blue-500/40">
                            {(handle) => cardContent(r, handle)}
                        </SortableItem>
                    ) : (
                        <div key={r.key} className={cardClass(r)}>{cardContent(r, null)}</div>
                    )
                )}
            </SortableTaskList>
        </div>
    );

    function cardContent(r, handle) {
        return (
            <>
                    <div className="flex items-center gap-1">
                        {handle && <span className="-ml-1.5">{handle}</span>}
                        {typePicker(r.values, r.onChange, r.kind === "task" && r.disabled.type)}
                        <div className={`flex-1 min-w-0 rounded-md focus-within:ring-2 focus-within:ring-blue-500 ${r.invalid?.title ? invalidRing : ""}`}>
                            {titleInput(r, "w-full h-9 px-2 text-[15px] font-medium")}
                        </div>
                        {r.kind === "task" && <ChecklistProgress task={r.task} className="shrink-0" />}
                        <div className="flex items-center shrink-0">{rowActions(r)}</div>
                    </div>
                    {!r.blank && (
                        <>
                            {r.kind === "task" && <WaitingOnBadge task={r.task} className="mt-1.5 ml-1" />}
                            <div className="flex flex-wrap items-center gap-1.5 mt-2 pl-1">
                                {renderField("assigneeId", { ...r, variant: "chip", currentAssignee: r.kind === "task" ? r.task.assignee : null })}
                                {renderField("status", { ...r, variant: "chip" })}
                                {renderField("priority", { ...r, variant: "chip" })}
                                <div className={`rounded-md ${r.invalid?.due_date ? invalidRing : ""}`}>
                                    {renderField("due_date", { ...r, variant: "chip", currentAssignee: r.kind === "task" ? r.task.assignee : null })}
                                </div>
                            </div>
                            <div className="mt-1.5 pl-1 rounded-md focus-within:ring-2 focus-within:ring-blue-500">
                                {descriptionInput(r, "w-full h-8 px-2 text-sm text-zinc-600 dark:text-zinc-400", "Add a description…")}
                            </div>
                        </>
                    )}
            </>
        );
    }

    const saveBar = hasUnsaved && (
        <div
            className={`motion-rise flex items-center gap-2 ${wide
                ? ""
                : "fixed inset-x-3 bottom-3 z-40 sm:left-auto sm:right-6 sm:bottom-6 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur shadow-xl p-2 pl-4"}`}
        >
            <span className="text-sm text-zinc-600 dark:text-zinc-400 mr-auto whitespace-nowrap">
                {filledDrafts.length} new
                {showErrors && invalidCount > 0 && <span className="text-red-600 dark:text-red-400"> · {invalidCount} incomplete</span>}
            </span>
            <button type="button" onClick={resetDrafts} disabled={saving} className="px-3 py-1.5 rounded-md text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50">
                Discard
            </button>
            <button type="button" data-sfx="none" onClick={saveDrafts} disabled={saving} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 disabled:opacity-60">
                {saving && <Loader2Icon className="size-4 animate-spin" />}
                Save {filledDrafts.length} {filledDrafts.length === 1 ? "task" : "tasks"}
                {wide && <kbd className="text-[10px] opacity-80 border border-white/40 rounded px-1">Ctrl S</kbd>}
            </button>
        </div>
    );

    return (
        <div ref={containerRef} className={!wide && hasUnsaved ? "pb-20" : ""}>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-4">
                {[
                    ["status", "All Statuses", STATUS_FILTER_OPTIONS],
                    ["type", "All Types", TYPE_OPTIONS],
                    ["priority", "All Priorities", PRIORITY_OPTIONS],
                    ["assigneeId", "All Assignees", assigneeFilterOptions],
                ].map(([name, allLabel, options]) => (
                    <select
                        key={name}
                        name={name}
                        value={filters[name]}
                        onChange={(e) => setFilters((prev) => ({ ...prev, [name]: e.target.value }))}
                        className="border not-dark:bg-white border-zinc-300 dark:border-zinc-800 outline-none px-3 py-1 rounded text-sm text-zinc-900 dark:text-zinc-200"
                    >
                        <option value="">{allLabel}</option>
                        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                ))}
                <select
                    name="sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                    aria-label="Sort tasks"
                    title={sort ? "Switch back to Manual order to drag rows" : undefined}
                    className={`border outline-none px-3 py-1 rounded text-sm ${sort
                        ? "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300"
                        : "not-dark:bg-white border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200"}`}
                >
                    {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>Sort: {o.label}</option>)}
                </select>
                <CompletedToggle shown={showCompleted} count={completedCount} onChange={setShowCompleted} />
                {filtersActive && (
                    <button type="button" onClick={() => setFilters(EMPTY_FILTERS)} className="px-3 py-1 flex items-center gap-2 rounded bg-gradient-to-br from-purple-400 to-purple-500 text-zinc-100 dark:text-zinc-200 text-sm transition-colors">
                        <X className="size-3" /> Reset
                    </button>
                )}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mr-auto">
                    {(filtersActive || hiddenCompleted > 0) && `${visibleTasks.length} of `}{tasks.length} {tasks.length === 1 ? "task" : "tasks"}
                    {hiddenCompleted > 0 && <span className="text-zinc-400 dark:text-zinc-500"> · {hiddenCompleted} completed hidden</span>}
                </p>
                {wide && (
                    <>
                        <button
                            type="button"
                            role="switch"
                            aria-checked={showDescription}
                            onClick={toggleDescription}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm border transition ${showDescription
                                ? "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300"
                                : "border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                        >
                            <AlignLeft className="size-3.5" /> Description
                        </button>
                        <button type="button" onClick={() => addRows(5)} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                            <Plus className="size-3.5" /> Add rows
                        </button>
                    </>
                )}
            </div>

            {wide ? gridLayout : cardsLayout}

            {wide ? (
                <div className="flex flex-wrap items-center justify-between gap-3 mt-3 min-h-9">
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Arrow keys move between cells · <kbd className="font-sans">Enter</kbd> edits a dropdown · paste rows (with or without headers) from Excel or Google Sheets
                    </p>
                    {saveBar}
                </div>
            ) : (
                saveBar
            )}

            <ConfirmDialog
                open={!!pendingDelete}
                title="Delete task?"
                description={pendingDelete && <>"{pendingDelete.title}" and its comments will be permanently deleted.</>}
                confirmLabel="Delete task"
                onConfirm={async () => {
                    try {
                        await dispatch(deleteTask([pendingDelete.id])).unwrap();
                        toast.success("Task deleted");
                    } catch (error) {
                        toast.error(error?.response?.data?.message || error.message || "Couldn't delete the task");
                        throw error;
                    }
                }}
                onClose={() => setPendingDelete(null)}
            />
        </div>
    );
}

// Text cell. Drafts update on every keystroke (onChange); existing tasks keep
// edits local until committed on blur/Enter, and Esc restores the saved value.
function TextCell({ dataCell, value, onChange, onCommit, disabled, placeholder, className, ariaLabel }) {
    const [local, setLocal] = useState(value);
    const [focused, setFocused] = useState(false);

    useEffect(() => {
        if (!focused) setLocal(value);
    }, [value, focused]);

    const commit = async () => {
        if (onChange || local === value) return;
        const ok = await onCommit(local);
        if (!ok) setLocal(value);
    };

    return (
        <input
            type="text"
            data-cell={dataCell}
            value={onChange ? value : local}
            disabled={disabled}
            placeholder={placeholder}
            aria-label={ariaLabel}
            onFocus={() => setFocused(true)}
            onChange={(e) => (onChange ? onChange(e.target.value) : setLocal(e.target.value))}
            onBlur={() => {
                setFocused(false);
                commit();
            }}
            onKeyDown={(e) => {
                if (e.key === "Escape" && !onChange) {
                    e.preventDefault();
                    setLocal(value);
                    requestAnimationFrame(() => e.target.blur());
                }
            }}
            className={`bg-transparent outline-none text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500 truncate ${className}`}
        />
    );
}
