import { ChevronDown } from "lucide-react";

// One person's row on the board when it's grouped by person: a header with
// their workload at a glance, then the usual status columns. Collapsible, so an
// owner can fold away people they're not looking at.
export default function BoardLane({ person, isMe, counts, collapsed, onToggle, children }) {
    const summary = [
        `${counts.open} open`,
        counts.blocked > 0 && `${counts.blocked} blocked`,
        counts.review > 0 && `${counts.review} in review`,
    ].filter(Boolean);

    return (
        <section aria-label={`${person?.name || "Unknown"}'s tasks`} className="rounded-xl border border-zinc-200 dark:border-zinc-800">
            <button
                type="button"
                onClick={onToggle}
                aria-expanded={!collapsed}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
            >
                <ChevronDown className={`size-4 shrink-0 text-zinc-400 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                <img src={person?.image} alt="" className="size-7 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {person?.name || "Unknown"}
                        {isMe && <span className="font-normal text-zinc-500 dark:text-zinc-400"> (you)</span>}
                    </span>
                    <span className="block text-xs text-zinc-500 dark:text-zinc-400">
                        {summary.map((part, i) => (
                            <span key={part} className={i > 0 ? "before:content-['·'] before:mx-1.5" : ""}>
                                <span className={part.endsWith("blocked") ? "text-red-600 dark:text-red-400" : part.endsWith("in review") ? "text-violet-600 dark:text-violet-300" : ""}>{part}</span>
                            </span>
                        ))}
                    </span>
                </span>
            </button>
            {!collapsed && <div className="px-2 pb-2">{children}</div>}
        </section>
    );
}
