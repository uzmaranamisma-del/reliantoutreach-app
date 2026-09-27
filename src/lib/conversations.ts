export function groupConversations<T extends { fromEmail?: string; createdAt: string }>(items: T[]) {
  const conversations = new Map<string, T>();
  for (const message of items) {
    const key = message.fromEmail?.trim().toLowerCase();
    if (!key) continue;
    const current = conversations.get(key);
    if (!current || new Date(message.createdAt) > new Date(current.createdAt)) conversations.set(key, message);
  }
  return [...conversations.values()].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
export function draftKey(user: string, workspace: string, email: string) {
  return `outreach-draft:${JSON.stringify([user, workspace, email.toLowerCase()])}`;
}
