// Checklist (subtask) helpers shared by the task page and task lists.

export const checklistOf = (task) => task?.checklist || [];

// { done, total, complete } — total is 0 when the task has no checklist.
export function checklistProgress(task) {
    const items = checklistOf(task);
    const done = items.filter((i) => i.done).length;
    return { done, total: items.length, complete: items.length > 0 && done === items.length };
}

// Pasted text with several lines becomes several items (bullets and
// numbering like "- ", "* ", "1." or "[ ]" are stripped).
export function splitItemLines(text) {
    return text
        .split(/\r?\n/)
        .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)]|\[[ xX]?\])\s*/, "").trim())
        .filter(Boolean);
}
