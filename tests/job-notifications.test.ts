import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({
  db: {
    appSetting: { findUnique: vi.fn(), upsert: vi.fn() },
    backgroundJob: { findMany: vi.fn() },
    notification: { findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock("@/server/push", () => ({ sendPushNotification: vi.fn() }));
import { db } from "@/lib/db";
import { sendPushNotification } from "@/server/push";
import { syncJobNotifications } from "@/server/notifications";
beforeEach(() => vi.resetAllMocks());
it("keeps successful syncs in history silently while failures and imports still alert", async () => {
  const updatedAt = new Date("2026-09-27T12:00:00Z");
  vi.mocked(db.backgroundJob.findMany).mockResolvedValue([
    {
      id: "sync-1",
      clientId: "client-a",
      type: "reconcile",
      status: "completed",
      updatedAt,
    },
    {
      id: "sync-2",
      clientId: "client-a",
      type: "reconcile",
      status: "failed",
      updatedAt,
    },
    {
      id: "import-1",
      clientId: "client-a",
      type: "prospect-import",
      status: "completed",
      updatedAt,
    },
  ] as any);
  await syncJobNotifications();
  expect(db.notification.create).toHaveBeenCalledTimes(3);
  expect(sendPushNotification).toHaveBeenCalledTimes(2);
  expect(sendPushNotification).toHaveBeenCalledWith(
    "client-a",
    expect.objectContaining({ tag: "job:sync-2" }),
  );
  expect(sendPushNotification).toHaveBeenCalledWith(
    "client-a",
    expect.objectContaining({ tag: "job:import-1" }),
  );
  expect(db.appSetting.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      update: { value: { at: updatedAt.toISOString(), id: "import-1" } },
    }),
  );
});
it("recovers outbox enqueue after history was saved, using the same deduplication tag", async () => {
  vi.mocked(db.backgroundJob.findMany).mockResolvedValue([
    {
      id: "job-1",
      clientId: "a",
      type: "prospect-import",
      status: "completed",
      updatedAt: new Date(),
    },
  ] as any);
  vi.mocked(db.notification.findUnique).mockResolvedValue({
    id: "job:job-1",
  } as any);
  await syncJobNotifications();
  expect(sendPushNotification).toHaveBeenCalledWith("a", expect.objectContaining({ tag: "job:job-1" }));
  expect(db.notification.create).not.toHaveBeenCalled();
});
