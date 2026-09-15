import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { encrypt, hash, token } from "@/lib/crypto";
import { withLease } from "@/lib/locks";
import { providerRequest } from "@/lib/manyreach/client";
import { teamCapacity } from "./invitations";
import { mailConfigured } from "@/lib/mail";
import { syncDataStage, syncValues } from "./sync-data";

export const syncStages = [
  "Campaigns",
  "Prospects",
  "Lists",
  "Senders",
  "Replies",
  "Activate & invite",
];
function readyPackage(pkg: {
  active: boolean;
  requiresLimitReview: boolean;
  serviceType: string;
}) {
  if (!pkg.active || pkg.requiresLimitReview || pkg.serviceType !== "EMAIL")
    throw new AppError(
      422,
      "Choose an active email package with reviewed limits.",
    );
}

async function resolveIsolatedKey(
  suppliedKey: string,
  clientId: string,
  company: string,
) {
  const bucket = `onboarding:${clientId}`;
  let account = await providerRequest(suppliedKey, bucket, "/account");
  const keyType = String(account.keyType).toLowerCase();
  if (["clientspace", "workspace"].includes(keyType))
    return {
      apiKey: suppliedKey,
      providerId: account.id,
      providerType: keyType,
    };
  if (!["organization", "agency"].includes(keyType))
    throw new AppError(422, "The API key account type is not supported.");

  const matches: any[] = [];
  for (const providerType of ["workspace", "clientspace"]) {
    let cursor: string | number | undefined;
    let scanned = 0;
    const seen = new Set<string>();
    do {
      const page = await providerRequest<any>(
        suppliedKey,
        bucket,
        `/${providerType}s`,
        "GET",
        undefined,
        { limit: 100, startingAfter: cursor },
      );
      if (
        !Array.isArray(page.items) ||
        !Number.isSafeInteger(page.pagination?.totalItems) ||
        page.pagination.totalItems < 0
      )
        throw new AppError(502, "Manyreach accounts could not be read.");
      scanned += page.items.length;
      matches.push(
        ...page.items
          .filter(
            (space: any) =>
              String(space.title || "")
                .trim()
                .toLowerCase() === company.trim().toLowerCase(),
          )
          .map((space: any) => ({ ...space, providerType })),
      );
      const next = page.pagination.nextCursor;
      if (!next && scanned !== page.pagination.totalItems)
        throw new AppError(
          502,
          "Manyreach account pages were incomplete. Retry the lookup.",
        );
      if (
        next &&
        (!page.items.length ||
          seen.has(String(next)) ||
          scanned >= page.pagination.totalItems)
      )
        throw new AppError(502, "Manyreach account pages did not advance.");
      if (next) seen.add(String(next));
      cursor = next || undefined;
    } while (cursor);
  }
  if (matches.length !== 1)
    throw new AppError(
      422,
      `No unique Manyreach Workspace or Clientspace named "${company}" was found. Enter its own API key directly, or match the client company name to the account title.`,
    );
  const space = matches[0];
  const expectedId = space[`${space.providerType}Id`];
  if (
    !Number.isSafeInteger(expectedId) ||
    expectedId < 1 ||
    typeof space.apiKey !== "string" ||
    space.apiKey.length < 8
  )
    throw new AppError(
      502,
      "The matching Manyreach Subaccount has no usable API key.",
    );
  account = await providerRequest(space.apiKey, bucket, "/account");
  if (
    String(account.keyType).toLowerCase() !== space.providerType ||
    account.id !== expectedId
  )
    throw new AppError(
      502,
      "The matching Manyreach Subaccount identity could not be verified.",
    );
  return {
    apiKey: space.apiKey,
    providerId: account.id,
    providerType: space.providerType as string,
  };
}
export async function queueOnboarding(
  actorId: string,
  clientId: string,
  input: unknown,
) {
  const data = z
    .object({
      apiKey: z.string().trim().min(8).max(2000).optional(),
      key: z.uuid(),
    })
    .parse(input);
  return withLease(`tenant:${clientId}`, async () => {
    const client = await db.client.findUniqueOrThrow({
      where: { id: clientId },
      include: { package: true, mapping: true },
    });
    if (client.status === "SUSPENDED")
      throw new AppError(
        422,
        "Reactivate the suspended workspace before synchronizing.",
      );
    readyPackage(client.package);
    const existing = await db.backgroundJob.findFirst({
      where: {
        clientId,
        type: "client-onboarding",
        OR: [
          { dedupeKey: `onboard:${clientId}:${data.key}` },
          { status: { in: ["pending", "retry", "processing"] } },
        ],
      },
    });
    if (existing) return { id: existing.id };
    let providerId = client.mapping?.providerId;
    let providerType = client.mapping?.providerType ?? "clientspace";
    let isolatedKey: string | undefined;
    if (data.apiKey) {
      const resolved = await resolveIsolatedKey(
        data.apiKey,
        clientId,
        client.company,
      );
      if (!Number.isSafeInteger(resolved.providerId) || resolved.providerId < 1)
        throw new AppError(502, "The Manyreach account identity is invalid.");
      if (
        providerId &&
        (providerId !== resolved.providerId ||
          providerType !== resolved.providerType)
      )
        throw new AppError(
          422,
          "This key belongs to a different account than the saved connection.",
        );
      providerId = resolved.providerId;
      providerType = resolved.providerType;
      isolatedKey = resolved.apiKey;
      const assigned = await db.manyreachClientspace.findUnique({
        where: {
          providerType_providerId: {
            providerType,
            providerId: resolved.providerId as number,
          },
        },
      });
      if (assigned && assigned.clientId !== clientId)
        throw new AppError(
          409,
          "This clientspace is already assigned to another client.",
        );
    }
    if (!providerId)
      throw new AppError(422, "Enter the client's Manyreach API key.");
    return db.$transaction(async (tx) => {
      if (isolatedKey)
        await tx.manyreachClientspace.upsert({
          where: { clientId },
          create: {
            clientId,
            providerId: providerId!,
            providerType,
            encryptedApiKey: encrypt(isolatedKey),
          },
          update: { encryptedApiKey: encrypt(isolatedKey), lastError: null },
        });
      const job = await tx.backgroundJob.create({
        data: {
          type: "client-onboarding",
          clientId,
          actorId,
          total: syncStages.length,
          dedupeKey: `onboard:${clientId}:${data.key}`,
          payload: encrypt(
            JSON.stringify({ stage: 0, counts: {}, missing: [] }),
          ),
        },
      });
      await tx.auditLog.create({
        data: {
          clientId,
          actorId,
          resourceId: job.id,
          action: "client.sync-and-invite-queued",
        },
      });
      return { id: job.id };
    });
  });
}

export async function onboardingStage(
  job: { id: string; clientId: string | null; actorId: string | null },
  payload: any,
) {
  return withLease(
    `tenant:${job.clientId}`,
    async () => {
      const client = await db.client.findUniqueOrThrow({
        where: { id: job.clientId! },
        include: { package: true, mapping: true },
      });
      const actor = await db.user.findUnique({ where: { id: job.actorId! } });
      if (!actor?.superadmin || actor.disabled || client.status === "SUSPENDED")
        throw new AppError(
          403,
          "Administrator or workspace access changed. Review the sync before retrying.",
        );
      readyPackage(client.package);
      const stage = Number(payload.stage || 0);
      if (!Number.isInteger(stage) || stage < 0 || stage > 5)
        throw new AppError(422, "Invalid sync progress.");
      if (stage < 5) {
        await syncDataStage(client.id, payload);
        return { done: false, progress: payload.stage };
      }
      const owner = await db.clientMembership.findFirst({
        where: {
          clientId: client.id,
          disabled: false,
          user: { email: client.email, disabled: false },
        },
      });
      if (!owner && !mailConfigured())
        throw new AppError(
          503,
          "Data checks passed, but SMTP is not configured. Add SMTP credentials, then retry Sync & Invite to finish setup.",
        );
      if (!owner) await teamCapacity(client.id, 1, client.email);
      const counts = syncValues(
        payload,
        await db.clientMembership.count({ where: { clientId: client.id } }),
      );
      const result = await db.$transaction(async (tx) => {
        await tx.usageSnapshot.upsert({
          where: {
            clientId_period: { clientId: client.id, period: "current" },
          },
          create: { clientId: client.id, period: "current", values: counts },
          update: { values: counts, capturedAt: new Date() },
        });
        await tx.manyreachClientspace.update({
          where: { clientId: client.id },
          data: { lastSyncAt: new Date(), lastError: null },
        });
        await tx.client.update({
          where: { id: client.id },
          data: { status: "ACTIVE" },
        });
        let invitationId: string | null = null,
          invitationJobId: string | null = null;
        if (!owner) {
          // A committed publication can be revisited after interruption; never duplicate its email job.
          let emailJob = await tx.backgroundJob.findUnique({
            where: { dedupeKey: `onboard-invite:${job.id}` },
          });
          if (!emailJob) {
            const pending = await tx.invitation.findFirst({
              where: {
                clientId: client.id,
                email: client.email,
                acceptedAt: null,
                revokedAt: null,
                expiresAt: { gt: new Date() },
              },
              orderBy: { createdAt: "desc" },
            });
            if (pending)
              emailJob = await tx.backgroundJob.findFirst({
                where: {
                  clientId: client.id,
                  type: "invitation-email",
                  OR: [
                    { dedupeKey: `invite:${pending.id}` },
                    { result: { path: "$.invitationId", equals: pending.id } },
                  ],
                },
              });
            if (emailJob) invitationId = pending!.id;
          }
          if (emailJob) {
            invitationJobId = emailJob.id;
            invitationId ||= (emailJob.result as any)?.invitationId || null;
          } else {
            const raw = token();
            await tx.invitation.updateMany({
              where: {
                clientId: client.id,
                email: client.email,
                acceptedAt: null,
                revokedAt: null,
              },
              data: { revokedAt: new Date() },
            });
            const invite = await tx.invitation.create({
              data: {
                clientId: client.id,
                email: client.email,
                name: `${client.firstName} ${client.lastName}`.trim(),
                role: "CLIENT_OWNER",
                tokenHash: hash(raw),
                expiresAt: new Date(
                  Date.now() +
                    Number(process.env.INVITATION_EXPIRY_HOURS || 48) * 3600000,
                ),
              },
            });
            invitationId = invite.id;
            emailJob = await tx.backgroundJob.create({
              data: {
                type: "invitation-email",
                clientId: client.id,
                actorId: job.actorId,
                dedupeKey: `onboard-invite:${job.id}`,
                payload: encrypt(
                  JSON.stringify({ invitationId: invite.id, token: raw }),
                ),
                result: { invitationId: invite.id },
              },
            });
            invitationJobId = emailJob.id;
          }
        }
        const result = {
          syncCompleted: true,
          invitationId,
          invitationJobId,
          ownerAlreadyHasAccess: !!owner,
        };
        await tx.backgroundJob.update({
          where: { id: job.id },
          data: { result },
        });
        await tx.auditLog.create({
          data: {
            clientId: client.id,
            actorId: job.actorId,
            resourceId: job.id,
            action: "client.synced-and-activated",
          },
        });
        return result;
      });
      return { done: true, progress: syncStages.length, result };
    },
    180,
  );
}

export async function onboardingStatus(clientId: string, jobId?: string) {
  const job = await db.backgroundJob.findFirst({
    where: {
      clientId,
      type: "client-onboarding",
      ...(jobId ? { id: jobId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return { job: null, smtpConfigured: mailConfigured() };
  const result = job.result as any;
  let invitation = result?.invitationId
    ? await db.invitation.findFirst({
        where: { id: result.invitationId, clientId },
        select: {
          id: true,
          email: true,
          sentAt: true,
          acceptedAt: true,
          revokedAt: true,
        },
      })
    : null;
  let emailJobId = result?.invitationJobId;
  // Follow an administrator's explicit resend so its delivery continues on this screen.
  if (invitation?.revokedAt) {
    const replacement = await db.invitation.findFirst({
      where: { clientId, email: invitation.email, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        email: true,
        sentAt: true,
        acceptedAt: true,
        revokedAt: true,
      },
    });
    if (replacement) {
      invitation = replacement;
      const replacementJob = await db.backgroundJob.findFirst({
        where: {
          clientId,
          type: "invitation-email",
          OR: [
            { dedupeKey: `invite:${replacement.id}` },
            { result: { path: "$.invitationId", equals: replacement.id } },
          ],
        },
        select: { id: true },
      });
      emailJobId = replacementJob?.id;
    }
  }
  const email = emailJobId
    ? await db.backgroundJob.findFirst({
        where: { id: emailJobId, clientId, type: "invitation-email" },
        select: { id: true, status: true, error: true },
      })
    : null;
  return {
    smtpConfigured: mailConfigured(),
    job: {
      id: job.id,
      status: job.status,
      progress: job.progress,
      total: job.total,
      stage: syncStages[job.progress] || "Sync complete",
      error: job.error,
      runAfter: job.runAfter,
      syncCompleted: !!result?.syncCompleted,
      ownerAlreadyHasAccess: !!result?.ownerAlreadyHasAccess,
    },
    email,
    invitation,
  };
}
