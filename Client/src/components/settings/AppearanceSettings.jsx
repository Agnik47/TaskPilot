import { useDispatch, useSelector } from "react-redux";
import { Check, MoonIcon, SunIcon } from "lucide-react";
import { setTheme } from "../../features/themeSlice";
import { SectionHeader, SettingsCard } from "./SettingsUI";

const THEMES = [
    { value: "light", label: "Light", icon: SunIcon, preview: "bg-white border-zinc-200", bar: "bg-zinc-200", line: "bg-zinc-100" },
    { value: "dark", label: "Dark", icon: MoonIcon, preview: "bg-zinc-950 border-zinc-800", bar: "bg-zinc-800", line: "bg-zinc-900" },
];

export default function AppearanceSettings() {
    const { theme } = useSelector((state) => state.theme);
    const dispatch = useDispatch();

    return (
        <div>
            <SectionHeader title="Appearance" description="How the app looks on this device." />

            <SettingsCard title="Theme">
                <div className="grid grid-cols-2 gap-4 max-w-md">
                    {THEMES.map((t) => {
                        const active = theme === t.value;
                        return (
                            <button
                                key={t.value}
                                type="button"
                                onClick={() => dispatch(setTheme(t.value))}
                                aria-pressed={active}
                                className={`text-left rounded-lg border-2 p-2 transition ${active ? "border-blue-500" : "border-transparent hover:border-zinc-300 dark:hover:border-zinc-700"}`}
                            >
                                <div className={`h-20 rounded-md border ${t.preview} p-2 flex gap-2`}>
                                    <div className={`w-1/4 rounded ${t.bar}`} />
                                    <div className="flex-1 space-y-1.5">
                                        <div className={`h-2 w-3/4 rounded ${t.bar}`} />
                                        <div className={`h-2 rounded ${t.line}`} />
                                        <div className={`h-2 w-1/2 rounded ${t.line}`} />
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-2 px-1">
                                    <span className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                                        <t.icon className="size-3.5" /> {t.label}
                                    </span>
                                    {active && <Check className="size-4 text-blue-500" />}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </SettingsCard>
        </div>
    );
}
