import { z } from "zod";
import { once } from "@/lib/mutations";
export { once } from "@/lib/mutations";
import { tenant, type Tenant } from "@/lib/access";
import { forClient, type ProviderPage } from "@/lib/manyreach/client";
import {
  publicRecord,
  resolve,
  version,
  safeHtml,
} from "@/lib/manyreach/public";
import { providerSchema } from "@/lib/manyreach/validation";
import { audit, enforceCapacity } from "@/lib/manyreach/service";
import { AppError } from "@/lib/errors";
import { withLease } from "@/lib/locks";
export function sendingGuard(ctx: Tenant) {
  // Provider credit allocation is additive; a monthly cap with rollover/downgrade cannot be made strict using the verified API.
  // Fail closed instead of promising a cap that polling can overrun.
  if (ctx.limit("monthlyEmails") !== -1)
    throw new AppError(
      403,
      "Sending is unavailable with this package’s monthly cap. Please contact your administrator.",
      "MONTHLY_CAP_UNAVAILABLE",
    );
}
export async function campaignAction(
  request: Request,
  id: string,
  action: string,
  input: any,
) {
  const verb =
    action === "start"
      ? "campaigns.start"
      : action === "pause"
        ? "campaigns.pause"
        : action === "duplicate"
          ? "campaigns.create"
          : "campaigns.delete";
  const initial = await tenant(request, verb);
  return withLease(`tenant:${initial.client.id}`, async () => {
    const ctx = await tenant(request, verb);
    const external = resolve(ctx.client.id, "campaigns", id).i;
    const p = await forClient(ctx.client.id);
    if (!["start", "pause", "duplicate", "archive"].includes(action))
      throw new AppError(404, "Action unavailable.");
    if (action === "start" || action === "archive") {
      if (input.confirm !== true)
        throw new AppError(422, "Confirm this campaign action.");
    }
    if (action === "start") {
      sendingGuard(ctx);
      const campaign = await p.request(`/campaigns/${external}`);
      if (!campaign.fromEmails || !campaign.prospectCount)
        throw new AppError(422, "Add senders and prospects before starting.");
    }
    if (action === "duplicate") await enforceCapacity(ctx, "campaigns");
    return once(ctx.client.id, input.key, async () => {
      const result = await p.request(
        `/campaigns/${external}/${action === "duplicate" ? "copy" : action}`,
        "POST",
        undefined,
        action === "duplicate"
          ? { newCampaignName: z.string().min(1).max(256).parse(input.name) }
          : action === "archive"
            ? { confirm: true }
            : {},
      );
      await audit(ctx, `campaigns.${action}`, id);
      return action === "duplicate"
        ? publicRecord(ctx.client.id, "campaigns", result)
        : { ok: true };
    });
  });
}
export async function sequences(ctx: Tenant, campaignId: string) {
  const p = await forClient(ctx.client.id),
    external = resolve(ctx.client.id, "campaigns", campaignId).i;
  const list = await p.request<ProviderPage>(
    `/campaigns/${external}/sequences`,
  );
  const output = [];
  if (list.items.length > 20)
    throw new AppError(
      422,
      "This sequence is too large to edit here. Please contact support.",
    );
  for (const sequence of list.items) {
    const followups = await p.request<ProviderPage>(
      `/sequences/${sequence.sequenceId}/followups`,
    );
    output.push({
      ...publicRecord(ctx.client.id, "sequences", sequence, external),
      followups: followups.items.map((f) =>
        publicRecord(
          ctx.client.id,
          "followups",
          f,
          String(sequence.sequenceId),
        ),
      ),
    });
  }
  return { items: output };
}
export async function sequenceWrite(
  request: Request,
  campaignId: string,
  action: string,
  input: any,
) {
  const initial = await tenant(request, "sequences.edit");
  return withLease(`tenant:${initial.client.id}`, async () => {
    const ctx = await tenant(request, "sequences.edit"),
      p = await forClient(ctx.client.id),
      campaign = resolve(ctx.client.id, "campaigns", campaignId).i;
    if (action === "create") {
      const data = providerSchema("SequenceCreate").parse(input.data);
      return once(ctx.client.id, input.key, async () => {
        const result = await p.request(
          `/campaigns/${campaign}/sequences`,
          "POST",
          data,
        );
        await audit(ctx, "sequences.create", campaignId);
        return publicRecord(ctx.client.id, "sequences", result, campaign);
      });
    }
    const sequence = resolve(ctx.client.id, "sequences", input.sequenceId);
    if (sequence.p !== campaign) throw new AppError(404, "Sequence not found.");
    if (action === "edit-sequence" || action === "delete-sequence") {
      const records = await p.request<ProviderPage>(
        `/campaigns/${campaign}/sequences`,
      );
      const current = records.items.find(
        (s) => String(s.sequenceId) === sequence.i,
      );
      if (!current) throw new AppError(404, "Sequence not found.");
      if (version(current) !== input.version)
        throw new AppError(409, "The sequence changed. Refresh before saving.");
      if (action === "delete-sequence") {
        if (input.confirm !== true)
          throw new AppError(422, "Confirm deletion.");
        await p.request(`/sequences/${sequence.i}`, "DELETE");
      } else
        await p.request(
          `/sequences/${sequence.i}`,
          "PATCH",
          providerSchema("SequenceUpdate").parse(input.data),
        );
      await audit(ctx, action, campaignId);
      return { ok: true };
    }
    if (action === "add") {
      const data = providerSchema("FollowupCreate").parse(input.data) as any;
      if (data.body) data.body = safeHtml(data.body);
      return once(ctx.client.id, input.key, async () => {
        const result = await p.request(
          `/sequences/${sequence.i}/followups`,
          "POST",
          data,
        );
        await audit(ctx, "followups.create", campaignId);
        return publicRecord(ctx.client.id, "followups", result, sequence.i);
      });
    }
    const followup = resolve(ctx.client.id, "followups", input.followupId);
    if (followup.p !== sequence.i)
      throw new AppError(404, "Follow-up not found.");
    const current = await p.request(`/followups/${followup.i}`);
    if (version(current) !== input.version)
      throw new AppError(409, "The follow-up changed. Refresh before saving.");
    if (action === "delete") {
      if (!input.confirm) throw new AppError(422, "Confirm deletion.");
      await p.request(`/followups/${followup.i}`, "DELETE");
    } else if (action === "edit") {
      const data = providerSchema("FollowupUpdate").parse(input.data) as any;
      if (data.body) data.body = safeHtml(data.body);
      await p.request(`/followups/${followup.i}`, "PATCH", data);
    } else throw new AppError(404, "Action unavailable.");
    await audit(ctx, `followups.${action}`, campaignId);
    return { ok: true };
  });
}
export async function reply(request: Request, input: unknown) {
  const data = z
    .object({
      id: z.string().min(10).max(1000),
      body: z.string().min(1).max(50000),
      key: z.uuid(),
      confirm: z.literal(true),
    })
    .parse(input);
  const initial = await tenant(request, "inbox.reply");
  return withLease(`tenant:${initial.client.id}`, async () => {
    const ctx = await tenant(request, "inbox.reply");
    sendingGuard(ctx);
    const message = resolve(ctx.client.id, "messages", data.id);
    const p = await forClient(ctx.client.id);
    return once(ctx.client.id, data.key, async () => {
      await p.request("/messages/reply", "POST", {
        messageId: message.i,
        body: safeHtml(data.body),
        sendAsReply: true,
      });
      await audit(ctx, "inbox.reply");
      return { ok: true };
    });
  });
}
export async function thread(ctx: Tenant, email: string, cursor?: string) {
  z.email().parse(email);
  if (cursor) z.string().max(200).parse(cursor);
  const p = await forClient(ctx.client.id);
  const prospects = await p.request<ProviderPage>(
    "/prospects",
    "GET",
    undefined,
    { email, limit: 1 },
  );
  const prospect = prospects.items.find(
    (x) => x.email?.toLowerCase() === email.toLowerCase(),
  );
  if (!prospect) return { items: [] };
  const messages = await p.request<ProviderPage>(
    `/prospects/${prospect.prospectId}/messages`,
    "GET",
    undefined,
    { limit: 100, startingAfter: cursor },
  );
  return {
    items: messages.items.map((m) =>
      publicRecord(ctx.client.id, "messages", m),
    ),
    pagination: messages.pagination,
  };
}
export async function analytics(
  ctx: Tenant,
  campaignId: string,
  start?: string,
  end?: string,
) {
  const p = await forClient(ctx.client.id),
    id = resolve(ctx.client.id, "campaigns", campaignId).i;
  if (start) z.iso.date().parse(start);
  if (end) z.iso.date().parse(end);
  if (start && end && start > end)
    throw new AppError(422, "End date must follow start date.");
  const data = await p.request(`/campaigns/${id}/stats`, "GET", undefined, {
    dateStart: start,
    dateEnd: end,
  });
  return {
    timeline: data.timeline,
    sent: data.sentSeries?.count || [],
    replies: data.replySeries?.count || [],
    opens: data.opensSeries?.count || [],
    clicks: data.clicksSeries?.count || [],
  };
}
