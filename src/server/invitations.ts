import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { encrypt, hash, token } from "@/lib/crypto";
import { AppError } from "@/lib/errors";
import { getEffectiveLimit, withinLimit } from "@/lib/permissions";
import { withLease } from "@/lib/locks";
export const invitationInput = z.object({
  email: z
    .email()
    .max(254)
    .transform((v) => v.toLowerCase()),
  name: z.string().min(1).max(150),
  role: z.enum(["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_MEMBER"]),
  sendNow: z.boolean().default(true),
});
export async function teamCapacity(
  clientId: string,
  additional = 1,
  replacingEmail?: string,
) {
  const c = await db.client.findUniqueOrThrow({
    where: { id: clientId },
    include: { package: { include: { limits: true } }, limits: true },
  });
  const [members, pending] = await Promise.all([
    db.clientMembership.count({ where: { clientId } }),
    db.invitation.count({
      where: {
        clientId,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: new Date() },
        ...(replacingEmail ? { email: { not: replacingEmail } } : {}),
      },
    }),
  ]);
  if (
    !withinLimit(
      members + pending,
      additional,
      getEffectiveLimit("teamMembers", c.package.limits, c.limits),
    )
  )
    throw new AppError(403, "Team member limit reached.");
}
// Caller must hold the tenant lease when creating/resending an invitation.
export async function createInvitation(
  clientId: string,
  actorId: string,
  input: unknown,
) {
  const data = invitationInput.parse(input);
  await teamCapacity(clientId, 1, data.email);
  const existing = await db.clientMembership.findFirst({
    where: { clientId, user: { email: data.email } },
  });
  if (existing)
    throw new AppError(409, "This person is already a team member.");
  const raw = token(),
    expiresAt = new Date(
      Date.now() + Number(process.env.INVITATION_EXPIRY_HOURS || 48) * 3600000,
    );
  const invitation = await db.$transaction(async (tx) => {
    await tx.invitation.updateMany({
      where: { clientId, email: data.email, acceptedAt: null, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    const invite = await tx.invitation.create({
      data: {
        clientId,
        email: data.email,
        name: data.name,
        role: data.role,
        tokenHash: hash(raw),
        expiresAt,
      },
    });
    if (data.sendNow)
      await tx.backgroundJob.create({
        data: {
          type: "invitation-email",
          clientId,
          actorId,
          dedupeKey: `invite:${invite.id}`,
          payload: encrypt(
            JSON.stringify({ invitationId: invite.id, token: raw }),
          ),
        },
      });
    await tx.auditLog.create({
      data: {
        clientId,
        actorId,
        action: "invitation.created",
        resourceId: invite.id,
      },
    });
    return invite;
  });
  return {
    id: invitation.id,
    expiresAt,
    email: invitation.email,
    delivery: data.sendNow ? "queued" : "not-sent",
  };
}
export async function acceptInvitation(
  input: unknown,
  existingUserId?: string,
) {
  const data = z
    .object({
      token: z.string().min(40).max(100),
      name: z.string().min(1).max(150),
      password: z.string().min(12).max(128).optional(),
      confirmPassword: z.string().optional(),
      acceptTerms: z.literal(true),
    })
    .parse(input);
  const invite = await db.invitation.findUnique({
    where: { tokenHash: hash(data.token) },
  });
  if (!invite)
    throw new AppError(410, "This invitation is no longer available.");
  return withLease(`tenant:${invite.clientId}`, async () => {
    const password = data.password
      ? await hashPassword(data.password)
      : undefined;
    if (data.password !== data.confirmPassword)
      throw new AppError(422, "Passwords do not match.");
    return db.$transaction(async (tx) => {
      const fresh = await tx.invitation.findUnique({
        where: { id: invite.id },
        include: { client: true },
      });
      if (
        !fresh ||
        fresh.revokedAt ||
        fresh.acceptedAt ||
        fresh.expiresAt <= new Date() ||
        fresh.client.status !== "ACTIVE"
      )
        throw new AppError(
          410,
          "This invitation has expired, was revoked, or has already been accepted.",
        );
      const existing = await tx.user.findUnique({
        where: { email: fresh.email },
      });
      if (existing && existing.id !== existingUserId)
        throw new AppError(
          409,
          "Sign in with your existing account before accepting this invitation.",
          "SIGN_IN_REQUIRED",
        );
      if (existing?.disabled)
        throw new AppError(403, "Your account is unavailable.");
      if (!existing && !password)
        throw new AppError(422, "Create a password to continue.");
      const c = await tx.client.findUniqueOrThrow({
        where: { id: fresh.clientId },
        include: { package: { include: { limits: true } }, limits: true },
      });
      const count = await tx.clientMembership.count({
        where: { clientId: c.id },
      });
      if (
        !withinLimit(
          count,
          1,
          getEffectiveLimit("teamMembers", c.package.limits, c.limits),
        )
      )
        throw new AppError(
          403,
          "Team member limit reached. Ask your administrator to update the package.",
        );
      const id = existing?.id || randomUUID();
      if (!existing)
        await tx.user.create({
          data: {
            id,
            name: data.name,
            email: fresh.email,
            emailVerified: true,
            accounts: {
              create: {
                id: randomUUID(),
                accountId: id,
                providerId: "credential",
                password,
              },
            },
          },
        });
      await tx.clientMembership.create({
        data: { userId: id, clientId: c.id, role: fresh.role },
      });
      const claimed = await tx.invitation.updateMany({
        where: {
          id: fresh.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { acceptedAt: new Date() },
      });
      if (claimed.count !== 1)
        throw new AppError(409, "Invitation already used.");
      await tx.auditLog.create({
        data: {
          clientId: c.id,
          actorId: id,
          action: "invitation.accepted",
          resourceId: fresh.id,
          metadata: { termsAcceptedAt: new Date().toISOString() },
        },
      });
      return { ok: true, email: fresh.email };
    });
  });
}
