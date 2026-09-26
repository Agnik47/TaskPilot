import { useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { CalendarDays, ListChecks } from "lucide-react";
import { updateChecklistItem } from "../../features/workspaceSlice";
import { dueInfo } from "../../lib/dates";

// Open checklist items you own, across every task (including other people's
// tasks). Earliest due first; tick them off right here.
export default function MyChecklistItems({ me }) {
    const dispatch = useDispatch();
    const projects = useSelector((state) => state.workspace.projects);

    const items = useMemo(
        () =>
            projects
                .flatMap((p) =>
                    (p.tasks || []).flatMap((task) =>
                        (task.checklist || []).filter((i) => i.assigneeId === me && !i.done).map((item) => ({ item, task, projectName: p.name }))
                    )
                )
                .sort((a, b) => (a.item.dueDate ? new Date(a.item.dueDate) : Infinity) - (b.item.dueDate ? new Date(b.item.dueDate) : Infinity)),
        [projects, me]
    );

    if (!items.length) return null;

    const tick = async ({ item, task }) => {
        try {
            await dispatch(updateChecklistItem({ taskId: task.id, itemId: item.id, changes: { done: true } })).unwrap();
            toast.success(`Checked off "${item.title.length > 40 ? `${item.title.slice(0, 40)}…` : item.title}"`);
        } catch (error) {
            toast.error(error?.message || "Couldn't update the item");
        }
    };

    return (
        <section className="mb-6 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 overflow-hidden">
            <h2 className="flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-zinc-800 dark:text-zinc-100 border-b border-zinc-100 dark:border-zinc-800">
                <ListChecks className="size-4 text-blue-500" /> Your checklist items
                <span className="text-xs font-normal text-zinc-400 tabular-nums">{items.length}</span>
            </h2>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {items.map((entry) => {
                    const { item, task, projectName } = entry;
                    const due = dueInfo({ due_date: item.dueDate, status: "TODO" });
                    return (
                        <li key={item.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-zinc-50 dark:hover:bg-zinc-900/60">
                            <input
                                type="checkbox"
                                onChange={() => tick(entry)}
                                aria-label={`Mark "${item.title}" done`}
                                className="mt-1 size-4 shrink-0 accent-emerald-600 cursor-pointer"
                            />
                            <div className="min-w-0 flex-1">
                                <p className="text-sm text-zinc-900 dark:text-zinc-100 break-words">{item.title}</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 flex flex-wrap items-center gap-x-1.5">
                                    <span>in</span>
                                    <Link to={`/taskDetails?projectId=${task.projectId}&taskId=${task.id}`} className="font-medium hover:underline truncate max-w-64">
                                        {task.title}
                                    </Link>
                                    <span aria-hidden>·</span>
                                    <span className="truncate max-w-40">{projectName}</span>
                                    {due && (
                                        <>
                                            <span aria-hidden>·</span>
                                            <span className={`inline-flex items-center gap-1 ${due.overdue ? "text-red-600 dark:text-red-400 font-medium" : due.soon ? "text-amber-700 dark:text-amber-300" : ""}`}>
                                                <CalendarDays className="size-3" /> {due.label}
                                            </span>
                                        </>
                                    )}
                                </p>
                            </div>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}
