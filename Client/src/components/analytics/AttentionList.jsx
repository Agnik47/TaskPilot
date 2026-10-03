import { useState } from "react";
import { Link } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { formatDistanceStrict } from "date-fns";
import { BellRing, CircleCheck, TriangleAlert } from "lucide-react";
import Card from "../Card";
import useOrgRole from "../../hooks/useOrgRole";
import useTaskActions from "../../hooks/useTaskActions";
import { nudgeAvailableIn } from "../../lib/blockers";
import { PRIORITY_META, taskHref } from "../../lib/taskMeta";

const SHOWN = 5;

const GROUPS = [
    { key: "overdue", label: "Overdue", dot: "bg-red-500", age: (r) => `${r.days} ${r.days === 1 ? "day" : "days"} late` },
    { key: "blocked", label: "Blocked", dot: "bg-amber-500", age: (r, now) => (r.blocker ? `Waiting on ${r.blocker.waitingOn?.name?.split(" ")[0] || "someone"} · ` : "") + formatDistanceStrict(r.since, now) },
    { key: "review", label: "Waiting for review", dot: "bg-violet-500", age: (r, now) => `Waiting ${formatDistanceStrict(r.since, now)}` },
    { key: "stale", label: "No recent activity", dot: "bg-zinc-400", age: (r) => `Untouched for ${r.days} days` },
];

function Row({ row, group, now }) {
    const { task, blocker } = row;
    const { user } = useUser();
    const { isOwner } = useOrgRole();
    const { nudge } = useTaskActions();
    const [sending, setSending] = useState(false);

    const canEdit = isOwner || task.creatorId === user?.id || task.assigneeId === user?.id;
    const showNudge = group.key === "blocked" && blocker && canEdit && blocker.waitingOnId !== user?.id;
    const cooling = showNudge && nudgeAvailableIn(blocker, now.getTime()) > 0;
    const priority = PRIORITY_META[task.priority];

    const sendNudge = async () => {
        setSending(true);
        await nudge(task, blocker);
        setSending(false);
    };

    return (
        <li className="flex items-center gap-2.5 py-2">
            {task.assignee?.image ? (
                <img src={task.assignee.image} alt="" title={task.assignee.name} className="size-6 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            ) : (
                <span className="size-6 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
            )}
            <div className="min-w-0 flex-1">
                <Link to={taskHref(task)} className="block truncate text-sm text-zinc-900 dark:text-zinc-100 hover:underline">
                    {task.title}
                </Link>
                <p className="truncate text-xs text-zinc-500 dark:text-zinc-400" title={blocker?.reason}>{group.age(row, now)}</p>
            </div>
            {(task.priority === "HIGH" || task.priority === "URGENT") && (
                <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide ${priority.pill}`}>{priority.label}</span>
            )}
            {showNudge && (
                <button
                    type="button"
                    onClick={sendNudge}
                    disabled={cooling || sending}
                    title={cooling ? "A reminder was sent recently" : `Remind ${blocker.waitingOn?.name}`}
                    className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 text-xs text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <BellRing className="size-3" /> {cooling ? "Nudged" : "Nudge"}
                </button>
            )}
            {group.key === "review" && isOwner && (
                <Link to={taskHref(task)} className="shrink-0 px-2 py-1 rounded border border-violet-300 dark:border-violet-500/40 text-xs text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10">
                    Review
                </Link>
            )}
        </li>
    );
}

function Group({ group, rows, now }) {
    const [expanded, setExpanded] = useState(false);
    const shown = expanded ? rows : rows.slice(0, SHOWN);

    return (
        <div>
            <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                <span className={`size-2 rounded-full ${group.dot}`} /> {group.label}
                <span className="tabular-nums text-zinc-900 dark:text-zinc-200">{rows.length}</span>
            </h3>
            <ul className="mt-1 divide-y divide-zinc-200 dark:divide-zinc-800">
                {shown.map((row) => <Row key={row.task.id} row={row} group={group} now={now} />)}
            </ul>
            {rows.length > SHOWN && (
                <button type="button" onClick={() => setExpanded(!expanded)} className="mt-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                    {expanded ? "Show fewer" : `Show ${rows.length - SHOWN} more`}
                </button>
            )}
        </div>
    );
}

// The work that needs someone to act: late, stuck, waiting on a review, or
// quietly forgotten. Every row opens the task.
export default function AttentionList({ attention, now }) {
    const groups = GROUPS.filter((g) => attention[g.key].length > 0);

    return (
        <Card title="Needs attention" icon={TriangleAlert} hint={attention.count ? "Open a task to act on it" : undefined}>
            {groups.length === 0 ? (
                <p className="flex items-center gap-2 py-4 text-sm text-zinc-600 dark:text-zinc-400">
                    <CircleCheck className="size-4 text-emerald-600 dark:text-emerald-400" /> Nothing is late, blocked or waiting on a review.
                </p>
            ) : (
                <div className={`grid gap-x-8 gap-y-5 ${groups.length > 1 ? "md:grid-cols-2" : ""}`}>
                    {groups.map((group) => <Group key={group.key} group={group} rows={attention[group.key]} now={now} />)}
                </div>
            )}
        </Card>
    );
}
