import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Eye, EyeOff, ListChecks, Loader2Icon, Plus, Trash2 } from "lucide-react";
import { addChecklistItems, deleteChecklistItem, fetchMembers, updateChecklistItem } from "../../features/workspaceSlice";
import { checklistOf, checklistProgress, splitItemLines } from "../../lib/checklist";
import { positionForMove } from "../../lib/taskOrder";
import { dueDateToInput } from "../../lib/sheet";
import { SortableItem, SortableTaskList } from "../SortableTasks";
import CellSelect from "../sheet/CellSelect";
import DateCell from "../sheet/DateCell";

const HIDE_DONE_KEY = "checklist.hideDone";
const readHideDone = () => {
    try {
        return localStorage.getItem(HIDE_DONE_KEY) === "1";
    } catch {
        return false;
    }
};

// The task page's checklist: steps inside a task, each optionally owned by
// someone (anyone in the organization) with its own due date. People who can
// edit the task manage the list; an item's owner can tick their own item off.
export default function Checklist({ task, me, canEdit }) {
    const dispatch = useDispatch();
    const members = useSelector((state) => state.workspace.members);
    const items = checklistOf(task);
    const { done, total, complete } = checklistProgress(task);
    const [hideDone, setHideDone] = useState(readHideDone);

    useEffect(() => {
        if (canEdit && !members.length) dispatch(fetchMembers());
    }, [canEdit, members.length, dispatch]);

    if (!total && !canEdit) return null;

    const visible = hideDone ? items.filter((i) => !i.done) : items;

    const run = async (thunk, failure) => {
        try {
            await dispatch(thunk).unwrap();
            return true;
        } catch (error) {
            toast.error(error?.message || failure);
            return false;
        }
    };
    const update = (item, changes) => run(updateChecklistItem({ taskId: task.id, itemId: item.id, changes }), "Couldn't save the checklist");
    const remove = (item) => run(deleteChecklistItem({ taskId: task.id, itemId: item.id }), "Couldn't delete the item");
    const add = (titles) => run(addChecklistItems({ taskId: task.id, titles }), "Couldn't add to the checklist");
    const reorder = (activeId, overId) => {
        const position = positionForMove(visible, activeId, overId);
        if (position !== null) update(items.find((i) => i.id === activeId), { position });
    };

    const toggleHideDone = () => {
        setHideDone((v) => {
            try { localStorage.setItem(HIDE_DONE_KEY, v ? "0" : "1"); } catch { /* not persisted */ }
            return !v;
        });
    };

    const peopleOptions = [
        { value: "", label: "No owner" },
        ...members.map((m) => ({ value: m.id, label: m.name, image: m.image || "", hint: m.id === me ? "You" : undefined })),
    ];

    return (
        <section aria-label="Checklist">
            <div className="flex items-center gap-2 mb-2">
                <ListChecks className="size-4 text-zinc-500 dark:text-zinc-400" />
                <h2 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">Checklist</h2>
                {total > 0 && (
                    <span className={`text-xs tabular-nums ${complete ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"}`}>
                        {done} of {total}
                    </span>
                )}
                {done > 0 && (
                    <button type="button" onClick={toggleHideDone} className="ml-auto inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200">
                        {hideDone ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                        {hideDone ? `Show completed (${done})` : "Hide completed"}
                    </button>
                )}
            </div>

            {total > 0 && (
                <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden mb-2" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
                    <div className={`h-full rounded-full transition-all duration-300 ${complete ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${(done / total) * 100}%` }} />
                </div>
            )}

            <SortableTaskList ids={visible.map((i) => i.id)} onMove={reorder}>
                <ul className="-mx-1.5">
                    {visible.map((item) => (
                        <SortableItem key={item.id} as="li" id={item.id} disabled={!canEdit} className="group rounded-md" draggingClassName="bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-blue-500/40">
                            {(handle) => (
                                <ChecklistRow
                                    item={item}
                                    handle={handle}
                                    canEdit={canEdit}
                                    canToggle={canEdit || item.assigneeId === me}
                                    peopleOptions={peopleOptions}
                                    onUpdate={(changes) => update(item, changes)}
                                    onRemove={() => remove(item)}
                                />
                            )}
                        </SortableItem>
                    ))}
                </ul>
            </SortableTaskList>

            {hideDone && done > 0 && visible.length === 0 && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 py-1">All {done} items done.</p>
            )}

            {canEdit && <AddItem onAdd={add} empty={total === 0} />}
        </section>
    );
}

function ChecklistRow({ item, handle, canEdit, canToggle, peopleOptions, onUpdate, onRemove }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(item.title);

    const saveTitle = () => {
        setEditing(false);
        const text = draft.trim();
        if (text && text !== item.title) onUpdate({ title: text });
        else setDraft(item.title);
    };

    return (
        <div className="flex items-start gap-1.5 px-1.5 py-1 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
            <span className="w-5 shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity -ml-1">{handle}</span>
            <input
                type="checkbox"
                checked={item.done}
                disabled={!canToggle}
                onChange={(e) => onUpdate({ done: e.target.checked })}
                aria-label={`Mark "${item.title}" ${item.done ? "not done" : "done"}`}
                className="mt-1 size-4 shrink-0 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed"
            />
            <div className="min-w-0 flex-1">
                {editing ? (
                    <input
                        autoFocus
                        value={draft}
                        maxLength={300}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                            if (e.key === "Escape") {
                                setDraft(item.title);
                                setEditing(false);
                            }
                        }}
                        aria-label="Item name"
                        className="w-full text-sm bg-white dark:bg-zinc-900 border border-blue-400 rounded px-1.5 py-0.5 outline-none"
                    />
                ) : (
                    <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => {
                            setDraft(item.title);
                            setEditing(true);
                        }}
                        title={canEdit ? "Click to rename" : undefined}
                        className={`block w-full text-left text-sm py-0.5 break-words disabled:cursor-default ${item.done ? "line-through text-zinc-400 dark:text-zinc-500" : "text-zinc-800 dark:text-zinc-200"}`}
                    >
                        {item.title}
                    </button>
                )}
                {item.done && item.doneBy && (
                    <p className="text-[11px] text-zinc-400 dark:text-zinc-500">Done by {item.doneBy.name}</p>
                )}
            </div>

            {/* Owner + due date: shown when set, or on hover for editors */}
            <div className="flex items-center gap-1 shrink-0">
                {(item.dueDate || canEdit) && (
                    <div className={item.dueDate ? "" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"}>
                        <DateCell
                            value={dueDateToInput(item.dueDate)}
                            status={item.done ? "DONE" : "TODO"}
                            onChange={(v) => onUpdate({ dueDate: v || null })}
                            disabled={!canEdit}
                            allowClear
                            className="h-7 px-1.5 text-xs rounded hover:bg-white dark:hover:bg-zinc-800"
                        />
                    </div>
                )}
                {(item.assignee || canEdit) && (
                    <div className={item.assignee ? "" : "opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity"}>
                        <CellSelect
                            label="Owner"
                            value={item.assigneeId || ""}
                            options={peopleOptions}
                            onChange={(v) => onUpdate({ assigneeId: v || null })}
                            disabled={!canEdit}
                            searchable={peopleOptions.length > 6}
                            hideChevron
                            menuWidth={240}
                            className="h-7 px-1 rounded hover:bg-white dark:hover:bg-zinc-800"
                            renderValue={() =>
                                item.assignee ? (
                                    <img src={item.assignee.image} alt={item.assignee.name} title={`Owner: ${item.assignee.name}`} className="size-5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                                ) : (
                                    <span className="text-xs text-zinc-400">Owner</span>
                                )
                            }
                        />
                    </div>
                )}
                {canEdit && (
                    <button
                        type="button"
                        onClick={onRemove}
                        title="Delete item"
                        aria-label={`Delete "${item.title}"`}
                        className="p-1 rounded text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                    >
                        <Trash2 className="size-3.5" />
                    </button>
                )}
            </div>
        </div>
    );
}

// Enter adds and keeps the box open for the next item; pasting several lines
// adds them all at once.
function AddItem({ onAdd, empty }) {
    const [text, setText] = useState("");
    const [saving, setSaving] = useState(false);
    const inputRef = useRef(null);

    const submit = async (titles) => {
        if (!titles.length || saving) return;
        setSaving(true);
        const ok = await onAdd(titles);
        setSaving(false);
        if (ok) {
            setText("");
            if (titles.length > 1) toast.success(`Added ${titles.length} items`);
            requestAnimationFrame(() => inputRef.current?.focus());
        }
    };

    return (
        <div className="flex items-center gap-2 mt-1 px-0.5">
            {saving ? <Loader2Icon className="size-4 shrink-0 text-zinc-400 animate-spin" /> : <Plus className="size-4 shrink-0 text-zinc-400" />}
            <input
                ref={inputRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter") {
                        e.preventDefault();
                        submit(splitItemLines(text));
                    }
                }}
                onPaste={(e) => {
                    const lines = splitItemLines(e.clipboardData.getData("text/plain"));
                    if (lines.length > 1) {
                        e.preventDefault();
                        submit(lines);
                    }
                }}
                maxLength={300}
                placeholder={empty ? "Break this task into steps. Type one and press Enter, or paste a list" : "Add an item"}
                aria-label="Add a checklist item"
                className="flex-1 min-w-0 h-8 bg-transparent text-sm outline-none placeholder-zinc-400 border-b border-transparent focus:border-zinc-300 dark:focus:border-zinc-700"
            />
        </div>
    );
}
