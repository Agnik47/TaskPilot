import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useUser } from "@clerk/clerk-react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { CheckCircle2, ChevronRight, Loader2Icon, RotateCcw, ShieldCheck } from "lucide-react";
import useOrgRole from "../../hooks/useOrgRole";
import useTaskActions from "../../hooks/useTaskActions";
import { peopleOptions } from "../../lib/people";
import FilterSelect from "../FilterSelect";
import RequestChangesDialog from "./RequestChangesDialog";

const VISIBLE = 5;

// Owner's inbox of finished work awaiting sign-off, oldest first so nothing
// sits forgotten. Only rendered for owners, and only when there's something to review.
// With several people waiting, the owner can narrow the list to one employee.
export default function ReviewQueue() {
    const { isOwner } = useOrgRole();
    const { user } = useUser();
    const projects = useSelector((state) => state.workspace.projects);
    const { approve, requestChanges } = useTaskActions();
    const [busyId, setBusyId] = useState(null);
    const [asking, setAsking] = useState(null);
    const [showAll, setShowAll] = useState(false);
    const [employee, setEmployee] = useState("");

    const waiting = useMemo(
        () =>
            projects
                .flatMap((p) => (p.tasks || []).filter((t) => t.status === "IN_REVIEW").map((t) => ({ ...t, projectName: p.name })))
                .sort((a, b) => new Date(a.submittedAt || a.updatedAt) - new Date(b.submittedAt || b.updatedAt)),
        [projects]
    );

    const employeeOptions = useMemo(() => {
        const counts = {};
        waiting.forEach((t) => { counts[t.assigneeId] = (counts[t.assigneeId] || 0) + 1; });
        const people = peopleOptions(waiting.map((t) => t.assignee).filter(Boolean), user?.id);
        return [{ value: "", label: "Everyone", hint: String(waiting.length) }, ...people.map((p) => ({ ...p, hint: String(counts[p.value]) }))];
    }, [waiting, user?.id]);

    if (!isOwner || waiting.length === 0) return null;
    // Approving someone's last task empties their filter; fall back to everyone.
    const activeEmployee = employeeOptions.some((o) => o.value === employee) ? employee : "";
    const filtered = activeEmployee ? waiting.filter((t) => t.assigneeId === activeEmployee) : waiting;
    const shown = showAll ? filtered : filtered.slice(0, VISIBLE);

    const onApprove = async (task) => {
        setBusyId(task.id);
        await approve(task);
        setBusyId(null);
    };

    return (
        <section className="motion-rise mb-8 rounded-lg border border-violet-200 dark:border-violet-500/30 bg-white dark:bg-zinc-950 overflow-hidden">
            <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-violet-100 dark:border-violet-500/20 bg-violet-50/70 dark:bg-violet-500/10">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-violet-900 dark:text-violet-100">
                    <ShieldCheck className="size-4" /> Waiting for your review
                    <span className="px-1.5 py-0.5 rounded-full text-xs bg-violet-600 text-white">{filtered.length}</span>
                </h2>
                {employeeOptions.length > 2 ? (
                    <FilterSelect label="Employee" value={activeEmployee} options={employeeOptions} onChange={setEmployee} showImage inactiveLabel="All employees" searchPlaceholder="Search by name or email" menuWidth={260} />
                ) : (
                    <p className="hidden sm:block text-xs text-violet-800/70 dark:text-violet-200/70">Oldest first</p>
                )}
            </header>

            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {shown.map((task) => (
                    <li key={task.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-4 py-3">
                        <Link to={`/taskDetails?projectId=${task.projectId}&taskId=${task.id}`} className="group flex items-center gap-3 min-w-0 flex-1">
                            <img src={task.assignee?.image} alt="" className="size-8 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                            <span className="min-w-0">
                                <span className="flex items-center gap-1 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:underline">
                                    {task.title} <ChevronRight className="size-3.5 opacity-0 group-hover:opacity-60 transition-opacity" />
                                </span>
                                <span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate">
                                    {task.assignee?.name} · {task.projectName}
                                    {task.submittedAt && ` · waiting ${formatDistanceToNowStrict(new Date(task.submittedAt))}`}
                                </span>
                            </span>
                        </Link>
                        <div className="flex items-center gap-2 sm:shrink-0">
                            <button type="button" onClick={() => setAsking(task)} disabled={busyId === task.id} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-50">
                                <RotateCcw className="size-3.5" /> Changes
                            </button>
                            <button type="button" onClick={() => onApprove(task)} disabled={busyId === task.id} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60">
                                {busyId === task.id ? <Loader2Icon className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />} Approve
                            </button>
                        </div>
                    </li>
                ))}
            </ul>

            {filtered.length > VISIBLE && (
                <button type="button" onClick={() => setShowAll((v) => !v)} className="w-full px-4 py-2.5 text-sm text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-500/10 border-t border-zinc-100 dark:border-zinc-800">
                    {showAll ? "Show less" : `Show all ${filtered.length}`}
                </button>
            )}

            {asking && <RequestChangesDialog task={asking} onSubmit={(note) => requestChanges(asking, note)} onClose={() => setAsking(null)} />}
        </section>
    );
}
