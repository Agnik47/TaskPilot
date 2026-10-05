import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GitCommit, MessageSquare, UserPlus, ArrowRightLeft, Flag, Calendar, CheckCircle2, ShieldCheck, RotateCcw, Hourglass, Unlock, ListChecks } from "lucide-react";
import { format, formatDistanceToNowStrict, isToday, isYesterday } from "date-fns";
import { useOrganization } from "@clerk/clerk-react";
import api from "../lib/api";

const activityIcons = {
    TASK_CREATED: { icon: GitCommit, color: "text-green-500 dark:text-green-400" },
    TASK_ASSIGNED: { icon: UserPlus, color: "text-blue-500 dark:text-blue-400" },
    TASK_REASSIGNED: { icon: ArrowRightLeft, color: "text-blue-500 dark:text-blue-400" },
    STATUS_CHANGED: { icon: Flag, color: "text-amber-500 dark:text-amber-400" },
    PRIORITY_CHANGED: { icon: Flag, color: "text-purple-500 dark:text-purple-400" },
    DUE_DATE_CHANGED: { icon: Calendar, color: "text-amber-500 dark:text-amber-400" },
    COMMENT_ADDED: { icon: MessageSquare, color: "text-zinc-500 dark:text-zinc-400" },
    TASK_COMPLETED: { icon: CheckCircle2, color: "text-emerald-500 dark:text-emerald-400" },
    SUBMITTED_FOR_REVIEW: { icon: ShieldCheck, color: "text-violet-500 dark:text-violet-400" },
    TASK_APPROVED: { icon: CheckCircle2, color: "text-emerald-500 dark:text-emerald-400" },
    CHANGES_REQUESTED: { icon: RotateCcw, color: "text-amber-500 dark:text-amber-400" },
    BLOCKER_ADDED: { icon: Hourglass, color: "text-red-500 dark:text-red-400" },
    BLOCKER_RESOLVED: { icon: Unlock, color: "text-emerald-500 dark:text-emerald-400" },
    CHECKLIST_ITEM_COMPLETED: { icon: ListChecks, color: "text-emerald-500 dark:text-emerald-400" },
};

const VISIBLE = 8;

const dayLabel = (date) => (isToday(date) ? "Today" : isYesterday(date) ? "Yesterday" : format(date, "EEEE, d MMM"));

// A short feed of what changed, grouped by day. It's context rather than a
// to-do list, so it stays compact and shows only the latest few until asked.
const RecentActivity = () => {
    const { organization } = useOrganization();
    const [activity, setActivity] = useState(null);
    const [showAll, setShowAll] = useState(false);

    useEffect(() => {
        if (!organization) return;
        api.get("/activity").then(({ data }) => setActivity(data)).catch(() => setActivity([]));
    }, [organization?.id]);

    const days = useMemo(() => {
        const shown = showAll ? activity || [] : (activity || []).slice(0, VISIBLE);
        const byDay = new Map();
        shown.forEach((item) => {
            const label = dayLabel(new Date(item.createdAt));
            byDay.set(label, [...(byDay.get(label) || []), item]);
        });
        return [...byDay.entries()];
    }, [activity, showAll]);

    return (
        <section className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            <h2 className="px-4 py-3 font-medium text-zinc-900 dark:text-white border-b border-zinc-100 dark:border-zinc-800">Recent activity</h2>

            {activity === null ? (
                <div className="p-4 space-y-3" aria-hidden>
                    {[0, 1, 2].map((i) => <div key={i} className="h-8 rounded bg-zinc-100 dark:bg-zinc-900 animate-pulse" />)}
                </div>
            ) : activity.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
                    Changes to your tasks will show up here.
                </p>
            ) : (
                <div className="pb-1">
                    {days.map(([label, items]) => (
                        <div key={label}>
                            <h3 className="px-4 pt-3 pb-1 text-xs font-medium text-zinc-400 dark:text-zinc-500">{label}</h3>
                            <ul>
                                {items.map((item) => {
                                    const TypeIcon = activityIcons[item.type]?.icon || GitCommit;
                                    const iconColor = activityIcons[item.type]?.color || "text-zinc-500 dark:text-zinc-400";
                                    const body = (
                                        <>
                                            <TypeIcon className={`size-4 mt-0.5 shrink-0 ${iconColor}`} />
                                            <span className="min-w-0 flex-1">
                                                <span className="block text-sm text-zinc-800 dark:text-zinc-200 line-clamp-2">{item.message}</span>
                                                <span className="flex gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                                                    {item.task?.title && <span className="truncate">{item.task.title}</span>}
                                                    <span className="shrink-0 text-zinc-400 dark:text-zinc-500">{formatDistanceToNowStrict(new Date(item.createdAt))} ago</span>
                                                </span>
                                            </span>
                                        </>
                                    );
                                    const rowClass = "flex items-start gap-3 px-4 py-2";
                                    return (
                                        <li key={item.id}>
                                            {item.task?.id && item.projectId ? (
                                                <Link to={`/taskDetails?projectId=${item.projectId}&taskId=${item.task.id}`} className={`${rowClass} hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors`}>
                                                    {body}
                                                </Link>
                                            ) : (
                                                <div className={rowClass}>{body}</div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    ))}
                </div>
            )}

            {activity?.length > VISIBLE && (
                <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full px-4 py-2.5 text-sm text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 border-t border-zinc-100 dark:border-zinc-800">
                    {showAll ? "Show less" : `Show ${activity.length - VISIBLE} more`}
                </button>
            )}
        </section>
    );
};

export default RecentActivity;
