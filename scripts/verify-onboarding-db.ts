import "dotenv/config";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { db } from "../src/lib/db";
import { encrypt } from "../src/lib/crypto";
import { onboardingStage, onboardingStatus } from "../src/server/onboarding";

async function main() {
  if (
    !["127.0.0.1", "localhost"].includes(
      new URL(process.env.DATABASE_URL || "").hostname,
    ) ||
    process.env.ALLOW_LOCAL_DB_TEST !== "yes"
  )
    throw new Error("Local database and ALLOW_LOCAL_DB_TEST=yes required.");
  const id = `onboarding-verification-${randomUUID()}`;
  // This test never runs the email worker or contacts Manyreach. All fixtures are removed.
  process.env.SMTP_HOST = "smtp.example.invalid";
  process.env.SMTP_USER = "test";
  process.env.SMTP_PASSWORD = "test";
  process.env.SMTP_FROM_EMAIL = "test@example.invalid";
  try {
    const actor = await db.user.findFirstOrThrow({
      where: { superadmin: true, disabled: false },
    });
    const pkg = await db.package.findFirstOrThrow({
      where: { name: "Growth", active: true, requiresLimitReview: false },
    });
    await db.client.create({
      data: {
        id,
        company: "Temporary onboarding verification",
        firstName: "Test",
        lastName: "",
        email: `${id}@example.invalid`,
        country: "PK",
        status: "DRAFT",
        packageId: pkg.id,
        mapping: {
          create: {
            providerId: -Math.floor(Math.random() * 2000000000 + 1),
            encryptedApiKey: encrypt("test-only-unused-key"),
          },
        },
      },
    });
    const job = await db.backgroundJob.create({
      data: {
        type: "client-onboarding",
        clientId: id,
        actorId: actor.id,
        total: 6,
        status: "processing",
      },
    });
    const payload = {
      stage: 5,
      counts: { campaigns: 0, prospects: 0, lists: 0, senders: 0, replies: 0 },
      missing: [],
    };
    await onboardingStage(job, payload);
    await onboardingStage(job, payload);
    assert.equal(await db.invitation.count({ where: { clientId: id } }), 1);
    assert.equal(
      await db.backgroundJob.count({
        where: { clientId: id, type: "invitation-email" },
      }),
      1,
    );
    assert.equal(
      (await db.client.findUniqueOrThrow({ where: { id } })).status,
      "ACTIVE",
    );
    const state = await onboardingStatus(id, job.id);
    assert.equal(state.job?.syncCompleted, true);
    assert.equal(state.email?.status, "pending");
    assert.equal(state.invitation?.sentAt, null);
    const second = await db.backgroundJob.create({
      data: {
        type: "client-onboarding",
        clientId: id,
        actorId: actor.id,
        total: 6,
        status: "processing",
      },
    });
    await onboardingStage(second, payload); // Exercises MySQL JSON-path lookup of the original invitation job.
    assert.equal(await db.invitation.count({ where: { clientId: id } }), 1);
    assert.equal(
      (await onboardingStatus(id, second.id)).email?.id,
      state.email?.id,
    );
    console.log(
      "PASS: MySQL sync publication, activation, invitation transaction, replay deduplication, JSON-path lookup and safe status. No emails sent.",
    );
  } finally {
    await db.backgroundJob.deleteMany({ where: { clientId: id } });
    await db.invitation.deleteMany({ where: { clientId: id } });
    await db.usageSnapshot.deleteMany({ where: { clientId: id } });
    await db.auditLog.deleteMany({ where: { clientId: id } });
    await db.manyreachClientspace.deleteMany({ where: { clientId: id } });
    await db.client.deleteMany({ where: { id } });
    await db.lease.deleteMany({ where: { key: `tenant:${id}` } });
    await db.$disconnect();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
