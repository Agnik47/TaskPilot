// Mentions are stored in comment content as `@[Display Name](userId)`
// (the server validates and normalises them). While composing, the textarea
// shows plain "@Display Name" and the picked users are tracked separately,
// then converted to markup on send.

const MENTION_RE = /@\[([^\]\n]{1,100})\]\(([A-Za-z0-9_-]{1,64})\)/g;

const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Turns "@Jane Doe" occurrences for users picked from the suggestion list into
// markup. Longer names first so "@Jane Doe" wins over a "@Jane" mention.
export function toMentionMarkup(text, pickedUsers) {
    const unique = [...new Map(pickedUsers.map((u) => [u.id, u])).values()]
        .sort((a, b) => b.name.length - a.name.length);

    return unique.reduce(
        (out, user) =>
            out.replace(
                new RegExp(`@${escapeRegExp(user.name)}(?![\\w\\]])`, "g"),
                `@[${user.name}](${user.id})`
            ),
        text
    );
}

// Splits stored content into text and mention segments for rendering.
export function parseMentions(content) {
    const segments = [];
    let last = 0;
    for (const match of content.matchAll(MENTION_RE)) {
        if (match.index > last) segments.push({ type: "text", text: content.slice(last, match.index) });
        segments.push({ type: "mention", name: match[1], userId: match[2] });
        last = match.index + match[0].length;
    }
    if (last < content.length) segments.push({ type: "text", text: content.slice(last) });
    return segments;
}

// If the caret sits right after "@query" (at a word boundary), returns
// { query, start } where start is the index of the "@"; otherwise null.
export function getMentionQuery(text, caret) {
    const match = /(^|\s)@([^\s@]{0,30})$/.exec(text.slice(0, caret));
    if (!match) return null;
    return { query: match[2], start: caret - match[2].length - 1 };
}
