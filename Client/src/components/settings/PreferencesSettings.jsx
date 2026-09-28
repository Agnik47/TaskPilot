import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Loader2Icon } from "lucide-react";
import toast from "react-hot-toast";
import { errorMessage } from "../../lib/errors";
import useOrgRole from "../../hooks/useOrgRole";
import { updateWorkspaceSettings } from "../../features/workspaceSlice";
import { approvalMode } from "../../lib/taskWorkflow";
import { SectionHeader, SettingsCard, FieldRow, ReadOnlyNotice, inputClass, primaryButtonClass, secondaryButtonClass } from "./SettingsUI";

const PRIORITY_OPTIONS = [
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
    { value: "URGENT", label: "Urgent" },
];

const TYPE_OPTIONS = [
    { value: "TASK", label: "Task" },
    { value: "BUG", label: "Bug" },
    { value: "FEATURE", label: "Feature" },
    { value: "IMPROVEMENT", label: "Improvement" },
    { value: "OTHER", label: "Other" },
];

const APPROVAL_OPTIONS = [
    { value: "all", label: "All assigned tasks", hint: "Every task an owner assigns is reviewed before it's Done." },
    { value: "important", label: "High & Urgent only", hint: "High and Urgent tasks are reviewed. Low and Medium tasks close as soon as they're done." },
    { value: "none", label: "Off", hint: "People close their tasks themselves. Nothing waits for review." },
];

export default function PreferencesSettings() {
    const settings = useSelector((state) => state.workspace.settings);
    const { isOwner } = useOrgRole();
    const dispatch = useDispatch();

    // Older workspaces only have requireApproval; show it as the matching mode.
    const withMode = (s) => ({ ...s, approvalFor: approvalMode(s) });
    const [form, setForm] = useState(() => withMode(settings));
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm(withMode(settings));
    }, [settings]);

    const saved = withMode(settings);
    const isDirty = Object.keys(form).some((key) => saved[key] !== form[key]);

    const handleSave = async (e) => {
        e.preventDefault();
        try {
            setSaving(true);
            await dispatch(updateWorkspaceSettings(form)).unwrap();
            toast.success("Workspace preferences saved");
        } catch (error) {
            toast.error(errorMessage(error, "Failed to save preferences"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <SectionHeader title="Workspace Preferences" description="Defaults that shape how work is created and planned across the whole team." />

            {!isOwner && <ReadOnlyNotice>These defaults are set by your workspace owner.</ReadOnlyNotice>}

            <form onSubmit={handleSave}>
                <SettingsCard
                    title="Task defaults"
                    description="Pre-filled when anyone creates a new task. People can still change them per task."
                >
                    <FieldRow label="Default priority">
                        <select value={form.defaultTaskPriority} onChange={(e) => setForm({ ...form, defaultTaskPriority: e.target.value })} disabled={!isOwner} className={inputClass}>
                            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </FieldRow>
                    <FieldRow label="Default task type">
                        <select value={form.defaultTaskType} onChange={(e) => setForm({ ...form, defaultTaskType: e.target.value })} disabled={!isOwner} className={inputClass}>
                            {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    </FieldRow>
                </SettingsCard>

                <SettingsCard
                    title="Task approval"
                    description="When an owner assigns a task, marking it Done sends it to review instead of closing it. Owners approve it or send it back with notes."
                >
                    <FieldRow
                        label="Require approval for"
                        help="Tasks people create for themselves, and anything an owner completes, never need approval. Anyone can still send a task for review on their own."
                    >
                        <div role="radiogroup" aria-label="Require approval for" className="inline-flex flex-wrap rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden">
                            {APPROVAL_OPTIONS.map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    role="radio"
                                    aria-checked={form.approvalFor === o.value}
                                    disabled={!isOwner}
                                    onClick={() => setForm({ ...form, approvalFor: o.value, requireApproval: o.value !== "none" })}
                                    className={`px-4 py-2 text-sm transition disabled:cursor-not-allowed ${form.approvalFor === o.value ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{APPROVAL_OPTIONS.find((o) => o.value === form.approvalFor)?.hint}</p>
                    </FieldRow>
                </SettingsCard>

                <SettingsCard
                    title="Task view"
                    description="How a project's tasks open for everyone. Each person can still switch views; their choice is remembered on their device."
                >
                    <FieldRow label="Default view" help="Board shows tasks as cards in status columns. Sheet lets people add and assign many tasks in a grid, like Excel.">
                        <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden">
                            {[{ value: "table", label: "Table" }, { value: "board", label: "Board" }, { value: "sheet", label: "Sheet" }].map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    disabled={!isOwner}
                                    onClick={() => setForm({ ...form, defaultTaskView: o.value })}
                                    className={`px-4 py-2 text-sm transition disabled:cursor-not-allowed ${form.defaultTaskView === o.value ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </FieldRow>
                </SettingsCard>

                <SettingsCard
                    title="Calendar"
                    footer={isOwner && (
                        <>
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">Applies to every member of this workspace.</p>
                            <div className="flex gap-2">
                                <button type="button" disabled={!isDirty || saving} onClick={() => setForm(settings)} className={secondaryButtonClass}>Reset</button>
                                <button type="submit" disabled={!isDirty || saving} className={primaryButtonClass}>
                                    {saving && <Loader2Icon className="size-4 animate-spin" />}
                                    Save preferences
                                </button>
                            </div>
                        </>
                    )}
                >
                    <FieldRow label="Week starts on" help="Used by project calendars.">
                        <div className="inline-flex rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden">
                            {[{ value: 0, label: "Sunday" }, { value: 1, label: "Monday" }].map((o) => (
                                <button
                                    key={o.value}
                                    type="button"
                                    disabled={!isOwner}
                                    onClick={() => setForm({ ...form, weekStartsOn: o.value })}
                                    className={`px-4 py-2 text-sm transition disabled:cursor-not-allowed ${form.weekStartsOn === o.value ? "bg-blue-600 text-white" : "bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}
                                >
                                    {o.label}
                                </button>
                            ))}
                        </div>
                    </FieldRow>
                </SettingsCard>
            </form>
        </div>
    );
}
