import { useState } from "react";
import { Loader2Icon, RotateCcw } from "lucide-react";
import OpenSound from "../OpenSound";

// Asks the owner what needs fixing. The note is optional but encouraged: it's
// posted to the task discussion and included in the assignee's notification.
export default function RequestChangesDialog({ task, onSubmit, onClose }) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setBusy(true);
        const ok = await onSubmit(note.trim());
        setBusy(false);
        if (ok) onClose();
    };

    return (
        <div className="motion-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur px-4" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
            <OpenSound />
            <form onSubmit={submit} className="motion-dialog w-full max-w-md rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 text-zinc-900 dark:text-zinc-100">
                <div className="flex gap-3">
                    <div className="size-9 shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
                        <RotateCcw className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold">Request changes</h2>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                            "{task.title}" goes back to <span className="font-medium">In Progress</span> for {task.assignee?.name || "the assignee"}.
                        </p>
                    </div>
                </div>

                <label htmlFor="review-note" className="block text-sm font-medium mt-5 mb-1.5">What needs to change?</label>
                <textarea
                    id="review-note"
                    autoFocus
                    rows={4}
                    maxLength={2000}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Escape" && !busy) onClose();
                        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) submit(e);
                    }}
                    placeholder="e.g. The banner text is cut off on mobile — please fix and resubmit."
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">Optional. It's posted in the task discussion so everyone has the context.</p>

                <div className="flex justify-end gap-2 mt-6">
                    <button type="button" onClick={onClose} disabled={busy} className="px-4 py-2 rounded-md text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={busy} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-60">
                        {busy && <Loader2Icon className="size-4 animate-spin" />}
                        Send back
                    </button>
                </div>
            </form>
        </div>
    );
}
