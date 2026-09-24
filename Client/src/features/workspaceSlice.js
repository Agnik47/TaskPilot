import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../lib/api";

// Mirrors the server defaults (Server/controllers/workspace.controller.js) so
// the UI behaves sensibly before settings have loaded.
export const DEFAULT_WORKSPACE_SETTINGS = {
    defaultTaskPriority: "MEDIUM",
    defaultTaskType: "TASK",
    weekStartsOn: 0,
    defaultTaskView: "table", // "table" | "sheet"
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

export const updateTask = createAsyncThunk("workspace/updateTask", async ({ id, ...changes }) => {
    const { data } = await api.put(`/tasks/${id}`, changes);
    return data;
});

export const deleteTask = createAsyncThunk("workspace/deleteTask", async (taskIds) => {
    await Promise.all(taskIds.map((id) => api.delete(`/tasks/${id}`)));
    return taskIds;
});

// Pre-edit copies of tasks with an in-flight updateTask, keyed by request id,
// so an optimistic change can be rolled back if the server rejects it. Kept
// outside the store because it's transient bookkeeping, not app state.
const taskSnapshots = new Map();

const workspaceSlice = createSlice({
    name: "workspace",
    initialState,
    reducers: {
        resetWorkspace: () => initialState,
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
                const { id, ...changes } = action.meta.arg;
                for (const project of state.projects) {
                    const task = project.tasks?.find((t) => t.id === id);
                    if (task) {
                        taskSnapshots.set(action.meta.requestId, { ...task });
                        Object.assign(task, changes);
                        break;
                    }
                }
            })
            .addCase(updateTask.rejected, (state, action) => {
                const snapshot = taskSnapshots.get(action.meta.requestId);
                taskSnapshots.delete(action.meta.requestId);
                if (!snapshot) return;
                for (const project of state.projects) {
                    const index = project.tasks?.findIndex((t) => t.id === snapshot.id) ?? -1;
                    if (index !== -1) {
                        project.tasks[index] = snapshot;
                        break;
                    }
                }
            })
            .addCase(updateTask.fulfilled, (state, action) => {
                taskSnapshots.delete(action.meta.requestId);
                const task = action.payload;
                state.projects = state.projects.map((p) =>
                    p.id === task.projectId
                        ? { ...p, tasks: p.tasks.map((t) => (t.id === task.id ? task : t)) }
                        : p
                );
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

export const { resetWorkspace } = workspaceSlice.actions;
export default workspaceSlice.reducer;
