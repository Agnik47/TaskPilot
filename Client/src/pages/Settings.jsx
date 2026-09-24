import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Bell, Building2, Palette, SlidersHorizontal, UserCircle, Users } from "lucide-react";
import GeneralSettings from "../components/settings/GeneralSettings";
import MembersSettings from "../components/settings/MembersSettings";
import PreferencesSettings from "../components/settings/PreferencesSettings";
import NotificationSettings from "../components/settings/NotificationSettings";
import AppearanceSettings from "../components/settings/AppearanceSettings";
import AccountSettings from "../components/settings/AccountSettings";
import DangerZoneSettings from "../components/settings/DangerZoneSettings";

const SECTIONS = [
    { group: "Workspace", id: "general", label: "General", icon: Building2, component: GeneralSettings },
    { group: "Workspace", id: "members", label: "Members & Roles", icon: Users, component: MembersSettings },
    { group: "Workspace", id: "preferences", label: "Preferences", icon: SlidersHorizontal, component: PreferencesSettings },
    { group: "Personal", id: "account", label: "My Account", icon: UserCircle, component: AccountSettings },
    { group: "Personal", id: "notifications", label: "Notifications", icon: Bell, component: NotificationSettings },
    { group: "Personal", id: "appearance", label: "Appearance", icon: Palette, component: AppearanceSettings },
    { group: "Other", id: "danger", label: "Danger Zone", icon: AlertTriangle, component: DangerZoneSettings, danger: true },
];

const GROUPS = [...new Set(SECTIONS.map((s) => s.group))];

export default function Settings() {
    const [searchParams, setSearchParams] = useSearchParams();
    const active = SECTIONS.find((s) => s.id === searchParams.get("tab")) || SECTIONS[0];
    const ActiveSection = active.component;

    const selectTab = (id) => setSearchParams({ tab: id }, { replace: true });

    const tabClass = (s) => {
        const isActive = s.id === active.id;
        if (s.danger) {
            return isActive
                ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-400"
                : "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10";
        }
        return isActive
            ? "bg-gray-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
            : "text-zinc-600 dark:text-zinc-400 hover:bg-gray-50 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200";
    };

    return (
        <div className="max-w-6xl mx-auto">
            <div className="mb-6">
                <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-1">Settings</h1>
                <p className="text-gray-500 dark:text-zinc-400 text-sm">Manage your workspace, team, and personal preferences</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
                {/* Mobile / tablet: horizontal scrolling tabs */}
                <nav className="lg:hidden -mx-1 overflow-x-auto no-scrollbar border-b border-zinc-200 dark:border-zinc-800">
                    <div className="flex gap-1 px-1 pb-2 w-max">
                        {SECTIONS.map((s) => (
                            <button key={s.id} type="button" onClick={() => selectTab(s.id)} className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm whitespace-nowrap transition ${tabClass(s)}`}>
                                <s.icon className="size-4" /> {s.label}
                            </button>
                        ))}
                    </div>
                </nav>

                {/* Desktop: grouped vertical nav */}
                <nav className="hidden lg:block w-56 shrink-0">
                    <div className="sticky top-0 space-y-6">
                        {GROUPS.map((group) => (
                            <div key={group}>
                                <p className="px-3 mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400 dark:text-zinc-500">{group}</p>
                                <div className="space-y-0.5">
                                    {SECTIONS.filter((s) => s.group === group).map((s) => (
                                        <button key={s.id} type="button" onClick={() => selectTab(s.id)} aria-current={s.id === active.id ? "page" : undefined} className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition ${tabClass(s)}`}>
                                            <s.icon className="size-4" /> {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </nav>

                <main className="flex-1 min-w-0 max-w-3xl">
                    <div key={active.id} className="motion-rise">
                        <ActiveSection />
                    </div>
                </main>
            </div>
        </div>
    );
}
