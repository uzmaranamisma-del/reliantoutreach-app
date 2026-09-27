import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { validatePushEndpoint } from "@/lib/push-endpoint";
import { getEffectivePermission, type Permission } from "@/lib/permissions";
import { withLease } from "@/lib/locks";

type Payload = { title: string; body?: string; url?: string; tag?: string; eventId?: string };
export function pushConfigured() {
  return Boolean(process.env.VAPID_SUBJECT && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}
export async function canReceivePush(subscription: { userId: string; clientId: string; sessionId: string | null }, permission: Permission) {
  if (!subscription.sessionId) return false;
  const [user, session, client, member] = await Promise.all([
    db.user.findUnique({ where: { id: subscription.userId } }),
    db.session.findUnique({ where: { id: subscription.sessionId } }),
    db.client.findUnique({ where: { id: subscription.clientId }, include: { package: { include: { features: true } }, permissions: true } }),
    db.clientMembership.findUnique({ where: { userId_clientId: { userId: subscription.userId, clientId: subscription.clientId } } }),
  ]);
  if (!user || user.disabled || !session || session.userId !== user.id || session.expiresAt <= new Date() || client?.status !== "ACTIVE") return false;
  if (!member || member.disabled) return false;
  return getEffectivePermission(permission, member.role, client.package.features, client.permissions);
}
// Durable outbox: queueing never performs external network writes.
export async function sendPushNotification(clientId: string, payload: Payload, permission: Permission = "inbox.view", onlySubscriptionId?: string) {
  const subscriptions = await db.pushSubscription.findMany({ where: { clientId, ...(onlySubscriptionId ? { id: onlySubscriptionId } : {}) } });
  const eventId = `${clientId}:${payload.tag || randomUUID()}`;
  for (const subscription of subscriptions) {
    if (!(await canReceivePush(subscription, permission))) continue;
    try { validatePushEndpoint(subscription.endpoint); } catch { continue; }
    const id = createHash("sha256").update(`${eventId}:${subscription.id}`).digest("hex");
    await db.pushDelivery.upsert({ where: { id }, create: { id, subscriptionId: subscription.id, payload: { ...payload, eventId }, permission, expiresAt: new Date(Date.now() + 86400000) }, update: {} });
  }
}
export async function processPushDeliveries() {
  if (!pushConfigured()) return { delivered: 0 };
  return withLease("push:delivery", async () => {
    const { default: webpush } = await import("web-push");
    webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    await db.pushDelivery.updateMany({ where: { status: "pending", expiresAt: { lte: new Date() } }, data: { status: "expired" } });
    const rows = await db.pushDelivery.findMany({ where: { status: "pending", runAfter: { lte: new Date() } }, include: { subscription: true }, orderBy: { runAfter: "asc" }, take: 30 });
    let delivered = 0;
    const started = Date.now();
    for (const row of rows) {
      if (Date.now() - started > 20000) break;
      const sub = row.subscription;
      if (!(await canReceivePush(sub, row.permission as Permission))) {
        await db.pushSubscription.deleteMany({ where: { id: sub.id } });
        continue;
      }
      try {
        validatePushEndpoint(sub.endpoint);
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(row.payload), { TTL: Math.max(1, Math.floor((row.expiresAt.getTime() - Date.now()) / 1000)), timeout: 5000 });
        await db.pushDelivery.update({ where: { id: row.id }, data: { status: "delivered", attempts: { increment: 1 }, lastError: null } });
        delivered++;
      } catch (error) {
        const code = (error as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) await db.pushSubscription.deleteMany({ where: { id: sub.id } });
        else await db.pushDelivery.update({ where: { id: row.id }, data: { attempts: { increment: 1 }, lastError: `Push delivery ${code || "failed"}`, runAfter: new Date(Date.now() + Math.min(3600000, 30000 * 2 ** Math.min(row.attempts, 7))) } });
      }
    }
    await db.pushDelivery.deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 7 * 86400000) } } });
    return { delivered };
  }, 60);
}
