import { z } from "zod";
import { forClient, type ProviderPage, type ProviderRecord } from "./client";
import { publicRecord, resolve, safeHtml, version, opaque } from "./public";
import { providerSchema, resourceSchemas } from "./validation";
import { AppError } from "@/lib/errors";
import { db } from "@/lib/db";
import { tenant, type Tenant } from "@/lib/access";
import { withLease } from "@/lib/locks";
import { withinLimit, type Permission, type LimitKey } from "@/lib/permissions";
import { once } from "@/lib/mutations";
import { validateSchedule } from "./schedule";
export type Resource = "campaigns" | "prospects" | "lists" | "senders";
export function permissionFor(
  kind: Resource,
  verb: "view" | "create" | "edit" | "delete",
): Permission {
  return (kind === "lists" ? "lists.manage" : `${kind}.${verb}`) as Permission;
}
export const pageQuery = z
  .object({
    page: z.coerce.number().int().min(1).max(400).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(25),
    search: z.string().max(200).optional(),
    status: z.string().max(40).optional(),
    cursor: z.string().max(1000).optional(),
    campaign: z.string().max(1000).optional(),
    list: z.string().max(1000).optional(),
  })
  .strict();
export async function list(
  ctx: Tenant,
  kind: Resource | "messages",
  input: unknown,
) {
  const q = pageQuery.parse(input),
    provider = await forClient(ctx.client.id);
  let params: Record<string, unknown> = { page: q.page, limit: q.limit };
  if (kind === "campaigns") {
    params = { "pageQuery.page": q.page, "pageQuery.limit": q.limit };
    if (q.status)
      params["pageQuery.status"] = z
        .enum([
          "Draft",
          "Running",
          "Paused",
          "Completed",
          "Archived",
          "Warning",
          "Blocked",
          "Scheduled",
          "Preparing",
        ])
        .parse(q.status);
  } else if (kind === "messages") {
    params.type = "Reply";
    if (q.search) params.subject = q.search;
    if (q.status)
      params.confirmedStatus = z
        .enum([
          "Interested",
          "NotInterested",
          "MaybeLater",
          "MeetingBooked",
          "AutoReply",
        ])
        .parse(q.status);
  } else if (["senders", "prospects"].includes(kind) && q.search)
    params.search = q.search;
  if (q.cursor)
    params[kind === "campaigns" ? "pageQuery.startingAfter" : "startingAfter"] =
      resolve(ctx.client.id, `cursor:${kind}`, q.cursor).i;
  if (q.campaign) {
    const id = resolve(ctx.client.id, "campaigns", q.campaign).i;
    params[
      kind === "prospects" ? "includeCampaignIds.campaignIds" : "campaignId"
    ] = id;
  }
  if (q.list)
    params["includeListIds.listIds"] = resolve(
      ctx.client.id,
      "lists",
      q.list,
    ).i;
  const data = await provider.request<ProviderPage>(
    `/${kind}`,
    "GET",
    undefined,
    params,
  );
  if (!Array.isArray(data.items) || !data.pagination)
    throw new AppError(502, "The outreach response could not be read.");
  return {
    items: data.items.map((r) => publicRecord(ctx.client.id, kind, r)),
    pagination: {
      ...data.pagination,
      nextCursor: data.pagination.nextCursor
        ? opaque(ctx.client.id, `cursor:${kind}`, data.pagination.nextCursor)
        : null,
    },
    updatedAt: new Date().toISOString(),
  };
}
export async function get(ctx: Tenant, kind: Resource, id: string) {
  const external = resolve(ctx.client.id, kind, id).i;
  const p = await forClient(ctx.client.id);
  return publicRecord(
    ctx.client.id,
    kind,
    await p.request(`/${kind}/${external}`),
  );
}
export async function enforceCapacity(ctx: Tenant, kind: Resource, amount = 1) {
  const limit = ctx.limit(kind as LimitKey);
  if (limit === -1) return;
  const p = await forClient(ctx.client.id);
  const data = await p.request<ProviderPage>(
    `/${kind}`,
    "GET",
    undefined,
    kind === "campaigns"
      ? { "pageQuery.limit": 1, "pageQuery.includeArchived": true }
      : { limit: 1 },
  );
  const count = data.pagination?.totalItems;
  if (!Number.isSafeInteger(count))
    throw new AppError(503, "Usage could not be verified. Please try again.");
  if (!withinLimit(count, amount, limit))
    throw new AppError(
      403,
      `${kind[0].toUpperCase() + kind.slice(1)} limit reached (${count} / ${limit}).`,
    );
}
export async function mutate(
  request: Request,
  kind: Resource,
  verb: "create" | "edit" | "delete",
  input: any,
  id?: string,
) {
  const initial = await tenant(request, permissionFor(kind, verb));
  return withLease(`tenant:${initial.client.id}`, async () => {
    const ctx = await tenant(request, permissionFor(kind, verb)),
      p = await forClient(ctx.client.id);
    const external = id ? resolve(ctx.client.id, kind, id).i : undefined;
    if (verb === "create") await enforceCapacity(ctx, kind);
    if (verb === "delete") {
      if (input.confirm !== true)
        throw new AppError(422, "Confirm this deletion.");
      await p.request(`/${kind}/${external}`, "DELETE");
      await audit(ctx, `${kind}.delete`, id);
      return { ok: true };
    }
    const clean = providerSchema(
      resourceSchemas[kind][verb === "create" ? 0 : 1],
    ).parse(input.data) as ProviderRecord;
    if (kind === "prospects" && clean.email) z.email().parse(clean.email);
    if (kind === "prospects" && clean.baseListId)
      throw new AppError(422, "Use the list import workflow to assign a list.");
    if (clean.body) clean.body = safeHtml(clean.body);
    if (clean.scheduleTimeZone) {
      try {
        Intl.DateTimeFormat("en", { timeZone: clean.scheduleTimeZone });
      } catch {
        throw new AppError(422, "Choose a valid timezone.");
      }
    }
    if (kind === "campaigns" && clean.fromEmails) {
      const emails = String(clean.fromEmails)
        .split(",")
        .map((s) => z.email().parse(s.trim()));
      const senders = await p.request<ProviderPage>(
        "/senders",
        "GET",
        undefined,
        { limit: 1000 },
      );
      for (const email of emails) {
        if (
          !senders.items.some(
            (s) => s.email?.toLowerCase() === email.toLowerCase(),
          )
        )
          throw new AppError(
            422,
            "Select senders connected to your workspace.",
          );
      }
    }
    if (kind === "campaigns" && verb === "create") validateSchedule(clean);
    if (verb === "edit") {
      const current = await p.request(`/${kind}/${external}`);
      if (!input.version || version(current) !== input.version)
        throw new AppError(
          409,
          "This record has changed. Refresh the latest version before saving.",
        );
      if (
        kind === "campaigns" &&
        (clean.scheduleSending ?? current.scheduleSending)
      ) {
        validateSchedule({ ...current, ...clean });
      }
      if (kind === "senders") {
        for (const [key, value] of Object.entries(current)) {
          if (typeof value === "boolean" && key in resourceSchemasBooleanFields)
            clean[key] = key in clean ? clean[key] : value;
        }
      }
    }
    const write = () =>
      p.request(
        `/${kind}${external ? `/${external}` : ""}`,
        verb === "create" ? "POST" : "PATCH",
        clean,
      );
    const result =
      verb === "create"
        ? await once(ctx.client.id, input.key, write)
        : await write();
    const output = publicRecord(ctx.client.id, kind, result);
    await audit(ctx, `${kind}.${verb}`, output.id);
    return output;
  });
}
const resourceSchemasBooleanFields = {
  dailyLimitIncrease: true,
  warmup: true,
  warmupDailyLimitIncrease: true,
  warmupSkipWeekends: true,
};
export async function audit(ctx: Tenant, action: string, resourceId?: string) {
  await db.auditLog.create({
    data: {
      actorId: ctx.user.id,
      clientId: ctx.client.id,
      action,
      resourceId: resourceId?.slice(0, 190),
    },
  });
}
