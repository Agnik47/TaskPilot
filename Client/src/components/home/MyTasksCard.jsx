import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { ChevronRight } from "lucide-react";
import useOrgRole from "../../hooks/useOrgRole";
import { groupTasks, selectTasks } from "../../lib/myWork";
import MyWorkRow from "../mywork/MyWorkRow";

const VISIBLE = 6;

// The My Work groups folded into four questions: what needs me now, what's
// coming, what am I waiting on, and what did I finish.
const HOME_TABS = [
    { key: "now", label: "Do now", groups: ["overdue", "today"], empty: "Nothing is overdue or due today." },
    { key: "upcoming", label: "Upcoming", groups: ["week", "later", "nodate"], empty: "Nothing else is lined up." },
    { key: "waiting", label: "Waiting", groups: ["blocked", "review"], empty: "You aren't waiting on anyone." },
    { key: "done", label: "Done", groups: ["done"], empty: "Nothing completed in the last 14 days." },
];

// Your tasks across every project, for the dashboard. The tab counts double
// as the day's summary; the full list lives on My Work.
export default function MyTasksCard() {
    const { user } = useUser();
    const me = user?.id;
    const { isOwner } = useOrgRole();
    const projects = useSelector((state) => state.workspace.projects);
    const [picked, setPicked] = useState(null);

    const tabs = useMemo(() => {
        const groups = groupTasks(selectTasks(projects, me, "mine"));
        return HOME_TABS.map((tab) => ({ ...tab, tasks: tab.groups.flatMap((g) => groups[g]) }));
    }, [projects, me]);

    // Until a tab is picked, open on the first one that needs attention.
    const activeKey = picked ?? (tabs.find((t) => t.key !== "done" && t.tasks.length > 0)?.key || "now");
    const active = tabs.find((t) => t.key === activeKey);
    const canEdit = (t) => isOwner || t.creatorId === me || t.assigneeId === me;

    return (
        <section className="mb-8 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-4 pt-3.5">
                <h2 className="font-medium text-zinc-900 dark:text-white">My tasks</h2>
                <Link to="/my-work" className="inline-flex items-center gap-0.5 text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white">
                    Open My Work <ChevronRight className="size-3.5" />
                </Link>
            </header>

            <div role="tablist" aria-label="My tasks" className="flex gap-1 px-2 mt-2 border-b border-zinc-200 dark:border-zinc-800 overflow-x-auto">
                {tabs.map((tab) => {
                    const selected = tab.key === activeKey;
                    const urgent = tab.key === "now" && tab.tasks.length > 0;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            role="tab"
                            aria-selected={selected}
                            onClick={() => setPicked(tab.key)}
                            className={`relative -mb-px flex items-center gap-1.5 px-2.5 py-2 text-sm whitespace-nowrap border-b-2 transition-colors ${selected
                                ? "border-blue-500 text-zinc-900 dark:text-white font-medium"
                                : "border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200"}`}
                        >
                            {tab.label}
                            <span className={`min-w-5 px-1.5 py-0.5 rounded-full text-xs tabular-nums ${urgent
                                ? "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300"
                                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"}`}>
                                {tab.tasks.length}
                            </span>
                        </button>
                    );
                })}
            </div>

            {active.tasks.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">{active.empty}</p>
            ) : (
                <ul role="tabpanel" className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                    {active.tasks.slice(0, VISIBLE).map((t) => (
                        <MyWorkRow key={t.id} task={t} canEdit={canEdit(t)} />
                    ))}
                </ul>
            )}

            {active.tasks.length > VISIBLE && (
                <Link to="/my-work" className="block px-4 py-2.5 text-center text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 border-t border-zinc-100 dark:border-zinc-800">
                    See all {active.tasks.length} in My Work
                </Link>
            )}
        </section>
    );
}
