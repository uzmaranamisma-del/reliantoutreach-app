import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { forClient, type ProviderPage } from "@/lib/manyreach/client";
export async function pauseCampaignStage(clientId: string, actorId: string, payload: any) {
  const actor = await db.user.findUnique({ where: { id: actorId } });
  if (!actor?.superadmin || actor.disabled) throw new AppError(403, "Administrator access was revoked.");
  const provider = await forClient(clientId);
  payload.ids ??= [];
  payload.paused ??= 0;
  if (!payload.collected) {
    const page = await provider.request<ProviderPage>("/campaigns", "GET", undefined, { "pageQuery.limit": 100, "pageQuery.startingAfter": payload.cursor });
    if (!Array.isArray(page.items) || !Number.isSafeInteger(page.pagination?.totalItems)) throw new AppError(502, "Campaign collection was incomplete.");
    payload.scanned = (payload.scanned || 0) + page.items.length;
    for (const c of page.items) if (["Running", "Scheduled", "Preparing"].includes(c.status) && !payload.ids.includes(String(c.campaignId))) payload.ids.push(String(c.campaignId));
    if (payload.ids.length > 10000) throw new AppError(422, "Pause this large account in Manyreach.");
    if (payload.scanned < page.pagination.totalItems) {
      const next = page.pagination.nextCursor;
      if (!next || String(next) === payload.cursor) throw new AppError(502, "Campaign pagination did not advance.");
      payload.cursor = String(next);
    } else payload.collected = true;
    return payload.collected && !payload.ids.length;
  }
  const id = payload.ids[payload.paused];
  if (!id) return true;
  // Re-read status before each write; drafts and already-paused campaigns stay untouched.
  const campaign = await provider.request(`/campaigns/${id}`);
  if (["Running", "Scheduled", "Preparing"].includes(campaign.status)) await provider.request(`/campaigns/${id}/pause`, "POST", undefined, {});
  payload.paused++;
  await db.auditLog.create({ data: { actorId, clientId, action: "campaign.paused-by-admin", resourceId: id } });
  return payload.paused >= payload.ids.length;
}
