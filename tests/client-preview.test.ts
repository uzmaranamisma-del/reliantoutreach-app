import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/access", () => ({ admin: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    client: { findUnique: vi.fn() },
    usageSnapshot: { findUnique: vi.fn() },
    auditLog: { findMany: vi.fn() },
  },
}));
vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("Redirected");
  },
  notFound: () => {
    throw new Error("Not found");
  },
}));
vi.mock("@/components/shell", () => ({ Shell: () => null }));
vi.mock("@/features/portal/dashboard", () => ({ Dashboard: () => null }));
import { admin } from "@/lib/access";
import { db } from "@/lib/db";
import Page from "@/app/admin/client-preview/[id]/page";
beforeEach(() => vi.clearAllMocks());
it("does not read client data when administrator authorization fails", async () => {
  vi.mocked(admin).mockRejectedValue(new Error("Unauthorized"));
  await expect(
    Page({ params: Promise.resolve({ id: "private-client" }) }),
  ).rejects.toThrow("Redirected");
  expect(db.client.findUnique).not.toHaveBeenCalled();
});
it("uses saved client data and leaves unavailable metrics empty", async () => {
  vi.mocked(admin).mockResolvedValue({ user: { name: "Admin" } } as any);
  vi.mocked(db.client.findUnique).mockResolvedValue({
    id: "draft",
    company: "Saved company",
    firstName: "Owner",
    lastName: "",
    email: "private@example.com",
    status: "DRAFT",
    package: { name: "Growth", features: [] },
    permissions: [],
  } as any);
  vi.mocked(db.usageSnapshot.findUnique).mockResolvedValue(null);
  vi.mocked(db.auditLog.findMany).mockResolvedValue([]);
  const page = await Page({ params: Promise.resolve({ id: "draft" }) });
  expect(page.props.preview).toMatchObject({
    id: "draft",
    company: "Saved company",
    package: "Growth",
    snapshot: null,
    activity: [],
  });
  expect(page.props.preview).not.toHaveProperty("email");
  expect(db.auditLog.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { clientId: "draft" } }),
  );
});
