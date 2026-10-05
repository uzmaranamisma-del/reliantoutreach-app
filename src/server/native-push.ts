import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { withLease } from "@/lib/locks";
import { canReceivePush } from "./push";

export type NativeEvent = {
  eventId: string;
  clientId: string;
  kind: "reply" | "order";
};
export const deliveryId = (eventId: string, deviceId: string) =>
  createHash("sha256")
    .update(JSON.stringify([eventId, deviceId]))
    .digest("hex");
export const nativePushConfigured = () =>
  process.env.MOBILE_PUSH_ENABLED === "1";
export const retryDelay = (attempt: number) =>
  Math.min(3600000, 30000 * 2 ** Math.min(attempt, 7));
export function pushMessage(
  token: string,
  event: NativeEvent,
  id: string,
  ttl: number,
) {
  return {
    to: token,
    title:
      event.kind === "reply"
        ? "New prospect reply"
        : "Your package request was updated",
    body: "Open ReliantOutreach to view the update.",
    data: event,
    sound: "default",
    priority: "high",
    ttl,
    channelId: event.kind === "reply" ? "replies" : "orders",
    collapseId: id,
    tag: id,
    threadId: `workspace-${deliveryId(event.clientId, "group").slice(0, 24)}`,
  };
}
export async function queueNativePush(event: NativeEvent) {
  const devices = await db.nativeDevice.findMany({
    where: {
      clientId: event.clientId,
      ...(event.kind === "reply" ? { replies: true } : { orders: true }),
    },
  });
  for (const device of devices) {
    if (!(await deviceEligible(device, event.kind))) continue;
    const id = deliveryId(event.eventId, device.id);
    await db.nativePushDelivery.upsert({
      where: { id },
      create: {
        id,
        deviceId: device.id,
        kind: event.kind,
        payload: event,
        expiresAt: new Date(Date.now() + 86400000),
      },
      update: {},
    });
  }
}
async function deviceEligible(
  device: {
    userId: string;
    clientId: string;
    sessionId: string;
    replies: boolean;
    orders: boolean;
  },
  kind: string,
) {
  if (kind === "reply")
    return device.replies && canReceivePush(device, "inbox.view");
  if (!device.orders) return false;
  const [user, session, member] = await Promise.all([
    db.user.findUnique({ where: { id: device.userId } }),
    db.session.findUnique({ where: { id: device.sessionId } }),
    db.clientMembership.findUnique({
      where: {
        userId_clientId: { userId: device.userId, clientId: device.clientId },
      },
      include: { client: true },
    }),
  ]);
  return !!(
    user &&
    !user.disabled &&
    session &&
    session.userId === user.id &&
    session.expiresAt > new Date() &&
    member &&
    !member.disabled &&
    member.client.status === "ACTIVE" &&
    member.role !== "CLIENT_MEMBER"
  );
}
async function expoRequest(path: string, body: unknown) {
  return fetch(`https://exp.host/--/api/v2/push/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(process.env.EXPO_ACCESS_TOKEN
        ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
        : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
}
// Tickets are persisted before receipt polling. A network timeout has an unknown
// outcome: don't blindly send again and create a second lock-screen alert.
export async function processNativePush() {
  if (!nativePushConfigured()) return { configured: false };
  return withLease(
    "native-push:worker",
    async () => {
      const now = new Date(),
        started = Date.now();
      const orders = await db.packageRequest.findMany({
        where: { notificationPending: true },
        take: 50,
      });
      for (const order of orders) {
        await queueNativePush({
          clientId: order.clientId,
          eventId: `${order.id}:${order.updatedAt.toISOString()}`,
          kind: "order",
        });
        await db.packageRequest.updateMany({
          where: { id: order.id, updatedAt: order.updatedAt },
          data: { notificationPending: false },
        });
      }
      await db.nativePushDelivery.updateMany({
        where: {
          status: "sending",
          runAfter: { lt: new Date(Date.now() - 120000) },
        },
        data: {
          status: "uncertain",
          lastError: "Interrupted delivery; outcome unknown",
        },
      });
      await db.nativePushDelivery.updateMany({
        where: {
          status: { in: ["pending", "ticket"] },
          expiresAt: { lte: now },
        },
        data: { status: "expired" },
      });
      const receipts = await db.nativePushDelivery.findMany({
        where: { status: "ticket", runAfter: { lte: now } },
        take: 100,
      });
      if (receipts.length) {
        try {
          const res = await expoRequest("getReceipts", {
            ids: receipts.map((r) => r.receiptId),
          });
          if (res.ok) {
            const body = await res.json();
            for (const row of receipts) {
              const receipt = body.data?.[row.receiptId!];
              if (receipt?.details?.error === "DeviceNotRegistered")
                await db.nativeDevice.deleteMany({
                  where: { id: row.deviceId },
                });
              else if (receipt?.status === "ok")
                await db.nativePushDelivery.updateMany({
                  where: { id: row.id },
                  data: { status: "accepted", lastError: null },
                });
              else if (receipt?.status === "error")
                await db.nativePushDelivery.updateMany({
                  where: { id: row.id },
                  data: {
                    status: "failed",
                    lastError: String(
                      receipt.details?.error || "Receipt error",
                    ).slice(0, 100),
                  },
                });
              else
                await db.nativePushDelivery.updateMany({
                  where: { id: row.id },
                  data: { runAfter: new Date(Date.now() + 900000) },
                });
            }
          }
        } catch {
          /* Receipt lookup is read-only and safe to retry next tick. */
        }
      }
      const rows = await db.nativePushDelivery.findMany({
        where: { status: "pending", runAfter: { lte: now } },
        include: { device: true },
        orderBy: { runAfter: "asc" },
        take: 20,
      });
      let submitted = 0;
      for (const row of rows) {
        if (Date.now() - started > 20000) break;
        if (!(await deviceEligible(row.device, row.kind))) {
          await db.nativePushDelivery.updateMany({
            where: { id: row.id },
            data: { status: "cancelled" },
          });
          continue;
        }
        const claimed = await db.nativePushDelivery.updateMany({
          where: { id: row.id, status: "pending" },
          data: {
            status: "sending",
            runAfter: new Date(),
            attempts: { increment: 1 },
          },
        });
        if (!claimed.count) continue;
        try {
          const response = await expoRequest("send", [
            pushMessage(
              row.device.token,
              row.payload as NativeEvent,
              row.id,
              Math.max(
                1,
                Math.floor((row.expiresAt.getTime() - Date.now()) / 1000),
              ),
            ),
          ]);
          if (response.status === 429 || response.status >= 500) {
            await db.nativePushDelivery.updateMany({
              where: { id: row.id },
              data: {
                status: "pending",
                runAfter: new Date(Date.now() + retryDelay(row.attempts)),
                lastError: `HTTP ${response.status}`,
              },
            });
            continue;
          }
          if (!response.ok) {
            await db.nativePushDelivery.updateMany({
              where: { id: row.id },
              data: { status: "failed", lastError: `HTTP ${response.status}` },
            });
            continue;
          }
          const body = await response.json(),
            ticket = body.data?.[0];
          if (ticket?.status === "ok" && typeof ticket.id === "string") {
            await db.nativePushDelivery.updateMany({
              where: { id: row.id },
              data: {
                status: "ticket",
                receiptId: ticket.id,
                runAfter: new Date(Date.now() + 900000),
                lastError: null,
              },
            });
            submitted++;
          } else if (ticket?.details?.error === "DeviceNotRegistered")
            await db.nativeDevice.deleteMany({ where: { id: row.deviceId } });
          else if (ticket?.details?.error === "MessageRateExceeded")
            await db.nativePushDelivery.updateMany({
              where: { id: row.id },
              data: {
                status: "pending",
                runAfter: new Date(Date.now() + retryDelay(row.attempts)),
                lastError: "MessageRateExceeded",
              },
            });
          else
            await db.nativePushDelivery.updateMany({
              where: { id: row.id },
              data: {
                status: ticket?.status === "error" ? "failed" : "uncertain",
                lastError: String(
                  ticket?.details?.error || "Unexpected ticket response",
                ).slice(0, 100),
              },
            });
        } catch {
          await db.nativePushDelivery.updateMany({
            where: { id: row.id },
            data: {
              status: "uncertain",
              lastError: "Network outcome unknown; not resent",
            },
          });
        }
      }
      await db.nativePushDelivery.deleteMany({
        where: { expiresAt: { lt: new Date(Date.now() - 7 * 86400000) } },
      });
      await db.appSetting.upsert({
        where: { key: "native-push:last-run" },
        create: {
          key: "native-push:last-run",
          value: { at: new Date().toISOString(), submitted },
        },
        update: { value: { at: new Date().toISOString(), submitted } },
      });
      return { configured: true, submitted };
    },
    90,
  );
}
