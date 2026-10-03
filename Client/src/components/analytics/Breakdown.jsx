import { Layers } from "lucide-react";
import Card from "../Card";
import { BOARD_COLUMNS, STATUS_META } from "../../lib/taskWorkflow";
import { PRIORITY_META, TYPE_META } from "../../lib/taskMeta";

function Bars({ title, rows }) {
    const max = Math.max(1, ...rows.map((r) => r.value));
    return (
        <div>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">{title}</h3>
            <ul className="space-y-2">
                {rows.map((row) => (
                    <li key={row.label} className="grid grid-cols-[6.5rem_minmax(0,1fr)_1.5rem] items-center gap-2 text-sm">
                        <span className="flex items-center gap-1.5 truncate text-zinc-700 dark:text-zinc-300">
                            {row.icon && <row.icon className={`size-3.5 shrink-0 ${row.iconClass}`} />} {row.label}
                        </span>
                        <span className="h-2 rounded-sm bg-zinc-100 dark:bg-zinc-800">
                            {row.value > 0 && <span className={`block h-full rounded-sm ${row.bar}`} style={{ width: `${(row.value / max) * 100}%` }} />}
                        </span>
                        <span className="text-right tabular-nums text-zinc-900 dark:text-zinc-100">{row.value}</span>
                    </li>
                ))}
            </ul>
        </div>
    );
}

// Where the work stands: every task by status, then what's still open by
// priority and type.
export default function Breakdown({ summary }) {
    const { total, byStatus, byPriority, byType } = summary;

    return (
        <Card title="Breakdown" icon={Layers}>
            {total === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-500 dark:text-zinc-400">No tasks in this project yet.</p>
            ) : (
                <div className="space-y-6">
                    <div>
                        <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">All tasks by status</h3>
                        <div className="flex h-3 gap-0.5">
                            {BOARD_COLUMNS.filter((s) => byStatus[s] > 0).map((s) => (
                                <span key={s} title={`${STATUS_META[s].label}: ${byStatus[s]}`} className={`h-full rounded-sm ${STATUS_META[s].dot}`} style={{ width: `${(byStatus[s] / total) * 100}%` }} />
                            ))}
                        </div>
                        <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
                            {BOARD_COLUMNS.map((s) => (
                                <li key={s} className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                                    <span className={`size-2 rounded-full ${STATUS_META[s].dot}`} /> {STATUS_META[s].label}
                                    <span className="tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{byStatus[s]}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2">
                        <Bars title="Open tasks by priority" rows={Object.entries(byPriority).map(([k, value]) => ({ label: PRIORITY_META[k].label, value, bar: PRIORITY_META[k].bar }))} />
                        <Bars title="Open tasks by type" rows={Object.entries(byType).map(([k, value]) => ({ label: TYPE_META[k].label, value, bar: "bg-zinc-400 dark:bg-zinc-500", icon: TYPE_META[k].icon, iconClass: TYPE_META[k].color }))} />
                    </div>
                </div>
            )}
        </Card>
    );
}
