import { Hourglass } from "lucide-react";
import { openBlockers, waitingFor } from "../../lib/blockers";

// Compact "Waiting on Priya · 2 days" chip for task lists. The tooltip lists
// every open blocker with its reason.
export default function WaitingOnBadge({ task, className = "" }) {
    const blockers = openBlockers(task);
    if (!blockers.length) return null;

    const first = blockers[0];
    const label = blockers.length === 1 ? `Waiting on ${first.waitingOn?.name?.split(" ")[0]} · ${waitingFor(first)}` : `Waiting on ${blockers.length} people`;
    const tooltip = blockers.map((b) => `${b.waitingOn?.name} (${waitingFor(b)}): ${b.reason}`).join("\n");

    return (
        <span
            title={tooltip}
            className={`inline-flex items-center gap-1.5 max-w-full pl-1 pr-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-200 dark:ring-amber-500/30 whitespace-nowrap ${className}`}
        >
            <span className="flex -space-x-1.5 shrink-0">
                {blockers.slice(0, 2).map((b) =>
                    b.waitingOn?.image ? (
                        <img key={b.id} src={b.waitingOn.image} alt="" className="size-4 rounded-full ring-1 ring-amber-50 dark:ring-zinc-900 bg-zinc-200" />
                    ) : (
                        <Hourglass key={b.id} className="size-3.5" />
                    )
                )}
            </span>
            <span className="truncate">{label}</span>
        </span>
    );
}
