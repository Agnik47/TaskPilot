import { useEffect, useRef } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import { useOrganization, useUser } from "@clerk/clerk-react";
import toast from "react-hot-toast";
import { useSocket } from "../lib/socketContext";
import { playNotificationSound } from "../lib/sound";
import { fetchProjects } from "../features/workspaceSlice";
import {
    fetchNotifications,
    markNotificationRead,
    notificationHref,
    notificationReceived,
    resetNotifications,
} from "../features/notificationsSlice";

// Which Settings → Notifications switch controls each notification type.
const PREF_FOR_TYPE = {
    TASK_ASSIGNED: "taskAssigned",
    MENTION: "mentions",
    REVIEW_REQUESTED: "taskCompleted",
    TASK_APPROVED: "reviewResults",
    CHANGES_REQUESTED: "reviewResults",
    BLOCKER_ADDED: "blockers",
    BLOCKER_NUDGE: "blockers",
    BLOCKER_RESOLVED: "blockers",
};

// These mean a task changed somewhere else; refresh lists so it shows here.
// (A new blocker also makes the task visible to the person being waited on.)
const REFRESH_TYPES = new Set(["TASK_ASSIGNED", "REVIEW_REQUESTED", "TASK_APPROVED", "CHANGES_REQUESTED", "BLOCKER_ADDED", "BLOCKER_RESOLVED"]);

// App-wide: loads the inbox, receives live notifications, and alerts with a
// toast + chime. Every notification lands in the bell regardless of settings;
// the per-type switches and "Play sound" only control the interruption.
export default function NotificationListener() {
    const socket = useSocket();
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useUser();
    const { organization } = useOrganization();

    // Latest values for the socket handler without resubscribing.
    const latest = useRef({ user, location });
    latest.current = { user, location };

    useEffect(() => {
        dispatch(resetNotifications());
        if (organization) dispatch(fetchNotifications());
    }, [organization?.id, dispatch]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (!socket) return;

        let connectedBefore = socket.connected;
        const onConnect = () => {
            // Catch up on anything that arrived while disconnected.
            if (connectedBefore) dispatch(fetchNotifications());
            connectedBefore = true;
        };

        const onNotification = (n) => {
            dispatch(notificationReceived(n));
            // A newly assigned task isn't in an employee's loaded list yet.
            if (REFRESH_TYPES.has(n.type)) dispatch(fetchProjects({ silent: true }));

            const { user: me, location: loc } = latest.current;
            const prefs = me?.unsafeMetadata?.notificationPrefs || {};
            if (prefs[PREF_FOR_TYPE[n.type]] === false) return;

            // Already looking at this task's discussion: the mention is right there.
            const viewingTask = loc.pathname === "/taskDetails" && new URLSearchParams(loc.search).get("taskId") === n.taskId;
            if (n.type === "MENTION" && viewingTask) {
                dispatch(markNotificationRead(n.id));
                return;
            }

            if (prefs.sound !== false) playNotificationSound();

            toast(
                (t) => (
                    <button
                        type="button"
                        onClick={() => {
                            toast.dismiss(t.id);
                            dispatch(markNotificationRead(n.id));
                            if (notificationHref(n)) navigate(notificationHref(n));
                        }}
                        className="flex items-center gap-3 text-left"
                    >
                        <img src={n.actor?.image} alt="" className="size-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                        <span className="text-sm">
                            {n.message}
                            <span className="block text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">Click to open</span>
                        </span>
                    </button>
                ),
                { id: `notification-${n.id}`, duration: 6000 }
            );
        };

        socket.on("connect", onConnect);
        socket.on("notification:new", onNotification);
        return () => {
            socket.off("connect", onConnect);
            socket.off("notification:new", onNotification);
        };
    }, [socket, dispatch, navigate]);

    return null;
}
