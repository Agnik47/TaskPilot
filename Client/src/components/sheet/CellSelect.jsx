import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search } from "lucide-react";

// Accessible single-select used in the task sheet instead of a native
// <select> (whose popup can't be themed on Windows and looks out of place).
// The menu renders in a portal with fixed positioning so it's never clipped by
// the scrolling grid, and flips above the trigger when there's no room below.
//
// options: [{ value, label, dot?, image?, hint?, sublabel? }]
// Search matches the label, hint and sublabel (e.g. a person's email), so
// long people lists can be narrowed by name or address.
// Keyboard: Enter / Space / Alt+↓ open · ↑↓ move · Enter selects · Esc closes ·
// typing jumps to a matching option (or filters, when the list is searchable).
export default function CellSelect({
    value,
    options,
    onChange,
    disabled,
    renderValue,
    placeholder = "—",
    searchable = false,
    searchPlaceholder = "Search…",
    label,
    dataCell,
    className = "",
    menuWidth = 220,
    onTriggerKeyDown,
    hideChevron = false,
}) {
    const triggerRef = useRef(null);
    const menuRef = useRef(null);
    const searchRef = useRef(null);
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [active, setActive] = useState(0);
    const [position, setPosition] = useState(null);

    const selected = options.find((o) => o.value === value);
    const visible = useMemo(() => {
        const q = query.trim().toLowerCase();
        if (!q) return options;
        return options.filter((o) => [o.label, o.hint, o.sublabel].some((t) => t && String(t).toLowerCase().includes(q)));
    }, [options, query]);

    const listHeight = visible.reduce((h, o) => h + (o.sublabel ? 44 : 36), 0);

    const openMenu = () => {
        if (disabled) return;
        setQuery("");
        setActive(Math.max(0, options.findIndex((o) => o.value === value)));
        setOpen(true);
    };

    const close = (refocus = true) => {
        setOpen(false);
        if (refocus) triggerRef.current?.focus();
    };

    const choose = (option) => {
        if (option?.disabled) return;
        if (option && option.value !== value) onChange(option.value);
        close();
    };

    // Position under (or above) the trigger; track scroll/resize while open.
    useLayoutEffect(() => {
        if (!open) return;
        const place = () => {
            const rect = triggerRef.current?.getBoundingClientRect();
            if (!rect) return;
            const menuHeight = Math.min(360, (searchable ? 48 : 8) + Math.max(listHeight, 36));
            const width = Math.max(menuWidth, rect.width);
            const below = window.innerHeight - rect.bottom;
            const top = below < menuHeight + 8 && rect.top > below ? rect.top - menuHeight - 4 : rect.bottom + 4;
            const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
            setPosition({ top, left, width, flipped: top < rect.top });
        };
        place();
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        return () => {
            window.removeEventListener("resize", place);
            window.removeEventListener("scroll", place, true);
        };
    }, [open, listHeight, searchable, menuWidth]);

    useEffect(() => {
        if (!open) return;
        if (searchable) searchRef.current?.focus();
        else menuRef.current?.focus();
        const onDown = (e) => {
            if (!menuRef.current?.contains(e.target) && !triggerRef.current?.contains(e.target)) close(false);
        };
        document.addEventListener("pointerdown", onDown, true);
        return () => document.removeEventListener("pointerdown", onDown, true);
    }, [open, searchable]);

    // Keep the highlighted option in view.
    useEffect(() => {
        if (open) menuRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
    }, [active, open]);

    const onMenuKeyDown = (e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            const step = e.key === "ArrowDown" ? 1 : -1;
            setActive((i) => (visible.length ? (i + step + visible.length) % visible.length : 0));
        } else if (e.key === "Home" || e.key === "End") {
            e.preventDefault();
            setActive(e.key === "Home" ? 0 : visible.length - 1);
        } else if (e.key === "Enter" || (e.key === " " && !searchable)) {
            e.preventDefault();
            choose(visible[active]);
        } else if (e.key === "Escape" || e.key === "Tab") {
            e.preventDefault();
            close();
        } else if (!searchable && e.key.length === 1) {
            // Type-ahead: jump to the next option starting with that letter.
            const letter = e.key.toLowerCase();
            const start = (active + 1) % visible.length;
            const order = [...visible.slice(start), ...visible.slice(0, start)];
            const hit = order.find((o) => o.label.toLowerCase().startsWith(letter));
            if (hit) setActive(visible.indexOf(hit));
        }
    };

    const onTrigger = (e) => {
        if (e.key === "Enter" || e.key === " " || (e.altKey && e.key === "ArrowDown")) {
            e.preventDefault();
            openMenu();
            return;
        }
        onTriggerKeyDown?.(e);
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                data-cell={dataCell}
                disabled={disabled}
                onClick={() => (open ? close() : openMenu())}
                onKeyDown={onTrigger}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={label ? `${label}: ${selected?.label ?? placeholder}` : undefined}
                className={`group/select flex items-center gap-2 text-left outline-none disabled:cursor-not-allowed ${className}`}
            >
                <span className="min-w-0 flex-1 truncate">
                    {renderValue ? renderValue(selected) : selected?.label ?? <span className="text-zinc-400">{placeholder}</span>}
                </span>
                {!disabled && !hideChevron && (
                    <ChevronDown className={`size-3.5 shrink-0 text-zinc-400 transition-opacity ${open ? "opacity-100" : "opacity-0 group-hover/select:opacity-100 group-focus-visible/select:opacity-100"}`} />
                )}
            </button>

            {open && position && createPortal(
                <div
                    ref={menuRef}
                    tabIndex={-1}
                    role="listbox"
                    aria-label={label}
                    onKeyDown={onMenuKeyDown}
                    style={{ position: "fixed", top: position.top, left: position.left, width: position.width }}
                    className={`${position.flipped ? "motion-pop-up" : "motion-pop"} z-[60] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-xl outline-none overflow-hidden`}
                >
                    {searchable && (
                        <div className="flex items-center gap-2 px-3 border-b border-zinc-100 dark:border-zinc-800">
                            <Search className="size-3.5 shrink-0 text-zinc-400" />
                            <input
                                ref={searchRef}
                                value={query}
                                onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                                placeholder={searchPlaceholder}
                                aria-label={searchPlaceholder}
                                data-sfx="none"
                                className="w-full h-10 bg-transparent outline-none text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                            />
                        </div>
                    )}
                    <ul className="max-h-72 overflow-y-auto py-1">
                        {visible.length === 0 && <li className="px-3 py-2 text-sm text-zinc-500">No matches for “{query.trim()}”</li>}
                        {visible.map((o, i) => (
                            <li
                                key={o.value}
                                data-index={i}
                                role="option"
                                aria-selected={o.value === value}
                                aria-disabled={o.disabled || undefined}
                                title={o.disabledReason}
                                onPointerEnter={() => setActive(i)}
                                onClick={() => choose(o)}
                                className={`mx-1 px-2.5 ${o.sublabel ? "min-h-11 py-1" : "h-9"} rounded-md flex items-center gap-2.5 text-sm select-none ${o.disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"} ${i === active ? "bg-zinc-100 dark:bg-zinc-800" : ""} text-zinc-800 dark:text-zinc-200`}
                            >
                                {o.image !== undefined && <img src={o.image || undefined} alt="" className={`${o.sublabel ? "size-7" : "size-5"} shrink-0 rounded-full bg-zinc-200 dark:bg-zinc-700`} />}
                                {o.dot && <span className={`size-2 rounded-full ${o.dot}`} />}
                                {o.icon && <o.icon className={`size-4 ${o.iconClass || ""}`} />}
                                {o.sublabel ? (
                                    <span className="flex-1 min-w-0">
                                        <span className="block truncate">{o.label}</span>
                                        <span className="block truncate text-xs text-zinc-400 dark:text-zinc-500">{o.sublabel}</span>
                                    </span>
                                ) : (
                                    <span className="flex-1 truncate">{o.label}</span>
                                )}
                                {o.hint && <span className="shrink-0 text-xs text-zinc-400">{o.hint}</span>}
                                {o.value === value && <Check className="size-4 shrink-0 text-blue-500" />}
                            </li>
                        ))}
                    </ul>
                </div>,
                document.body
            )}
        </>
    );
}
