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
// Display only the newest authored text. Keep the provider's original body intact.
// Avoid removing ordinary blockquotes or words such as "From" in someone's reply.
export function chatText(html = "") {
  const original = plainText(html);
  const quoteContainer = /<(?:div|section|blockquote)\b[^>]*(?:class|id)\s*=\s*["'][^"']*\b(?:gmail_quote|yahoo_quoted|moz-cite-prefix|divRplyFwdMsg)\b[^"']*["'][^>]*>/i.exec(html);
  let text = plainText(quoteContainer && plainText(html.slice(0, quoteContainer.index))
    ? html.slice(0, quoteContainer.index) : html);
  const attribution = /(?:^|\n)[ \t]*On[ \t]+[^\n]*(?:\n[^\n]*){0,5}?\bwrote\s*:/gi;
  for (const match of text.matchAll(attribution)) {
    if (/\b(?:\d{4}|Mon|Tue|Wed|Thu|Fri|Sat|Sun|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(match[0]) &&
        /(?:@|\d{1,2}:\d{2})/.test(match[0]) && text.slice(0, match.index).trim()) {
      text = text.slice(0, match.index);
      break;
    }
  }
  const forwarded = /(?:^|\n)[ \t]*(?:-{2,}[ \t]*(?:Original Message|Forwarded message)[ \t]*-{2,}|From:[^\n]+\n(?:Sent|Date):[^\n]+\nTo:[^\n]+\nSubject:)/i.exec(text);
  if (forwarded && text.slice(0, forwarded.index).trim()) text = text.slice(0, forwarded.index);
  return text.trim() || original;
}
export function messageTime(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
}
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
