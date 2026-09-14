import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { providerRequest } from "@/lib/manyreach/client";
import { encrypt } from "@/lib/crypto";
export async function rotateConnection(
  actorId: string,
  clientId: string,
  input: unknown,
) {
  const { apiKey } = z
    .object({ apiKey: z.string().min(8).max(2000) })
    .parse(input);
  const mapping = await db.manyreachClientspace.findUnique({
    where: { clientId },
  });
  if (!mapping) throw new AppError(404, "Clientspace mapping not found.");
  const account = await providerRequest(
    apiKey,
    `clientspace:${mapping.providerId}`,
    "/account",
  );
  if (
    Number(account.id) !== mapping.providerId ||
    String(account.keyType).toLowerCase() !== "clientspace"
  )
    throw new AppError(
      422,
      "The key must belong to this exact isolated clientspace.",
    );
  await db.$transaction(async (tx) => {
    await tx.manyreachClientspace.update({
      where: { clientId },
      data: { encryptedApiKey: encrypt(apiKey), lastError: null },
    });
    await tx.auditLog.create({
      data: { actorId, clientId, action: "client.connection-key-rotated" },
    });
  });
  return { ok: true };
}
export async function changeMember(
  actorId: string,
  clientId: string,
  input: unknown,
) {
  const data = z
    .object({
      id: z.string().min(1),
      role: z.enum(["CLIENT_OWNER", "CLIENT_ADMIN", "CLIENT_MEMBER"]),
      disabled: z.boolean().default(false),
    })
    .parse(input);
  await db.$transaction(async (tx) => {
    const member = await tx.clientMembership.findFirst({
      where: { id: data.id, clientId },
    });
    if (!member) throw new AppError(404, "Member not found.");
    if (
      member.role === "CLIENT_OWNER" &&
      !member.disabled &&
      (data.role !== "CLIENT_OWNER" || data.disabled) &&
      (await tx.clientMembership.count({
        where: {
          clientId,
          role: "CLIENT_OWNER",
          disabled: false,
          id: { not: member.id },
        },
      })) === 0
    )
      throw new AppError(
        422,
        "Assign another active owner before changing the last owner.",
      );
    await tx.clientMembership.update({
      where: { id: member.id },
      data: { role: data.role, disabled: data.disabled },
    });
    await tx.auditLog.create({
      data: {
        actorId,
        clientId,
        resourceId: member.id,
        action: "team.access-changed",
        metadata: { role: data.role, disabled: data.disabled },
      },
    });
  });
  return { ok: true };
}
export async function cancelJob(actorId: string, id: string) {
  return db.$transaction(async (tx) => {
    const changed = await tx.backgroundJob.updateMany({
      where: { id, status: { in: ["pending", "retry"] } },
      data: {
        status: "cancelled",
        payload: null,
        error: "Cancelled by administrator",
      },
    });
    if (!changed.count)
      throw new AppError(
        409,
        "Only a queued job can be cancelled. A running or finished job cannot be cancelled.",
      );
    await tx.auditLog.create({
      data: { actorId, resourceId: id, action: "job.cancelled" },
    });
    return { ok: true };
  });
}
