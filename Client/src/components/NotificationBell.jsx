import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { AtSign, BellIcon, CheckCheck, UserPlus } from "lucide-react";
import { fetchNotifications, markAllNotificationsRead, markNotificationRead, notificationHref } from "../features/notificationsSlice";

const TYPE_ICON = { TASK_ASSIGNED: UserPlus, MENTION: AtSign };

export default function NotificationBell() {
    const { items, unreadCount, loaded } = useSelector((state) => state.notifications);
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const [open, setOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        const onClick = (e) => !containerRef.current?.contains(e.target) && setOpen(false);
        const onKey = (e) => e.key === "Escape" && setOpen(false);
        document.addEventListener("mousedown", onClick);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onClick);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    // Optimistic in the store; if the server call fails, re-sync from it.
    const resyncOnError = (promise) => promise.unwrap().catch(() => dispatch(fetchNotifications()));

    const openNotification = (n) => {
        if (!n.readAt) resyncOnError(dispatch(markNotificationRead(n.id)));
        setOpen(false);
        if (notificationHref(n)) navigate(notificationHref(n));
    };

    const badge = unreadCount > 99 ? "99+" : unreadCount;

    return (
        <div ref={containerRef} className="relative">
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : "Notifications"}
                aria-expanded={open}
                className="relative size-8 flex items-center justify-center bg-white dark:bg-zinc-800 shadow rounded-lg transition hover:bg-gray-100 dark:hover:bg-zinc-700"
            >
                <BellIcon className="size-4 text-gray-800 dark:text-gray-200" />
                {unreadCount > 0 && (
                    <span key={unreadCount} className="motion-badge absolute -top-1.5 -right-1.5 min-w-4 h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-semibold leading-4 text-center">
                        {badge}
                    </span>
                )}
            </button>

            {open && (
                <div className="motion-pop origin-top-right absolute right-0 top-full mt-2 z-50 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
                        <p className="text-sm font-semibold text-zinc-900 dark:text-white">Notifications</p>
                        {unreadCount > 0 && (
                            <button type="button" onClick={() => resyncOnError(dispatch(markAllNotificationsRead()))} className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline">
                                <CheckCheck className="size-3.5" /> Mark all as read
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {!loaded ? (
                            <p className="px-4 py-8 text-center text-sm text-zinc-500">Loading…</p>
                        ) : items.length === 0 ? (
                            <div className="px-4 py-10 text-center">
                                <BellIcon className="size-6 mx-auto text-zinc-300 dark:text-zinc-600 mb-2" />
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">You're all caught up</p>
                                <p className="text-xs text-zinc-400 mt-1">Task assignments and @mentions show up here.</p>
                            </div>
                        ) : (
                            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                {items.map((n) => {
                                    const Icon = TYPE_ICON[n.type] || BellIcon;
                                    return (
                                        <li key={n.id}>
                                            <button
                                                type="button"
                                                onClick={() => openNotification(n)}
                                                className={`w-full flex gap-3 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/60 transition ${n.readAt ? "" : "bg-blue-50/60 dark:bg-blue-500/5"}`}
                                            >
                                                <span className="relative shrink-0">
                                                    <img src={n.actor?.image} alt="" className="size-8 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                                                    <span className="absolute -bottom-1 -right-1 size-4 rounded-full bg-white dark:bg-zinc-900 flex items-center justify-center">
                                                        <Icon className="size-3 text-blue-500" />
                                                    </span>
                                                </span>
                                                <span className="flex-1 min-w-0">
                                                    <span className={`block text-sm ${n.readAt ? "text-zinc-600 dark:text-zinc-400" : "text-zinc-900 dark:text-zinc-100 font-medium"}`}>{n.message}</span>
                                                    <span className="block text-xs text-zinc-400 mt-0.5">{formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}</span>
                                                </span>
                                                {!n.readAt && <span className="size-2 mt-1.5 shrink-0 rounded-full bg-blue-500" aria-label="Unread" />}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
