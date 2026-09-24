import { useState } from "react";
import { AlertTriangle, Loader2Icon } from "lucide-react";
import OpenSound from "../OpenSound";

// Small presentational primitives shared by every settings section so the
// page reads as one consistent surface.

export const inputClass =
    "w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-200 text-sm px-3 py-2 placeholder-zinc-400 dark:placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition";

export const primaryButtonClass =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm bg-gradient-to-br from-blue-500 to-blue-600 text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition";

export const secondaryButtonClass =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm border border-zinc-300 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition";

export const dangerButtonClass =
    "inline-flex items-center justify-center gap-2 px-4 py-2 rounded-md text-sm bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition";

export function SectionHeader({ title, description }) {
    return (
        <div className="mb-6">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-white">{title}</h2>
            {description && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>}
        </div>
    );
}

export function SettingsCard({ title, description, children, footer, tone = "default" }) {
    const border = tone === "danger" ? "border-red-300 dark:border-red-900/60" : "border-zinc-200 dark:border-zinc-800";

    return (
        <div className={`rounded-lg border ${border} bg-white dark:bg-zinc-900 dark:bg-gradient-to-br dark:from-zinc-800/40 dark:to-zinc-900/40 mb-6`}>
            {(title || description) && (
                <div className="px-5 pt-5">
                    {title && <h3 className={`text-sm font-semibold ${tone === "danger" ? "text-red-600 dark:text-red-400" : "text-zinc-900 dark:text-white"}`}>{title}</h3>}
                    {description && <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{description}</p>}
                </div>
            )}
            <div className="p-5">{children}</div>
            {footer && (
                <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 rounded-b-lg flex flex-wrap items-center justify-between gap-3">
                    {footer}
                </div>
            )}
        </div>
    );
}

// Label/help on the left, control on the right (stacks on small screens).
export function FieldRow({ label, help, children }) {
    return (
        <div className="grid sm:grid-cols-5 gap-2 sm:gap-6 py-4 first:pt-0 last:pb-0 border-b last:border-b-0 border-zinc-100 dark:border-zinc-800">
            <div className="sm:col-span-2">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{label}</p>
                {help && <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{help}</p>}
            </div>
            <div className="sm:col-span-3">{children}</div>
        </div>
    );
}

export function Toggle({ checked, onChange, disabled, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${checked ? "bg-blue-600" : "bg-zinc-300 dark:bg-zinc-700"}`}
        >
            <span className={`inline-block size-4 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-4.5" : "translate-x-0.5"}`} />
        </button>
    );
}

export function Badge({ children, tone = "zinc" }) {
    const tones = {
        zinc: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
        purple: "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300",
        blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300",
        amber: "bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300",
    };
    return <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-md whitespace-nowrap ${tones[tone]}`}>{children}</span>;
}

export function ReadOnlyNotice({ children }) {
    return (
        <div className="mb-6 rounded-md border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
            {children}
        </div>
    );
}

// Confirmation modal for destructive actions. When `confirmText` is set, the
// user must type it exactly before the action button enables.
export function ConfirmDialog({ open, title, description, confirmLabel, confirmText, onConfirm, onClose }) {
    const [typed, setTyped] = useState("");
    const [busy, setBusy] = useState(false);

    if (!open) return null;

    const close = () => {
        if (busy) return;
        setTyped("");
        onClose();
    };

    const handleConfirm = async () => {
        setBusy(true);
        try {
            await onConfirm();
            setTyped("");
            onClose();
        } finally {
            setBusy(false);
        }
    };

    const canConfirm = !confirmText || typed === confirmText;

    return (
        <div className="motion-overlay fixed inset-0 bg-black/20 dark:bg-black/50 backdrop-blur flex items-center justify-center z-50 px-4">
            <OpenSound />
            <div className="motion-dialog bg-white dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md text-zinc-900 dark:text-zinc-200">
                <div className="flex gap-3">
                    <div className="size-9 shrink-0 rounded-full bg-red-100 dark:bg-red-500/15 flex items-center justify-center">
                        <AlertTriangle className="size-4 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                        <h2 className="text-base font-semibold">{title}</h2>
                        <div className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{description}</div>
                    </div>
                </div>

                {confirmText && (
                    <div className="mt-5 space-y-2">
                        <label className="text-sm text-zinc-700 dark:text-zinc-300">
                            Type <span className="font-semibold text-zinc-900 dark:text-white">{confirmText}</span> to confirm
                        </label>
                        <input value={typed} onChange={(e) => setTyped(e.target.value)} className={inputClass} autoFocus />
                    </div>
                )}

                <div className="flex justify-end gap-3 mt-6">
                    <button type="button" onClick={close} disabled={busy} className={secondaryButtonClass}>Cancel</button>
                    <button type="button" onClick={handleConfirm} disabled={!canConfirm || busy} className={dangerButtonClass}>
                        {busy && <Loader2Icon className="size-4 animate-spin" />}
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
