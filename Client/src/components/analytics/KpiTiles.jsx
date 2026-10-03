import { AlertTriangle, CheckCircle2, ListTodo, Timer, TrendingDown, TrendingUp } from "lucide-react";

const formatDays = (days) => (days < 1 ? "under a day" : `${days < 10 ? Math.round(days * 10) / 10 : Math.round(days)} ${days < 1.05 ? "day" : "days"}`);

// Headline numbers for the selected range. A tile with nothing to measure
// shows a dash rather than a misleading 0.
export default function KpiTiles({ summary, rangeDays }) {
    const delta = summary.completed - summary.prevCompleted;
    const DeltaIcon = delta >= 0 ? TrendingUp : TrendingDown;

    const tiles = [
        {
            label: "Completed",
            value: summary.completed,
            icon: CheckCircle2,
            tone: "text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10",
            note: delta === 0
                ? `Same as the previous ${rangeDays} days`
                : <><DeltaIcon className="size-3.5 shrink-0" /> {Math.abs(delta)} {delta > 0 ? "more" : "fewer"} than the previous {rangeDays} days</>,
        },
        {
            label: "Open",
            value: summary.open,
            icon: ListTodo,
            tone: "text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-500/10",
            note: `${summary.blocked} blocked · ${summary.inReview} in review`,
        },
        {
            label: "Overdue",
            value: summary.overdue,
            icon: AlertTriangle,
            tone: summary.overdue ? "text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-500/10" : "text-zinc-500 dark:text-zinc-400 bg-zinc-100 dark:bg-zinc-800",
            note: summary.overdue ? "Past their due date and not finished" : "Nothing is past its due date",
        },
        {
            label: "On time",
            value: summary.onTimeRate === null ? "–" : `${summary.onTimeRate}%`,
            icon: Timer,
            tone: "text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/10",
            note: summary.medianDays === null ? "No completed tasks in this period" : `Typically ${formatDays(summary.medianDays)} to complete`,
        },
    ];

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {tiles.map((tile) => (
                <div key={tile.label} className="not-dark:bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2">
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">{tile.label}</p>
                        <span className={`p-1.5 rounded-md ${tile.tone}`}><tile.icon className="size-4" /></span>
                    </div>
                    <p className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900 dark:text-white">{tile.value}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">{tile.note}</p>
                </div>
            ))}
        </div>
    );
}
