import { useState } from "react";
import { useSelector } from "react-redux";
import { formatDistanceToNow } from "date-fns";
import { CheckCircle2, Clock3, Loader2Icon, RotateCcw, ShieldCheck, Undo2 } from "lucide-react";
import useOrgRole from "../../hooks/useOrgRole";
import useTaskActions from "../../hooks/useTaskActions";
import { needsApproval, reviewerName } from "../../lib/taskWorkflow";
import RequestChangesDialog from "./RequestChangesDialog";

// Contextual review panel for the task page:
//  - owner, task In Review  -> "Ready for your review" + Approve / Request changes
//  - assignee, In Review    -> "Waiting for approval" + Withdraw
//  - approved work          -> quiet "Approved" confirmation
export default function ReviewBanner({ task }) {
    const { isOwner } = useOrgRole();
    const settings = useSelector((state) => state.workspace.settings);
    const { approve, requestChanges, setStatus } = useTaskActions();
    const [busy, setBusy] = useState(null);
    const [asking, setAsking] = useState(false);

    const since = task.submittedAt ? formatDistanceToNow(new Date(task.submittedAt), { addSuffix: true }) : null;
    const run = async (key, fn) => {
        setBusy(key);
        await fn();
        setBusy(null);
    };

    if (task.status === "IN_REVIEW" && isOwner) {
        return (
            <div className="motion-rise rounded-lg border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 p-4">
                <div className="flex items-start gap-3">
                    <ShieldCheck className="size-5 shrink-0 mt-0.5 text-violet-600 dark:text-violet-300" />
                    <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">Ready for your review</p>
                        <p className="text-sm text-violet-800/80 dark:text-violet-200/80 mt-0.5">
                            {task.assignee?.name || "The assignee"} {needsApproval(task, settings) ? "marked this done" : "sent this for review"}{since ? ` ${since}` : ""}. Approve it to complete the task, or send it back with notes.
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap justify-end gap-2 mt-3">
                    <button type="button" onClick={() => setAsking(true)} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-violet-300 dark:border-violet-500/40 text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-500/15 disabled:opacity-50">
                        <RotateCcw className="size-4" /> Request changes
                    </button>
                    <button type="button" onClick={() => run("approve", () => approve(task))} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60">
                        {busy === "approve" ? <Loader2Icon className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />} Approve
                    </button>
                </div>
                {asking && <RequestChangesDialog task={task} onSubmit={(note) => requestChanges(task, note)} onClose={() => setAsking(false)} />}
            </div>
        );
    }

    if (task.status === "IN_REVIEW") {
        return (
            <div className="motion-rise rounded-lg border border-violet-200 dark:border-violet-500/30 bg-violet-50 dark:bg-violet-500/10 p-4 flex flex-wrap items-start gap-3">
                <Clock3 className="size-5 shrink-0 mt-0.5 text-violet-600 dark:text-violet-300" />
                <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">Waiting for approval</p>
                    <p className="text-sm text-violet-800/80 dark:text-violet-200/80 mt-0.5">
                        Sent to {reviewerName(task, settings)}{since ? ` ${since}` : ""}. You'll be notified when it's approved or needs changes.
                    </p>
                </div>
                <button type="button" onClick={() => run("withdraw", () => setStatus(task, "IN_PROGRESS"))} disabled={!!busy} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm text-violet-800 dark:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-500/15 disabled:opacity-50">
                    {busy === "withdraw" ? <Loader2Icon className="size-4 animate-spin" /> : <Undo2 className="size-4" />} Withdraw
                </button>
            </div>
        );
    }

    if (task.status === "DONE" && needsApproval(task, settings)) {
        return (
            <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="size-4" /> Approved and complete
            </div>
        );
    }

    return null;
}
