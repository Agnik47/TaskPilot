import { Bug, GitCommit, MessageSquare, Square, Zap } from "lucide-react";

// One source for how priorities and types look (status lives in
// STATUS_META, lib/taskWorkflow.js). Priority runs cool to hot: low is quiet,
// urgent is red.
export const PRIORITY_META = {
    LOW: { label: "Low", pill: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300", bar: "bg-zinc-400 dark:bg-zinc-500" },
    MEDIUM: { label: "Medium", pill: "bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300", bar: "bg-blue-500" },
    HIGH: { label: "High", pill: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300", bar: "bg-amber-500" },
    URGENT: { label: "Urgent", pill: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300", bar: "bg-red-500" },
};

export const TYPE_META = {
    TASK: { label: "Task", icon: Square, color: "text-green-600 dark:text-green-400" },
    BUG: { label: "Bug", icon: Bug, color: "text-red-600 dark:text-red-400" },
    FEATURE: { label: "Feature", icon: Zap, color: "text-blue-600 dark:text-blue-400" },
    IMPROVEMENT: { label: "Improvement", icon: GitCommit, color: "text-purple-600 dark:text-purple-400" },
    OTHER: { label: "Other", icon: MessageSquare, color: "text-amber-600 dark:text-amber-400" },
};

export const taskHref = (task) => `/taskDetails?projectId=${task.projectId}&taskId=${task.id}`;
