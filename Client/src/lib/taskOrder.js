// Manual task order (drag to reorder). Each task has a numeric `position`;
// moving a task gives it a position between its new neighbours, so a move is a
// single one-field update no matter how many tasks the project has.

export function sortByPosition(tasks) {
    return [...tasks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || new Date(a.createdAt) - new Date(b.createdAt));
}

// `list` is the order the user sees (possibly filtered). Returns the position
// that places `activeId` where `overId` currently is, or null for no move.
export function positionForMove(list, activeId, overId) {
    const from = list.findIndex((t) => t.id === activeId);
    const to = list.findIndex((t) => t.id === overId);
    if (from === -1 || to === -1 || from === to) return null;

    const rest = list.filter((t) => t.id !== activeId);
    const before = rest[to - 1];
    const after = rest[to];
    if (before && after) return (before.position + after.position) / 2;
    if (before) return before.position + 1;
    if (after) return after.position - 1;
    return null;
}
