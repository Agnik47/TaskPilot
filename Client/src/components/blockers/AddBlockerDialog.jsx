import { useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useUser } from "@clerk/clerk-react";
import { Check, Hourglass, Loader2Icon, Search } from "lucide-react";
import { fetchMembers } from "../../features/workspaceSlice";
import useTaskActions from "../../hooks/useTaskActions";
import { REASON_SUGGESTIONS, openBlockers } from "../../lib/blockers";
import OpenSound from "../OpenSound";

// "What's blocking this?" Pick the person the task is waiting on (anyone in
// the organization; people on the project are listed first), say what you
// need, and they're notified. Opened from "Add blocker" or by choosing
// Blocked in any status picker (which can also just mark it Blocked).
export default function AddBlockerDialog({ task, fromStatusPicker = false, onClose }) {
    const dispatch = useDispatch();
    const { user } = useUser();
    const { addWaitingOn, setStatus } = useTaskActions();
    const members = useSelector((state) => state.workspace.members);
    const project = useSelector((state) => state.workspace.projects.find((p) => p.id === task.projectId));

    const [query, setQuery] = useState("");
    const [personId, setPersonId] = useState(null);
    const [active, setActive] = useState(0);
    const [reason, setReason] = useState("");
    const [busy, setBusy] = useState(null);
    const listRef = useRef(null);

    useEffect(() => {
        if (!members.length) dispatch(fetchMembers());
    }, [members.length, dispatch]);

    // Everyone in the org except you and people this task already waits on;
    // project members first, then alphabetical.
    const people = useMemo(() => {
        const already = new Set(openBlockers(task).map((b) => b.waitingOnId));
        const onProject = new Set((project?.members || []).map((m) => m.userId || m.user?.id));
        const q = query.trim().toLowerCase();
        return members
            .filter((m) => m.id !== user?.id && !already.has(m.id))
            .filter((m) => !q || m.name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q))
            .map((m) => ({ ...m, onProject: onProject.has(m.id) }))
            .sort((a, b) => Number(b.onProject) - Number(a.onProject) || a.name.localeCompare(b.name));
    }, [members, project, task, user?.id, query]);

    const person = members.find((m) => m.id === personId) || null;
    const canSubmit = person && reason.trim() && !busy;

    useEffect(() => setActive(0), [query]);
    useEffect(() => {
        listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    }, [active]);

    const close = () => !busy && onClose();

    const submit = async (e) => {
        e?.preventDefault();
        if (!canSubmit) return;
        setBusy("add");
        const updated = await addWaitingOn(task, person, reason.trim());
        setBusy(null);
        if (updated) onClose();
    };

    const justBlock = async () => {
        setBusy("block");
        const ok = await setStatus(task, "BLOCKED", { ask: false });
        setBusy(null);
        if (ok) onClose();
    };

    const onSearchKey = (e) => {
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, people.length - 1));
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
        } else if (e.key === "Enter") {
            e.preventDefault();
            if (people[active]) setPersonId(people[active].id);
        }
    };

    const alreadyBlocked = task.status === "BLOCKED";

    return (
        <div
            className="motion-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/20 dark:bg-black/60 backdrop-blur px-4"
            onMouseDown={(e) => e.target === e.currentTarget && close()}
            onKeyDown={(e) => e.key === "Escape" && close()}
        >
            <OpenSound />
            <form onSubmit={submit} className="motion-dialog w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 text-zinc-900 dark:text-zinc-100">
                <div className="flex gap-3">
                    <div className="size-9 shrink-0 rounded-full bg-amber-100 dark:bg-amber-500/15 flex items-center justify-center">
                        <Hourglass className="size-4 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-base font-semibold">{alreadyBlocked ? "Waiting on someone else too?" : "What's blocking this?"}</h2>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 truncate">"{task.title}"</p>
                    </div>
                </div>

                {/* Who */}
                <label htmlFor="blocker-search" className="block text-sm font-medium mt-5 mb-1.5">Who are you waiting on?</label>
                <div className="rounded-md border border-zinc-300 dark:border-zinc-700 focus-within:ring-1 focus-within:ring-blue-500 overflow-hidden">
                    <div className="flex items-center gap-2 px-3 border-b border-zinc-200 dark:border-zinc-800">
                        <Search className="size-4 text-zinc-400 shrink-0" />
                        <input
                            id="blocker-search"
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={onSearchKey}
                            placeholder="Search anyone in your organization"
                            role="combobox"
                            aria-expanded="true"
                            aria-controls="blocker-people"
                            aria-activedescendant={people[active] ? `blocker-person-${people[active].id}` : undefined}
                            className="w-full h-9 bg-transparent text-sm outline-none placeholder-zinc-400"
                        />
                    </div>
                    <ul id="blocker-people" ref={listRef} role="listbox" className="max-h-48 overflow-y-auto py-1">
                        {!members.length ? (
                            <li className="px-3 py-3 text-sm text-zinc-500 flex items-center gap-2"><Loader2Icon className="size-4 animate-spin" /> Loading people…</li>
                        ) : people.length === 0 ? (
                            <li className="px-3 py-3 text-sm text-zinc-500">No one matches "{query}".</li>
                        ) : (
                            people.map((p, i) => {
                                const selected = p.id === personId;
                                return (
                                    <li
                                        key={p.id}
                                        id={`blocker-person-${p.id}`}
                                        data-index={i}
                                        role="option"
                                        aria-selected={selected}
                                        onMouseEnter={() => setActive(i)}
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => setPersonId(p.id)}
                                        className={`flex items-center gap-3 px-3 py-2 cursor-pointer ${selected ? "bg-blue-50 dark:bg-blue-500/15" : i === active ? "bg-zinc-100 dark:bg-zinc-800" : ""}`}
                                    >
                                        <img src={p.image} alt="" className="size-7 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                                        <span className="min-w-0 flex-1">
                                            <span className="block text-sm truncate">{p.name}</span>
                                            <span className="block text-xs text-zinc-500 dark:text-zinc-400 truncate">{p.email}</span>
                                        </span>
                                        {p.onProject && <span className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">On this project</span>}
                                        {selected && <Check className="size-4 text-blue-600 dark:text-blue-400 shrink-0" />}
                                    </li>
                                );
                            })
                        )}
                    </ul>
                </div>

                {/* What */}
                <label htmlFor="blocker-reason" className="block text-sm font-medium mt-5 mb-1.5">What do you need from {person ? person.name.split(" ")[0] : "them"}?</label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                    {REASON_SUGGESTIONS.map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setReason((r) => (r.trim() ? r : `${s}: `))}
                            className="px-2.5 py-1 rounded-full text-xs border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                            {s}
                        </button>
                    ))}
                </div>
                <textarea
                    id="blocker-reason"
                    rows={3}
                    maxLength={500}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && submit(e)}
                    placeholder="e.g. Need admin access to Google Analytics to finish the audit."
                    className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
                />
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1.5">
                    {person
                        ? `${person.name} will be notified and can open this task to see the details and reply.`
                        : "They'll be notified and can open this task to see the details and reply."}
                </p>

                <div className="flex flex-wrap items-center justify-end gap-2 mt-6">
                    {fromStatusPicker && !alreadyBlocked && (
                        <button type="button" onClick={justBlock} disabled={!!busy} className="mr-auto text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 disabled:opacity-50 inline-flex items-center gap-1.5">
                            {busy === "block" && <Loader2Icon className="size-3.5 animate-spin" />}
                            Just mark Blocked
                        </button>
                    )}
                    <button type="button" onClick={close} disabled={!!busy} className="px-4 py-2 rounded-md text-sm border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50">
                        Cancel
                    </button>
                    <button type="submit" disabled={!canSubmit} className="inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-50 disabled:cursor-not-allowed">
                        {busy === "add" && <Loader2Icon className="size-4 animate-spin" />}
                        {alreadyBlocked ? "Add blocker" : "Mark as blocked"}
                    </button>
                </div>
            </form>
        </div>
    );
}
