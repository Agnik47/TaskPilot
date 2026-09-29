// Option lists for people pickers (assignee, checklist owner, filters).
// You come first, everyone else alphabetically, and each person carries their
// email as a second line: it tells apart people who share a name and lets the
// search box match an address.
export function peopleOptions(people, me, { value = (p) => p.id } = {}) {
    const seen = new Set();
    return people
        .filter((p) => p && !seen.has(value(p)) && seen.add(value(p)))
        .sort((a, b) => (a.id === me ? -1 : b.id === me ? 1 : (a.name || "").localeCompare(b.name || "")))
        .map((p) => ({
            value: value(p),
            label: p.name || p.email || "Unknown",
            image: p.image || "",
            sublabel: p.email || undefined,
            hint: p.id === me ? "You" : undefined,
        }));
}
