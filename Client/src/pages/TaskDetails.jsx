import { format } from "date-fns";
import toast from "react-hot-toast";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useUser } from "@clerk/clerk-react";
import { CalendarIcon, MessageCircle, PenIcon, HistoryIcon, SendHorizontal } from "lucide-react";
import useCurrentWorkspace from "../hooks/useCurrentWorkspace";
import api from "../lib/api";
import useTaskChannel from "../hooks/useTaskChannel";
import MentionInput from "../components/MentionInput";
import { parseMentions, toMentionMarkup } from "../lib/mentions";
import { sfx } from "../lib/sound";
import { useSelector } from "react-redux";
import useOrgRole from "../hooks/useOrgRole";
import useTaskActions from "../hooks/useTaskActions";
import CellSelect from "../components/sheet/CellSelect";
import ReviewBanner from "../components/review/ReviewBanner";
import BlockerPanel from "../components/blockers/BlockerPanel";
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
    const { setStatus } = useTaskActions();

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

    // People who can be @mentioned: those involved in the task (excluding you).
    // Mirrors the server rule in Server/services/mentions.service.js.
    const mentionables = [];
    const involved = [
        [task?.assignee, "Assignee"],
        [task?.creator, "Creator"],
        ...(task?.blockers || []).map((b) => [b.waitingOn, "Waiting on them"]),
    ];
    for (const [person, label] of involved) {
        if (!person || person.id === user?.id) continue;
        const existing = mentionables.find((m) => m.id === person.id);
        if (existing) existing.label = `${existing.label} · ${label}`;
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

    if (loading) return <div className="text-gray-500 dark:text-zinc-400 px-4 py-6">Loading task details...</div>;
    if (!task) return <div className="text-red-500 px-4 py-6">Task not found.</div>;

    return (
        <div className="flex flex-col-reverse lg:flex-row gap-6 sm:p-4 text-gray-900 dark:text-zinc-100 max-w-6xl mx-auto">
            {/* Left: Comments / Chatbox */}
            <div className="w-full lg:w-2/3">
                <div className="p-5 rounded-md  border border-gray-300 dark:border-zinc-800  flex flex-col lg:h-[80vh]">
                    <div className="flex items-center justify-between gap-3 mb-4">
                        <h2 className="text-base font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                            <MessageCircle className="size-5" /> Task Discussion ({comments.length})
                        </h2>
                        <div className="flex items-center gap-3">
                            {otherViewers.length > 0 && (
                                <div className="flex items-center -space-x-2" title={`Also viewing: ${otherViewers.map((v) => v.name).join(", ")}`}>
                                    {otherViewers.slice(0, 4).map((v) => (
                                        <img key={v.id} src={v.image} alt={v.name} className="size-6 rounded-full ring-2 ring-white dark:ring-zinc-950 bg-zinc-200 dark:bg-zinc-700" />
                                    ))}
                                    {otherViewers.length > 4 && (
                                        <span className="size-6 rounded-full ring-2 ring-white dark:ring-zinc-950 bg-zinc-200 dark:bg-zinc-700 text-[10px] flex items-center justify-center">+{otherViewers.length - 4}</span>
                                    )}
                                </div>
                            )}
                            <span className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400" title={connected ? "New messages appear instantly" : "Reconnecting; messages will sync when back online"}>
                                <span className={`size-2 rounded-full ${connected ? "bg-emerald-500" : "bg-zinc-400 animate-pulse"}`} />
                                {connected ? "Live" : "Connecting…"}
                            </span>
                        </div>
                    </div>

                    <div className="flex-1 md:overflow-y-scroll no-scrollbar">
                        {comments.length > 0 ? (
                            <div className="flex flex-col gap-4 mb-6 mr-2">
                                {comments.map((comment) => {
                                    const isMine = comment.userId === user?.id;
                                    return (
                                        <div key={comment.clientKey || comment.id} className={`motion-rise sm:max-w-4/5 border p-3 rounded-md transition-opacity ${comment.pending ? "opacity-60" : ""} ${isMine ? "ml-auto bg-blue-50 border-blue-200 dark:bg-blue-500/10 dark:border-blue-900/60" : "mr-auto border-gray-300 dark:border-zinc-700 dark:bg-gradient-to-br dark:from-zinc-800 dark:to-zinc-900"}`} >
                                            <div className="flex items-center gap-2 mb-1 text-sm text-gray-500 dark:text-zinc-400">
                                                <img src={comment.user?.image} alt="avatar" className="size-5 rounded-full" />
                                                <span className="font-medium text-gray-900 dark:text-white">{comment.user?.name}</span>
                                                <span className="text-xs text-gray-400 dark:text-zinc-600">
                                                    • {comment.pending ? "Sending…" : format(new Date(comment.createdAt), "dd MMM yyyy, HH:mm")}
                                                </span>
                                            </div>
                                            <p className="text-sm text-gray-900 dark:text-zinc-200 whitespace-pre-wrap break-words">
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
                            <p className="text-gray-600 dark:text-zinc-500 mb-4 text-sm">No comments yet. Be the first!</p>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Typing indicator (fixed height so the layout doesn't jump) */}
                    <p className="h-5 text-xs text-gray-500 dark:text-zinc-400 italic" aria-live="polite">{typingText}</p>

                    {/* Add Comment */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
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
                                ? "Write a comment… Type @ to mention someone (Enter to send, Shift+Enter for a new line)"
                                : "Write a comment… (Enter to send, Shift+Enter for a new line)"}
                            className="w-full dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-md p-2 text-sm text-gray-900 dark:text-zinc-200 resize-none focus:outline-none focus:ring-1 focus:ring-blue-600"
                        />
                        <button data-sfx="none" onClick={handleAddComment} disabled={isPosting || !newComment.trim()} className="flex items-center gap-2 bg-gradient-to-l from-blue-500 to-blue-600 transition-colors text-white text-sm px-5 py-2 rounded disabled:opacity-50" >
                            <SendHorizontal className="size-4" /> Send
                        </button>
                    </div>
                </div>
            </div>

            {/* Right: Task + Project Info */}
            <div className="w-full lg:w-1/2 flex flex-col gap-6">
                {/* Task Info */}
                <div className="p-5 rounded-md bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-800 ">
                    <div className="mb-3">
                        <h1 className="text-lg font-medium text-gray-900 dark:text-zinc-100">{task.title}</h1>
                        <div className="flex flex-wrap gap-2 mt-2">
                            {canEdit ? (
                                <CellSelect
                                    label="Status"
                                    value={task.status}
                                    options={statusOptionsFor(task, { isOwner, settings })}
                                    onChange={(s) => setStatus(task, s)}
                                    menuWidth={230}
                                    className="h-7 pl-1 pr-2 rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                                    renderValue={() => (
                                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_META[task.status]?.pill}`}>
                                            <span className={`size-1.5 rounded-full ${STATUS_META[task.status]?.dot}`} />
                                            {STATUS_META[task.status]?.label ?? task.status}
                                        </span>
                                    )}
                                />
                            ) : (
                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_META[task.status]?.pill}`}>
                                    {STATUS_META[task.status]?.label ?? task.status}
                                </span>
                            )}
                            <span className="px-2 py-0.5 rounded bg-blue-200 dark:bg-blue-900 text-blue-900 dark:text-blue-300 text-xs">
                                {task.type}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-green-200 dark:bg-emerald-900 text-green-900 dark:text-emerald-300 text-xs">
                                {task.priority}
                            </span>
                        </div>
                    </div>

                    <div className="mb-3 empty:hidden">
                        <ReviewBanner task={task} />
                    </div>

                    <div className="mb-3 empty:hidden">
                        <BlockerPanel task={task} me={user?.id} canEdit={canEdit} />
                    </div>

                    {task.description && (
                        <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed mb-4">{task.description}</p>
                    )}

                    <hr className="border-zinc-200 dark:border-zinc-700 my-3" />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm text-gray-700 dark:text-zinc-300">
                        <div className="flex items-center gap-2">
                            <img src={task.assignee?.image} className="size-5 rounded-full" alt="avatar" />
                            {task.assignee?.name || "Unassigned"}
                        </div>
                        <div className="flex items-center gap-2">
                            <CalendarIcon className="size-4 text-gray-500 dark:text-zinc-500" />
                            Due : {task.due_date ? format(new Date(task.due_date), "dd MMM yyyy") : "No due date"}
                        </div>
                        {task.creator && (
                            <div className="flex items-center gap-2 col-span-2 text-xs text-gray-500 dark:text-zinc-500">
                                Created by {task.creator.name}
                            </div>
                        )}
                    </div>
                </div>

                {/* Project Info */}
                {project && (
                    <div className="p-4 rounded-md bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-gray-300 dark:border-zinc-800 ">
                        <p className="text-xl font-medium mb-4">Project Details</p>
                        <h2 className="text-gray-900 dark:text-zinc-100 flex items-center gap-2"> <PenIcon className="size-4" /> {project.name}</h2>
                        {project.start_date && (
                            <p className="text-xs mt-3">Project Start Date: {format(new Date(project.start_date), "dd MMM yyyy")}</p>
                        )}
                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-zinc-400 mt-3">
                            <span>Status: {project.status}</span>
                            <span>Priority: {project.priority}</span>
                            <span>Progress: {project.progress}%</span>
                        </div>
                    </div>
                )}

                {/* Activity History */}
                <div className="p-4 rounded-md bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-gray-300 dark:border-zinc-800 ">
                    <p className="text-base font-medium mb-3 flex items-center gap-2">
                        <HistoryIcon className="size-4" /> Activity
                    </p>
                    {activity.length === 0 ? (
                        <p className="text-sm text-gray-500 dark:text-zinc-500">No activity yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {activity.map((item) => (
                                <div key={item.id} className="text-xs text-gray-600 dark:text-zinc-400 flex items-center justify-between">
                                    <span>{item.message}</span>
                                    <span className="text-gray-400 dark:text-zinc-600">{format(new Date(item.createdAt), "dd MMM, HH:mm")}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaskDetails;
