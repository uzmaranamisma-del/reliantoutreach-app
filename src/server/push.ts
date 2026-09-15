import "server-only";
import { db } from "@/lib/db";

type WebPush = typeof import("web-push").default;
let webpush: WebPush | undefined;
async function configure() {
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  if (!webpush) {
    try {
      const loaded = await import("web-push");
      webpush = loaded.default;
      webpush.setVapidDetails(subject, publicKey, privateKey);
    } catch {
      return false;
    }
  }
  return true;
}

export function pushConfigured() {
  return Boolean(
    process.env.VAPID_SUBJECT &&
      process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY,
  );
}

export async function sendPushNotification(
  clientId: string,
  payload: { title: string; body?: string; url?: string; tag?: string },
) {
  if (!(await configure()) || !webpush) return;
  const subscriptions = await db.pushSubscription.findMany({
    where: { clientId },
    select: { id: true, endpoint: true, p256dh: true, auth: true },
  });
  for (const subscription of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        { TTL: 300 },
      );
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) {
        await db.pushSubscription.delete({ where: { id: subscription.id } });
      } else {
        console.error("Push delivery failed", status || "unknown");
      }
    }
  }
}
