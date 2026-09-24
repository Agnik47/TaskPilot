import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { ArrowUpRight, ChevronDown, Loader2Icon, Plus, Trash2, X } from "lucide-react";
import useOrgRole from "../hooks/useOrgRole";
import { bulkCreateTasks, deleteTask, updateTask } from "../features/workspaceSlice";
import { ConfirmDialog } from "./settings/SettingsUI";
import {
    PRIORITY_OPTIONS,
    STATUS_OPTIONS,
    TYPE_OPTIONS,
    dueDateToInput,
    parseCellForColumn,
    parseClipboardGrid,
} from "../lib/sheet";

// Spreadsheet-style task entry: every cell is editable in place.
//  - Existing tasks save as soon as a cell is committed (blur / Enter / pick).
//  - New rows are drafts; there's always an empty row at the bottom to type
//    into, and drafts are created together with "Save" (one bulk request).
//  - Pasting cells copied from Excel / Google Sheets fills new rows.

const COLUMNS = [
    { key: "title", label: "Task", required: true, width: "min-w-72" },
    { key: "assigneeId", label: "Assignee", width: "min-w-44" },
    { key: "status", label: "Status", width: "min-w-36" },
    { key: "priority", label: "Priority", width: "min-w-32" },
    { key: "type", label: "Type", width: "min-w-36" },
    { key: "due_date", label: "Due date", required: true, width: "min-w-40" },
    { key: "description", label: "Description", width: "min-w-64" },
];

const DOTS = {
    type: { TASK: "bg-green-500", BUG: "bg-red-500", FEATURE: "bg-blue-500", IMPROVEMENT: "bg-purple-500", OTHER: "bg-amber-500" },
    priority: { LOW: "bg-zinc-400", MEDIUM: "bg-blue-500", HIGH: "bg-amber-500", URGENT: "bg-red-500" },
    status: { TODO: "bg-zinc-400", IN_PROGRESS: "bg-blue-500", BLOCKED: "bg-red-500", DONE: "bg-emerald-500" },
};
const OPTIONS = { type: TYPE_OPTIONS, priority: PRIORITY_OPTIONS, status: STATUS_OPTIONS };

let draftSeq = 0;
const newDraftKey = () => `draft-${Date.now()}-${draftSeq++}`;
const isBlank = (v) => !v.title.trim() && !v.description.trim() && !v.due_date;

const cellInputClass = "w-full h-10 px-3 bg-transparent outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 dark:placeholder-zinc-500 disabled:cursor-not-allowed disabled:text-zinc-500";

export default function TaskSheet({ project }) {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { user } = useUser();
    const { isOwner } = useOrgRole();
    const { defaultTaskType, defaultTaskPriority } = useSelector((state) => state.workspace.settings);
    const tableRef = useRef(null);

    const me = user?.id;
    const tasks = useMemo(
        () => [...(project.tasks || [])].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
        [project.tasks]
    );

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
    const invalidOf = (v) => ({ title: !v.title.trim(), due_date: !v.due_date });
    const invalidCount = filledDrafts.filter((d) => Object.values(invalidOf(d.values)).some(Boolean)).length;

    // Always keep an empty row at the bottom to type into.
    const withTrailingBlank = (list) =>
        list.length && isBlank(list.at(-1).values) ? list : [...list, { key: newDraftKey(), values: blankValues() }];

    const setDraftValue = (key, field, value) =>
        setDrafts((prev) => withTrailingBlank(prev.map((d) => (d.key === key ? { ...d, values: { ...d.values, [field]: value } } : d))));

    const removeDraft = (key) => setDrafts((prev) => withTrailingBlank(prev.filter((d) => d.key !== key)));

    // ---- existing tasks: save a single field ----
    const canEdit = (t) => isOwner || t.creatorId === me || t.assigneeId === me;
    const canDelete = (t) => isOwner || t.creatorId === me;

    const commitTask = async (task, field, value) => {
        if (field === "title" && !value.trim()) {
            toast.error("A task needs a title");
            return false;
        }
        const current = field === "due_date" ? dueDateToInput(task.due_date) : (task[field] ?? "");
        if (value === current) return true;
        try {
            await dispatch(updateTask({ id: task.id, [field]: field === "title" ? value.trim() : value })).unwrap();
            return true;
        } catch (error) {
            toast.error(error?.response?.data?.message || error.message || "Couldn't save that change");
            return false;
        }
    };

    // ---- save all new rows in one request ----
    const saveDrafts = async () => {
        if (saving || !filledDrafts.length) return;
        if (invalidCount) {
            setShowErrors(true);
            toast.error(`${invalidCount} new ${invalidCount === 1 ? "row needs" : "rows need"} a task name and due date`);
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
            setDrafts([{ key: newDraftKey(), values: blankValues() }]);
            setShowErrors(false);
            toast.success(`Created ${created.length} ${created.length === 1 ? "task" : "tasks"}`);
        } catch (error) {
            toast.error(error?.response?.data?.message || error.message || "Couldn't create the tasks");
        } finally {
            setSaving(false);
        }
    };

    const discardDrafts = () => {
        setDrafts([{ key: newDraftKey(), values: blankValues() }]);
        setShowErrors(false);
    };

    const addRows = (n) =>
        setDrafts((prev) => [...prev.filter((d) => !isBlank(d.values)), ...Array.from({ length: n + 1 }, () => ({ key: newDraftKey(), values: blankValues() }))]);

    // Ctrl/⌘+S saves new rows; warn before leaving with unsaved rows.
    const saveRef = useRef(saveDrafts);
    saveRef.current = saveDrafts;
    const hasUnsaved = filledDrafts.length > 0;
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

    // ---- keyboard navigation between cells ----
    const focusCell = (row, col) => {
        const el = tableRef.current?.querySelector(`[data-cell="${row}:${col}"]`);
        if (el) {
            el.focus();
            el.select?.();
        }
    };

    const focusFirstInvalid = () => {
        const index = drafts.findIndex((d) => !isBlank(d.values) && Object.values(invalidOf(d.values)).some(Boolean));
        if (index === -1) return;
        const v = drafts[index].values;
        const col = COLUMNS.findIndex((c) => c.key === (!v.title.trim() ? "title" : "due_date"));
        requestAnimationFrame(() => focusCell(tasks.length + index, col));
    };

    const handleGridKeyDown = (e) => {
        const cell = e.target.closest?.("[data-cell]");
        if (!cell || e.nativeEvent.isComposing) return;
        const [row, col] = cell.dataset.cell.split(":").map(Number);
        const isText = cell.tagName === "INPUT" && cell.type === "text";

        if (e.key === "Enter" && cell.tagName !== "SELECT") {
            e.preventDefault();
            cell.blur(); // commits the cell
            focusCell(e.shiftKey ? row - 1 : row + 1, col);
        } else if (isText && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            e.preventDefault();
            focusCell(e.key === "ArrowDown" ? row + 1 : row - 1, col);
        }
    };

    // ---- paste from Excel / Google Sheets ----
    const handlePaste = (e) => {
        const cell = e.target.closest?.("[data-cell]");
        const text = e.clipboardData.getData("text/plain");
        if (!cell || !text || (!text.includes("\t") && !text.includes("\n"))) return; // single value: normal paste

        e.preventDefault();
        let grid = parseClipboardGrid(text);
        const [row, col] = cell.dataset.cell.split(":").map(Number);
        const targetCols = COLUMNS.slice(col).map((c) => c.key);

        // Skip a copied header row like "Task | Assignee | Status".
        const labels = COLUMNS.map((c) => c.label.toLowerCase());
        if (grid[0] && grid[0].filter((c) => labels.includes(c.toLowerCase()) || c.toLowerCase() === "title").length >= 2) grid = grid.slice(1);
        if (!grid.length) return;

        const unreadable = [];
        const parsedRows = grid.map((cells) => {
            const values = {};
            cells.slice(0, targetCols.length).forEach((raw, i) => {
                const field = targetCols[i];
                if (field === "assigneeId" && !isOwner) return; // employees always assign themselves
                const { value, ok } = parseCellForColumn(field, raw, { people });
                if (!ok) unreadable.push(`"${raw}" in ${COLUMNS.find((c) => c.key === field).label}`);
                if (value !== undefined) values[field] = value;
            });
            return values;
        });

        // Pasting onto an existing task's row appends new rows instead of overwriting tasks.
        const startDraft = Math.max(0, row - tasks.length);
        setDrafts((prev) => {
            const next = [...prev];
            parsedRows.forEach((values, i) => {
                const index = startDraft + i;
                if (next[index]) next[index] = { ...next[index], values: { ...next[index].values, ...values } };
                else next.push({ key: newDraftKey(), values: { ...blankValues(), ...values } });
            });
            return withTrailingBlank(next);
        });

        toast.success(`Pasted ${parsedRows.length} ${parsedRows.length === 1 ? "row" : "rows"}. Review, then save.`);
        if (unreadable.length) {
            toast(`${unreadable.length} ${unreadable.length === 1 ? "cell wasn't" : "cells weren't"} recognised and kept the default: ${unreadable.slice(0, 3).join(", ")}${unreadable.length > 3 ? "…" : ""}`, { duration: 6000 });
        }
    };

    // ---- rendering ----
    const renderCell = ({ rowIndex, colIndex, column, value, onChange, onCommit, disabled, invalid, currentAssignee }) => {
        const id = `${rowIndex}:${colIndex}`;
        const tdClass = `relative p-0 border-b border-r border-zinc-200 dark:border-zinc-800 ${column.width} focus-within:z-10 focus-within:ring-2 focus-within:ring-inset focus-within:ring-blue-500 ${invalid ? "bg-red-50 dark:bg-red-500/10 ring-1 ring-inset ring-red-300 dark:ring-red-500/40" : ""} ${column.key === "title" ? "sticky left-10 z-[1] bg-inherit" : ""}`;

        if (column.key === "title" || column.key === "description") {
            return (
                <td key={column.key} className={tdClass}>
                    <TextCell
                        dataCell={id}
                        value={value}
                        onChange={onChange}
                        onCommit={onCommit}
                        disabled={disabled}
                        placeholder={column.key === "title" ? "Type a task…" : ""}
                    />
                </td>
            );
        }

        if (column.key === "due_date") {
            return (
                <td key={column.key} className={tdClass}>
                    <input
                        type="date"
                        data-cell={id}
                        value={value}
                        disabled={disabled}
                        onChange={(e) => (onChange ? onChange(e.target.value) : e.target.value && onCommit(e.target.value))}
                        className={`${cellInputClass} ${value ? "" : "text-zinc-400"}`}
                        aria-label="Due date"
                    />
                </td>
            );
        }

        // Keep showing a current assignee who's no longer in the project's member list.
        const assignable = currentAssignee && !people.some((p) => p.id === currentAssignee.id) ? [currentAssignee, ...people] : people;
        const options = column.key === "assigneeId"
            ? assignable.map((p) => ({ value: p.id, label: p.name }))
            : OPTIONS[column.key];
        const person = column.key === "assigneeId" ? assignable.find((p) => p.id === value) : null;
        const handle = (v) => (onChange ? onChange(v) : onCommit(v));

        return (
            <td key={column.key} className={`${tdClass} group/cell`}>
                <div className="relative flex items-center">
                    {person ? (
                        <img src={person.image} alt="" className="absolute left-3 size-5 rounded-full bg-zinc-200 dark:bg-zinc-700 pointer-events-none" />
                    ) : DOTS[column.key]?.[value] ? (
                        <span className={`absolute left-3.5 size-2 rounded-full pointer-events-none ${DOTS[column.key][value]}`} />
                    ) : null}
                    <select
                        data-cell={id}
                        value={value}
                        disabled={disabled}
                        onChange={(e) => handle(e.target.value)}
                        className={`${cellInputClass} appearance-none cursor-pointer ${person ? "pl-10" : DOTS[column.key] ? "pl-8" : ""} pr-8`}
                        aria-label={column.label}
                    >
                        {column.key === "assigneeId" && !person && <option value="">—</option>}
                        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    {!disabled && (
                        <ChevronDown className="absolute right-2.5 size-3.5 text-zinc-400 pointer-events-none opacity-0 group-hover/cell:opacity-100 group-focus-within/cell:opacity-100 transition-opacity" />
                    )}
                </div>
            </td>
        );
    };

    const existingRow = (task, rowIndex) => {
        const editable = canEdit(task);
        const values = {
            title: task.title,
            assigneeId: task.assigneeId,
            status: task.status,
            priority: task.priority,
            type: task.type,
            due_date: dueDateToInput(task.due_date),
            description: task.description || "",
        };
        return (
            <tr key={task.id} className="group bg-white dark:bg-zinc-950 hover:bg-zinc-50/80 dark:hover:bg-zinc-900/60">
                <td className="sticky left-0 z-[1] bg-inherit w-10 min-w-10 border-b border-r border-zinc-200 dark:border-zinc-800 text-center text-xs text-zinc-400 tabular-nums">{rowIndex + 1}</td>
                {COLUMNS.map((column, colIndex) =>
                    renderCell({
                        rowIndex,
                        colIndex,
                        column,
                        value: values[column.key],
                        onCommit: (v) => commitTask(task, column.key, v),
                        currentAssignee: task.assignee,
                        disabled: !editable || (column.key === "assigneeId" && !isOwner),
                    })
                )}
                <td className="border-b border-zinc-200 dark:border-zinc-800 px-2 w-20">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <button type="button" onClick={() => navigate(`/taskDetails?projectId=${project.id}&taskId=${task.id}`)} title="Open task" aria-label={`Open ${task.title}`} className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800">
                            <ArrowUpRight className="size-4" />
                        </button>
                        {canDelete(task) && (
                            <button type="button" onClick={() => setPendingDelete(task)} title="Delete task" aria-label={`Delete ${task.title}`} className="p-1.5 rounded text-zinc-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10">
                                <Trash2 className="size-4" />
                            </button>
                        )}
                    </div>
                </td>
            </tr>
        );
    };

    const draftRow = (draft, draftIndex) => {
        const rowIndex = tasks.length + draftIndex;
        const blank = isBlank(draft.values);
        const invalid = showErrors && !blank ? invalidOf(draft.values) : {};
        return (
            <tr key={draft.key} className={`group ${blank ? "bg-white dark:bg-zinc-950" : "bg-blue-50/50 dark:bg-blue-500/[0.06]"}`}>
                <td className="sticky left-0 z-[1] bg-inherit w-10 min-w-10 border-b border-r border-zinc-200 dark:border-zinc-800 text-center">
                    {blank ? <Plus className="size-3.5 mx-auto text-zinc-300 dark:text-zinc-600" /> : <span className="inline-block size-1.5 rounded-full bg-blue-500" title="Not saved yet" />}
                </td>
                {COLUMNS.map((column, colIndex) =>
                    renderCell({
                        rowIndex,
                        colIndex,
                        column,
                        value: draft.values[column.key],
                        onChange: (v) => setDraftValue(draft.key, column.key, v),
                        disabled: column.key === "assigneeId" && !isOwner,
                        invalid: invalid[column.key],
                    })
                )}
                <td className="border-b border-zinc-200 dark:border-zinc-800 px-2 w-20">
                    {!blank && (
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                            <button type="button" onClick={() => removeDraft(draft.key)} title="Remove row" aria-label="Remove new row" className="p-1.5 rounded text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:text-white dark:hover:bg-zinc-800">
                                <X className="size-4" />
                            </button>
                        </div>
                    )}
                </td>
            </tr>
        );
    };

    return (
        <div>
            <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-auto max-h-[70vh] bg-white dark:bg-zinc-950">
                <table
                    ref={tableRef}
                    onKeyDown={handleGridKeyDown}
                    onPaste={handlePaste}
                    className="w-full min-w-[1100px] border-separate border-spacing-0 text-sm"
                >
                    <thead>
                        <tr>
                            <th className="sticky top-0 left-0 z-20 w-10 min-w-10 bg-zinc-50 dark:bg-zinc-900 border-b border-r border-zinc-200 dark:border-zinc-800" />
                            {COLUMNS.map((c) => (
                                <th
                                    key={c.key}
                                    scope="col"
                                    className={`sticky top-0 ${c.key === "title" ? "left-10 z-20" : "z-10"} bg-zinc-50 dark:bg-zinc-900 border-b border-r border-zinc-200 dark:border-zinc-800 px-3 py-2.5 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap ${c.width}`}
                                >
                                    {c.label}
                                    {c.required && <span className="text-red-500 ml-0.5" aria-hidden>*</span>}
                                </th>
                            ))}
                            <th className="sticky top-0 z-10 bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 w-20" />
                        </tr>
                    </thead>
                    <tbody>
                        {tasks.map(existingRow)}
                        {drafts.map(draftRow)}
                    </tbody>
                </table>
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                <div className="flex flex-wrap items-center gap-3">
                    <button type="button" onClick={() => addRows(5)} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-zinc-700 dark:text-zinc-300 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <Plus className="size-3.5" /> Add 5 rows
                    </button>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Paste rows from Excel or Google Sheets · <kbd className="font-sans">Enter</kbd> moves down · <kbd className="font-sans">Tab</kbd> moves right · <kbd className="font-sans">Esc</kbd> undoes a cell
                    </p>
                </div>

                {hasUnsaved && (
                    <div className="motion-rise flex items-center gap-3">
                        <span className="text-sm text-zinc-600 dark:text-zinc-400">
                            {filledDrafts.length} new {filledDrafts.length === 1 ? "row" : "rows"}
                            {showErrors && invalidCount > 0 && <span className="text-red-600 dark:text-red-400"> · {invalidCount} incomplete</span>}
                        </span>
                        <button type="button" onClick={discardDrafts} disabled={saving} className="px-3 py-1.5 rounded-md text-sm text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50">
                            Discard
                        </button>
                        <button type="button" data-sfx="none" onClick={saveDrafts} disabled={saving} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-md text-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 disabled:opacity-60">
                            {saving && <Loader2Icon className="size-4 animate-spin" />}
                            Save {filledDrafts.length} {filledDrafts.length === 1 ? "task" : "tasks"}
                            <kbd className="hidden sm:inline text-[10px] opacity-80 border border-white/40 rounded px-1">Ctrl S</kbd>
                        </button>
                    </div>
                )}
            </div>

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

// Text cell. For drafts every keystroke updates the draft (onChange); for
// existing tasks edits stay local until committed on blur/Enter, and Esc
// restores the saved value.
function TextCell({ dataCell, value, onChange, onCommit, disabled, placeholder }) {
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
            onFocus={() => setFocused(true)}
            onChange={(e) => (onChange ? onChange(e.target.value) : setLocal(e.target.value))}
            onBlur={() => {
                setFocused(false);
                commit();
            }}
            onKeyDown={(e) => {
                if (e.key === "Escape" && !onChange) {
                    setLocal(value);
                    requestAnimationFrame(() => e.target.blur());
                }
            }}
            className={`${cellInputClass} truncate`}
        />
    );
}
