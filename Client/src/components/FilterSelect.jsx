import { ChevronDown } from "lucide-react";
import CellSelect from "./sheet/CellSelect";

// Toolbar filter built on CellSelect: a themed menu instead of the native
// <select>, with search once the list gets long (e.g. assignees).
// `options` includes the "all" entry (value ""); the trigger shows
// "Label: Choice" and turns blue while a filter is applied.
export default function FilterSelect({ label, value, options, onChange, searchable, searchPlaceholder, menuWidth = 220, showImage = false, inactiveLabel, className = "" }) {
    const selected = options.find((o) => o.value === value);
    const active = value !== "";

    return (
        <CellSelect
            label={label}
            value={value}
            options={options}
            onChange={onChange}
            searchable={searchable ?? options.length > 7}
            searchPlaceholder={searchPlaceholder}
            menuWidth={menuWidth}
            hideChevron
            className={`h-8 pl-3 pr-2 rounded-md border text-sm transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30 ${active
                ? "border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100/70 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-500/20"
                : "border-zinc-300 dark:border-zinc-800 not-dark:bg-white text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800/60"} ${className}`}
            renderValue={() => (
                <span className="flex items-center gap-1.5 max-w-56">
                    {showImage && active && selected?.image !== undefined && (
                        <img src={selected.image || undefined} alt="" className="size-4 shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                    )}
                    <span className="truncate">
                        {active ? <><span className="opacity-70">{label}:</span> {selected?.label ?? value}</> : inactiveLabel ?? selected?.label}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 opacity-60" />
                </span>
            )}
        />
    );
}
