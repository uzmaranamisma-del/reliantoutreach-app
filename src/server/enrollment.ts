import { z } from "zod";
import { tenant } from "@/lib/access";
import { withLease } from "@/lib/locks";
import { forClient, type ProviderPage } from "@/lib/manyreach/client";
import { resolve } from "@/lib/manyreach/public";
import { AppError } from "@/lib/errors";
import { once } from "@/lib/mutations";
import { encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
export async function queueEnrollment(request: Request, input: unknown) {
  const data = z
    .object({
      sourceList: z.string().optional(),
      prospects: z.array(z.string()).min(1).max(1000).optional(),
      campaign: z.string().optional(),
      list: z.string().optional(),
      key: z.uuid(),
    })
    .parse(input);
  if (
    Boolean(data.sourceList) === Boolean(data.prospects) ||
    (!data.campaign && !data.list)
  )
    throw new AppError(
      422,
      "Choose exactly one prospect source and its destination.",
    );
  const initial = await tenant(request, "prospects.import");
  return withLease(`tenant:${initial.client.id}`, async () => {
    const ctx = await tenant(request, "prospects.import"),
      p = await forClient(ctx.client.id);
    const sourceListId = data.sourceList
      ? resolve(ctx.client.id, "lists", data.sourceList).i
      : undefined;
    const campaignId = data.campaign
      ? resolve(ctx.client.id, "campaigns", data.campaign).i
      : undefined;
    const listId = data.list
      ? resolve(ctx.client.id, "lists", data.list).i
      : undefined;
    const prospectIds = data.prospects?.map(
      (id) => resolve(ctx.client.id, "prospects", id).i,
    );
    if ((sourceListId || listId) && !ctx.can("lists.manage"))
      throw new AppError(403, "List management permission is required.");
    if (campaignId) {
      if (!ctx.can("campaigns.edit"))
        throw new AppError(403, "Campaign editing permission is required.");
      const campaign = await p.request(`/campaigns/${campaignId}`);
      if (!["Draft", "Paused"].includes(campaign.status))
        throw new AppError(
          422,
          "Pause the campaign before enrolling prospects.",
        );
    }
    if (listId) await p.request(`/lists/${listId}`);
    if (sourceListId) await p.request(`/lists/${sourceListId}`);
    const total = sourceListId
      ? (
          await p.request<ProviderPage>("/prospects", "GET", undefined, {
            "includeListIds.listIds": sourceListId,
            limit: 1,
          })
        ).pagination.totalItems
      : prospectIds!.length;
    if (!Number.isSafeInteger(total) || total < 1)
      throw new AppError(422, "The source contains no prospects.");
    return once(ctx.client.id, data.key, async () => {
      const job = await db.backgroundJob.create({
        data: {
          type: "prospect-import",
          clientId: ctx.client.id,
          actorId: ctx.user.id,
          total,
          dedupeKey: `enroll:${ctx.client.id}:${data.key}`,
          payload: encrypt(
            JSON.stringify({ sourceListId, prospectIds, campaignId, listId }),
          ),
        },
      });
      await db.auditLog.create({
        data: {
          actorId: ctx.user.id,
          clientId: ctx.client.id,
          resourceId: job.id,
          action: "prospects.enrollment-queued",
        },
      });
      return { id: job.id, total };
    });
  });
}
