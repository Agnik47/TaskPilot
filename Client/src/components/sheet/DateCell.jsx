import { useRef } from "react";
import { format, isToday, isTomorrow, isYesterday } from "date-fns";
import { CalendarDays } from "lucide-react";

// "yyyy-MM-dd" -> local Date at midnight (avoids UTC off-by-one).
const fromInput = (v) => {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
};

function formatDue(value) {
    if (!value) return "";
    const d = fromInput(value);
    if (isToday(d)) return "Today";
    if (isTomorrow(d)) return "Tomorrow";
    if (isYesterday(d)) return "Yesterday";
    return format(d, d.getFullYear() === new Date().getFullYear() ? "d MMM" : "d MMM yyyy");
}

function isOverdue(value, status) {
    if (!value || status === "DONE" || status === "IN_REVIEW") return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return fromInput(value) < today;
}

// Friendly date display ("Today", "15 Oct") that opens the native date picker.
// The real <input type="date"> sits invisibly underneath so the picker works
// everywhere, including mobile, where it opens the OS date wheel.
export default function DateCell({ value, onChange, disabled, status, dataCell, className = "", onTriggerKeyDown, allowClear = false }) {
    const inputRef = useRef(null);
    const overdue = isOverdue(value, status);

    const openPicker = () => {
        if (disabled) return;
        const input = inputRef.current;
        try {
            input.showPicker();
        } catch {
            input.focus();
            input.click();
        }
    };

    return (
        <div className={`relative ${className}`}>
            <button
                type="button"
                data-cell={dataCell}
                disabled={disabled}
                onClick={openPicker}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        openPicker();
                    } else if (allowClear && (e.key === "Delete" || e.key === "Backspace") && value) {
                        e.preventDefault();
                        onChange("");
                    } else {
                        onTriggerKeyDown?.(e);
                    }
                }}
                aria-label={value ? `Due ${formatDue(value)}${overdue ? ", overdue" : ""}` : "Set due date"}
                className={`w-full h-full flex items-center gap-2 text-left outline-none disabled:cursor-not-allowed ${overdue ? "text-red-600 dark:text-red-400" : value ? "text-zinc-800 dark:text-zinc-200" : "text-zinc-400"}`}
            >
                <CalendarDays className="size-3.5 shrink-0 opacity-70" />
                <span className="truncate">{value ? formatDue(value) : "Set date"}</span>
            </button>
            <input
                ref={inputRef}
                type="date"
                tabIndex={-1}
                aria-hidden="true"
                value={value}
                onChange={(e) => e.target.value && onChange(e.target.value)}
                className="absolute inset-0 opacity-0 pointer-events-none"
            />
        </div>
    );
}
