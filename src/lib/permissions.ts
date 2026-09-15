export const permissions = [
  "campaigns.view",
  "campaigns.create",
  "campaigns.edit",
  "campaigns.start",
  "campaigns.pause",
  "campaigns.delete",
  "sequences.edit",
  "prospects.view",
  "prospects.create",
  "prospects.edit",
  "prospects.delete",
  "prospects.import",
  "lists.manage",
  "inbox.view",
  "inbox.reply",
  "senders.view",
  "senders.create",
  "senders.edit",
  "senders.delete",
  "analytics.view",
  "analytics.export",
  "team.manage",
] as const;
export type Permission = (typeof permissions)[number];
export const limitKeys = [
  "monthlyEmails",
  "senders",
  "campaigns",
  "prospects",
  "lists",
  "teamMembers",
  "csvRows",
] as const;
export type LimitKey = (typeof limitKeys)[number];
type Feature = { key: string; enabled: boolean };
type Limit = { key: string; value: number };
export function getEffectivePermission(
  key: Permission,
  role: string,
  features: Feature[],
  overrides: Feature[],
) {
  if (role === "CLIENT_MEMBER" && !key.endsWith(".view")) return false;
  return (
    overrides.find((x) => x.key === key)?.enabled ??
    features.find((x) => x.key === key)?.enabled ??
    false
  );
}
export function getEffectiveLimit(
  key: LimitKey,
  limits: Limit[],
  overrides: Limit[],
) {
  return (
    overrides.find((x) => x.key === key)?.value ??
    limits.find((x) => x.key === key)?.value ??
    0
  );
}
export function withinLimit(used: number, amount: number, limit: number) {
  return limit === -1 || used + amount <= limit;
}
