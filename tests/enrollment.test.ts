import { vi, beforeEach, expect, it } from "vitest";
vi.mock("@/lib/db", () => ({
  db: { backgroundJob: { create: vi.fn() }, auditLog: { create: vi.fn() } },
}));
vi.mock("@/lib/access", () => ({ tenant: vi.fn() }));
vi.mock("@/lib/locks", () => ({
  withLease: (_key: string, fn: () => unknown) => fn(),
}));
vi.mock("@/lib/mutations", () => ({
  once: (_client: string, _key: string, fn: () => unknown) => fn(),
}));
vi.mock("@/lib/manyreach/client", () => ({ forClient: vi.fn() }));
import { db } from "@/lib/db";
import { tenant } from "@/lib/access";
import { forClient } from "@/lib/manyreach/client";
import { opaque } from "@/lib/manyreach/public";
import { decrypt } from "@/lib/crypto";
import { queueEnrollment } from "@/server/enrollment";
const request = new Request("http://localhost:3000/api/portal/enrollments");
const provider = vi.fn();
const key = "e2ea0010-950c-4df3-af00-060fcfbdf4cc";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENCRYPTION_KEY = "1".repeat(64);
  vi.mocked(tenant).mockResolvedValue({
    client: { id: "A" },
    user: { id: "owner" },
    can: () => true,
  } as any);
  vi.mocked(forClient).mockResolvedValue({ request: provider } as any);
  vi.mocked(db.backgroundJob.create).mockResolvedValue({ id: "job" } as any);
});
it("rejects prospect handles issued for another tenant before provider mutation", async () => {
  await expect(
    queueEnrollment(request, {
      key,
      prospects: [opaque("B", "prospects", "1")],
      campaign: opaque("A", "campaigns", "2"),
    }),
  ).rejects.toThrow();
  expect(provider).not.toHaveBeenCalled();
  expect(db.backgroundJob.create).not.toHaveBeenCalled();
});
it("refuses enrollment into a running campaign", async () => {
  provider.mockResolvedValue({ status: "Running" });
  await expect(
    queueEnrollment(request, {
      key,
      prospects: [opaque("A", "prospects", "1")],
      campaign: opaque("A", "campaigns", "2"),
    }),
  ).rejects.toThrow("Pause the campaign");
  expect(db.backgroundJob.create).not.toHaveBeenCalled();
});
it("requires campaign edit permission in addition to import permission", async () => {
  vi.mocked(tenant).mockResolvedValue({
    client: { id: "A" },
    user: { id: "owner" },
    can: () => false,
  } as any);
  await expect(
    queueEnrollment(request, {
      key,
      prospects: [opaque("A", "prospects", "1")],
      campaign: opaque("A", "campaigns", "2"),
    }),
  ).rejects.toThrow("Campaign editing permission");
  expect(db.backgroundJob.create).not.toHaveBeenCalled();
});
it("queues encrypted resolved handles without sending outreach", async () => {
  provider.mockResolvedValue({ status: "Draft" });
  await expect(
    queueEnrollment(request, {
      key,
      prospects: [opaque("A", "prospects", "1")],
      campaign: opaque("A", "campaigns", "2"),
    }),
  ).resolves.toEqual({ id: "job", total: 1 });
  const data = vi.mocked(db.backgroundJob.create).mock.calls[0][0].data;
  expect(JSON.parse(decrypt(data.payload!))).toMatchObject({
    prospectIds: ["1"],
    campaignId: "2",
  });
  expect(provider).toHaveBeenCalledTimes(1);
  expect(provider).toHaveBeenCalledWith("/campaigns/2");
});
