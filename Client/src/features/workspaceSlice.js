import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../lib/api";

// Mirrors the server defaults (Server/controllers/workspace.controller.js) so
// the UI behaves sensibly before settings have loaded.
export const DEFAULT_WORKSPACE_SETTINGS = {
    defaultTaskPriority: "MEDIUM",
    defaultTaskType: "TASK",
    weekStartsOn: 0,
    defaultTaskView: "table", // "table" | "board" | "sheet"
    requireApproval: true, // legacy switch, read only when approvalFor is unset
    approvalFor: "all", // which assigned tasks need an owner's approval: "all" | "important" | "none"
};

const initialState = {
    projects: [],
    members: [],
    settings: DEFAULT_WORKSPACE_SETTINGS,
    loading: false,
    error: null,
};

export const fetchProjects = createAsyncThunk("workspace/fetchProjects", async () => {
    const { data } = await api.get("/projects");
    return data;
});

export const fetchMembers = createAsyncThunk("workspace/fetchMembers", async () => {
    const { data } = await api.get("/members");
    return data;
});

export const fetchWorkspaceSettings = createAsyncThunk("workspace/fetchSettings", async () => {
    const { data } = await api.get("/workspace/settings");
    return data;
});

export const updateWorkspaceSettings = createAsyncThunk("workspace/updateSettings", async (changes) => {
    const { data } = await api.put("/workspace/settings", changes);
    return data;
});

export const createProject = createAsyncThunk("workspace/createProject", async (payload) => {
    const { data } = await api.post("/projects", payload);
    return data;
});

export const updateProject = createAsyncThunk("workspace/updateProject", async ({ id, ...changes }) => {
    const { data } = await api.put(`/projects/${id}`, changes);
    return data;
});

export const deleteProject = createAsyncThunk("workspace/deleteProject", async (id) => {
    await api.delete(`/projects/${id}`);
    return id;
});

export const addProjectMember = createAsyncThunk("workspace/addProjectMember", async ({ projectId, userId }) => {
    const { data } = await api.post(`/projects/${projectId}/members`, { userId });
    return { projectId, member: data };
});

export const createTask = createAsyncThunk("workspace/createTask", async ({ projectId, ...payload }) => {
    const { data } = await api.post("/tasks", { ...payload, projectId });
    return data;
});

// Creates many tasks in one project in a single request (spreadsheet entry).
export const bulkCreateTasks = createAsyncThunk("workspace/bulkCreateTasks", async ({ projectId, tasks }) => {
    const { data } = await api.post("/tasks/bulk", { projectId, tasks });
    return data;
});

// Keeps the server's explanation (e.g. "only an owner can reopen it") instead
// of Redux's generic "Request failed with status code 400".
const serverError = (err, rejectWithValue) =>
    rejectWithValue({ message: err?.response?.data?.message || err?.message || "Something went wrong" });

// `optimistic` (optional) overrides what the UI shows while saving — e.g. an
// employee's "Done" appears as "In Review" straight away. It isn't sent.
export const updateTask = createAsyncThunk("workspace/updateTask", async (arg, { rejectWithValue }) => {
    const changes = { ...arg };
    delete changes.id;
    delete changes.optimistic;
    try {
        const { data } = await api.put(`/tasks/${arg.id}`, changes);
        return data;
    } catch (err) {
        return serverError(err, rejectWithValue);
    }
});

// Owner decision on a task in review: decision "approve" | "changes", optional note.
export const reviewTask = createAsyncThunk("workspace/reviewTask", async ({ id, decision, note }, { rejectWithValue }) => {
    try {
        const { data } = await api.post(`/tasks/${id}/review`, { decision, note });
        return data;
    } catch (err) {
        return serverError(err, rejectWithValue);
    }
});

// Blockers ("waiting on someone"). Each returns the updated task.
export const addBlocker = createAsyncThunk("workspace/addBlocker", async ({ taskId, waitingOnId, reason }, { rejectWithValue }) => {
    try {
        const { data } = await api.post(`/tasks/${taskId}/blockers`, { waitingOnId, reason });
        return data;
    } catch (err) {
        return serverError(err, rejectWithValue);
    }
});

export const resolveBlocker = createAsyncThunk("workspace/resolveBlocker", async ({ taskId, blockerId, note }, { rejectWithValue }) => {
    try {
        const { data } = await api.post(`/tasks/${taskId}/blockers/${blockerId}/resolve`, { note });
        return data;
    } catch (err) {
        return serverError(err, rejectWithValue);
    }
});

export const nudgeBlocker = createAsyncThunk("workspace/nudgeBlocker", async ({ taskId, blockerId }, { rejectWithValue }) => {
    try {
        const { data } = await api.post(`/tasks/${taskId}/blockers/${blockerId}/nudge`);
        return data;
    } catch (err) {
        return serverError(err, rejectWithValue);
    }
});

// Checklist items (subtasks). Each returns the updated task.
export const addChecklistItems = createAsyncThunk("workspace/addChecklistItems", async ({ taskId, ...body }, { rejectWithValue }) => {
    try {
        const { data } = await api.post(`/tasks/${taskId}/checklist`, body);
        return data;
    } catch (err) {
        return serverError(err, rejectWithValue);
    }
});

// Optimistic: the change shows immediately and is rolled back on failure.
export const updateChecklistItem = createAsyncThunk("workspace/updateChecklistItem", async ({ taskId, itemId, changes }, { rejectWithValue }) => {
    try {
        const { data } = await api.patch(`/tasks/${taskId}/checklist/${itemId}`, changes);
        return data;
    } catch (err) {
        return serverError(err, rejectWithValue);
    }
});

export const deleteChecklistItem = createAsyncThunk("workspace/deleteChecklistItem", async ({ taskId, itemId }, { rejectWithValue }) => {
    try {
        const { data } = await api.delete(`/tasks/${taskId}/checklist/${itemId}`);
        return data;
    } catch (err) {
        return serverError(err, rejectWithValue);
    }
});

export const deleteTask = createAsyncThunk("workspace/deleteTask", async (taskIds) => {
    await Promise.all(taskIds.map((id) => api.delete(`/tasks/${id}`)));
    return taskIds;
});

// Pre-edit copies of tasks with an in-flight updateTask, keyed by request id,
// so an optimistic change can be rolled back if the server rejects it. Kept
// outside the store because it's transient bookkeeping, not app state.
const taskSnapshots = new Map();

function applyOptimistic(state, requestId, taskId, changes) {
    for (const project of state.projects) {
        const task = project.tasks?.find((t) => t.id === taskId);
        if (task) {
            taskSnapshots.set(requestId, { ...task });
            Object.assign(task, changes);
            return;
        }
    }
}

function rollback(state, requestId) {
    const snapshot = taskSnapshots.get(requestId);
    taskSnapshots.delete(requestId);
    if (!snapshot) return;
    for (const project of state.projects) {
        const index = project.tasks?.findIndex((t) => t.id === snapshot.id) ?? -1;
        if (index !== -1) {
            project.tasks[index] = snapshot;
            return;
        }
    }
}

function findTask(state, taskId) {
    for (const project of state.projects) {
        const task = project.tasks?.find((t) => t.id === taskId);
        if (task) return task;
    }
    return null;
}

// Pre-change checklists for optimistic item edits, keyed by request id.
const checklistSnapshots = new Map();

function editChecklistOptimistically(state, action, edit) {
    const task = findTask(state, action.meta.arg.taskId);
    if (!task?.checklist) return;
    checklistSnapshots.set(action.meta.requestId, task.checklist.map((i) => ({ ...i })));
    task.checklist = edit(task.checklist);
}

function rollbackChecklist(state, action) {
    const snapshot = checklistSnapshots.get(action.meta.requestId);
    checklistSnapshots.delete(action.meta.requestId);
    const task = findTask(state, action.meta.arg.taskId);
    if (task && snapshot) task.checklist = snapshot;
}

function replaceTask(state, task) {
    state.projects = state.projects.map((p) =>
        p.id === task.projectId ? { ...p, tasks: p.tasks.map((t) => (t.id === task.id ? task : t)) } : p
    );
}

const workspaceSlice = createSlice({
    name: "workspace",
    initialState,
    reducers: {
        resetWorkspace: () => initialState,
        // Live update from someone else viewing the same task.
        checklistReceived: (state, action) => {
            const task = findTask(state, action.payload.taskId);
            if (task) task.checklist = action.payload.checklist;
        },
    },
    extraReducers: (builder) => {
        builder
            // `dispatch(fetchProjects({ silent: true }))` refreshes in the
            // background without swapping the page for a loading spinner.
            .addCase(fetchProjects.pending, (state, action) => {
                if (!action.meta.arg?.silent) state.loading = true;
                state.error = null;
            })
            .addCase(fetchProjects.fulfilled, (state, action) => {
                state.loading = false;
                state.projects = action.payload;
            })
            .addCase(fetchProjects.rejected, (state, action) => {
                state.loading = false;
                state.error = action.error.message;
            })
            .addCase(fetchMembers.fulfilled, (state, action) => {
                state.members = action.payload;
            })
            .addCase(fetchWorkspaceSettings.fulfilled, (state, action) => {
                state.settings = { ...DEFAULT_WORKSPACE_SETTINGS, ...action.payload };
            })
            .addCase(updateWorkspaceSettings.fulfilled, (state, action) => {
                state.settings = { ...DEFAULT_WORKSPACE_SETTINGS, ...action.payload };
            })
            .addCase(createProject.fulfilled, (state, action) => {
                state.projects.unshift(action.payload);
            })
            .addCase(updateProject.fulfilled, (state, action) => {
                state.projects = state.projects.map((p) => (p.id === action.payload.id ? action.payload : p));
            })
            .addCase(deleteProject.fulfilled, (state, action) => {
                state.projects = state.projects.filter((p) => p.id !== action.payload);
            })
            .addCase(addProjectMember.fulfilled, (state, action) => {
                const { projectId, member } = action.payload;
                state.projects = state.projects.map((p) =>
                    p.id === projectId ? { ...p, members: [...(p.members || []), member] } : p
                );
            })
            .addCase(createTask.fulfilled, (state, action) => {
                const task = action.payload;
                state.projects = state.projects.map((p) =>
                    p.id === task.projectId ? { ...p, tasks: [...(p.tasks || []), task] } : p
                );
            })
            .addCase(bulkCreateTasks.fulfilled, (state, action) => {
                const { projectId } = action.meta.arg;
                state.projects = state.projects.map((p) =>
                    p.id === projectId ? { ...p, tasks: [...(p.tasks || []), ...action.payload] } : p
                );
            })
            // Optimistic: apply the edit immediately so status changes feel
            // instant; the server response (or a rollback) settles it.
            .addCase(updateTask.pending, (state, action) => {
                const { id, optimistic, ...changes } = action.meta.arg;
                applyOptimistic(state, action.meta.requestId, id, { ...changes, ...optimistic });
            })
            .addCase(reviewTask.pending, (state, action) => {
                const { id, decision } = action.meta.arg;
                applyOptimistic(state, action.meta.requestId, id, { status: decision === "approve" ? "DONE" : "IN_PROGRESS" });
            })
            .addCase(reviewTask.rejected, (state, action) => rollback(state, action.meta.requestId))
            .addCase(reviewTask.fulfilled, (state, action) => {
                taskSnapshots.delete(action.meta.requestId);
                replaceTask(state, action.payload);
            })
            .addCase(updateTask.rejected, (state, action) => rollback(state, action.meta.requestId))
            .addCase(updateTask.fulfilled, (state, action) => {
                taskSnapshots.delete(action.meta.requestId);
                replaceTask(state, action.payload);
            })
            .addCase(addBlocker.fulfilled, (state, action) => replaceTask(state, action.payload))
            .addCase(resolveBlocker.fulfilled, (state, action) => replaceTask(state, action.payload))
            .addCase(nudgeBlocker.fulfilled, (state, action) => replaceTask(state, action.payload))
            .addCase(addChecklistItems.fulfilled, (state, action) => replaceTask(state, action.payload))
            .addCase(updateChecklistItem.pending, (state, action) => {
                const { itemId, changes } = action.meta.arg;
                editChecklistOptimistically(state, action, (list) => list.map((i) => (i.id === itemId ? { ...i, ...changes } : i)));
            })
            .addCase(updateChecklistItem.rejected, rollbackChecklist)
            .addCase(updateChecklistItem.fulfilled, (state, action) => {
                checklistSnapshots.delete(action.meta.requestId);
                replaceTask(state, action.payload);
            })
            .addCase(deleteChecklistItem.pending, (state, action) => {
                editChecklistOptimistically(state, action, (list) => list.filter((i) => i.id !== action.meta.arg.itemId));
            })
            .addCase(deleteChecklistItem.rejected, rollbackChecklist)
            .addCase(deleteChecklistItem.fulfilled, (state, action) => {
                checklistSnapshots.delete(action.meta.requestId);
                replaceTask(state, action.payload);
            })
            .addCase(deleteTask.fulfilled, (state, action) => {
                const ids = action.payload;
                state.projects = state.projects.map((p) => ({
                    ...p,
                    tasks: p.tasks.filter((t) => !ids.includes(t.id)),
                }));
            });
    },
});

export const { resetWorkspace, checklistReceived } = workspaceSlice.actions;
export default workspaceSlice.reducer;
