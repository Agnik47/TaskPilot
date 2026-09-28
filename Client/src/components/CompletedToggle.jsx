import { CheckCircle2 } from "lucide-react";

// "Show completed" switch for task lists (see useCompletedTasks). Hidden when
// there's nothing completed to show.
export default function CompletedToggle({ shown, count, onChange, className = "" }) {
    if (!count) return null;
    return (
        <button
            type="button"
            role="switch"
            aria-checked={shown}
            onClick={() => onChange(!shown)}
            title={shown ? "Hide completed tasks" : "Completed tasks are hidden to keep the list focused. Nothing is deleted."}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-sm border transition ${shown
                ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300"
                : "border-zinc-300 dark:border-zinc-800 not-dark:bg-white text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"} ${className}`}
        >
            <CheckCircle2 className="size-3.5" />
            Show completed
            <span className="tabular-nums text-xs opacity-70">{count}</span>
        </button>
    );
}
