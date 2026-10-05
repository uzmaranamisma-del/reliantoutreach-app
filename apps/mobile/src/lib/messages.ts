import type { Message } from "./types";
export function plainText(html = "") {
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>|<\/p>|<\/div>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}
export const replyHtml = (text: string) =>
  `<p>${text.trim().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/\n/g, "<br>")}</p>`;
export function newestMessages(pages: { items: Message[] }[]) {
  return [
    ...new Map(
      pages.flatMap((p) => p.items).map((m) => [m.key || m.id, m]),
    ).values(),
  ].sort(
    (a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0),
  );
}
export function conversations(messages: Message[]) {
  const grouped = new Map<string, Message>();
  for (const m of messages) {
    const email = m.fromEmail?.toLowerCase();
    if (email && !grouped.has(email)) grouped.set(email, m);
  }
  return [...grouped.values()];
}
export function initials(email: string) {
  return (
    email
      .split("@")[0]
      .replace(/[._-]+/g, " ")
      .split(" ")
      .slice(0, 2)
      .map((s) => s[0])
      .join("")
      .toUpperCase() || "?"
  );
}
export function displayName(email: string) {
  return email
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
export function timeLabel(value: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
}
