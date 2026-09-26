import { useDispatch, useSelector } from "react-redux";
import toast from "react-hot-toast";
import useOrgRole from "./useOrgRole";
import { addBlocker, nudgeBlocker, resolveBlocker, reviewTask, updateTask } from "../features/workspaceSlice";
import { expectedStatus } from "../lib/taskWorkflow";
import { positionForMove } from "../lib/taskOrder";
import { openBlockers, requestBlockerDialog } from "../lib/blockers";

// One place for status changes and review decisions, so the table, sheet and
// task page behave identically: instant (optimistic) UI, the server's own
// message on failure (with rollback), and a clear note when work is sent for
// approval instead of being completed.
export default function useTaskActions() {
    const dispatch = useDispatch();
    const { isOwner } = useOrgRole();
    const settings = useSelector((state) => state.workspace.settings);

    // Choosing "Blocked" asks who/what it's waiting on (the dialog can still
    // just mark it Blocked); pass { ask: false } to skip that. `position`
    // (optional) also places the task, e.g. where it was dropped on the board.
    const setStatus = async (task, status, { ask = true, position } = {}) => {
        if (status === task.status) return position === undefined ? true : savePosition(task.id, position);
        if (status === "BLOCKED" && ask) {
            requestBlockerDialog(task, { fromStatusPicker: true });
            return true;
        }
        const clearing = openBlockers(task);
        const placed = position === undefined || position === null ? {} : { position };
        const optimistic = { status: expectedStatus(task, status, { isOwner, settings }), ...placed };
        try {
            const updated = await dispatch(updateTask({ id: task.id, status, ...placed, optimistic })).unwrap();
            if (updated.status === "IN_REVIEW" && task.status !== "IN_REVIEW") {
                toast.success(`Sent to ${task.creator?.name || "the owner"} for approval`);
            } else if (status !== "BLOCKED" && clearing.length) {
                toast.success(`Unblocked. No longer waiting on ${clearing.map((b) => b.waitingOn?.name).join(", ")}`);
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
        if (list.some((t) => typeof t.position !== "number")) {
            toast.error("Couldn't save the new order. The server may need updating.");
            return;
        }
        const position = positionForMove(list, activeId, overId);
        if (position === null) return;
        await savePosition(activeId, position);
    };

    async function savePosition(id, position) {
        if (position === null) return false;
        try {
            const saved = await dispatch(updateTask({ id, position })).unwrap();
            // A server without reordering support answers 200 but ignores the position.
            if (saved.position !== position) toast.error("Couldn't save the new order. The server may need updating.");
            return true;
        } catch (error) {
            toast.error(error?.message || "Couldn't move the task");
            return false;
        }
    }

    // ---- blockers ("waiting on someone") ----
    // Each resolves to the updated task, or null on failure (already toasted).
    const runBlocker = async (thunk, success, failure) => {
        try {
            const updated = await dispatch(thunk).unwrap();
            if (success) toast.success(success);
            return updated;
        } catch (error) {
            toast.error(error?.message || failure);
            return null;
        }
    };

    const addWaitingOn = (task, person, reason) =>
        runBlocker(addBlocker({ taskId: task.id, waitingOnId: person.id, reason }), `${person.name} has been notified`, "Couldn't add the blocker");

    const resolve = (task, blocker, note) => {
        const lastOne = openBlockers(task).length === 1 && task.status === "BLOCKED";
        return runBlocker(
            resolveBlocker({ taskId: task.id, blockerId: blocker.id, note }),
            lastOne ? "Unblocked. Moved back to In Progress" : "Marked as resolved",
            "Couldn't resolve the blocker"
        );
    };

    const nudge = (task, blocker) =>
        runBlocker(nudgeBlocker({ taskId: task.id, blockerId: blocker.id }), `Reminder sent to ${blocker.waitingOn?.name}`, "Couldn't send the reminder");

    return {
        setStatus,
        move,
        savePosition,
        addWaitingOn,
        resolve,
        nudge,
        approve: (task) => review(task, "approve"),
        requestChanges: (task, note) => review(task, "changes", note),
    };
}
