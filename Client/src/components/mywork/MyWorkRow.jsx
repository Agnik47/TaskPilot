import { useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import toast from "react-hot-toast";
import { format } from "date-fns";
import { CalendarDays, Check, CheckCircle2, Circle, Clock3, Loader2Icon } from "lucide-react";
import useOrgRole from "../../hooks/useOrgRole";
import useTaskActions from "../../hooks/useTaskActions";
import { STATUS_META, expectedStatus, statusOptionsFor } from "../../lib/taskWorkflow";
import { dueInfo } from "../../lib/dates";
import CellSelect from "../sheet/CellSelect";
import WaitingOnBadge from "../blockers/WaitingOnBadge";
import ChecklistProgress from "../checklist/ChecklistProgress";

const PRIORITY = {
    LOW: "text-zinc-500 dark:text-zinc-400",
    MEDIUM: "text-blue-600 dark:text-blue-400",
    HIGH: "text-amber-600 dark:text-amber-400",
    URGENT: "text-red-600 dark:text-red-400 font-semibold",
};

// One task on the My Work page: complete it in one click (with Undo), change
// its status, or open it. `showAssignee` is for work you delegated.
export default function MyWorkRow({ task, canEdit, showAssignee }) {
    const { isOwner } = useOrgRole();
    const settings = useSelector((state) => state.workspace.settings);
    const { setStatus } = useTaskActions();
    const [completing, setCompleting] = useState(false);

    const due = dueInfo(task);
    const href = `/taskDetails?projectId=${task.projectId}&taskId=${task.id}`;
    const settled = task.status === "DONE" || task.status === "IN_REVIEW";
    // Approved work can't be undone by the assignee, and blocked work needs unblocking first.
    const doneOption = statusOptionsFor(task, { isOwner, settings }).find((o) => o.value === "DONE");
    const canComplete = canEdit && !settled && task.status !== "BLOCKED" && !doneOption?.disabled;

    const complete = async () => {
        const previous = task.status;
        const goesToReview = expectedStatus(task, "DONE", { isOwner, settings }) === "IN_REVIEW";
        setCompleting(true);
        const ok = await setStatus(task, "DONE");
        setCompleting(false);
        // Review submissions already get their own "Sent for approval" toast.
        if (!ok || goesToReview) return;
        toast(
            (t) => (
                <span className="flex items-center gap-3 text-sm">
                    <span>Completed "{task.title.length > 40 ? `${task.title.slice(0, 40)}…` : task.title}"</span>
                    <button
                        type="button"
                        onClick={() => {
                            toast.dismiss(t.id);
                            setStatus({ ...task, status: "DONE" }, previous);
                        }}
                        className="font-medium text-blue-600 dark:text-blue-400 hover:underline"
                    >
                        Undo
                    </button>
                </span>
            ),
            { duration: 5000 }
        );
    };

    return (
        <li className="group flex items-start gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-colors">
            {/* Complete */}
            {settled ? (
                task.status === "DONE" ? (
                    <CheckCircle2 className="size-5 mt-0.5 shrink-0 text-emerald-500" aria-label="Done" />
                ) : (
                    <Clock3 className="size-5 mt-0.5 shrink-0 text-violet-500" aria-label="Waiting for approval" />
                )
            ) : (
                <button
                    type="button"
                    onClick={complete}
                    disabled={!canComplete || completing}
                    title={canComplete ? "Mark as done" : task.status === "BLOCKED" ? "Unblock it first" : "You can't complete this task"}
                    aria-label={`Mark "${task.title}" as done`}
                    className="relative size-5 mt-0.5 shrink-0 text-zinc-400 hover:text-emerald-600 disabled:hover:text-zinc-400 disabled:opacity-50 disabled:cursor-not-allowed group/check"
                >
                    {completing ? (
                        <Loader2Icon className="size-5 animate-spin" />
                    ) : (
                        <>
                            <Circle className="size-5" />
                            {canComplete && <Check className="size-3 absolute inset-0 m-auto opacity-0 group-hover/check:opacity-100 transition-opacity" />}
                        </>
                    )}
                </button>
            )}

            {/* Title + details */}
            <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <Link to={href} className={`text-sm font-medium hover:underline break-words ${task.status === "DONE" ? "text-zinc-500 dark:text-zinc-500 line-through decoration-zinc-400/60" : "text-zinc-900 dark:text-zinc-100"}`}>
                        {task.title}
                    </Link>
                    <WaitingOnBadge task={task} />
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <Link to={`/projectsDetail?id=${task.projectId}&tab=tasks`} className="hover:underline truncate max-w-48">{task.projectName}</Link>
                    <span aria-hidden>·</span>
                    <span className={PRIORITY[task.priority]}>{task.priority.charAt(0) + task.priority.slice(1).toLowerCase()}</span>
                    {task.checklist?.length > 0 && (
                        <>
                            <span aria-hidden>·</span>
                            <ChecklistProgress task={task} />
                        </>
                    )}
                    {due && (
                        <>
                            <span aria-hidden>·</span>
                            <span className={`inline-flex items-center gap-1 ${due.overdue ? "text-red-600 dark:text-red-400 font-medium" : due.soon ? "text-amber-700 dark:text-amber-300" : ""}`}>
                                <CalendarDays className="size-3" /> {due.overdue ? `Due ${due.label}` : due.label}
                            </span>
                        </>
                    )}
                    {task.status === "DONE" && task.completedAt && (
                        <>
                            <span aria-hidden>·</span>
                            <span>Done {format(new Date(task.completedAt), "d MMM")}</span>
                        </>
                    )}
                </div>
            </div>

            {/* Assignee (delegated work) + status */}
            <div className="flex items-center gap-2 shrink-0">
                {showAssignee && task.assignee && (
                    <img src={task.assignee.image} alt={task.assignee.name} title={task.assignee.name} className="size-6 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                )}
                <CellSelect
                    label="Status"
                    value={task.status}
                    options={statusOptionsFor(task, { isOwner, settings })}
                    onChange={(s) => setStatus(task, s)}
                    disabled={!canEdit}
                    menuWidth={230}
                    className="h-7 pl-1 pr-2 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-white dark:hover:bg-zinc-800"
                    renderValue={() => (
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUS_META[task.status]?.pill}`}>
                            <span className={`size-1.5 rounded-full ${STATUS_META[task.status]?.dot}`} />
                            {STATUS_META[task.status]?.label ?? task.status}
                        </span>
                    )}
                />
            </div>
        </li>
    );
}
