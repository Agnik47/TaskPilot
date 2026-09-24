import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import api from "../lib/api";

const MAX_ITEMS = 50;

// Where clicking a notification takes you: the task, or the project's task
// list for grouped ones ("assigned you 5 tasks in …").
export const notificationHref = (n) =>
    n.taskId
        ? `/taskDetails?projectId=${n.projectId}&taskId=${n.taskId}`
        : n.projectId ? `/projectsDetail?id=${n.projectId}&tab=tasks` : null;

const initialState = {
    items: [],
    unreadCount: 0,
    loaded: false,
};

export const fetchNotifications = createAsyncThunk("notifications/fetch", async () => {
    const { data } = await api.get("/notifications");
    return data;
});

export const markNotificationRead = createAsyncThunk("notifications/markRead", async (id) => {
    await api.post(`/notifications/${id}/read`);
    return id;
});

export const markAllNotificationsRead = createAsyncThunk("notifications/markAllRead", async () => {
    await api.post("/notifications/read-all");
});

const notificationsSlice = createSlice({
    name: "notifications",
    initialState,
    reducers: {
        // Pushed live over the socket.
        notificationReceived: (state, action) => {
            const n = action.payload;
            if (state.items.some((i) => i.id === n.id)) return;
            state.items.unshift(n);
            state.items.length = Math.min(state.items.length, MAX_ITEMS);
            if (!n.readAt) state.unreadCount += 1;
        },
        resetNotifications: () => initialState,
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchNotifications.fulfilled, (state, action) => {
                state.items = action.payload.items;
                state.unreadCount = action.payload.unreadCount;
                state.loaded = true;
            })
            // Read state updates optimistically; a failure re-syncs from the server.
            .addCase(markNotificationRead.pending, (state, action) => {
                const n = state.items.find((i) => i.id === action.meta.arg);
                if (n && !n.readAt) {
                    n.readAt = new Date().toISOString();
                    state.unreadCount = Math.max(0, state.unreadCount - 1);
                }
            })
            .addCase(markAllNotificationsRead.pending, (state) => {
                const now = new Date().toISOString();
                state.items.forEach((n) => { n.readAt ??= now; });
                state.unreadCount = 0;
            });
    },
});

export const { notificationReceived, resetNotifications } = notificationsSlice.actions;
export default notificationsSlice.reducer;
