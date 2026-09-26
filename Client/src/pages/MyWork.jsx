import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useUser } from "@clerk/clerk-react";
import { ChevronDown, ChevronRight, Inbox, PartyPopper, Search, X } from "lucide-react";
import useOrgRole from "../hooks/useOrgRole";
import { GROUPS, groupTasks, selectTasks } from "../lib/myWork";
import MyWorkRow from "../components/mywork/MyWorkRow";
import WaitingOnYou from "../components/blockers/WaitingOnYou";

// One place for "what should I work on?": everything assigned to you across
// all projects, grouped by urgency. Owners can switch to work they delegated.

const MODE_KEY = "myWork.mode";
const COLLAPSED_KEY = "myWork.collapsed";

const read = (key, fallback) => {
    try {
        const v = localStorage.getItem(key);
        return v === null ? fallback : JSON.parse(v);
    } catch {
        return fallback;
    }
};
const write = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // storage unavailable — the preference just won't persist
    }
};

const TONES = {
    red: { text: "text-red-700 dark:text-red-300", chip: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-500/10 dark:text-red-300 dark:ring-red-500/30" },
    amber: { text: "text-amber-700 dark:text-amber-300", chip: "bg-amber-50 text-amber-800 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30" },
    violet: { text: "text-violet-700 dark:text-violet-300", chip: "bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/30" },
    emerald: { text: "text-emerald-700 dark:text-emerald-300", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/30" },
    default: { text: "text-zinc-700 dark:text-zinc-200", chip: "bg-zinc-100 text-zinc-700 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-700" },
};

export default function MyWork() {
    const { user } = useUser();
    const me = user?.id;
    const { isOwner } = useOrgRole();
    const projects = useSelector((state) => state.workspace.projects);

    // The role can load after the first render, so keep the saved choice and
    // only apply it for owners.
    const [mode, setModeState] = useState(() => read(MODE_KEY, "mine"));
    const setMode = (m) => {
        setModeState(m);
        write(MODE_KEY, m);
    };
    const activeMode = isOwner ? mode : "mine";

    const [collapsed, setCollapsedState] = useState(() => read(COLLAPSED_KEY, GROUPS.filter((g) => g.collapsedByDefault).map((g) => g.key)));
    const setCollapsed = (keys) => {
        setCollapsedState(keys);
        write(COLLAPSED_KEY, keys);
    };
    const toggle = (key) => setCollapsed(collapsed.includes(key) ? collapsed.filter((k) => k !== key) : [...collapsed, key]);

    const [query, setQuery] = useState("");
    const [projectId, setProjectId] = useState("");

    const all = useMemo(() => selectTasks(projects, me, activeMode), [projects, me, activeMode]);
    const groups = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = all.filter((t) => (!projectId || t.projectId === projectId) && (!q || t.title.toLowerCase().includes(q)));
        return groupTasks(filtered);
    }, [all, query, projectId]);

    const myProjects = useMemo(() => {
        const ids = new Set(all.map((t) => t.projectId));
        return projects.filter((p) => ids.has(p.id));
    }, [all, projects]);

    const canEdit = (t) => isOwner || t.creatorId === me || t.assigneeId === me;
    const openCount = ["overdue", "today", "week", "later", "nodate", "blocked", "review"].reduce((n, k) => n + groups[k].length, 0);
    const filtering = !!(query.trim() || projectId);

    const jumpTo = (key) => {
        if (collapsed.includes(key)) setCollapsed(collapsed.filter((k) => k !== key));
        requestAnimationFrame(() => document.getElementById(`group-${key}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
    };

    const labelOf = (g) => (typeof g.label === "string" ? g.label : g.label[activeMode]);
    const summary = [
        ["overdue", "overdue"],
        ["today", "due today"],
        ["blocked", "blocked"],
        ["review", activeMode === "mine" ? "waiting for approval" : "to review"],
    ].filter(([key]) => groups[key].length > 0);

    return (
        <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1">My Work</h1>
                    <p className="text-sm text-gray-500 dark:text-zinc-400">
                        {activeMode === "mine" ? "Everything assigned to you, across all projects." : "Work you've handed to others, and where it stands."}
                    </p>
                </div>
                {isOwner && (
                    <div role="tablist" aria-label="Whose work" className="inline-flex p-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800/80 self-start">
                        {[
                            ["mine", "Assigned to me"],
                            ["delegated", "Delegated by me"],
                        ].map(([key, label]) => (
                            <button
                                key={key}
                                type="button"
                                role="tab"
                                aria-selected={activeMode === key}
                                onClick={() => setMode(key)}
                                className={`px-3 py-1.5 rounded text-sm transition ${activeMode === key ? "bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white shadow-sm" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {activeMode === "mine" && <WaitingOnYou />}

            {/* Summary + filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
                {summary.map(([key, text]) => {
                    const tone = TONES[GROUPS.find((g) => g.key === key).tone] || TONES.default;
                    return (
                        <button key={key} type="button" onClick={() => jumpTo(key)} className={`px-2.5 py-1 rounded-full text-xs font-medium ring-1 hover:opacity-80 ${tone.chip}`}>
                            {groups[key].length} {text}
                        </button>
                    );
                })}
                <div className="flex items-center gap-2 sm:ml-auto w-full sm:w-auto">
                    <label className="relative flex-1 sm:flex-none">
                        <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Search"
                            aria-label="Search my work"
                            className="w-full sm:w-44 h-8 pl-8 pr-2 rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </label>
                    {myProjects.length > 1 && (
                        <select
                            value={projectId}
                            onChange={(e) => setProjectId(e.target.value)}
                            aria-label="Project"
                            className="h-8 max-w-40 border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 outline-none px-2 rounded-md text-sm text-zinc-900 dark:text-zinc-200"
                        >
                            <option value="">All projects</option>
                            {myProjects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                    )}
                    {filtering && (
                        <button type="button" onClick={() => { setQuery(""); setProjectId(""); }} aria-label="Clear filters" className="h-8 px-2 rounded-md text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800">
                            <X className="size-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Groups */}
            {all.length === 0 ? (
                <EmptyState mode={activeMode} />
            ) : (
                <div className="space-y-3">
                    {openCount === 0 && !filtering && (
                        <div className="flex items-center gap-3 rounded-lg border border-emerald-200 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
                            <PartyPopper className="size-5 shrink-0" /> You're all caught up. Nothing open right now.
                        </div>
                    )}
                    {GROUPS.map((g) => {
                        const tasks = groups[g.key];
                        if (!tasks.length) return null;
                        const isCollapsed = collapsed.includes(g.key);
                        const tone = TONES[g.tone] || TONES.default;
                        return (
                            <section key={g.key} id={`group-${g.key}`} className="scroll-mt-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => toggle(g.key)}
                                    aria-expanded={!isCollapsed}
                                    className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                                >
                                    {isCollapsed ? <ChevronRight className="size-4 text-zinc-400" /> : <ChevronDown className="size-4 text-zinc-400" />}
                                    <h2 className={`text-sm font-semibold ${tone.text}`}>{labelOf(g)}</h2>
                                    <span className="text-xs text-zinc-400 tabular-nums">{tasks.length}</span>
                                </button>
                                {!isCollapsed && (
                                    <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80 border-t border-zinc-100 dark:border-zinc-800/80">
                                        {tasks.map((t) => (
                                            <MyWorkRow key={t.id} task={t} canEdit={canEdit(t)} showAssignee={activeMode === "delegated"} />
                                        ))}
                                    </ul>
                                )}
                            </section>
                        );
                    })}
                    {filtering && GROUPS.every((g) => groups[g.key].length === 0) && (
                        <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">No tasks match your filters.</p>
                    )}
                </div>
            )}
        </div>
    );
}

function EmptyState({ mode }) {
    return (
        <div className="rounded-lg border border-dashed border-zinc-300 dark:border-zinc-700 px-6 py-14 text-center">
            <Inbox className="size-8 mx-auto text-zinc-300 dark:text-zinc-600 mb-3" />
            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                {mode === "mine" ? "Nothing is assigned to you yet" : "You haven't delegated any tasks yet"}
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
                {mode === "mine" ? "Tasks assigned to you in any project will show up here." : "Tasks you create and assign to teammates will show up here."}
            </p>
        </div>
    );
}
