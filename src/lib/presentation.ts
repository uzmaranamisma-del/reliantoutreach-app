export function readable(value: unknown): string {
  if (value === null || value === undefined || value === "")
    return "Not available";
  const text = String(value);
  if (/^\d{4}-\d{2}-\d{2}T/.test(text)) return displayDate(text);
  if (/^[A-Z][A-Z_]+$/.test(text)) {
    const words = text.toLowerCase().replaceAll("_", " ");
    return words[0].toUpperCase() + words.slice(1);
  }
  return text;
}
export function displayDate(value: string | Date): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}
export function statusTone(value: unknown) {
  const text = String(value).toLowerCase();
  if (
    /^(2\d\d)$/.test(text) ||
    [
      "active",
      "running",
      "healthy",
      "connected",
      "online",
      "verified",
      "accepted",
      "sent",
      "synced",
      "ok",
    ].includes(text)
  )
    return "success";
  if (
    /^[45]\d\d$/.test(text) ||
    /failed|error|expired|bounced|disabled|suspended|revoked/.test(text)
  )
    return "danger";
  if (/draft|warming|scheduled|queued|pending/.test(text)) return "accent";
  if (/warning|limit|setup|retry|degraded/.test(text)) return "warning";
  if (/completed|superadmin|replied/.test(text)) return "brand";
  return "neutral";
}
