import { Users } from "lucide-react";
import Card from "../Card";

const SEGMENTS = [
    { key: "active", label: "To do / in progress", bar: "bg-blue-500" },
    { key: "blocked", label: "Blocked", bar: "bg-red-500" },
    { key: "inReview", label: "In review", bar: "bg-violet-500" },
];

// What each person is carrying, heaviest first. A picture of load, not a
// score: bars share one scale so they compare across people.
export default function WorkloadByPerson({ rows, rangeDays }) {
    const max = Math.max(1, ...rows.map((r) => r.load));

    return (
        <Card
            title="Workload"
            icon={Users}
            hint="Open tasks per person"
            action={
                <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
                    {SEGMENTS.map((s) => (
                        <li key={s.key} className="flex items-center gap-1.5"><span className={`size-2.5 rounded-sm ${s.bar}`} /> {s.label}</li>
                    ))}
                </ul>
            }
        >
            {rows.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">No one is on this project yet.</p>
            ) : (
                <ul className="space-y-3">
                    {rows.map((row) => (
                        <li key={row.person.id} className="grid grid-cols-[minmax(0,10rem)_minmax(0,1fr)] sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1">
                            <div className="flex items-center gap-2 min-w-0">
                                <img src={row.person.image || undefined} alt="" className="size-6 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                                <span className="truncate text-sm text-zinc-900 dark:text-zinc-100">{row.person.name || row.person.email}</span>
                            </div>
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="flex h-2.5 flex-1 gap-0.5" title={SEGMENTS.filter((s) => row[s.key]).map((s) => `${s.label}: ${row[s.key]}`).join("\n") || "Nothing open"}>
                                    {row.load === 0 ? (
                                        <span className="h-full w-full rounded-sm bg-zinc-100 dark:bg-zinc-800" />
                                    ) : (
                                        SEGMENTS.filter((s) => row[s.key] > 0).map((s) => (
                                            <span key={s.key} className={`h-full rounded-sm ${s.bar}`} style={{ width: `${(row[s.key] / max) * 100}%` }} />
                                        ))
                                    )}
                                </div>
                                <span className="w-6 shrink-0 text-right text-sm tabular-nums text-zinc-900 dark:text-zinc-100">{row.load}</span>
                            </div>
                            <p className="max-sm:col-span-2 text-xs text-zinc-500 dark:text-zinc-400 sm:w-44 sm:text-right">
                                {row.overdue > 0 && <span className="font-medium text-red-600 dark:text-red-400">{row.overdue} overdue · </span>}
                                {row.done} done in {rangeDays} days
                            </p>
                        </li>
                    ))}
                </ul>
            )}
        </Card>
    );
}
