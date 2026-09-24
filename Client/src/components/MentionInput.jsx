import { useRef, useState } from "react";
import { getMentionQuery } from "../lib/mentions";

// Comment textarea with "@" suggestions. The parent owns the text and
// receives each picked user via onMention (to convert to markup on send).
// Enter submits unless the suggestion list is open, where it picks instead.
export default function MentionInput({ value, onChange, onSubmit, onMention, onBlur, mentionables, placeholder, className }) {
    const textareaRef = useRef(null);
    const [mention, setMention] = useState(null); // { query, start }
    const [activeIndex, setActiveIndex] = useState(0);

    const suggestions = mention
        ? mentionables.filter((u) => u.name.toLowerCase().includes(mention.query.toLowerCase()))
        : [];
    const isOpen = suggestions.length > 0;

    const updateMention = (text, caret) => {
        const next = getMentionQuery(text, caret);
        setMention(next);
        if (next?.query !== mention?.query) setActiveIndex(0);
    };

    const pick = (user) => {
        const caret = textareaRef.current.selectionStart;
        const before = value.slice(0, mention.start);
        const after = value.slice(caret);
        const inserted = `@${user.name} `;
        onChange(before + inserted + after);
        onMention(user);
        setMention(null);

        // Put the caret right after the inserted mention.
        const pos = before.length + inserted.length;
        requestAnimationFrame(() => {
            textareaRef.current?.focus();
            textareaRef.current?.setSelectionRange(pos, pos);
        });
    };

    const handleKeyDown = (e) => {
        if (isOpen) {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
                e.preventDefault();
                const step = e.key === "ArrowDown" ? 1 : -1;
                setActiveIndex((i) => (i + step + suggestions.length) % suggestions.length);
                return;
            }
            if (e.key === "Enter" || e.key === "Tab") {
                e.preventDefault();
                pick(suggestions[Math.min(activeIndex, suggestions.length - 1)]);
                return;
            }
            if (e.key === "Escape") {
                e.preventDefault();
                setMention(null);
                return;
            }
        }
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            onSubmit();
        }
    };

    return (
        <div className="relative w-full">
            {isOpen && (
                <ul role="listbox" aria-label="Mention someone" className="motion-pop-up absolute bottom-full left-0 mb-1 w-64 max-w-full z-20 rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1">
                    <li className="px-3 py-1 text-[11px] uppercase tracking-wide text-zinc-400">People on this task</li>
                    {suggestions.map((u, i) => (
                        <li key={u.id} role="option" aria-selected={i === activeIndex}>
                            <button
                                type="button"
                                // mousedown (not click) so the textarea doesn't blur first
                                onMouseDown={(e) => { e.preventDefault(); pick(u); }}
                                onMouseEnter={() => setActiveIndex(i)}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-sm ${i === activeIndex ? "bg-blue-50 dark:bg-blue-500/15" : ""}`}
                            >
                                <img src={u.image} alt="" className="size-5 rounded-full bg-zinc-200 dark:bg-zinc-700" />
                                <span className="flex-1 truncate text-zinc-900 dark:text-zinc-100">{u.name}</span>
                                <span className="text-[11px] text-zinc-400">{u.label}</span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => {
                    onChange(e.target.value);
                    updateMention(e.target.value, e.target.selectionStart);
                }}
                onKeyDown={handleKeyDown}
                onKeyUp={(e) => {
                    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) updateMention(value, e.target.selectionStart);
                }}
                onClick={(e) => updateMention(value, e.target.selectionStart)}
                onBlur={() => {
                    setMention(null);
                    onBlur?.();
                }}
                placeholder={placeholder}
                className={className}
                rows={3}
                aria-autocomplete="list"
                aria-expanded={isOpen}
            />
        </div>
    );
}
