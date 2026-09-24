import { FolderOpen, CheckCircle, ListTodo, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/clerk-react";
import useCurrentWorkspace from "../hooks/useCurrentWorkspace";
import useOrgRole from "../hooks/useOrgRole";
import api from "../lib/api";

export default function StatsGrid() {
    const currentWorkspace = useCurrentWorkspace();
    const { organization } = useOrganization();
    const { isOwner } = useOrgRole();

    const [summary, setSummary] = useState(null);

    useEffect(() => {
        if (!organization) return;
        api.get("/dashboard/summary").then(({ data }) => setSummary(data)).catch(() => setSummary(null));
    }, [organization?.id]);

    const totalProjects = currentWorkspace?.projects.length || 0;
    const completed = summary?.completed || 0;
    const active = (summary?.total || 0) - completed;
    const overdue = summary?.overdue || 0;

    const statCards = [
        {
            icon: FolderOpen,
            title: "Total Projects",
            value: totalProjects,
            subtitle: `projects in ${currentWorkspace?.name || "your workspace"}`,
            bgColor: "bg-blue-500/10",
            textColor: "text-blue-500",
        },
        {
            icon: CheckCircle,
            title: "Completed Tasks",
            value: completed,
            subtitle: `of ${summary?.total || 0} total`,
            bgColor: "bg-emerald-500/10",
            textColor: "text-emerald-500",
        },
        {
            icon: ListTodo,
            title: isOwner ? "Active Tasks" : "My Tasks",
            value: active,
            subtitle: isOwner ? "across the workspace" : "assigned to me",
            bgColor: "bg-purple-500/10",
            textColor: "text-purple-500",
        },
        {
            icon: AlertTriangle,
            title: "Overdue",
            value: overdue,
            subtitle: "need attention",
            bgColor: "bg-amber-500/10",
            textColor: "text-amber-500",
        },
    ];

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 my-9">
            {statCards.map(
                ({ icon, title, value, subtitle, bgColor, textColor }, i) => {
                    const Icon = icon;
                    return (
                    <div key={i} className="bg-white dark:bg-zinc-950 dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition duration-200 rounded-md" >
                        <div className="p-6 py-4">
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">
                                        {title}
                                    </p>
                                    <p className="text-3xl font-bold text-zinc-800 dark:text-white">
                                        {value}
                                    </p>
                                    {subtitle && (
                                        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-1">
                                            {subtitle}
                                        </p>
                                    )}
                                </div>
                                <div className={`p-3 rounded-xl ${bgColor} bg-opacity-20`}>
                                    <Icon size={20} className={textColor} />
                                </div>
                            </div>
                        </div>
                    </div>
                    );
                }
            )}
        </div>
    );
}
