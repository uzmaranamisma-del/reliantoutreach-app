import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {
  user: { findUnique: vi.fn() }, session: { findUnique: vi.fn() }, client: { findUnique: vi.fn(), findMany: vi.fn() }, clientMembership: { findUnique: vi.fn() },
  pushSubscription: { findMany: vi.fn(), deleteMany: vi.fn() }, pushDelivery: { upsert: vi.fn(), findMany: vi.fn(), updateMany: vi.fn(), update: vi.fn(), deleteMany: vi.fn() },
  replyScan: { upsert: vi.fn(), findMany: vi.fn(), update: vi.fn() }, replyEvent: { upsert: vi.fn(), findMany: vi.fn(), update: vi.fn() }, notification: { upsert: vi.fn() }, auditLog: { create: vi.fn() },
} }));
vi.mock("@/lib/locks", () => ({ withLease: (_: string, fn: () => unknown) => fn() }));
vi.mock("web-push", () => ({ default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() } }));
vi.mock("@/lib/manyreach/client", () => ({ forClient: vi.fn() }));
import { db } from "@/lib/db";
import webpush from "web-push";
import { forClient } from "@/lib/manyreach/client";
import { canReceivePush, processPushDeliveries, sendPushNotification } from "@/server/push";
import { collectReplyAlerts, replyEventId } from "@/server/reply-alerts";
import { validatePushEndpoint } from "@/lib/push-endpoint";
import { groupConversations, draftKey } from "@/lib/conversations";
import { getEffectivePermission } from "@/lib/permissions";
import { sendingGuard } from "@/server/outreach";
import { sumSentSeries } from "@/server/monthly-usage";
import { pauseCampaignStage } from "@/server/pause-campaigns";
const sub = { id: "sub", userId: "user", clientId: "client", sessionId: "session", endpoint: "https://fcm.googleapis.com/send/mock", p256dh: "mock", auth: "mock" };
beforeEach(() => {
  vi.resetAllMocks();
  process.env.VAPID_SUBJECT = "mailto:test@example.com"; process.env.VAPID_PUBLIC_KEY = "mock"; process.env.VAPID_PRIVATE_KEY = "mock";
  vi.mocked(db.user.findUnique).mockResolvedValue({ id: "user", disabled: false } as any);
  vi.mocked(db.session.findUnique).mockResolvedValue({ userId: "user", expiresAt: new Date(Date.now() + 60000) } as any);
  vi.mocked(db.client.findUnique).mockResolvedValue({ status: "ACTIVE", package: { features: [{ key: "inbox.view", enabled: true }] }, permissions: [] } as any);
  vi.mocked(db.clientMembership.findUnique).mockResolvedValue({ disabled: false, role: "CLIENT_OWNER" } as any);
  vi.mocked(db.pushSubscription.findMany).mockResolvedValue([sub] as any);
});
it.each(["http://fcm.googleapis.com/a", "https://127.0.0.1/a", "https://localhost/a", "https://fcm.googleapis.com.evil.test/a", "https://fcm.googleapis.com:8443/a", "https://u:p@fcm.googleapis.com/a", "https://10.0.0.1/a"])("rejects untrusted push endpoint %s", value => expect(() => validatePushEndpoint(value)).toThrow());
it.each(["https://fcm.googleapis.com/a", "https://web.push.apple.com/a", "https://updates.push.services.mozilla.com/a"])("accepts supported service %s", value => expect(validatePushEndpoint(value)).toBe(value));
it("revoked membership, session or inbox permission prevents delivery", async () => {
  expect(await canReceivePush(sub, "inbox.view")).toBe(true);
  vi.mocked(db.clientMembership.findUnique).mockResolvedValueOnce({ disabled: true } as any);
  expect(await canReceivePush(sub, "inbox.view")).toBe(false);
  vi.mocked(db.session.findUnique).mockResolvedValueOnce(null);
  expect(await canReceivePush(sub, "inbox.view")).toBe(false);
  expect(await canReceivePush(sub, "inbox.reply")).toBe(false);
  expect(await canReceivePush({ ...sub, sessionId: null }, "inbox.view")).toBe(false);
});
it("queues the same event with a stable id, without sending", async () => {
  await sendPushNotification("client", { title: "Reply", tag: "reply:1" });
  await sendPushNotification("client", { title: "Reply", tag: "reply:1" });
  expect(vi.mocked(db.pushDelivery.upsert).mock.calls[0][0].where).toEqual(vi.mocked(db.pushDelivery.upsert).mock.calls[1][0].where);
  expect(webpush.sendNotification).not.toHaveBeenCalled();
});
it("retries failed pushes and keeps a one-day delivery window", async () => {
  vi.mocked(db.pushDelivery.findMany).mockResolvedValue([{ id: "d", subscription: sub, payload: { eventId: "e" }, permission: "inbox.view", attempts: 0, expiresAt: new Date(Date.now() + 86400000) }] as any);
  vi.mocked(webpush.sendNotification).mockRejectedValue({ statusCode: 503 });
  await processPushDeliveries();
  expect(db.pushDelivery.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ lastError: "Push delivery 503", runAfter: expect.any(Date) }) }));
  expect(webpush.sendNotification).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ timeout: 5000, TTL: expect.any(Number) }));
});
it("detects a new message by ID even if total reply count has not increased, without historical alerts", async () => {
  vi.mocked(db.client.findMany).mockResolvedValue([{ id: "client" }] as any);
  vi.mocked(db.replyScan.findMany).mockResolvedValue([{ clientId: "client", enabledAt: new Date("2026-09-27"), cursor: null }] as any);
  vi.mocked(db.replyEvent.findMany).mockResolvedValue([]);
  vi.mocked(forClient).mockResolvedValue({ request: vi.fn().mockResolvedValue({ items: [{ messageId: "old", createdAt: "2026-09-26" }, { messageId: "new", createdAt: "2026-09-28" }], pagination: { totalItems: 2 } }) } as any);
  await collectReplyAlerts();
  expect(db.replyEvent.upsert).toHaveBeenCalledTimes(1);
  expect(db.replyEvent.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { id: replyEventId("client", "new") } }));
});
it("read-only members cannot manage conversation metadata", () => {
  expect(getEffectivePermission("inbox.manage", "CLIENT_MEMBER", [{ key: "inbox.manage", enabled: true }], [])).toBe(false);
});
it("groups contacts with their latest reply and keeps drafts isolated", () => {
  expect(groupConversations([{ fromEmail: "A@x.com", createdAt: "2026-01-01" }, { fromEmail: "a@x.com", createdAt: "2026-02-01" }])).toEqual([{ fromEmail: "a@x.com", createdAt: "2026-02-01" }]);
  expect(draftKey("a", "w1", "x@y.com")).not.toBe(draftKey("a", "w2", "x@y.com"));
  expect(draftKey("a", "w1", "x@y.com")).not.toBe(draftKey("b", "w1", "x@y.com"));
});
it("allows managed monthly allowances, retaining zero-entitlement protection", () => {
  expect(() => sendingGuard({ limit: () => 5000 } as any)).not.toThrow();
  expect(() => sendingGuard({ limit: () => -1 } as any)).not.toThrow();
  expect(() => sendingGuard({ limit: () => 0 } as any)).toThrow();
  expect(sumSentSeries({ sentSeries: { count: [2, 5] } })).toBe(7);
  expect(() => sumSentSeries({})).toThrow();
});
it("collects pause targets without writes, then pauses only eligible live campaigns", async () => {
  vi.mocked(db.user.findUnique).mockResolvedValue({ superadmin: true, disabled: false } as any);
  const request = vi.fn().mockResolvedValueOnce({ items: [{ campaignId: 1, status: "Running" }, { campaignId: 2, status: "Draft" }], pagination: { totalItems: 2 } });
  vi.mocked(forClient).mockResolvedValue({ request } as any);
  const payload: any = {};
  expect(await pauseCampaignStage("client", "admin", payload)).toBe(false);
  expect(request).toHaveBeenCalledTimes(1);
  expect(payload.ids).toEqual(["1"]);
  request.mockResolvedValueOnce({ status: "Running" }).mockResolvedValueOnce({});
  expect(await pauseCampaignStage("client", "admin", payload)).toBe(true);
  expect(request).toHaveBeenLastCalledWith("/campaigns/1/pause", "POST", undefined, {});
});
it("does not run a queued pause after administrator access is revoked", async () => {
  await expect(pauseCampaignStage("client", "former-admin", {})).rejects.toThrow("revoked");
  expect(forClient).not.toHaveBeenCalled();
});
