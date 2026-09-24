import { isValid, parse } from "date-fns";

// Pure helpers for the task sheet: option lists, and turning pasted
// spreadsheet text (Excel / Google Sheets copy = tab-separated rows) into
// task field values.

export const TYPE_OPTIONS = [
    { value: "TASK", label: "Task" },
    { value: "BUG", label: "Bug" },
    { value: "FEATURE", label: "Feature" },
    { value: "IMPROVEMENT", label: "Improvement" },
    { value: "OTHER", label: "Other" },
];

export const PRIORITY_OPTIONS = [
    { value: "LOW", label: "Low" },
    { value: "MEDIUM", label: "Medium" },
    { value: "HIGH", label: "High" },
    { value: "URGENT", label: "Urgent" },
];

export const STATUS_OPTIONS = [
    { value: "TODO", label: "To Do" },
    { value: "IN_PROGRESS", label: "In Progress" },
    { value: "BLOCKED", label: "Blocked" },
    { value: "DONE", label: "Done" },
];

// Splits clipboard text into rows of cells. Handles quoted cells (Excel quotes
// cells containing tabs/newlines) and drops the trailing empty line.
export function parseClipboardGrid(text) {
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (inQuotes) {
            if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++; }
            else if (ch === '"') inQuotes = false;
            else cell += ch;
        } else if (ch === '"' && cell === "") {
            inQuotes = true;
        } else if (ch === "\t") {
            row.push(cell); cell = "";
        } else if (ch === "\n" || ch === "\r") {
            if (ch === "\r" && text[i + 1] === "\n") i++;
            row.push(cell); rows.push(row); row = []; cell = "";
        } else {
            cell += ch;
        }
    }
    if (cell !== "" || row.length) { row.push(cell); rows.push(row); }

    return rows
        .map((r) => r.map((c) => c.trim()))
        .filter((r) => r.some((c) => c !== ""));
}

const normalize = (s) => s.toLowerCase().replace(/[\s_-]+/g, "");

// "in progress", "IN_PROGRESS", "In-Progress" -> "IN_PROGRESS" (null if no match).
export function matchOption(options, raw) {
    if (!raw) return null;
    const key = normalize(raw);
    const hit = options.find((o) => normalize(o.value) === key || normalize(o.label) === key);
    if (hit) return hit.value;
    if (key === "todo" || key === "open" || key === "notstarted") return options.find((o) => o.value === "TODO")?.value ?? null;
    if (key === "completed" || key === "complete" || key === "closed") return options.find((o) => o.value === "DONE")?.value ?? null;
    return null;
}

// Matches a person by exact name or email, then by unique first name.
export function matchPerson(people, raw) {
    if (!raw) return null;
    const key = raw.trim().toLowerCase();
    const exact = people.find((p) => p.name?.toLowerCase() === key || p.email?.toLowerCase() === key);
    if (exact) return exact.id;
    const byFirst = people.filter((p) => p.name?.toLowerCase().split(" ")[0] === key);
    return byFirst.length === 1 ? byFirst[0].id : null;
}

// Day-first formats are tried before month-first (the common convention
// outside the US); unambiguous formats like "2026-10-15" or "15 Oct 2026"
// always work. Returns "yyyy-MM-dd" or null.
const DATE_FORMATS = ["yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "dd.MM.yyyy", "d MMM yyyy", "d MMMM yyyy", "MMM d, yyyy", "MMMM d, yyyy", "MM/dd/yyyy", "d/M/yy", "dd-MMM-yy", "d-MMM-yyyy"];

export function parseDateCell(raw) {
    if (!raw) return null;
    const text = raw.trim();
    for (const fmt of DATE_FORMATS) {
        const d = parse(text, fmt, new Date());
        if (isValid(d) && d.getFullYear() > 1900) return toDateInput(d);
    }
    return null;
}

// Local date -> "yyyy-MM-dd" for <input type="date">.
export function toDateInput(d) {
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Stored due dates are UTC midnight for the chosen day; read them back as that day.
export function dueDateToInput(iso) {
    return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

// Converts one pasted cell for a column. Returns { value, ok } — ok=false when
// the text couldn't be understood (the cell keeps its default).
export function parseCellForColumn(column, raw, { people }) {
    const text = (raw ?? "").trim();
    if (!text) return { value: undefined, ok: true };
    switch (column) {
        case "title":
        case "description":
            return { value: text, ok: true };
        case "type": {
            const v = matchOption(TYPE_OPTIONS, text);
            return { value: v ?? undefined, ok: !!v };
        }
        case "priority": {
            const v = matchOption(PRIORITY_OPTIONS, text);
            return { value: v ?? undefined, ok: !!v };
        }
        case "status": {
            const v = matchOption(STATUS_OPTIONS, text);
            return { value: v ?? undefined, ok: !!v };
        }
        case "assigneeId": {
            const v = matchPerson(people, text);
            return { value: v ?? undefined, ok: !!v };
        }
        case "due_date": {
            const v = parseDateCell(text);
            return { value: v ?? undefined, ok: !!v };
        }
        default:
            return { value: undefined, ok: true };
    }
}
