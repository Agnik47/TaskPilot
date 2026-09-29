import { format } from "date-fns";
import toast from "react-hot-toast";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { CalendarIcon, FlagIcon, FolderIcon, HistoryIcon, MessageCircle, SendHorizontal, UserIcon } from "lucide-react";
import useCurrentWorkspace from "../hooks/useCurrentWorkspace";
import api from "../lib/api";
import useTaskChannel from "../hooks/useTaskChannel";
import MentionInput from "../components/MentionInput";
import { parseMentions, toMentionMarkup } from "../lib/mentions";
import { sfx } from "../lib/sound";
import { useDispatch, useSelector } from "react-redux";
import useOrgRole from "../hooks/useOrgRole";
import useTaskActions from "../hooks/useTaskActions";
import CellSelect from "../components/sheet/CellSelect";
import ReviewBanner from "../components/review/ReviewBanner";
import BlockerPanel from "../components/blockers/BlockerPanel";
import Checklist from "../components/checklist/Checklist";
import { checklistReceived } from "../features/workspaceSlice";
import { STATUS_META, statusOptionsFor } from "../lib/taskWorkflow";

const TaskDetails = () => {

    const [searchParams] = useSearchParams();
    const projectId = searchParams.get("projectId");
    const taskId = searchParams.get("taskId");

    const { user } = useUser();
    const [task, setTask] = useState(null);
    const [project, setProject] = useState(null);
    const [comments, setComments] = useState([]);
    const [activity, setActivity] = useState([]);
    const [newComment, setNewComment] = useState("");
    const [pickedMentions, setPickedMentions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isPosting, setIsPosting] = useState(false);

    const currentWorkspace = useCurrentWorkspace();
    const { isOwner } = useOrgRole();
    const settings = useSelector((state) => state.workspace.settings);
    const members = useSelector((state) => state.workspace.members);
    const { setStatus } = useTaskActions();
    const dispatch = useDispatch();

    const fetchComments = async () => {
        try {
            const { data } = await api.get(`/tasks/${taskId}/comments`);
            setComments(data);
        } catch {
            // task may no longer be visible/exist; leave comments empty
        }
    };

    const fetchActivity = async () => {
        try {
            const { data } = await api.get(`/tasks/${taskId}/activity`);
            setActivity(data);
        } catch {
            setActivity([]);
        }
    };

    useEffect(() => {
        if (!currentWorkspace || !projectId || !taskId) return;

        const proj = currentWorkspace.projects.find((p) => p.id === projectId);
        const tsk = proj?.tasks.find((t) => t.id === taskId);

        setProject(proj || null);
        setTask(tsk || null);
        setLoading(false);
    }, [currentWorkspace, projectId, taskId]);

    // Keyed on the task id, not the task object: the object changes on every
    // unrelated store update, which used to re-fetch comments and activity.
    const hasTask = !!task;
    useEffect(() => {
        if (!taskId || !hasTask) return;
        fetchComments();
        fetchActivity();
    }, [taskId, hasTask]); // eslint-disable-line react-hooks/exhaustive-deps

    const appendComment = (comment) =>
        setComments((prev) => (prev.some((c) => c.id === comment.id) ? prev : [...prev, comment]));

    // Live messages from other people get a soft "received" sound.
    const receiveComment = (comment) => {
        if (comment.userId !== user?.id) sfx("receive");
        appendComment(comment);
    };

    const { connected, viewers, typingUsers, notifyTyping, stopTyping } = useTaskChannel(task ? taskId : null, {
        onComment: receiveComment,
        onActivity: (item) => setActivity((prev) => (prev.some((a) => a.id === item.id) ? prev : [item, ...prev])),
        onChecklist: (checklist) => dispatch(checklistReceived({ taskId, checklist })),
        onReconnect: () => {
            fetchComments();
            fetchActivity();
        },
    });

    // Keep the newest message in view as the conversation grows.
    const messagesEndRef = useRef(null);
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, [comments.length, typingUsers.length]);

    // People who can be @mentioned: those involved in the task, plus the
    // workspace owners, who can always be pulled in (excluding you).
    // Mirrors the server rule in Server/services/mentions.service.js.
    const mentionables = [];
    const involved = [
        [task?.assignee, "Assignee"],
        [task?.creator, "Creator"],
        ...(task?.blockers || []).map((b) => [b.waitingOn, "Waiting on them"]),
        ...(task?.checklist || []).map((item) => [item.assignee, "Checklist"]),
        ...members.filter((m) => m.role === "org:admin").map((m) => [m, "Owner"]),
    ];
    for (const [person, label] of involved) {
        if (!person || person.id === user?.id) continue;
        const existing = mentionables.find((m) => m.id === person.id);
        if (existing) {
            if (!existing.label.split(" · ").includes(label)) existing.label = `${existing.label} · ${label}`;
        }
        else mentionables.push({ id: person.id, name: person.name, image: person.image, label });
    }

    const handleAddComment = async () => {
        const text = newComment.trim();
        if (!text || isPosting) return;
        const content = toMentionMarkup(text, pickedMentions);

        // Show the message immediately; swap in the saved one when the server confirms.
        const tempId = `temp-${Date.now()}`;
        sfx("send");
        setComments((prev) => [...prev, {
            id: tempId,
            content,
            userId: user?.id,
            createdAt: new Date().toISOString(),
            user: { name: user?.fullName, image: user?.imageUrl },
            pending: true,
        }]);
        setNewComment("");
        setPickedMentions([]);
        stopTyping();

        try {
            setIsPosting(true);
            const { data } = await api.post(`/tasks/${taskId}/comments`, { content });
            // The socket broadcast may already have delivered this comment.
            // Keep the temp bubble's React key so it doesn't re-mount (and replay its entrance).
            setComments((prev) => {
                if (prev.some((c) => c.id === data.id)) return prev.filter((c) => c.id !== tempId);
                return prev.map((c) => (c.id === tempId ? { ...data, clientKey: tempId } : c));
            });
            if (!connected) fetchActivity();
        } catch (error) {
            setComments((prev) => prev.filter((c) => c.id !== tempId));
            setNewComment(text);
            setPickedMentions(pickedMentions);
            toast.error(error?.response?.data?.message || error.message || "Failed to send comment");
        } finally {
            setIsPosting(false);
        }
    };

    const otherViewers = viewers.filter((v) => v.id !== user?.id);
    const typingText = typingUsers.length === 1
        ? `${typingUsers[0].name} is typing…`
        : typingUsers.length > 1 ? `${typingUsers.length} people are typing…` : "";

    // Being waited on lets you view and discuss a task, not edit it.
    const canEdit = !!task && (isOwner || task.creatorId === user?.id || task.assigneeId === user?.id);

    if (loading) return <div className="text-sm text-zinc-500 dark:text-zinc-400 px-4 py-6">Loading task details…</div>;
    if (!task) return <div className="text-sm text-red-600 dark:text-red-400 px-4 py-6">Task not found.</div>;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_420px] gap-6 items-start max-w-7xl mx-auto text-zinc-900 dark:text-zinc-100">
            {/* Left: Comments / Chatbox. Sticks in view while the side column scrolls. */}
            <section aria-label="Task discussion" className={`${CARD} order-2 lg:order-1 flex flex-col min-h-[480px] lg:sticky lg:top-0 lg:h-[calc(100vh-7rem)] xl:h-[calc(100vh-9rem)]`}>
                <header className="flex items-center justify-between gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
                    <h2 className="text-sm font-semibold flex items-center gap-2 text-zinc-900 dark:text-white">
                        <MessageCircle className="size-4 text-zinc-500 dark:text-zinc-400" /> Task discussion
                        <span className="min-w-5 h-5 px-1.5 inline-flex items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 text-[11px] font-medium tabular-nums text-zinc-600 dark:text-zinc-300">{comments.length}</span>
                    </h2>
                    <div className="flex items-center gap-3">
                        {otherViewers.length > 0 && (
                            <div className="flex items-center -space-x-2" title={`Also viewing: ${otherViewers.map((v) => v.name).join(", ")}`}>
                                {otherViewers.slice(0, 4).map((v) => (
                                    <img key={v.id} src={v.image} alt={v.name} className="size-6 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-200 dark:bg-zinc-700" />
                                ))}
                                {otherViewers.length > 4 && (
                                    <span className="size-6 rounded-full ring-2 ring-white dark:ring-zinc-900 bg-zinc-200 dark:bg-zinc-700 text-[10px] flex items-center justify-center">+{otherViewers.length - 4}</span>
                                )}
                            </div>
                        )}
                        <span className={`inline-flex items-center gap-1.5 h-6 px-2 rounded-full text-xs font-medium ${connected ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"}`} title={connected ? "New messages appear instantly" : "Reconnecting; messages will sync when back online"}>
                            <span className={`size-1.5 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-400 animate-pulse"}`} />
                            {connected ? "Live" : "Connecting…"}
                        </span>
                    </div>
                </header>

                <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 pt-5">
                    {comments.length > 0 ? (
                        <div className="flex flex-col gap-3 pb-2">
                            {comments.map((comment) => {
                                const isMine = comment.userId === user?.id;
                                return (
                                    <div key={comment.clientKey || comment.id} className={`motion-rise max-w-full sm:max-w-[85%] border px-4 py-3 rounded-xl transition-opacity ${comment.pending ? "opacity-60" : ""} ${isMine ? "ml-auto rounded-br-sm bg-blue-50 border-blue-100 dark:bg-blue-500/10 dark:border-blue-500/20" : "mr-auto rounded-bl-sm bg-zinc-50 border-zinc-200 dark:bg-zinc-800/60 dark:border-zinc-700/70"}`} >
                                        <div className="flex items-center gap-2 mb-1.5 text-sm">
                                            <img src={comment.user?.image} alt="" className="size-5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                                            <span className="font-medium text-zinc-900 dark:text-white truncate">{comment.user?.name}</span>
                                            <span className="text-xs text-zinc-400 dark:text-zinc-500 whitespace-nowrap">
                                                {comment.pending ? "Sending…" : format(new Date(comment.createdAt), "dd MMM yyyy, HH:mm")}
                                            </span>
                                        </div>
                                        <p className="text-sm leading-6 text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">
                                            {parseMentions(comment.content).map((seg, i) =>
                                                seg.type === "mention" ? (
                                                    <span key={i} className={`px-1 rounded font-medium ${seg.userId === user?.id ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" : "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"}`}>
                                                        @{seg.name}
                                                    </span>
                                                ) : (
                                                    <span key={i}>{seg.text}</span>
                                                )
                                            )}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="h-full min-h-40 flex flex-col items-center justify-center text-center gap-2">
                            <span className="size-10 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                <MessageCircle className="size-5 text-zinc-400" />
                            </span>
                            <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">No comments yet</p>
                            <p className="text-xs text-zinc-500 dark:text-zinc-500">Start the conversation. Questions, updates and decisions live here.</p>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Typing indicator (fixed height so the layout doesn't jump) */}
                <p className="h-6 px-5 flex items-center text-xs text-zinc-500 dark:text-zinc-400 italic shrink-0" aria-live="polite">{typingText}</p>

                {/* Add Comment */}
                <div className="px-5 pb-5 shrink-0">
                    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800/60 transition-shadow focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/15">
                        <MentionInput
                            value={newComment}
                            onChange={(text) => {
                                setNewComment(text);
                                if (text) notifyTyping();
                                else stopTyping();
                            }}
                            onSubmit={handleAddComment}
                            onMention={(person) => setPickedMentions((prev) => [...prev, person])}
                            onBlur={stopTyping}
                            mentionables={mentionables}
                            placeholder={mentionables.length
                                ? "Write a comment… Type @ to mention someone"
                                : "Write a comment…"}
                            className="block w-full bg-transparent px-3 pt-2.5 pb-1 text-sm leading-6 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 resize-none focus:outline-none"
                        />
                        <div className="flex items-center justify-between gap-3 px-2 pb-2 pl-3">
                            <span className="hidden sm:block text-[11px] text-zinc-400 dark:text-zinc-500">
                                <kbd className="font-sans">Enter</kbd> to send, <kbd className="font-sans">Shift + Enter</kbd> for a new line
                            </span>
                            <button data-sfx="none" onClick={handleAddComment} disabled={isPosting || !newComment.trim()} className="ml-auto inline-flex items-center gap-1.5 h-8 px-3.5 rounded-md bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 disabled:opacity-40 disabled:hover:bg-blue-600 disabled:cursor-not-allowed" >
                                <SendHorizontal className="size-4" /> Send
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* Right: Task + Project Info */}
            <aside className="order-1 lg:order-2 flex flex-col gap-6 min-w-0">
                {/* Task Info */}
                <div className={`${CARD} p-5`}>
                    <h1 className="text-lg font-semibold leading-snug tracking-tight text-zinc-900 dark:text-white break-words">{task.title}</h1>
                    <div className="flex flex-wrap items-center gap-2 mt-3">
                        {canEdit ? (
                            <CellSelect
                                label="Status"
                                value={task.status}
                                options={statusOptionsFor(task, { isOwner, settings })}
                                onChange={(s) => setStatus(task, s)}
                                menuWidth={230}
                                className="h-7 pl-1 pr-2 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
                                renderValue={() => (
                                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_META[task.status]?.pill}`}>
                                        <span className={`size-1.5 rounded-full ${STATUS_META[task.status]?.dot}`} />
                                        {STATUS_META[task.status]?.label ?? task.status}
                                    </span>
                                )}
                            />
                        ) : (
                            <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium ${STATUS_META[task.status]?.pill}`}>
                                <span className={`size-1.5 rounded-full ${STATUS_META[task.status]?.dot}`} />
                                {STATUS_META[task.status]?.label ?? task.status}
                            </span>
                        )}
                        <span className="inline-flex items-center h-7 px-2.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-300">
                            {titleCase(task.type)}
                        </span>
                        <span className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium ${PRIORITY_TONE[task.priority] || PRIORITY_TONE.LOW}`}>
                            <FlagIcon className="size-3" />
                            {titleCase(task.priority)}
                        </span>
                    </div>

                    <div className="mt-4 empty:hidden">
                        <ReviewBanner task={task} />
                    </div>

                    <div className="mt-4 empty:hidden">
                        <BlockerPanel task={task} me={user?.id} canEdit={canEdit} />
                    </div>

                    {task.description && (
                        <p className="mt-4 text-sm text-zinc-600 dark:text-zinc-400 leading-6 whitespace-pre-wrap break-words">{task.description}</p>
                    )}

                    <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 empty:hidden">
                        <Checklist task={task} me={user?.id} canEdit={canEdit} />
                    </div>

                    <dl className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
                        <div className="min-w-0">
                            <dt className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">Assignee</dt>
                            <dd className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                                {task.assignee?.image
                                    ? <img src={task.assignee.image} className="size-5 rounded-full bg-zinc-200 dark:bg-zinc-700" alt="" />
                                    : <UserIcon className="size-4 text-zinc-400" />}
                                <span className="truncate">{task.assignee?.name || "Unassigned"}</span>
                            </dd>
                        </div>
                        <div className="min-w-0">
                            <dt className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">Due date</dt>
                            <dd className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                                <CalendarIcon className="size-4 text-zinc-400" />
                                {task.due_date ? format(new Date(task.due_date), "dd MMM yyyy") : <span className="text-zinc-400">No due date</span>}
                            </dd>
                        </div>
                        {task.creator && (
                            <div className="col-span-2 min-w-0">
                                <dt className="text-xs text-zinc-500 dark:text-zinc-400 mb-1.5">Created by</dt>
                                <dd className="flex items-center gap-2 text-zinc-800 dark:text-zinc-200">
                                    {task.creator.image && <img src={task.creator.image} className="size-5 rounded-full bg-zinc-200 dark:bg-zinc-700" alt="" />}
                                    <span className="truncate">{task.creator.name}</span>
                                </dd>
                            </div>
                        )}
                    </dl>
                </div>

                {/* Project Info */}
                {project && (
                    <div className={`${CARD} p-5`}>
                        <SectionTitle icon={<FolderIcon />}>Project</SectionTitle>
                        <p className="mt-3 text-base font-medium text-zinc-900 dark:text-white break-words">{project.name}</p>

                        <div className="mt-4">
                            <div className="flex items-center justify-between text-xs mb-1.5">
                                <span className="text-zinc-500 dark:text-zinc-400">Progress</span>
                                <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">{project.progress ?? 0}%</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                                <div className="h-full rounded-full bg-blue-500 transition-all duration-300" style={{ width: `${Math.min(100, Math.max(0, project.progress ?? 0))}%` }} />
                            </div>
                        </div>

                        <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
                            <div className="min-w-0">
                                <dt className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Status</dt>
                                <dd className="text-zinc-800 dark:text-zinc-200 truncate">{titleCase(project.status)}</dd>
                            </div>
                            <div className="min-w-0">
                                <dt className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Priority</dt>
                                <dd className="text-zinc-800 dark:text-zinc-200 truncate">{titleCase(project.priority)}</dd>
                            </div>
                            {project.start_date && (
                                <div className="min-w-0">
                                    <dt className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">Started</dt>
                                    <dd className="text-zinc-800 dark:text-zinc-200 truncate">{format(new Date(project.start_date), "dd MMM yyyy")}</dd>
                                </div>
                            )}
                        </dl>
                    </div>
                )}

                {/* Activity History */}
                <div className={`${CARD} p-5`}>
                    <SectionTitle icon={<HistoryIcon />}>Activity</SectionTitle>
                    {activity.length === 0 ? (
                        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-500">No activity yet.</p>
                    ) : (
                        <ol className="mt-4 max-h-96 overflow-y-auto no-scrollbar">
                            {activity.map((item, i) => (
                                <li key={item.id} className="relative flex gap-3 pb-4 last:pb-0">
                                    {i < activity.length - 1 && <span aria-hidden className="absolute left-[3px] top-3 bottom-0 w-px bg-zinc-200 dark:bg-zinc-800" />}
                                    <span aria-hidden className={`relative mt-1.5 size-[7px] rounded-full shrink-0 ${i === 0 ? "bg-blue-500" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                                    <div className="min-w-0 flex-1 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-x-3 gap-y-0.5">
                                        <p className="text-xs leading-5 text-zinc-700 dark:text-zinc-300 break-words">{item.message}</p>
                                        <time dateTime={item.createdAt} className="text-[11px] leading-5 text-zinc-400 dark:text-zinc-500 whitespace-nowrap tabular-nums shrink-0">{format(new Date(item.createdAt), "dd MMM, HH:mm")}</time>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    )}
                </div>
            </aside>
        </div>
    );
};

const CARD = "rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";

const PRIORITY_TONE = {
    LOW: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    MEDIUM: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
    HIGH: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
    URGENT: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
};

// "IN_PROGRESS" -> "In progress"
const titleCase = (value) => {
    if (!value) return "";
    const text = String(value).replace(/_/g, " ").toLowerCase();
    return text.charAt(0).toUpperCase() + text.slice(1);
};

const SectionTitle = ({ icon, children }) => (
    <h2 className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-white">
        <span className="inline-flex text-zinc-500 dark:text-zinc-400 [&>svg]:size-4">{icon}</span> {children}
    </h2>
);

export default TaskDetails;
