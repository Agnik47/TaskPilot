import { useEffect, useState } from "react";
import { useUser } from "@clerk/clerk-react";
import { BellRing, Loader2Icon, Volume2 } from "lucide-react";
import { previewSound } from "../../lib/sound";
import toast from "react-hot-toast";
import { errorMessage } from "../../lib/errors";
import { SectionHeader, SettingsCard, Toggle, Badge, primaryButtonClass, secondaryButtonClass } from "./SettingsUI";

// Personal preferences, stored on the Clerk user (unsafeMetadata is the
// user-writable bucket) so they follow the person across workspaces/devices.
const EVENTS = [
    { key: "taskAssigned", label: "Task assigned to me", help: "Someone gives you a new task." },
    { key: "taskReassigned", label: "Task reassigned", help: "A task you own is moved to someone else, or to you." },
    { key: "dueSoon", label: "Due date approaching", help: "A task you own is due within the next day." },
    { key: "overdue", label: "Task overdue", help: "A task you own has passed its due date." },
    { key: "comments", label: "New comments", help: "Someone comments on a task you own or created." },
    { key: "mentions", label: "Mentions", help: "Someone mentions you in a task or comment." },
    { key: "taskCompleted", label: "Task completed", help: "A task you created or assigned is marked done." },
];

const PREF_KEYS = [...EVENTS.map((e) => e.key), "sound", "uiSounds"];
const DEFAULT_PREFS = Object.fromEntries(PREF_KEYS.map((key) => [key, true]));

export default function NotificationSettings() {
    const { user } = useUser();
    const saved = { ...DEFAULT_PREFS, ...(user?.unsafeMetadata?.notificationPrefs || {}) };

    const [prefs, setPrefs] = useState(saved);
    const [saving, setSaving] = useState(false);

    const savedKey = JSON.stringify(saved);
    useEffect(() => {
        setPrefs(JSON.parse(savedKey));
    }, [savedKey]);

    const isDirty = PREF_KEYS.some((key) => prefs[key] !== saved[key]);
    const allOn = EVENTS.every((e) => prefs[e.key]);

    const handleSave = async () => {
        try {
            setSaving(true);
            await user.update({ unsafeMetadata: { ...user.unsafeMetadata, notificationPrefs: prefs } });
            toast.success("Notification preferences saved");
        } catch (error) {
            toast.error(errorMessage(error, "Failed to save preferences"));
        } finally {
            setSaving(false);
        }
    };

    return (
        <div>
            <SectionHeader title="Notifications" description="Choose what's worth your attention. These are personal and don't affect anyone else." />

            <SettingsCard
                title="Activity"
                description="Get a pop-up (and sound) when these happen. Task assignments and @mentions are always kept in the bell inbox, whatever you choose here."
                footer={
                    <>
                        <button type="button" onClick={() => setPrefs({ ...prefs, ...Object.fromEntries(EVENTS.map((e) => [e.key, !allOn])) })} className="text-sm text-blue-600 dark:text-blue-400 hover:underline">
                            {allOn ? "Turn all off" : "Turn all on"}
                        </button>
                        <div className="flex gap-2">
                            <button type="button" disabled={!isDirty || saving} onClick={() => setPrefs(saved)} className={secondaryButtonClass}>Reset</button>
                            <button type="button" disabled={!isDirty || saving} onClick={handleSave} className={primaryButtonClass}>
                                {saving && <Loader2Icon className="size-4 animate-spin" />}
                                Save preferences
                            </button>
                        </div>
                    </>
                }
            >
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {EVENTS.map((e) => (
                        <li key={e.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                            <div>
                                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{e.label}</p>
                                <p className="text-xs text-zinc-500 dark:text-zinc-400">{e.help}</p>
                            </div>
                            <Toggle checked={prefs[e.key]} onChange={(v) => setPrefs({ ...prefs, [e.key]: v })} label={e.label} />
                        </li>
                    ))}
                </ul>
            </SettingsCard>

            <SettingsCard
                title="Sounds"
                footer={
                    <>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">Sounds are quiet by design and follow your device volume.</p>
                        <button type="button" disabled={!isDirty || saving} onClick={handleSave} className={primaryButtonClass}>
                            {saving && <Loader2Icon className="size-4 animate-spin" />}
                            Save preferences
                        </button>
                    </>
                }
            >
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {[
                        { key: "sound", label: "Notification chime", help: "Plays when a task is assigned to you or you're @mentioned.", preview: "notification" },
                        { key: "uiSounds", label: "Interface sounds", help: "Subtle clicks, typing ticks, and confirmation tones across the app.", preview: "success" },
                    ].map((row) => (
                        <li key={row.key} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                            <div className="flex items-center gap-3">
                                <Volume2 className="size-4 text-zinc-500 shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{row.label}</p>
                                    <p className="text-xs text-zinc-500 dark:text-zinc-400">{row.help}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <button type="button" data-sfx="none" onClick={() => previewSound(row.preview)} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">Preview</button>
                                <Toggle checked={prefs[row.key]} onChange={(v) => setPrefs({ ...prefs, [row.key]: v })} label={row.label} />
                            </div>
                        </li>
                    ))}
                </ul>
            </SettingsCard>

            <SettingsCard title="Delivery channels">
                <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    <li className="flex items-center justify-between gap-4 pb-3">
                        <div className="flex items-center gap-3">
                            <BellRing className="size-4 text-zinc-500" />
                            <p className="text-sm text-zinc-900 dark:text-zinc-100">In-app</p>
                        </div>
                        <Badge tone="blue">Always on</Badge>
                    </li>
                    {["Email", "WhatsApp"].map((channel) => (
                        <li key={channel} className="flex items-center justify-between gap-4 py-3 last:pb-0">
                            <p className="text-sm text-zinc-500 dark:text-zinc-400 pl-7">{channel}</p>
                            <Badge tone="amber">Coming soon</Badge>
                        </li>
                    ))}
                </ul>
            </SettingsCard>
        </div>
    );
}
