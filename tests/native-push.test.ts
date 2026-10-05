import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: {
    nativeDevice: { findMany: vi.fn(), deleteMany: vi.fn() },
    nativePushDelivery: {
      upsert: vi.fn(),
      updateMany: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    packageRequest: { findMany: vi.fn(), updateMany: vi.fn() },
    appSetting: { upsert: vi.fn() },
  },
  canReceive: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/locks", () => ({
  withLease: async (_key: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock("@/server/push", () => ({ canReceivePush: mocks.canReceive }));
import {
  queueNativePush,
  processNativePush,
  pushMessage,
  deliveryId,
} from "@/server/native-push";
const device = {
  id: "d1",
  userId: "u1",
  clientId: "c1",
  sessionId: "s1",
  token: "ExpoPushToken[test]",
  replies: true,
  orders: true,
};
const event = { eventId: "reply1", clientId: "c1", kind: "reply" as const };
const row = {
  id: "delivery1",
  deviceId: "d1",
  device,
  payload: event,
  kind: "reply",
  attempts: 0,
  expiresAt: new Date(Date.now() + 86400000),
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("MOBILE_PUSH_ENABLED", "1");
  mocks.canReceive.mockResolvedValue(true);
  mocks.db.nativeDevice.findMany.mockResolvedValue([device]);
  mocks.db.nativePushDelivery.updateMany.mockResolvedValue({ count: 1 });
  mocks.db.packageRequest.findMany.mockResolvedValue([]);
  mocks.db.nativePushDelivery.findMany.mockResolvedValue([]);
  vi.stubGlobal("fetch", vi.fn());
});
describe("native push outbox", () => {
  it("queues the same event once per device and never sends from refresh/queueing", async () => {
    await queueNativePush(event);
    await queueNativePush(event);
    const calls = mocks.db.nativePushDelivery.upsert.mock.calls;
    expect(calls[0][0].where.id).toBe(calls[1][0].where.id);
    expect(calls[0][0].update).toEqual({});
    expect(fetch).not.toHaveBeenCalled();
    expect(deliveryId("reply1", "d1")).not.toBe(deliveryId("reply1", "d2"));
  });
  it("does not queue notifications after access/session revocation", async () => {
    mocks.canReceive.mockResolvedValue(false);
    await queueNativePush(event);
    expect(mocks.db.nativePushDelivery.upsert).not.toHaveBeenCalled();
  });
  it("keeps lock-screen payload generic and uses event collapse identifiers", () => {
    const payload = pushMessage(device.token, event, "stable-id", 123);
    expect(payload.collapseId).toBe("stable-id");
    expect(payload.tag).toBe("stable-id");
    expect(payload.data).toEqual(event);
    expect(payload.ttl).toBe(123);
    expect(JSON.stringify(payload)).not.toContain("@");
  });
  it("stores a ticket and waits for its receipt; does not claim device delivery", async () => {
    mocks.db.nativePushDelivery.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row]);
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ data: [{ status: "ok", id: "receipt-1" }] }),
    );
    await processNativePush();
    expect(mocks.db.nativePushDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "ticket",
          receiptId: "receipt-1",
        }),
      }),
    );
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("marks a timeout uncertain instead of sending a duplicate", async () => {
    mocks.db.nativePushDelivery.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row]);
    vi.mocked(fetch).mockRejectedValue(new Error("timeout"));
    await processNativePush();
    expect(mocks.db.nativePushDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "uncertain" }),
      }),
    );
  });
  it("backs off on explicit throttling", async () => {
    mocks.db.nativePushDelivery.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row]);
    vi.mocked(fetch).mockResolvedValue(new Response("", { status: 429 }));
    await processNativePush();
    const retry = mocks.db.nativePushDelivery.updateMany.mock.calls.find(
      ([arg]) => arg.data.lastError === "HTTP 429",
    )![0];
    expect(retry.data.status).toBe("pending");
    expect(retry.data.runAfter.getTime()).toBeGreaterThan(Date.now());
  });
  it("removes unregistered tokens when a receipt reports DeviceNotRegistered", async () => {
    mocks.db.nativePushDelivery.findMany
      .mockResolvedValueOnce([{ ...row, receiptId: "r1" }])
      .mockResolvedValueOnce([]);
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        data: {
          r1: { status: "error", details: { error: "DeviceNotRegistered" } },
        },
      }),
    );
    await processNativePush();
    expect(mocks.db.nativeDevice.deleteMany).toHaveBeenCalledWith({
      where: { id: "d1" },
    });
  });
  it("rechecks permissions immediately before transmission", async () => {
    mocks.canReceive.mockResolvedValue(false);
    mocks.db.nativePushDelivery.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([row]);
    await processNativePush();
    expect(fetch).not.toHaveBeenCalled();
    expect(mocks.db.nativePushDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "cancelled" } }),
    );
  });
});
