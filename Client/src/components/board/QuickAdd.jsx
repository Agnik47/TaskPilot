import { useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import { Loader2Icon, Plus } from "lucide-react";
import { createTask } from "../../features/workspaceSlice";
import { STATUS_META } from "../../lib/taskWorkflow";

// "+ Add task" at the bottom of a board column. Type a title and press Enter;
// the box stays open so several tasks can be added in a row. Esc closes.
// New tasks use the workspace defaults and are assigned to you; set a due
// date or assignee afterwards from the task.
export default function QuickAdd({ projectId, status }) {
    const dispatch = useDispatch();
    const { defaultTaskType, defaultTaskPriority } = useSelector((state) => state.workspace.settings);
    const [open, setOpen] = useState(false);
    const [title, setTitle] = useState("");
    const [saving, setSaving] = useState(false);
    const inputRef = useRef(null);

    const save = async () => {
        const text = title.trim();
        if (!text || saving) return;
        try {
            setSaving(true);
            await dispatch(createTask({ projectId, title: text, status, type: defaultTaskType, priority: defaultTaskPriority })).unwrap();
            setTitle("");
            requestAnimationFrame(() => inputRef.current?.focus());
        } catch (error) {
            toast.error(error?.response?.data?.message || error.message || "Couldn't create the task");
        } finally {
            setSaving(false);
        }
    };

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200/60 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200"
            >
                <Plus className="size-4" /> Add task
            </button>
        );
    }

    return (
        <div className="rounded-lg border border-blue-400/60 bg-white dark:bg-zinc-950 p-2 shadow-sm">
            <textarea
                ref={inputRef}
                autoFocus
                rows={2}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        save();
                    } else if (e.key === "Escape") {
                        setOpen(false);
                        setTitle("");
                    }
                }}
                onBlur={() => !title.trim() && setOpen(false)}
                placeholder={`What needs doing? (${STATUS_META[status].label})`}
                aria-label={`New task in ${STATUS_META[status].label}`}
                className="w-full resize-none bg-transparent text-sm outline-none placeholder-zinc-400"
            />
            <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-zinc-400">Enter to add · Esc to close</span>
                <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={save}
                    disabled={!title.trim() || saving}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                    {saving && <Loader2Icon className="size-3 animate-spin" />} Add
                </button>
            </div>
        </div>
    );
}
