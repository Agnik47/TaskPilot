import { ListChecks } from "lucide-react";
import { checklistProgress } from "../../lib/checklist";

// Compact "3/5" checklist progress for task lists; nothing when there's no checklist.
export default function ChecklistProgress({ task, className = "" }) {
    const { done, total, complete } = checklistProgress(task);
    if (!total) return null;
    return (
        <span
            title={`Checklist: ${done} of ${total} done`}
            className={`inline-flex items-center gap-1 text-xs tabular-nums whitespace-nowrap ${complete ? "text-emerald-600 dark:text-emerald-400" : "text-zinc-500 dark:text-zinc-400"} ${className}`}
        >
            <ListChecks className="size-3.5" />
            {done}/{total}
        </span>
    );
}
