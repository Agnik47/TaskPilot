import { useEffect, useMemo, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { FolderOpenIcon, SearchIcon, SquareCheckBig } from "lucide-react";

const MAX_PROJECTS = 5;
const MAX_TASKS = 8;

const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

// Instant search over projects and tasks already in the store. The server only
// sends tasks the user may see (employees get their own), so results never
// expose anything the user couldn't open.
export default function NavbarSearch() {
    const projects = useSelector((state) => state.workspace.projects);
    const navigate = useNavigate();
    const inputRef = useRef(null);
    const containerRef = useRef(null);

    const [query, setQuery] = useState("");
    const [open, setOpen] = useState(false);
    const [activeIndex, setActiveIndex] = useState(0);

    const results = useMemo(() => {
        const term = query.trim().toLowerCase();
        if (!term) return [];
        const matches = (...fields) => fields.some((f) => f?.toLowerCase().includes(term));

        const projectHits = projects
            .filter((p) => matches(p.name, p.description))
            .slice(0, MAX_PROJECTS)
            .map((p) => ({
                kind: "project",
                id: p.id,
                title: p.name,
                subtitle: p.status?.replace("_", " ").toLowerCase(),
                href: `/projectsDetail?id=${p.id}&tab=tasks`,
            }));

        const taskHits = projects
            .flatMap((p) => (p.tasks || []).map((t) => ({ task: t, project: p })))
            .filter(({ task }) => matches(task.title, task.description, task.assignee?.name))
            .slice(0, MAX_TASKS)
            .map(({ task, project }) => ({
                kind: "task",
                id: task.id,
                title: task.title,
                subtitle: `${project.name} · ${task.status.replace("_", " ").toLowerCase()}${task.assignee ? ` · ${task.assignee.name}` : ""}`,
                href: `/taskDetails?projectId=${project.id}&taskId=${task.id}`,
            }));

        return [...projectHits, ...taskHits];
    }, [projects, query]);

    // Ctrl/⌘+K focuses search from anywhere.
    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                inputRef.current?.focus();
                inputRef.current?.select();
            }
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        const onClick = (e) => {
            if (!containerRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener("mousedown", onClick);
        return () => document.removeEventListener("mousedown", onClick);
    }, []);

    const go = (result) => {
        navigate(result.href);
        setQuery("");
        setOpen(false);
        inputRef.current?.blur();
    };

    const handleKeyDown = (e) => {
        if (e.key === "Escape") {
            setOpen(false);
            inputRef.current?.blur();
            return;
        }
        if (!results.length) return;
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActiveIndex((i) => (i + step + results.length) % results.length);
        } else if (e.key === "Enter") {
            e.preventDefault();
            go(results[Math.min(activeIndex, results.length - 1)]);
        }
    };

    const showPanel = open && query.trim().length > 0;
    let lastKind = null;

    return (
        <div ref={containerRef} className="relative flex-1 max-w-sm">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-400 size-3.5" />
            <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setOpen(true); setActiveIndex(0); }}
                onFocus={() => setOpen(true)}
                onKeyDown={handleKeyDown}
                placeholder="Search projects, tasks..."
                role="combobox"
                aria-expanded={showPanel}
                aria-controls="navbar-search-results"
                className="pl-8 pr-14 py-2 w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-md text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition"
            />
            <kbd className="max-sm:hidden absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5 pointer-events-none">
                {isMac ? "⌘K" : "Ctrl K"}
            </kbd>

            {showPanel && (
                <div id="navbar-search-results" role="listbox" className="motion-pop absolute left-0 right-0 top-full mt-1 z-50 max-h-96 overflow-y-auto rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 min-w-72">
                    {results.length === 0 ? (
                        <p className="px-3 py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">No projects or tasks match "{query.trim()}"</p>
                    ) : (
                        results.map((r, i) => {
                            const header = r.kind !== lastKind ? (r.kind === "project" ? "Projects" : "Tasks") : null;
                            lastKind = r.kind;
                            const Icon = r.kind === "project" ? FolderOpenIcon : SquareCheckBig;
                            return (
                                <div key={`${r.kind}-${r.id}`}>
                                    {header && <p className="px-3 pt-2 pb-1 text-[11px] uppercase tracking-wide text-zinc-400">{header}</p>}
                                    <button
                                        type="button"
                                        role="option"
                                        aria-selected={i === activeIndex}
                                        onMouseDown={(e) => { e.preventDefault(); go(r); }}
                                        onMouseEnter={() => setActiveIndex(i)}
                                        className={`w-full flex items-start gap-3 px-3 py-2 text-left ${i === activeIndex ? "bg-blue-50 dark:bg-blue-500/15" : ""}`}
                                    >
                                        <Icon className="size-4 mt-0.5 shrink-0 text-zinc-500" />
                                        <span className="min-w-0">
                                            <span className="block text-sm text-zinc-900 dark:text-zinc-100 truncate">{r.title}</span>
                                            <span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate capitalize">{r.subtitle}</span>
                                        </span>
                                    </button>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
