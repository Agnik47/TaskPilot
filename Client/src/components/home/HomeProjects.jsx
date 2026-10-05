import { useMemo } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { ChevronRight } from "lucide-react";
import { isSettled } from "../../lib/taskWorkflow";

const VISIBLE = 5;

// Projects at a glance: how far along each one is and how much of what's left
// is yours. Projects with your open work come first.
export default function HomeProjects() {
    const { user } = useUser();
    const projects = useSelector((state) => state.workspace.projects);

    const rows = useMemo(
        () =>
            projects
                .map((p) => {
                    const tasks = p.tasks || [];
                    const done = tasks.filter((t) => t.status === "DONE").length;
                    const mine = tasks.filter((t) => t.assigneeId === user?.id && !isSettled(t.status)).length;
                    return { id: p.id, name: p.name, total: tasks.length, done, mine };
                })
                .sort((a, b) => b.mine - a.mine || a.name.localeCompare(b.name)),
        [projects, user?.id]
    );

    return (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
                <h2 className="font-medium text-zinc-900 dark:text-white">Projects</h2>
                <Link to="/projects" className="inline-flex items-center gap-0.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                    All projects <ChevronRight className="size-3.5" />
                </Link>
            </header>

            {rows.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">You aren't in any projects yet.</p>
            ) : (
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {rows.slice(0, VISIBLE).map((p) => (
                        <li key={p.id}>
                            <Link to={`/projectsDetail?id=${p.id}&tab=tasks`} className="block px-4 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">{p.name}</span>
                                    <span className="shrink-0 text-xs text-zinc-500 dark:text-zinc-400 tabular-nums">
                                        {p.total === 0 ? "No tasks" : `${p.done} of ${p.total} done`}
                                    </span>
                                </div>
                                <div className="mt-2 h-1 rounded-full bg-zinc-100 dark:bg-zinc-800" role="img" aria-label={`${p.done} of ${p.total} tasks done`}>
                                    <div className="h-1 rounded-full bg-emerald-500" style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
                                </div>
                                {p.mine > 0 && (
                                    <p className="mt-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                        {p.mine} open {p.mine === 1 ? "task is" : "tasks are"} yours
                                    </p>
                                )}
                            </Link>
                        </li>
                    ))}
                </ul>
            )}
        </section>
    );
}
