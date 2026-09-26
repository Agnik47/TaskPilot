import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { CheckCircle2, ChevronRight, Hourglass, Loader2Icon } from "lucide-react";
import useTaskActions from "../../hooks/useTaskActions";
import { openBlockers, waitingFor } from "../../lib/blockers";

const VISIBLE = 5;

// Everything other people are waiting on you for, across all projects,
// longest-waiting first. Only shown when there's something waiting.
export default function WaitingOnYou() {
    const { user } = useUser();
    const projects = useSelector((state) => state.workspace.projects);
    const { resolve } = useTaskActions();
    const [busyId, setBusyId] = useState(null);
    const [showAll, setShowAll] = useState(false);

    const items = useMemo(
        () =>
            projects
                .flatMap((p) =>
                    (p.tasks || []).flatMap((task) =>
                        openBlockers(task)
                            .filter((b) => b.waitingOnId === user?.id)
                            .map((blocker) => ({ task, blocker, projectName: p.name }))
                    )
                )
                .sort((a, b) => new Date(a.blocker.createdAt) - new Date(b.blocker.createdAt)),
        [projects, user?.id]
    );

    if (items.length === 0) return null;
    const shown = showAll ? items : items.slice(0, VISIBLE);

    const unblock = async ({ task, blocker }) => {
        setBusyId(blocker.id);
        await resolve(task, blocker);
        setBusyId(null);
    };

    return (
        <section className="motion-rise mb-8 rounded-lg border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-zinc-950 overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-amber-100 dark:border-amber-500/20 bg-amber-50/70 dark:bg-amber-500/10">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-900 dark:text-amber-100">
                    <Hourglass className="size-4" /> Waiting on you
                    <span className="px-1.5 py-0.5 rounded-full text-xs bg-amber-500 text-white">{items.length}</span>
                </h2>
                <p className="hidden sm:block text-xs text-amber-800/70 dark:text-amber-200/70">Unblock these so your teammates can keep going</p>
            </header>

            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {shown.map((item) => {
                    const { task, blocker, projectName } = item;
                    return (
                        <li key={blocker.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                            <Link to={`/taskDetails?projectId=${task.projectId}&taskId=${task.id}`} className="group flex items-center gap-3 min-w-0 flex-1">
                                <img src={blocker.createdBy?.image} alt="" className="size-8 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                                <span className="min-w-0">
                                    <span className="flex items-center gap-1 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">
                                        {blocker.reason} <ChevronRight className="size-3.5 shrink-0 opacity-0 group-hover:opacity-60 transition-opacity" />
                                    </span>
                                    <span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                        {blocker.createdBy?.name} · "{task.title}" · {projectName} · waiting {waitingFor(blocker)}
                                    </span>
                                </span>
                            </Link>
                            <button
                                type="button"
                                onClick={() => unblock(item)}
                                disabled={busyId === blocker.id}
                                className="sm:shrink-0 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
                            >
                                {busyId === blocker.id ? <Loader2Icon className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Unblocked
                            </button>
                        </li>
                    );
                })}
            </ul>

            {items.length > VISIBLE && (
                <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full px-4 py-2.5 text-sm text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-500/10 border-t border-zinc-100 dark:border-zinc-800">
                    {showAll ? "Show less" : `Show all ${items.length}`}
                </button>
            )}
        </section>
    );
}
