import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import useOrgRole from "./useOrgRole";
import { reviewTask, updateTask } from "../features/workspaceSlice";
import { expectedStatus } from "../lib/taskWorkflow";
import { positionForMove } from "../lib/taskOrder";

// One place for status changes and review decisions, so the table, sheet and
// task page behave identically: instant (optimistic) UI, the server's own
// message on failure (with rollback), and a clear note when work is sent for
// approval instead of being completed.
export default function useTaskActions() {
    const dispatch = useDispatch();
    const { isOwner } = useOrgRole();
    const settings = useSelector((state) => state.workspace.settings);

    const setStatus = async (task, status) => {
        if (status === task.status) return true;
        const optimistic = { status: expectedStatus(task, status, { isOwner, settings }) };
        try {
            const updated = await dispatch(updateTask({ id: task.id, status, optimistic })).unwrap();
            if (updated.status === "IN_REVIEW" && task.status !== "IN_REVIEW") {
                toast.success(`Sent to ${task.creator?.name || "the owner"} for approval`);
            }
            return true;
        } catch (error) {
            toast.error(error?.message || "Couldn't update the status");
            return false;
        }
    };

    const review = async (task, decision, note) => {
        try {
            await dispatch(reviewTask({ id: task.id, decision, note })).unwrap();
            toast.success(decision === "approve" ? `Approved "${task.title}"` : `Sent back to ${task.assignee?.name || "the assignee"} with your notes`);
            return true;
        } catch (error) {
            toast.error(error?.message || "Couldn't save the review");
            return false;
        }
    };

    // Drag-to-reorder: `list` is the order on screen. Optimistic, rolls back on failure.
    const move = async (list, activeId, overId) => {
        const position = positionForMove(list, activeId, overId);
        if (position === null) return;
        try {
            await dispatch(updateTask({ id: activeId, position })).unwrap();
        } catch (error) {
            toast.error(error?.message || "Couldn't move the task");
        }
    };

    return { setStatus, move, approve: (task) => review(task, "approve"), requestChanges: (task, note) => review(task, "changes", note) };
}
