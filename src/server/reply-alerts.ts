import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { forClient, type ProviderPage } from "@/lib/manyreach/client";
import { withLease } from "@/lib/locks";
import { sendPushNotification } from "./push";

export const replyEventId = (clientId: string, messageId: string) =>
  createHash("sha256").update(JSON.stringify([clientId, messageId])).digest("hex");

// Separate from campaign statistics. Persist progress and dedupe by provider ID,
// never by total counts. Each pass walks all pages; no undocumented sort assumed.
export async function collectReplyAlerts() {
  return withLease("replies:collector", async () => {
    const clients = await db.client.findMany({ where: { status: "ACTIVE", mapping: { isNot: null }, pushSubscriptions: { some: {} } }, select: { id: true } });
    for (const client of clients) await db.replyScan.upsert({ where: { clientId: client.id }, create: { clientId: client.id }, update: {} });
    const scans = await db.replyScan.findMany({ where: { clientId: { in: clients.map(c => c.id) } }, orderBy: { lastScanAt: "asc" }, take: 5 });
    const started = Date.now();
    let scanned = 0, failed = 0;
    for (const scan of scans) {
      if (Date.now() - started > 20000) break;
      try {
        const provider = await forClient(scan.clientId);
        // Send the 1-based page explicitly, as the working inbox requests do.
        // Omitting it is rejected with 422 by the live provider despite its documented default.
        const page = await provider.request<ProviderPage>("/messages", "GET", undefined, { type: "Reply", page: 1, limit: 1000, startingAfter: scan.cursor || undefined });
        if (!Array.isArray(page.items) || !page.pagination) throw new Error("Incomplete reply page");
        for (const message of page.items) {
          const at = new Date(message.createdAt);
          if (!message.messageId || !Number.isFinite(at.getTime())) throw new Error("Invalid reply record");
          // Establish a baseline on enrollment instead of notifying old history.
          if (at < scan.enabledAt) continue;
          const id = replyEventId(scan.clientId, String(message.messageId));
          await db.replyEvent.upsert({ where: { id }, create: { id, clientId: scan.clientId }, update: {} });
        }
        const next = page.items.length && page.pagination.nextCursor ? String(page.pagination.nextCursor) : null;
        if (next && next === scan.cursor) throw new Error("Reply cursor did not advance");
        await db.replyScan.update({ where: { clientId: scan.clientId }, data: { cursor: next, lastScanAt: new Date(), lastError: null } });
        scanned++;
      } catch {
        failed++;
        await db.replyScan.update({ where: { clientId: scan.clientId }, data: { lastScanAt: new Date(), lastError: "Reply collection failed; will retry automatically." } });
      }
    }
    const events = await db.replyEvent.findMany({ where: { queued: false }, orderBy: { createdAt: "asc" }, take: 100 });
    for (const event of events) {
      await db.notification.upsert({ where: { id: `reply:${event.id}` }, create: { id: `reply:${event.id}`, clientId: event.clientId, title: "New prospect reply" }, update: {} });
      await sendPushNotification(event.clientId, { title: "New prospect reply", body: "Open Inbox to read the latest message.", url: "/app/inbox", tag: `reply:${event.id}` });
      await db.replyEvent.update({ where: { id: event.id }, data: { queued: true } });
    }
    return { scanned, failed, queued: events.length };
  }, 180);
}
