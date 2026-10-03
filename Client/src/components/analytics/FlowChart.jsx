import { useSelector } from "react-redux";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartColumn } from "lucide-react";
import Card from "../Card";

// Checked for colour-blind separation and contrast on both surfaces.
const SERIES = [
    { key: "created", label: "Created", color: "#3b82f6" },
    { key: "completed", label: "Completed", color: "#059669" },
];

const INK = {
    light: { tick: "#52525b", grid: "#e4e4e7", cursor: "rgba(24, 24, 27, 0.05)" },
    dark: { tick: "#a1a1aa", grid: "#27272a", cursor: "rgba(255, 255, 255, 0.05)" },
};

function FlowTooltip({ active, payload }) {
    if (!active || !payload?.length) return null;
    const bucket = payload[0].payload;
    return (
        <div className="rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-xs shadow-lg">
            <p className="mb-1 font-medium text-zinc-900 dark:text-zinc-100">{bucket.title}</p>
            {SERIES.map((s) => (
                <p key={s.key} className="flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                    <span className="size-2 rounded-sm" style={{ background: s.color }} /> {s.label}
                    <span className="ml-auto pl-4 tabular-nums font-medium text-zinc-900 dark:text-zinc-100">{bucket[s.key]}</span>
                </p>
            ))}
        </div>
    );
}

// Created vs completed over the selected range.
export default function FlowChart({ data, rangeDays }) {
    const theme = useSelector((state) => state.theme.theme);
    const ink = INK[theme] || INK.light;
    const created = data.reduce((sum, b) => sum + b.created, 0);
    const completed = data.reduce((sum, b) => sum + b.completed, 0);
    const verdict = created > completed ? `${created - completed} more created than completed, so the backlog grew`
        : completed > created ? `${completed - created} more completed than created, so the backlog shrank`
        : "As many completed as created";

    return (
        <Card
            title="Created vs completed"
            icon={ChartColumn}
            hint={created + completed ? verdict : undefined}
            action={
                <ul className="flex items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
                    {SERIES.map((s) => (
                        <li key={s.key} className="flex items-center gap-1.5">
                            <span className="size-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
                        </li>
                    ))}
                </ul>
            }
        >
            {created + completed === 0 ? (
                <p className="py-10 text-center text-sm text-zinc-500 dark:text-zinc-400">No tasks were created or completed in the last {rangeDays} days.</p>
            ) : (
                <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={data} barGap={2} barCategoryGap="28%" margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                        <CartesianGrid vertical={false} stroke={ink.grid} />
                        <XAxis dataKey="label" tick={{ fill: ink.tick, fontSize: 12 }} axisLine={{ stroke: ink.grid }} tickLine={false} interval="preserveStartEnd" />
                        <YAxis allowDecimals={false} tick={{ fill: ink.tick, fontSize: 12 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<FlowTooltip />} cursor={{ fill: ink.cursor }} />
                        {SERIES.map((s) => (
                            <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} />
                        ))}
                    </BarChart>
                </ResponsiveContainer>
            )}
        </Card>
    );
}
