import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({
  db: {
    client: { findUnique: vi.fn() },
    usageSnapshot: { findUnique: vi.fn() },
    clientMembership: { findMany: vi.fn() },
    invitation: { findMany: vi.fn() },
    notification: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/manyreach/client", () => ({ forClient: vi.fn() }));
import { db } from "@/lib/db";
import { forClient } from "@/lib/manyreach/client";
import { clientPreviewData } from "@/server/client-preview-data";
const base = {
  id: "A",
  company: "Client",
  firstName: "Owner",
  lastName: "",
  email: "owner@example.test",
  phone: null,
  website: null,
  industry: null,
  country: "PK",
  timezone: "UTC",
  status: "DRAFT",
  mapping: null,
  limits: [],
  package: {
    name: "Growth",
    description: "Plan",
    price: 1000,
    setupPrice: 2500,
    currency: "USD",
    billingLabel: "per month",
    minimumMonths: 3,
    setupIncludes: [],
    monthlyIncludes: [],
    commercialTerms: "Terms",
    limits: [],
  },
};
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENCRYPTION_KEY = "1".repeat(64);
  vi.mocked(db.client.findUnique).mockResolvedValue(base as any);
});
it("returns a safe empty resource page before Manyreach is connected", async () => {
  const result = await clientPreviewData("A", "campaigns", {});
  expect(result).toMatchObject({
    connected: false,
    items: [],
    pagination: { totalItems: 0 },
  });
  expect(forClient).not.toHaveBeenCalled();
});
it("loads connected data and converts provider identifiers to tenant-bound opaque IDs", async () => {
  vi.mocked(db.client.findUnique).mockResolvedValue({
    ...base,
    mapping: { lastSyncAt: new Date(), lastError: null },
  } as any);
  const request = vi
    .fn()
    .mockResolvedValue({
      items: [{ campaignId: 42, name: "Real campaign", sentCount: 5 }],
      pagination: {
        currentPage: 1,
        pageSize: 25,
        totalItems: 1,
        nextCursor: 99,
      },
    });
  vi.mocked(forClient).mockResolvedValue({ request } as any);
  const result: any = await clientPreviewData("A", "campaigns", {});
  expect(result.items[0]).toMatchObject({
    name: "Real campaign",
    sentCount: 5,
  });
  expect(result.items[0].id).not.toBe(42);
  expect(JSON.stringify(result)).not.toContain("campaignId");
  expect(request).toHaveBeenCalledWith(
    "/campaigns",
    "GET",
    undefined,
    expect.objectContaining({ "pageQuery.includeArchived": true }),
  );
});
it("rejects unsupported preview sections instead of proxying arbitrary provider paths", async () => {
  await expect(clientPreviewData("A", "secrets", {})).rejects.toThrow();
  expect(forClient).not.toHaveBeenCalled();
});
