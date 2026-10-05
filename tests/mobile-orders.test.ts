import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  db: {
    packageRequest: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    package: { findUnique: vi.fn() },
    client: { update: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));
vi.mock("@/lib/locks", () => ({
  withLease: async (_key: string, fn: () => Promise<unknown>) => fn(),
}));
import {
  requestPackage,
  updatePackageRequest,
} from "@/server/package-requests";
import type { Tenant } from "@/lib/access";
const ctx = {
  role: "CLIENT_OWNER",
  client: { id: "c1", packageId: "old" },
  user: { id: "u1" },
} as Tenant;
const input = {
  packageId: "growth",
  key: "c671e068-4f40-4b0c-9788-78ef2cd4462b",
  confirm: true,
};
beforeEach(() => vi.resetAllMocks());
it("does not let regular members request a package change", async () => {
  await expect(
    requestPackage({ ...ctx, role: "CLIENT_MEMBER" }, input),
  ).rejects.toMatchObject({ status: 403 });
  expect(mocks.db.packageRequest.create).not.toHaveBeenCalled();
});
it("does not activate a plan after its quoted price changes", async () => {
  const update = vi.fn();
  mocks.db.packageRequest.findFirst.mockResolvedValue({ id: "order", status: "approved", packageId: "growth", price: "1000", setupPrice: "2500", currency: "USD" });
  mocks.db.package.findUnique.mockResolvedValue({ id: "growth", active: true, serviceType: "EMAIL", price: "1100", setupPrice: "2500", currency: "USD" });
  mocks.db.$transaction.mockImplementation(fn => fn({ ...mocks.db, packageRequest: { ...mocks.db.packageRequest, update } }));
  await expect(updatePackageRequest("c1", "admin", { id: "order", status: "activated", confirm: true }, true)).rejects.toMatchObject({ status: 409 });
  expect(mocks.db.client.update).not.toHaveBeenCalled();
});
it("activates the approved email plan and records its status in one transaction", async () => {
  const update = vi.fn().mockResolvedValue({ id: "order", status: "activated" });
  mocks.db.packageRequest.findFirst.mockResolvedValue({ id: "order", status: "approved", packageId: "growth", price: "1000", setupPrice: "2500", currency: "USD", history: [] });
  mocks.db.package.findUnique.mockResolvedValue({ id: "growth", active: true, serviceType: "EMAIL", price: "1000", setupPrice: "2500", currency: "USD" });
  mocks.db.$transaction.mockImplementation(fn => fn({ ...mocks.db, packageRequest: { ...mocks.db.packageRequest, update } }));
  await updatePackageRequest("c1", "admin", { id: "order", status: "activated", confirm: true }, true);
  expect(mocks.db.client.update).toHaveBeenCalledWith({ where: { id: "c1" }, data: { packageId: "growth" } });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: "activated", notificationPending: true }) }));
});
it("replays an existing request safely after a lost response", async () => {
  mocks.db.packageRequest.findUnique.mockResolvedValue({
    id: "already-created",
  });
  expect(await requestPackage(ctx, input)).toEqual({ id: "already-created" });
  expect(mocks.db.packageRequest.create).not.toHaveBeenCalled();
});
it("blocks a second concurrent pending request", async () => {
  mocks.db.packageRequest.findFirst.mockResolvedValue({ id: "pending" });
  await expect(requestPackage(ctx, input)).rejects.toMatchObject({
    status: 409,
  });
});
it("client cancellation cannot target another workspace's order", async () => {
  mocks.db.packageRequest.findFirst.mockResolvedValue(null);
  await expect(
    updatePackageRequest(
      "c1",
      "u1",
      { id: "other-order", status: "cancelled", confirm: true },
      false,
    ),
  ).rejects.toMatchObject({ status: 404 });
  expect(mocks.db.packageRequest.findFirst).toHaveBeenCalledWith({
    where: { id: "other-order", clientId: "c1" },
  });
});
it("prevents clients approving their own requests", async () => {
  await expect(
    updatePackageRequest(
      "c1",
      "u1",
      { id: "order", status: "approved", confirm: true },
      false,
    ),
  ).rejects.toMatchObject({ status: 403 });
});
it("cannot reactivate a completed or cancelled order", async () => {
  mocks.db.packageRequest.findFirst.mockResolvedValue({
    id: "order",
    status: "cancelled",
  });
  await expect(
    updatePackageRequest(
      "c1",
      "admin",
      { id: "order", status: "activated", confirm: true },
      true,
    ),
  ).rejects.toMatchObject({ status: 409 });
});
