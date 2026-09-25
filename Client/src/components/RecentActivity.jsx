import { useEffect, useState } from "react";
import { GitCommit, MessageSquare, Clock, UserPlus, ArrowRightLeft, Flag, Calendar, CheckCircle2, ShieldCheck, RotateCcw } from "lucide-react";
import { format } from "date-fns";
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
};

const RecentActivity = () => {
    const { organization } = useOrganization();
    const [activity, setActivity] = useState([]);

    useEffect(() => {
        if (!organization) return;
        api.get("/activity").then(({ data }) => setActivity(data)).catch(() => setActivity([]));
    }, [organization?.id]);

    return (
        <div className="bg-white dark:bg-zinc-950 dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-lg transition-all overflow-hidden">
            <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
                <h2 className="text-lg text-zinc-800 dark:text-zinc-200">Recent Activity</h2>
            </div>

            <div className="p-0">
                {activity.length === 0 ? (
                    <div className="p-12 text-center">
                        <div className="w-16 h-16 mx-auto mb-4 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center">
                            <Clock className="w-8 h-8 text-zinc-600 dark:text-zinc-500" />
                        </div>
                        <p className="text-zinc-600 dark:text-zinc-400">No recent activity</p>
                    </div>
                ) : (
                    <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {activity.map((item) => {
                            const TypeIcon = activityIcons[item.type]?.icon || GitCommit;
                            const iconColor = activityIcons[item.type]?.color || "text-gray-500 dark:text-gray-400";

                            return (
                                <div key={item.id} className="p-6 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                                    <div className="flex items-start gap-4">
                                        <div className="p-2 bg-zinc-200 dark:bg-zinc-800 rounded-lg">
                                            <TypeIcon className={`w-4 h-4 ${iconColor}`} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between mb-1">
                                                <h4 className="text-zinc-800 dark:text-zinc-200 truncate">
                                                    {item.message}
                                                </h4>
                                            </div>
                                            <div className="flex items-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
                                                {item.task?.title && <span className="truncate">{item.task.title}</span>}
                                                <span>{format(new Date(item.createdAt), "MMM d, h:mm a")}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default RecentActivity;
