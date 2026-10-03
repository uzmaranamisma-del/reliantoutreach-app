import "server-only";
import { z } from "zod";
import { tenant } from "@/lib/access";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { aiProfileInput, defaultAiProfile } from "@/lib/ai-workspace";
import { rateLimit } from "@/lib/locks";

export function canEditAiProfile(role: string) {
  return role === "CLIENT_OWNER" || role === "CLIENT_ADMIN";
}
export async function readAiWorkspace(clientId: string, canEdit = false) {
  const row = await db.aiWorkspace.findUnique({ where: { clientId } });
  return {
    profile: row ? aiProfileInput.parse(row.profile) : defaultAiProfile,
    revision: row?.revision || 0,
    updatedAt: row?.updatedAt.toISOString() || null,
    canEdit,
    status: "not_connected" as const,
  };
}
export async function saveAiWorkspace(request: Request, input: unknown) {
  const ctx = await tenant(request);
  if (!canEditAiProfile(ctx.role))
    throw new AppError(
      403,
      "Only workspace owners and admins can edit AI setup.",
    );
  const data = z
    .object({
      profile: aiProfileInput,
      revision: z.number().int().min(0).max(2147483646),
    })
    .strict()
    .parse(input);
  await rateLimit(`ai-profile:${ctx.user.id}`, 20);
  try {
    await db.$transaction(async (tx) => {
      if (data.revision === 0) {
        await tx.aiWorkspace.create({
          data: { clientId: ctx.client.id, profile: data.profile },
        });
      } else {
        const changed = await tx.aiWorkspace.updateMany({
          where: { clientId: ctx.client.id, revision: data.revision },
          data: { profile: data.profile, revision: { increment: 1 } },
        });
        if (!changed.count)
          throw new AppError(
            409,
            "This setup was updated elsewhere. Reload the saved setup before saving again.",
          );
      }
      await tx.auditLog.create({
        data: {
          actorId: ctx.user.id,
          clientId: ctx.client.id,
          action: "ai.workspace-prepared",
        },
      });
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002")
      throw new AppError(
        409,
        "This setup was updated elsewhere. Reload the saved setup before saving again.",
      );
    throw error;
  }
  return readAiWorkspace(ctx.client.id, true);
}
