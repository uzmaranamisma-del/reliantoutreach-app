import { vi, beforeEach, expect, it } from "vitest";
vi.mock("@/lib/db", () => ({
  db: {
    clientMembership: { findFirst: vi.fn(), count: vi.fn(), update: vi.fn() },
    backgroundJob: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    manyreachClientspace: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/manyreach/client", () => ({ providerRequest: vi.fn() }));
vi.mock("@/lib/crypto", () => ({
  encrypt: (value: string) => `encrypted:${value}`,
}));
import { db } from "@/lib/db";
import { providerRequest } from "@/lib/manyreach/client";
import {
  cancelJob,
  changeMember,
  rotateConnection,
} from "@/server/admin-actions";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.$transaction).mockImplementation(async (fn: any) => fn(db));
});
it("rejects a membership from another tenant", async () => {
  vi.mocked(db.clientMembership.findFirst).mockResolvedValue(null);
  await expect(
    changeMember("admin", "tenant-A", {
      id: "tenant-B-member",
      role: "CLIENT_ADMIN",
    }),
  ).rejects.toThrow("Member not found");
  expect(db.clientMembership.findFirst).toHaveBeenCalledWith({
    where: { id: "tenant-B-member", clientId: "tenant-A" },
  });
  expect(db.clientMembership.update).not.toHaveBeenCalled();
});
it.each([
  { role: "CLIENT_ADMIN", disabled: false },
  { role: "CLIENT_OWNER", disabled: true },
])("protects the last active owner: %j", async (change) => {
  vi.mocked(db.clientMembership.findFirst).mockResolvedValue({
    id: "owner",
    role: "CLIENT_OWNER",
    disabled: false,
  } as any);
  vi.mocked(db.clientMembership.count).mockResolvedValue(0);
  await expect(
    changeMember("admin", "tenant-A", { id: "owner", ...change }),
  ).rejects.toThrow("another active owner");
  expect(db.clientMembership.update).not.toHaveBeenCalled();
});
it("refuses cancellation after a worker wins the claim", async () => {
  vi.mocked(db.backgroundJob.updateMany).mockResolvedValue({ count: 0 });
  await expect(cancelJob("admin", "job")).rejects.toThrow("Only a queued job");
  expect(db.auditLog.create).not.toHaveBeenCalled();
});
it("cancels queued work atomically and erases its payload", async () => {
  vi.mocked(db.backgroundJob.updateMany).mockResolvedValue({ count: 1 });
  await cancelJob("admin", "job");
  expect(db.backgroundJob.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: "job", status: { in: ["pending", "retry"] } },
      data: expect.objectContaining({ status: "cancelled", payload: null }),
    }),
  );
  expect(db.auditLog.create).toHaveBeenCalled();
});
it.each([
  { id: 42, keyType: "agency" },
  { id: 43, keyType: "clientspace" },
  { id: 42, keyType: "workspace" },
])(
  "rejects a replacement key outside the exact clientspace: %j",
  async (account) => {
    vi.mocked(db.manyreachClientspace.findUnique).mockResolvedValue({
      providerId: 42,
    } as any);
    vi.mocked(providerRequest).mockResolvedValue(account);
    await expect(
      rotateConnection("admin", "tenant-A", { apiKey: "test-only-key" }),
    ).rejects.toThrow("exact isolated clientspace");
    expect(db.manyreachClientspace.update).not.toHaveBeenCalled();
  },
);
it("rotates a workspace key while preserving its account scope", async () => {
  vi.mocked(db.manyreachClientspace.findUnique).mockResolvedValue({
    providerId: 42,
    providerType: "workspace",
  } as any);
  vi.mocked(providerRequest).mockResolvedValue({
    id: 42,
    keyType: "workspace",
  });
  await rotateConnection("admin", "tenant-A", { apiKey: "test-only-key" });
  expect(db.manyreachClientspace.update).toHaveBeenCalled();
});
