// Manual task order (drag to reorder). Each task has a numeric `position`;
// moving a task gives it a position between its new neighbours, so a move is a
// single one-field update no matter how many tasks the project has.

export function sortByPosition(tasks) {
    return [...tasks].sort((a, b) => (a.position ?? 0) - (b.position ?? 0) || new Date(a.createdAt) - new Date(b.createdAt));
}

// A position that sorts between two neighbours (either may be missing).
// `fallback` is used when there are no neighbours at all (e.g. an empty column).
export function positionBetween(before, after, fallback = null) {
    let position = fallback;
    if (before && after) position = (before.position + after.position) / 2;
    else if (before) position = before.position + 1;
    else if (after) position = after.position - 1;
    // Tasks loaded without positions (e.g. from an older server) can't be placed.
    return Number.isFinite(position) ? position : null;
}

// `list` is the order the user sees (possibly filtered). Returns the position
// that places `activeId` where `overId` currently is, or null for no move.
export function positionForMove(list, activeId, overId) {
    const from = list.findIndex((t) => t.id === activeId);
    const to = list.findIndex((t) => t.id === overId);
    if (from === -1 || to === -1 || from === to) return null;

    const rest = list.filter((t) => t.id !== activeId);
    return positionBetween(rest[to - 1], rest[to]);
}
