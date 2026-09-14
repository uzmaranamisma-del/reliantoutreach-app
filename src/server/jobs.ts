import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/crypto";
import { sendMail } from "@/lib/mail";
import {
  forClient,
  ProviderError,
  type ProviderPage,
} from "@/lib/manyreach/client";
import { AppError } from "@/lib/errors";
import { withLease } from "@/lib/locks";
import {
  getEffectivePermission,
  getEffectiveLimit,
  withinLimit,
} from "@/lib/permissions";
export async function processJobs() {
  return withLease(
    "cron:processor",
    async () => {
      const started = Date.now();
      let processed = 0;
      // Never blindly replay jobs whose worker died during a non-idempotent external write.
      await db.backgroundJob.updateMany({
        where: {
          status: "processing",
          lockedAt: { lt: new Date(Date.now() - 180000) },
        },
        data: {
          status: "failed",
          error: "Interrupted; verify the external result before re-importing.",
          payload: null,
          lockToken: null,
        },
      });
      const jobs = await db.backgroundJob.findMany({
        where: {
          status: { in: ["pending", "retry"] },
          runAfter: { lte: new Date() },
        },
        take: 5,
        orderBy: { runAfter: "asc" },
      });
      for (const job of jobs) {
        if (Date.now() - started > 35000) break;
        const lockToken = randomUUID();
        const claim = await db.backgroundJob.updateMany({
          where: { id: job.id, status: { in: ["pending", "retry"] } },
          data: {
            status: "processing",
            lockedAt: new Date(),
            lockToken,
            attempts: { increment: 1 },
          },
        });
        if (!claim.count) continue;
        try {
          const payload = job.payload ? JSON.parse(decrypt(job.payload)) : {};
          let done = true,
            progress = job.progress;
          if (job.type === "invitation-email") {
            const invitation = await db.invitation.findUnique({
              where: { id: payload.invitationId },
            });
            if (
              invitation &&
              !invitation.revokedAt &&
              !invitation.acceptedAt &&
              invitation.expiresAt > new Date()
            ) {
              await sendMail(
                invitation.email,
                "You've been invited to ReliantOutreach",
                `Hello ${invitation.name},\n\nYour outreach workspace is ready.\n\nAccept your invitation:\n${process.env.NEXT_PUBLIC_APP_URL}/invite/${payload.token}\n\nThis link expires in ${process.env.INVITATION_EXPIRY_HOURS || 48} hours.\n\nReliantOutreach`,
              );
              await db.invitation.update({
                where: { id: invitation.id },
                data: { sentAt: new Date() },
              });
            }
          } else if (job.type === "prospect-import") {
            await withLease(`tenant:${job.clientId}`, async () => {
              const client = await db.client.findUniqueOrThrow({
                where: { id: job.clientId! },
                include: {
                  package: { include: { features: true, limits: true } },
                  permissions: true,
                  limits: true,
                },
              });
              const actor = await db.user.findUnique({
                  where: { id: job.actorId! },
                }),
                member = await db.clientMembership.findUnique({
                  where: {
                    userId_clientId: {
                      userId: job.actorId!,
                      clientId: client.id,
                    },
                  },
                });
              if (
                client.status !== "ACTIVE" ||
                !actor ||
                actor.disabled ||
                (!actor.superadmin && (!member || member.disabled)) ||
                !getEffectivePermission(
                  "prospects.import",
                  actor.superadmin ? "CLIENT_OWNER" : member!.role,
                  client.package.features,
                  client.permissions,
                )
              )
                throw new AppError(
                  403,
                  "Import access is no longer available.",
                );
              const p = await forClient(client.id);
              const batch = payload.rows.slice(progress, progress + 100);
              const usage = await p.request<ProviderPage>(
                "/prospects",
                "GET",
                undefined,
                { limit: 1 },
              );
              // Conservative reservation: duplicates also consume temporary capacity, never undercount new rows.
              if (
                !withinLimit(
                  usage.pagination.totalItems,
                  batch.length,
                  getEffectiveLimit(
                    "prospects",
                    client.package.limits,
                    client.limits,
                  ),
                )
              )
                throw new AppError(403, "Prospect limit reached.");
              const imported = await p.request(
                "/prospects/bulk",
                "POST",
                { prospects: batch },
                { campaignId: payload.campaignId, listId: payload.listId },
              );
              if (
                !Number.isInteger(imported.totalProcessed) ||
                imported.totalProcessed + (imported.duplicatesInBatch || 0) !==
                  batch.length
              )
                throw new AppError(
                  502,
                  "The import result is incomplete or unconfirmed. Review the actual prospects before re-importing.",
                );
              progress += batch.length;
              done = progress >= payload.rows.length;
            });
          } else if (job.type === "reconcile") {
            const p = await forClient(job.clientId!);
            const counts: Record<string, number> = {};
            for (const kind of ["campaigns", "senders", "prospects", "lists"]) {
              const result = await p.request<ProviderPage>(
                `/${kind}`,
                "GET",
                undefined,
                kind === "campaigns"
                  ? { "pageQuery.limit": 1, "pageQuery.includeArchived": true }
                  : { limit: 1 },
              );
              counts[kind] = result.pagination.totalItems;
            }
            counts.teamMembers = await db.clientMembership.count({
              where: { clientId: job.clientId! },
            });
            await db.usageSnapshot.upsert({
              where: {
                clientId_period: { clientId: job.clientId!, period: "current" },
              },
              create: {
                clientId: job.clientId!,
                period: "current",
                values: counts,
              },
              update: { values: counts, capturedAt: new Date() },
            });
            await db.manyreachClientspace.update({
              where: { clientId: job.clientId! },
              data: { lastSyncAt: new Date(), lastError: null },
            });
          } else throw new AppError(422, "Unknown job type.");
          await db.backgroundJob.updateMany({
            where: { id: job.id, lockToken },
            data: {
              status: done ? "completed" : "pending",
              progress,
              completedAt: done ? new Date() : null,
              payload: done ? null : encrypt(JSON.stringify(payload)),
              attempts: done ? job.attempts + 1 : 0,
              lockedAt: null,
              lockToken: null,
              runAfter: new Date(Date.now() + 1000),
              error: null,
            },
          });
          processed++;
        } catch (error) {
          const transient =
            error instanceof ProviderError &&
            !error.ambiguous &&
            [429, 500, 502, 503, 504].includes(error.providerStatus);
          const retry = transient && job.attempts + 1 < job.maxAttempts;
          await db.backgroundJob.updateMany({
            where: { id: job.id, lockToken },
            data: {
              status: retry ? "retry" : "failed",
              error:
                error instanceof AppError
                  ? error.message
                  : "Delivery failed. Check the system configuration.",
              runAfter: new Date(
                Date.now() + Math.min(3600000, 60000 * 2 ** job.attempts),
              ),
              lockToken: null,
              lockedAt: null,
              ...(!retry ? { payload: null } : {}),
            },
          });
        }
      }
      await db.appSetting.upsert({
        where: { key: "cron.lastRun" },
        create: { key: "cron.lastRun", value: new Date().toISOString() },
        update: { value: new Date().toISOString() },
      });
      await cleanup();
      return { processed };
    },
    120,
  );
}
export async function scheduleReconciliation() {
  const slot = Math.floor(Date.now() / 900000);
  const cursor = await db.appSetting.findUnique({
    where: { key: "reconcile.cursor" },
  });
  const after = typeof cursor?.value === "string" ? cursor.value : undefined;
  const clients = await db.client.findMany({
    where: {
      status: "ACTIVE",
      mapping: { isNot: null },
      ...(after ? { id: { gt: after } } : {}),
    },
    orderBy: { id: "asc" },
    take: 10,
  });
  for (const c of clients)
    await db.backgroundJob.upsert({
      where: { dedupeKey: `sync:${c.id}:${slot}` },
      create: {
        type: "reconcile",
        clientId: c.id,
        dedupeKey: `sync:${c.id}:${slot}`,
      },
      update: {},
    });
  await db.appSetting.upsert({
    where: { key: "reconcile.cursor" },
    create: {
      key: "reconcile.cursor",
      value: clients.length === 10 ? clients[9].id : "",
    },
    update: { value: clients.length === 10 ? clients[9].id : "" },
  });
}
async function cleanup() {
  const age = (days: number) => new Date(Date.now() - days * 86400000);
  await db.$transaction([
    db.apiLog.deleteMany({
      where: {
        createdAt: { lt: age(Number(process.env.API_LOG_RETENTION_DAYS || 7)) },
      },
    }),
    db.auditLog.deleteMany({
      where: {
        createdAt: { lt: age(Number(process.env.AUDIT_RETENTION_DAYS || 90)) },
      },
    }),
    db.backgroundJob.deleteMany({
      where: {
        status: { in: ["completed", "failed"] },
        updatedAt: { lt: age(7) },
      },
    }),
    db.backgroundJob.updateMany({
      where: {
        status: { in: ["pending", "retry"] },
        createdAt: { lt: age(2) },
      },
      data: { status: "failed", payload: null, error: "Job expired." },
    }),
    db.webhookEvent.deleteMany({ where: { createdAt: { lt: age(7) } } }),
    db.notification.deleteMany({ where: { createdAt: { lt: age(30) } } }),
    db.invitation.deleteMany({ where: { expiresAt: { lt: age(30) } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
    db.verification.deleteMany({ where: { expiresAt: { lt: age(1) } } }),
    db.requestBucket.deleteMany({ where: { windowAt: { lt: age(2) } } }),
    db.mutationReceipt.deleteMany({ where: { createdAt: { lt: age(30) } } }),
  ]);
}
