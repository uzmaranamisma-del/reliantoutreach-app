import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({
  db: {
    package: { findFirst: vi.fn(), findMany: vi.fn() },
    client: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/access", () => ({
  admin: vi.fn().mockResolvedValue({ user: { id: "admin" } }),
}));
vi.mock("@/lib/locks", () => ({
  withLease: (_key: string, fn: () => unknown) => fn(),
}));
vi.mock("@/lib/manyreach/client", () => ({
  agencyRequest: vi.fn(),
  providerRequest: vi.fn(),
}));
vi.mock("@/server/invitations", () => ({ createInvitation: vi.fn() }));
import { db } from "@/lib/db";
import { agencyRequest, providerRequest } from "@/lib/manyreach/client";
import { createInvitation } from "@/server/invitations";
import { createClient } from "@/server/admin";
import { activateClient } from "@/server/admin-actions";
import { GET } from "@/app/api/admin/[...path]/route";
const input = {
  company: "Test workspace",
  firstName: "Owner",
  lastName: "",
  email: "owner@example.com",
  country: "PK",
  timezone: "Asia/Karachi",
  packageId: "launch",
  connection: "later",
  saveAsDraft: true,
  sendNow: true,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.$transaction).mockImplementation(async (fn: any) => fn(db));
  vi.mocked(db.package.findFirst).mockResolvedValue({
    id: "launch",
    active: false,
    requiresLimitReview: true,
    serviceType: "EMAIL",
  } as any);
  vi.mocked(db.client.create).mockResolvedValue({ id: "draft-client" } as any);
});
it("offers draft email packages for onboarding and supplies permission fields", async () => {
  vi.mocked(db.package.findMany).mockResolvedValue([]);
  const response = await GET(
    new Request(
      "http://localhost:3000/api/admin/packages/options?purpose=onboarding",
    ),
    { params: Promise.resolve({ path: ["packages", "options"] }) },
  );
  expect(response.status).toBe(200);
  expect(db.package.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { serviceType: "EMAIL" },
      select: expect.objectContaining({
        active: true,
        features: { select: { key: true, enabled: true } },
      }),
    }),
  );
});
it("keeps normal assignment restricted to reviewed active email packages", async () => {
  vi.mocked(db.package.findMany).mockResolvedValue([]);
  await GET(new Request("http://localhost:3000/api/admin/packages/options"), {
    params: Promise.resolve({ path: ["packages", "options"] }),
  });
  expect(db.package.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { serviceType: "EMAIL", active: true, requiresLimitReview: false },
    }),
  );
});
it("saves an inactive draft without creating a provider space or sending an invitation", async () => {
  await expect(createClient("admin", input)).resolves.toEqual({
    id: "draft-client",
    status: "DRAFT",
  });
  const data = vi.mocked(db.client.create).mock.calls[0][0].data;
  expect(data).toMatchObject({ status: "DRAFT", packageId: "launch" });
  expect(data).not.toHaveProperty("sendNow");
  expect(data).not.toHaveProperty("mapping");
  expect(agencyRequest).not.toHaveBeenCalled();
  expect(providerRequest).not.toHaveBeenCalled();
  expect(createInvitation).not.toHaveBeenCalled();
});
it("rejects a missing or non-email package", async () => {
  vi.mocked(db.package.findFirst).mockResolvedValue(null);
  await expect(createClient("admin", input)).rejects.toThrow(
    "email outreach package",
  );
  expect(db.client.create).not.toHaveBeenCalled();
});
it("cannot bypass active-package requirements by omitting draft mode", async () => {
  vi.mocked(db.package.findFirst).mockResolvedValue(null);
  await expect(
    createClient("admin", {
      ...input,
      connection: "existing",
      clientspaceId: 12,
      saveAsDraft: false,
    }),
  ).rejects.toThrow("active package");
  expect(agencyRequest).not.toHaveBeenCalled();
});
it("cannot activate a workspace while its package limits are unreviewed", async () => {
  vi.mocked(db.client.findUnique).mockResolvedValue({
    package: { active: true, requiresLimitReview: true, serviceType: "EMAIL" },
    mapping: { providerId: 12 },
  } as any);
  await expect(activateClient("admin", "draft-client")).rejects.toThrow(
    "Review the package limits",
  );
  expect(db.client.update).not.toHaveBeenCalled();
});
it("cannot activate an unconnected workspace", async () => {
  vi.mocked(db.client.findUnique).mockResolvedValue({
    package: { active: true, requiresLimitReview: false, serviceType: "EMAIL" },
    mapping: null,
  } as any);
  await expect(activateClient("admin", "draft-client")).rejects.toThrow(
    "Add and verify",
  );
  expect(db.client.update).not.toHaveBeenCalled();
});
it("activates a reviewed connected workspace without sending an invitation", async () => {
  vi.mocked(db.client.findUnique).mockResolvedValue({
    package: { active: true, requiresLimitReview: false, serviceType: "EMAIL" },
    mapping: { providerId: 12 },
  } as any);
  await activateClient("admin", "draft-client");
  expect(db.client.update).toHaveBeenCalledWith({
    where: { id: "draft-client" },
    data: { status: "ACTIVE" },
  });
  expect(createInvitation).not.toHaveBeenCalled();
});
