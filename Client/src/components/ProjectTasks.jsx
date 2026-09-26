import { format } from "date-fns";
import toast from "react-hot-toast";
import { useDispatch, useSelector } from "react-redux";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { deleteTask } from "../features/workspaceSlice";
import useOrgRole from "../hooks/useOrgRole";
import useTaskActions from "../hooks/useTaskActions";
import { statusOptionsFor } from "../lib/taskWorkflow";
import { sortByPosition } from "../lib/taskOrder";
import { SortableItem, SortableTaskList } from "./SortableTasks";
import WaitingOnBadge from "./blockers/WaitingOnBadge";
import ChecklistProgress from "./checklist/ChecklistProgress";
import { Bug, CalendarIcon, GitCommit, MessageSquare, Square, Trash, XIcon, Zap } from "lucide-react";

const typeIcons = {
    BUG: { icon: Bug, color: "text-red-600 dark:text-red-400" },
    FEATURE: { icon: Zap, color: "text-blue-600 dark:text-blue-400" },
    TASK: { icon: Square, color: "text-green-600 dark:text-green-400" },
    IMPROVEMENT: { icon: GitCommit, color: "text-purple-600 dark:text-purple-400" },
    OTHER: { icon: MessageSquare, color: "text-amber-600 dark:text-amber-400" },
};

const priorityTexts = {
    LOW: { background: "bg-red-100 dark:bg-red-950", prioritycolor: "text-red-600 dark:text-red-400" },
    MEDIUM: { background: "bg-blue-100 dark:bg-blue-950", prioritycolor: "text-blue-600 dark:text-blue-400" },
    HIGH: { background: "bg-emerald-100 dark:bg-emerald-950", prioritycolor: "text-emerald-600 dark:text-emerald-400" },
    URGENT: { background: "bg-rose-100 dark:bg-rose-950", prioritycolor: "text-rose-600 dark:text-rose-400" },
};

const ProjectTasks = ({ tasks }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [selectedTasks, setSelectedTasks] = useState([]);
    const { isOwner } = useOrgRole();
    const { user } = useUser();
    // People a task is only waiting on can see it but not change it.
    const canEdit = (task) => isOwner || task.creatorId === user?.id || task.assigneeId === user?.id;
    const settings = useSelector((state) => state.workspace.settings);
    const { setStatus, move } = useTaskActions();
    const statusOptions = (task) =>
        statusOptionsFor(task, { isOwner, settings }).map((o) => (
            <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ));

    const [filters, setFilters] = useState({
        status: "",
        type: "",
        priority: "",
        assignee: "",
    });

    const assigneeList = useMemo(
        () => Array.from(new Set(tasks.map((t) => t.assignee?.name).filter(Boolean))),
        [tasks]
    );

    const filteredTasks = useMemo(() => {
        return sortByPosition(tasks).filter((task) => {
            const { status, type, priority, assignee } = filters;
            return (
                (!status || task.status === status) &&
                (!type || task.type === type) &&
                (!priority || task.priority === priority) &&
                (!assignee || task.assignee?.name === assignee)
            );
        });
    }, [filters, tasks]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters((prev) => ({ ...prev, [name]: value }));
    };

    // Optimistic and approval-aware (an employee's "Done" becomes "In Review").
    const handleStatusChange = (taskId, newStatus) => {
        const task = tasks.find((t) => t.id === taskId);
        if (task) setStatus(task, newStatus);
    };

    const filteredIds = filteredTasks.map((t) => t.id);
    const handleMove = (activeId, overId) => move(filteredTasks, activeId, overId);
    const dueLabel = (task) => (task.due_date ? format(new Date(task.due_date), "dd MMMM") : "No due date");

    const handleDelete = async () => {
        try {
            const confirm = window.confirm("Are you sure you want to delete the selected tasks?");
            if (!confirm) return;

            toast.loading("Deleting tasks...");
            await dispatch(deleteTask(selectedTasks)).unwrap();
            setSelectedTasks([]);
            toast.dismissAll();
            toast.success("Tasks deleted successfully");
        } catch (error) {
            toast.dismissAll();
            toast.error(error?.response?.data?.message || error.message);
        }
    };

    return (
        <div>
            {/* Filters */}
            <div className="flex flex-wrap gap-4 mb-4">
                {["status", "type", "priority", "assignee"].map((name) => {
                    const options = {
                        status: [
                            { label: "All Statuses", value: "" },
                            { label: "To Do", value: "TODO" },
                            { label: "In Progress", value: "IN_PROGRESS" },
                            { label: "Blocked", value: "BLOCKED" },
                            { label: "In Review", value: "IN_REVIEW" },
                            { label: "Done", value: "DONE" },
                        ],
                        type: [
                            { label: "All Types", value: "" },
                            { label: "Task", value: "TASK" },
                            { label: "Bug", value: "BUG" },
                            { label: "Feature", value: "FEATURE" },
                            { label: "Improvement", value: "IMPROVEMENT" },
                            { label: "Other", value: "OTHER" },
                        ],
                        priority: [
                            { label: "All Priorities", value: "" },
                            { label: "Low", value: "LOW" },
                            { label: "Medium", value: "MEDIUM" },
                            { label: "High", value: "HIGH" },
                            { label: "Urgent", value: "URGENT" },
                        ],
                        assignee: [
                            { label: "All Assignees", value: "" },
                            ...assigneeList.map((n) => ({ label: n, value: n })),
                        ],
                    };
                    return (
                        <select key={name} name={name} onChange={handleFilterChange} className=" border not-dark:bg-white border-zinc-300 dark:border-zinc-800 outline-none px-3 py-1 rounded text-sm text-zinc-900 dark:text-zinc-200" >
                            {options[name].map((opt, idx) => (
                                <option key={idx} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    );
                })}

                {/* Reset filters */}
                {(filters.status || filters.type || filters.priority || filters.assignee) && (
                    <button type="button" onClick={() => setFilters({ status: "", type: "", priority: "", assignee: "" })} className="px-3 py-1 flex items-center gap-2 rounded bg-gradient-to-br from-purple-400 to-purple-500 text-zinc-100 dark:text-zinc-200 text-sm transition-colors" >
                        <XIcon className="size-3" /> Reset
                    </button>
                )}

                {isOwner && selectedTasks.length > 0 && (
                    <button type="button" onClick={handleDelete} className="px-3 py-1 flex items-center gap-2 rounded bg-gradient-to-br from-indigo-400 to-indigo-500 text-zinc-100 dark:text-zinc-200 text-sm transition-colors" >
                        <Trash className="size-3" /> Delete
                    </button>
                )}
            </div>

            {/* Tasks Table */}
            <div className="overflow-auto rounded-lg lg:border border-zinc-300 dark:border-zinc-800">
                <div className="w-full">
                    {/* Desktop/Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                        <table className="min-w-full text-sm text-left not-dark:bg-white text-zinc-900 dark:text-zinc-300">
                            <thead className="text-xs uppercase dark:bg-zinc-800/70 text-zinc-500 dark:text-zinc-400 ">
                                <tr>
                                    <th className="w-7 pl-1" aria-label="Reorder" />
                                    <th className="pl-1 pr-1">
                                        <input onChange={() => selectedTasks.length > 1 ? setSelectedTasks([]) : setSelectedTasks(tasks.map((t) => t.id))} checked={selectedTasks.length === tasks.length} type="checkbox" className="size-3 accent-zinc-600 dark:accent-zinc-500" />
                                    </th>
                                    <th className="px-4 pl-0 py-3">Title</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Priority</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Assignee</th>
                                    <th className="px-4 py-3">Due Date</th>
                                </tr>
                            </thead>
                            <SortableTaskList ids={filteredIds} onMove={handleMove}>
                            <tbody>
                                {filteredTasks.length > 0 ? (
                                    filteredTasks.map((task) => {
                                        const { icon: Icon, color } = typeIcons[task.type] || {};
                                        const { background, prioritycolor } = priorityTexts[task.priority] || {};

                                        return (
                                            <SortableItem
                                        disabled={!canEdit(task)}
                                                as="tr"
                                                disabled={!canEdit(task)}
                                                id={task.id}
                                                key={task.id}
                                                onClick={() => navigate(`/taskDetails?projectId=${task.projectId}&taskId=${task.id}`)}
                                                className="border-t border-zinc-300 dark:border-zinc-800 group hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                                                draggingClassName="bg-white dark:bg-zinc-800 shadow-lg ring-1 ring-blue-500/40"
                                            >
                                                {(handle) => (<>
                                                <td onClick={e => e.stopPropagation()} className="pl-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">{handle}</td>
                                                <td onClick={e => e.stopPropagation()} className="pl-1 pr-1">
                                                    <input type="checkbox" className="size-3 accent-zinc-600 dark:accent-zinc-500" onChange={() => selectedTasks.includes(task.id) ? setSelectedTasks(selectedTasks.filter((i) => i !== task.id)) : setSelectedTasks((prev) => [...prev, task.id])} checked={selectedTasks.includes(task.id)} />
                                                </td>
                                                <td className="px-4 pl-0 py-2">
                                                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                        <span>{task.title}</span>
                                                        <ChecklistProgress task={task} />
                                                        <WaitingOnBadge task={task} />
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-2">
                                                        {Icon && <Icon className={`size-4 ${color}`} />}
                                                        <span className={`uppercase text-xs ${color}`}>{task.type}</span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <span className={`text-xs px-2 py-1 rounded ${background} ${prioritycolor}`}>
                                                        {task.priority}
                                                    </span>
                                                </td>
                                                <td onClick={e => e.stopPropagation()} className="px-4 py-2">
                                                    <select name="status" disabled={!canEdit(task)} onChange={(e) => handleStatusChange(task.id, e.target.value)} value={task.status} className="disabled:cursor-not-allowed disabled:opacity-70 group-hover:ring ring-zinc-100 dark:ring-zinc-700 outline-none px-2 pr-4 py-1 rounded text-sm text-zinc-900 dark:text-zinc-200 cursor-pointer" >
                                                        {statusOptions(task)}
                                                    </select>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-2">
                                                        <img src={task.assignee?.image} className="size-5 rounded-full" alt="avatar" />
                                                        {task.assignee?.name || "-"}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-2">
                                                    <div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
                                                        <CalendarIcon className="size-4" />
                                                        {dueLabel(task)}
                                                    </div>
                                                </td>
                                                </>)}
                                            </SortableItem>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="8" className="text-center text-zinc-500 dark:text-zinc-400 py-6">
                                            No tasks found for the selected filters.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            </SortableTaskList>
                        </table>
                    </div>

                    {/* Mobile/Card View */}
                    <div className="lg:hidden flex flex-col gap-4">
                        {filteredTasks.length > 0 ? (
                            <SortableTaskList ids={filteredIds} onMove={handleMove}>
                            {filteredTasks.map((task) => {
                                const { icon: Icon, color } = typeIcons[task.type] || {};
                                const { background, prioritycolor } = priorityTexts[task.priority] || {};

                                return (
                                    <SortableItem
                                        key={task.id}
                                        id={task.id}
                                        className="bg-white dark:bg-gradient-to-br dark:from-zinc-800/70 dark:to-zinc-900/50 border border-zinc-300 dark:border-zinc-800 rounded-lg p-4 flex flex-col gap-2"
                                        draggingClassName="shadow-xl ring-1 ring-blue-500/40"
                                    >
                                        {(handle) => (<>
                                        <div className="flex items-center gap-2">
                                            <span className="-ml-2">{handle}</span>
                                            <h3 className="text-zinc-900 dark:text-zinc-200 text-sm font-semibold mr-auto">{task.title}</h3>
                                            <ChecklistProgress task={task} />
                                            <input type="checkbox" className="size-4 accent-zinc-600 dark:accent-zinc-500" onChange={() => selectedTasks.includes(task.id) ? setSelectedTasks(selectedTasks.filter((i) => i !== task.id)) : setSelectedTasks((prev) => [...prev, task.id])} checked={selectedTasks.includes(task.id)} />
                                        </div>

                                        <WaitingOnBadge task={task} className="self-start" />

                                        <div className="text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2">
                                            {Icon && <Icon className={`size-4 ${color}`} />}
                                            <span className={`${color} uppercase`}>{task.type}</span>
                                        </div>

                                        <div>
                                            <span className={`text-xs px-2 py-1 rounded ${background} ${prioritycolor}`}>
                                                {task.priority}
                                            </span>
                                        </div>

                                        <div>
                                            <label className="text-zinc-600 dark:text-zinc-400 text-xs">Status</label>
                                            <select name="status" disabled={!canEdit(task)} onChange={(e) => handleStatusChange(task.id, e.target.value)} value={task.status} className="disabled:cursor-not-allowed disabled:opacity-70 w-full mt-1 bg-zinc-100 dark:bg-zinc-800 ring-1 ring-zinc-300 dark:ring-zinc-700 outline-none px-2 py-1 rounded text-sm text-zinc-900 dark:text-zinc-200" >
                                                {statusOptions(task)}
                                            </select>
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                                            <img src={task.assignee?.image} className="size-5 rounded-full" alt="avatar" />
                                            {task.assignee?.name || "-"}
                                        </div>

                                        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
                                            <CalendarIcon className="size-4" />
                                            {dueLabel(task)}
                                        </div>
                                        </>)}
                                    </SortableItem>
                                );
                            })}
                            </SortableTaskList>
                        ) : (
                            <p className="text-center text-zinc-500 dark:text-zinc-400 py-4">
                                No tasks found for the selected filters.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ProjectTasks;
