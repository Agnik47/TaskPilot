// Mentions are stored inline in comment content as `@[Display Name](userId)`.
// Only people involved in the task (its creator, assignee, anyone it's
// waiting on, and owners of its checklist items) can be mentioned — they're
// the only non-owners who can see it — and nobody mentions themselves.

const MENTION_RE = /@\[([^\]\n]{1,100})\]\(([A-Za-z0-9_-]{1,64})\)/g;

// Rewrites client-supplied mention markup so it can't be forged: invalid
// targets become plain "@name" text, and valid ones get the user's real name
// (the client-sent label is never trusted). Returns the cleaned content and
// the de-duplicated users that were mentioned.
export function sanitizeMentions(content, { task, authorId }) {
  const allowed = new Map();
  for (const user of [task.creator, task.assignee, ...(task.blockers || []).map((b) => b.waitingOn), ...(task.checklist || []).map((i) => i.assignee)]) {
    if (user && user.id !== authorId) allowed.set(user.id, user);
  }

  const mentioned = new Map();
  const cleaned = content.replace(MENTION_RE, (_match, label, userId) => {
    const user = allowed.get(userId);
    if (!user) return `@${label}`;
    mentioned.set(user.id, user);
    return `@[${user.name}](${user.id})`;
  });

  return { content: cleaned, mentioned: [...mentioned.values()] };
}
