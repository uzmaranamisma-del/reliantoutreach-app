import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({
  db: { mutationReceipt: { create: vi.fn(), update: vi.fn() } },
}));
import { db } from "@/lib/db";
import { once } from "@/lib/mutations";
const key = "93cf29c8-7056-4b36-a7db-8b88e9f64a17";
beforeEach(() => vi.resetAllMocks());
it("does not repeat a previously claimed external write", async () => {
  vi.mocked(db.mutationReceipt.create).mockRejectedValue({ code: "P2002" });
  const write = vi.fn();
  await expect(once("tenant-a", key, write)).rejects.toMatchObject({
    status: 409,
  });
  expect(write).not.toHaveBeenCalled();
});
it("keeps uncertain external writes in review instead of enabling replay", async () => {
  const write = vi.fn().mockRejectedValue(new Error("Unconfirmed response"));
  await expect(once("tenant-a", key, write)).rejects.toThrow(
    "Unconfirmed response",
  );
  expect(db.mutationReceipt.update).toHaveBeenCalledWith(
    expect.objectContaining({ data: { status: "review" } }),
  );
  expect(write).toHaveBeenCalledTimes(1);
});
it("does not perform external work if a receipt cannot be persisted", async () => {
  vi.mocked(db.mutationReceipt.create).mockRejectedValue(
    new Error("Database offline"),
  );
  const write = vi.fn();
  await expect(once("tenant-a", key, write)).rejects.toThrow(
    "Database offline",
  );
  expect(write).not.toHaveBeenCalled();
});
