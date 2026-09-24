import { useCallback, useEffect, useRef, useState } from "react";
import { useSocket } from "../lib/socketContext";

const TYPING_IDLE_MS = 2500; // stop "typing" after this long without keystrokes
const TYPING_STALE_MS = 5000; // drop a remote typer if we stop hearing from them

// Subscribes to one task's realtime room: new comments/activity, who's typing,
// and who's viewing. Handlers are read through a ref so callers can pass
// inline functions without resubscribing on every render.
export default function useTaskChannel(taskId, { onComment, onActivity, onReconnect } = {}) {
    const socket = useSocket();
    const handlers = useRef({ onComment, onActivity, onReconnect });
    handlers.current = { onComment, onActivity, onReconnect };

    const [connected, setConnected] = useState(false);
    const [viewers, setViewers] = useState([]);
    const [typingUsers, setTypingUsers] = useState([]);

    useEffect(() => {
        if (!socket || !taskId) return;

        const staleTimers = new Map();
        let hasJoinedBefore = false;

        const join = () => {
            socket.emit("task:join", { taskId }, (res) => {
                setConnected(!!res?.ok);
                // Anything posted while we were offline won't be replayed, so
                // re-sync from the API after a reconnect.
                if (res?.ok && hasJoinedBefore) handlers.current.onReconnect?.();
                if (res?.ok) hasJoinedBefore = true;
            });
        };

        const onDisconnect = () => setConnected(false);
        const onCommentEvent = (comment) => comment.taskId === taskId && handlers.current.onComment?.(comment);
        const onActivityEvent = (item) => item.taskId === taskId && handlers.current.onActivity?.(item);
        const onPresence = (p) => p.taskId === taskId && setViewers(p.viewers);
        const onTyping = ({ taskId: id, user, isTyping }) => {
            if (id !== taskId) return;
            clearTimeout(staleTimers.get(user.id));
            setTypingUsers((prev) => {
                const others = prev.filter((u) => u.id !== user.id);
                return isTyping ? [...others, user] : others;
            });
            if (isTyping) {
                staleTimers.set(user.id, setTimeout(() => {
                    setTypingUsers((prev) => prev.filter((u) => u.id !== user.id));
                }, TYPING_STALE_MS));
            }
        };

        socket.on("connect", join);
        socket.on("disconnect", onDisconnect);
        socket.on("comment:new", onCommentEvent);
        socket.on("activity:new", onActivityEvent);
        socket.on("presence", onPresence);
        socket.on("typing", onTyping);
        if (socket.connected) join();

        return () => {
            socket.emit("task:leave", { taskId });
            socket.off("connect", join);
            socket.off("disconnect", onDisconnect);
            socket.off("comment:new", onCommentEvent);
            socket.off("activity:new", onActivityEvent);
            socket.off("presence", onPresence);
            socket.off("typing", onTyping);
            staleTimers.forEach(clearTimeout);
            setConnected(false);
            setViewers([]);
            setTypingUsers([]);
        };
    }, [socket, taskId]);

    // Announce typing on the first keystroke, then "stopped" once idle.
    const typingState = useRef({ active: false, timer: null });
    const stopTyping = useCallback(() => {
        const state = typingState.current;
        clearTimeout(state.timer);
        if (state.active) socket?.emit("typing", { taskId, isTyping: false });
        state.active = false;
    }, [socket, taskId]);

    const notifyTyping = useCallback(() => {
        const state = typingState.current;
        if (!state.active) {
            socket?.emit("typing", { taskId, isTyping: true });
            state.active = true;
        }
        clearTimeout(state.timer);
        state.timer = setTimeout(stopTyping, TYPING_IDLE_MS);
    }, [socket, taskId, stopTyping]);

    useEffect(() => stopTyping, [stopTyping]);

    return { connected, viewers, typingUsers, notifyTyping, stopTyping };
}
