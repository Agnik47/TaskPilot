import { useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { BellRing, CheckCircle2, Hourglass, Loader2Icon, Plus } from "lucide-react";
import useTaskActions from "../../hooks/useTaskActions";
import { isSettled } from "../../lib/taskWorkflow";
import { nudgeAvailableIn, openBlockers, requestBlockerDialog, waitingFor } from "../../lib/blockers";

// Task-page panel for "waiting on someone":
//  - the person being waited on sees what's needed and can mark it unblocked
//    (with an optional note that's posted to the discussion);
//  - the task's people see who they're waiting on, since when, and can nudge
//    or resolve each blocker, or add another.
export default function BlockerPanel({ task, me, canEdit }) {
    const blockers = openBlockers(task);
    const mine = blockers.filter((b) => b.waitingOnId === me);
    const canAdd = canEdit && !isSettled(task.status);

    if (!blockers.length) {
        if (!canAdd) return null;
        return (
            <button
                type="button"
                onClick={() => requestBlockerDialog(task)}
                className="inline-flex items-center gap-1.5 text-sm text-zinc-500 dark:text-zinc-400 hover:text-amber-700 dark:hover:text-amber-300"
            >
                <Hourglass className="size-4" /> Waiting on someone? Add a blocker
            </button>
        );
    }

    return (
        <div className="space-y-3">
            {mine.map((b) => <WaitingOnYouCard key={b.id} task={task} blocker={b} />)}
            {(canEdit || blockers.length > mine.length) && (
                <BlockerList task={task} blockers={canEdit ? blockers : blockers.filter((b) => b.waitingOnId !== me)} canEdit={canEdit} canAdd={canAdd} />
            )}
        </div>
    );
}

function WaitingOnYouCard({ task, blocker }) {
    const { resolve } = useTaskActions();
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const asker = blocker.createdBy;

    const submit = async () => {
        setBusy(true);
        await resolve(task, blocker, note.trim());
        setBusy(false);
    };

    return (
        <div className="motion-rise rounded-lg border border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 p-4">
            <div className="flex items-start gap-3">
                <img src={asker?.image} alt="" className="size-8 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        {asker?.name || "Someone"} is waiting on you
                        <span className="font-normal text-amber-800/70 dark:text-amber-200/70"> · {waitingFor(blocker)}</span>
                    </p>
                    <p className="text-sm text-amber-900/90 dark:text-amber-100/90 mt-1 whitespace-pre-wrap break-words">{blocker.reason}</p>
                </div>
            </div>
            <textarea
                rows={2}
                maxLength={2000}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && submit()}
                placeholder="Optional note, e.g. “Access granted. Check your email.”"
                className="mt-3 w-full rounded-md border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-zinc-900 px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
            />
            <div className="flex items-center justify-between gap-3 mt-2">
                <p className="text-xs text-amber-800/70 dark:text-amber-200/70">The note is posted in the discussion.</p>
                <button type="button" onClick={submit} disabled={busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60 shrink-0">
                    {busy ? <Loader2Icon className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Mark as unblocked
                </button>
            </div>
        </div>
    );
}

function BlockerList({ task, blockers, canEdit, canAdd }) {
    const { resolve, nudge } = useTaskActions();
    const [busy, setBusy] = useState(null);

    const run = async (key, fn) => {
        setBusy(key);
        await fn();
        setBusy(null);
    };

    return (
        <div className="motion-rise rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50/60 dark:bg-red-500/[0.07] overflow-hidden">
            <p className="flex items-center gap-2 px-4 pt-3 text-sm font-semibold text-red-900 dark:text-red-100">
                <Hourglass className="size-4" />
                Blocked · waiting on {blockers.length === 1 ? blockers[0].waitingOn?.name : `${blockers.length} people`}
            </p>
            <ul className="divide-y divide-red-100 dark:divide-red-500/15">
                {blockers.map((b) => {
                    const cooldown = nudgeAvailableIn(b);
                    return (
                        <li key={b.id} className="flex items-start gap-3 px-4 py-3">
                            <img src={b.waitingOn?.image} alt="" className="size-7 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-zinc-900 dark:text-zinc-100">
                                    <span className="font-medium">{b.waitingOn?.name}</span>
                                    <span className="text-zinc-500 dark:text-zinc-400"> · {waitingFor(b)}</span>
                                </p>
                                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-0.5 whitespace-pre-wrap break-words">{b.reason}</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                    Raised by {b.createdBy?.name}
                                    {b.lastNudgedAt && ` · nudged ${formatDistanceToNowStrict(new Date(b.lastNudgedAt), { addSuffix: true })}`}
                                </p>
                            </div>
                            {canEdit && (
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        type="button"
                                        onClick={() => run(`nudge-${b.id}`, () => nudge(task, b))}
                                        disabled={!!busy || cooldown > 0}
                                        title={cooldown > 0 ? `${b.waitingOn?.name} was notified recently. You can nudge again in ${Math.ceil(cooldown / 3600000)}h` : `Send ${b.waitingOn?.name} a reminder`}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-700 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        {busy === `nudge-${b.id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : <BellRing className="size-3.5" />} Nudge
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => run(`resolve-${b.id}`, () => resolve(task, b))}
                                        disabled={!!busy}
                                        title="No longer waiting on them"
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-emerald-700 dark:text-emerald-300 hover:bg-white dark:hover:bg-zinc-800 disabled:opacity-40"
                                    >
                                        {busy === `resolve-${b.id}` ? <Loader2Icon className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Resolved
                                    </button>
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
            {canAdd && (
                <button
                    type="button"
                    onClick={() => requestBlockerDialog(task)}
                    className="w-full flex items-center gap-1.5 px-4 py-2 text-xs text-red-800 dark:text-red-200 hover:bg-red-100/60 dark:hover:bg-red-500/10 border-t border-red-100 dark:border-red-500/15"
                >
                    <Plus className="size-3.5" /> Waiting on someone else too
                </button>
            )}
        </div>
    );
}
