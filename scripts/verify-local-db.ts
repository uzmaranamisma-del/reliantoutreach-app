import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { withLease } from "../src/lib/locks";

async function main() {
  const url = new URL(process.env.DATABASE_URL || "");
  if (
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    process.env.ALLOW_LOCAL_DB_TEST !== "yes"
  )
    throw new Error(
      "This test requires a local database and ALLOW_LOCAL_DB_TEST=yes.",
    );
  const id = `verification-${randomUUID()}`,
    leaseKey = `verification:${id}`;
  try {
    await db.backgroundJob.create({
      data: { id, type: "local-verification", payload: "test-only" },
    });
    const results = await Promise.all([
      db.backgroundJob.updateMany({
        where: { id, status: "pending" },
        data: { status: "processing", lockToken: "test-claim" },
      }),
      db.backgroundJob.updateMany({
        where: { id, status: "pending" },
        data: { status: "cancelled", payload: null },
      }),
    ]);
    assert.equal(
      results.reduce((sum, r) => sum + r.count, 0),
      1,
      "Exactly one claim/cancellation may win",
    );
    let entered = 0;
    await withLease(leaseKey, async () => {
      entered++;
      await assert.rejects(
        withLease(leaseKey, async () => {
          entered++;
        }),
        /Another operation/,
      );
    });
    assert.equal(entered, 1);
    await withLease(leaseKey, async () => {
      entered++;
    });
    assert.equal(entered, 2, "Released leases must be reusable");
    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.appSetting.create({ data: { key: id, value: "test-only" } });
        throw new Error("Intentional rollback");
      }),
      /Intentional rollback/,
    );
    assert.equal(await db.appSetting.findUnique({ where: { key: id } }), null);
    console.log(
      "PASS: MySQL claim/cancellation race, lease exclusion/release, transaction rollback.",
    );
  } finally {
    await db.backgroundJob.deleteMany({
      where: { id, type: "local-verification" },
    });
    await db.lease.deleteMany({ where: { key: leaseKey } });
    await db.appSetting.deleteMany({ where: { key: id } });
    await db.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
