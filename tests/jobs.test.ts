import { vi, it, expect, beforeEach } from "vitest";
vi.mock("@/server/notifications", () => ({ syncJobNotifications: vi.fn() }));
vi.mock("@/lib/locks", () => ({
  withLease: (_key: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock("@/lib/mail", () => ({ sendMail: vi.fn() }));
vi.mock("@/lib/manyreach/client", () => ({
  forClient: vi.fn(),
  ProviderError: class extends Error {
    constructor(
      public providerStatus: number,
      public ambiguous = false,
    ) {
      super("Provider unavailable");
    }
  },
}));
vi.mock("@/lib/db", () => ({
  db: {
    backgroundJob: {
      updateMany: vi.fn(),
      findMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    appSetting: { upsert: vi.fn() },
    client: { findUniqueOrThrow: vi.fn() },
    apiLog: { deleteMany: vi.fn() },
    auditLog: { deleteMany: vi.fn() },
    webhookEvent: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    invitation: { deleteMany: vi.fn() },
    session: { deleteMany: vi.fn() },
    verification: { deleteMany: vi.fn() },
    requestBucket: { deleteMany: vi.fn() },
    mutationReceipt: { deleteMany: vi.fn() },
    $transaction: vi.fn(),
  },
}));
import { db } from "@/lib/db";
import { forClient, ProviderError } from "@/lib/manyreach/client";
import { processJobs } from "../src/server/jobs";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.client.findUniqueOrThrow).mockResolvedValue({
    status: "ACTIVE",
  } as any);
  vi.mocked(db.backgroundJob.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(db.backgroundJob.findMany).mockResolvedValue([
    {
      id: "j1",
      type: "reconcile",
      clientId: "A",
      attempts: 0,
      maxAttempts: 5,
      progress: 0,
    },
  ] as any);
});
it("retries transient failures with a future run time", async () => {
  vi.mocked(forClient).mockRejectedValue(new ProviderError(429));
  await processJobs();
  expect(db.backgroundJob.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ id: "j1" }),
      data: expect.objectContaining({
        status: "retry",
        runAfter: expect.any(Date),
      }),
    }),
  );
});
it("does not replay ambiguous writes", async () => {
  vi.mocked(forClient).mockRejectedValue(new ProviderError(503, true));
  await processJobs();
  expect(db.backgroundJob.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ status: "failed", payload: null }),
    }),
  );
});
it("does not process a job when another worker claims it", async () => {
  vi.mocked(db.backgroundJob.updateMany).mockResolvedValue({ count: 0 });
  await processJobs();
  expect(forClient).not.toHaveBeenCalled();
});
it("marks expired processing leases for manual review instead of replaying", async () => {
  vi.mocked(db.backgroundJob.findMany).mockResolvedValue([]);
  await processJobs();
  expect(db.backgroundJob.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ status: "processing" }),
      data: expect.objectContaining({ status: "failed", payload: null }),
    }),
  );
});
it("targets only the requested job without reporting a scheduled cron run", async () => {
  vi.mocked(db.backgroundJob.findMany).mockResolvedValue([]);
  await processJobs("chosen-job");
  expect(db.backgroundJob.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ id: "chosen-job" }),
    }),
  );
  expect(db.appSetting.upsert).not.toHaveBeenCalled();
  expect(db.backgroundJob.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        id: "chosen-job",
        status: "processing",
      }),
    }),
  );
});
