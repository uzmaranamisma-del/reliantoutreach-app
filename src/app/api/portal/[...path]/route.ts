import { z } from "zod";
import { parse } from "csv-parse/sync";
import { tenant } from "@/lib/access";
import { db } from "@/lib/db";
import { endpoint, AppError, json, sameOrigin } from "@/lib/errors";
import { permissions, limitKeys } from "@/lib/permissions";
import {
  list,
  get,
  mutate,
  permissionFor,
  type Resource,
  enforceCapacity,
} from "@/lib/manyreach/service";
import {
  campaignAction,
  sequences,
  sequenceWrite,
  reply,
  thread,
  analytics,
  once,
} from "@/server/outreach";
import { providerSchema } from "@/lib/manyreach/validation";
import { resolve } from "@/lib/manyreach/public";
import { encrypt } from "@/lib/crypto";
import { createInvitation } from "@/server/invitations";
import { withLease } from "@/lib/locks";
import { queueEnrollment } from "@/server/enrollment";
const resources = ["campaigns", "prospects", "lists", "senders"];
export const GET = endpoint(async (request, context) => {
  const { path } = await context.params;
  const [section, id, action] = path;
  const url = new URL(request.url);
  const q = Object.fromEntries(url.searchParams);
  const resource = section as Resource;
  if (resources.includes(section)) {
    const ctx = await tenant(request, permissionFor(resource, "view"));
    if (section === "campaigns" && id && action === "sequences")
      return sequences(ctx, id);
    if (section === "campaigns" && id && action === "analytics") {
      if (!ctx.can("analytics.view")) throw new AppError(403, "Unauthorized.");
      return analytics(ctx, id, q.start, q.end);
    }
    if (id) return get(ctx, resource, id);
    return list(ctx, resource, q);
  }
  if (section === "inbox") {
    const ctx = await tenant(request, "inbox.view");
    if (id === "thread") return thread(ctx, q.email, q.cursor);
    return list(ctx, "messages", q);
  }
  if (section === "context") {
    const ctx = await tenant(request);
    return {
      name: ctx.user.name,
      email: ctx.user.email,
      company: ctx.client.company,
      role: ctx.role,
      impersonating: ctx.impersonating,
      permissions: Object.fromEntries(permissions.map((p) => [p, ctx.can(p)])),
      limits: Object.fromEntries(limitKeys.map((p) => [p, ctx.limit(p)])),
      package: ctx.client.package.name,
      timezone: ctx.client.timezone,
      poll: {
        inbox: Number(process.env.POLL_INBOX_SECONDS || 15),
        campaigns: Number(process.env.POLL_CAMPAIGNS_SECONDS || 25),
        dashboard: Number(process.env.POLL_DASHBOARD_SECONDS || 45),
      },
    };
  }
  const ctx = await tenant(request);
  if (section === "notifications") {
    const page = z.coerce
      .number()
      .int()
      .min(1)
      .max(100000)
      .parse(q.page || 1);
    const where = { clientId: ctx.client.id };
    const [items, total] = await Promise.all([
      db.notification.findMany({
        where,
        take: 25,
        skip: (page - 1) * 25,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
      db.notification.count({ where }),
    ]);
    return { items, total };
  }
  if (section === "overview") {
    const snapshot = await db.usageSnapshot.findUnique({
      where: {
        clientId_period: { clientId: ctx.client.id, period: "current" },
      },
    });
    return {
      snapshot,
      activity: await db.auditLog.findMany({
        where: { clientId: ctx.client.id },
        select: { id: true, action: true, createdAt: true },
        take: 10,
        orderBy: { createdAt: "desc" },
      }),
    };
  }
  if (section === "usage")
    return {
      package: ctx.client.package.name,
      billingLabel: ctx.client.package.billingLabel,
      plan: {
        description: ctx.client.package.description,
        price: ctx.client.package.price.toString(),
        setupPrice: ctx.client.package.setupPrice.toString(),
        currency: ctx.client.package.currency,
        minimumMonths: ctx.client.package.minimumMonths,
        setupIncludes: ctx.client.package.setupIncludes,
        monthlyIncludes: ctx.client.package.monthlyIncludes,
        commercialTerms: ctx.client.package.commercialTerms,
      },
      limits: Object.fromEntries(limitKeys.map((k) => [k, ctx.limit(k)])),
      snapshot: await db.usageSnapshot.findUnique({
        where: {
          clientId_period: { clientId: ctx.client.id, period: "current" },
        },
      }),
    };
  if (section === "team") {
    if (!ctx.can("team.manage")) throw new AppError(403, "Unauthorized.");
    return {
      items: await db.clientMembership.findMany({
        where: { clientId: ctx.client.id },
        include: { user: { select: { name: true, email: true } } },
      }),
      invitations: await db.invitation.findMany({
        where: {
          clientId: ctx.client.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          expiresAt: true,
        },
      }),
    };
  }
  if (section === "imports") {
    if (!ctx.can("prospects.import")) throw new AppError(403, "Unauthorized.");
    return {
      items: await db.backgroundJob.findMany({
        where: { clientId: ctx.client.id, type: "prospect-import" },
        select: {
          id: true,
          status: true,
          progress: true,
          total: true,
          error: true,
          createdAt: true,
        },
        take: 20,
        orderBy: { createdAt: "desc" },
      }),
    };
  }
  throw new AppError(404, "Not found.");
});
export const POST = endpoint(async (request, context) => {
  sameOrigin(request);
  const { path } = await context.params;
  const [section, id, action] = path;
  const input = await json(request, section === "imports" ? 3_000_000 : 128000);
  if (section === "enrollments") return queueEnrollment(request, input);
  if (section === "notifications" && id) {
    const ctx = await tenant(request);
    const changed = await db.notification.updateMany({
      where: { id, clientId: ctx.client.id },
      data: { readAt: new Date() },
    });
    if (!changed.count) throw new AppError(404, "Notification not found.");
    return { ok: true };
  }
  if (resources.includes(section)) {
    if (section === "campaigns" && id && action === "sequences")
      return sequenceWrite(request, id, input.action, input);
    if (section === "campaigns" && id && action)
      return campaignAction(request, id, action, input);
    return mutate(
      request,
      section as Resource,
      !id ? "create" : input.action === "delete" ? "delete" : "edit",
      input,
      id,
    );
  }
  if (section === "inbox" && id === "reply") return reply(request, input);
  if (section === "refresh") {
    const ctx = await tenant(request);
    const key = `manual-sync:${ctx.client.id}:${Math.floor(Date.now() / 60000)}`;
    await db.backgroundJob.upsert({
      where: { dedupeKey: key },
      create: { type: "reconcile", clientId: ctx.client.id, dedupeKey: key },
      update: {},
    });
    return { ok: true };
  }
  if (section === "imports") {
    const initial = await tenant(request, "prospects.import");
    return withLease(`tenant:${initial.client.id}`, async () => {
      const ctx = await tenant(request, "prospects.import");
      const data = z
        .object({
          csv: z.string().min(1).max(2_500_000),
          mapping: z.record(z.string(), z.string()),
          campaign: z.string().optional(),
          list: z.string().optional(),
          key: z.uuid(),
        })
        .parse(input);
      const campaignId = data.campaign
          ? resolve(ctx.client.id, "campaigns", data.campaign).i
          : undefined,
        listId = data.list
          ? resolve(ctx.client.id, "lists", data.list).i
          : undefined;
      if (campaignId && !ctx.can("campaigns.edit"))
        throw new AppError(403, "Campaign editing permission is required.");
      if (listId && !ctx.can("lists.manage"))
        throw new AppError(403, "List management permission is required.");
      let records: Record<string, string>[];
      try {
        records = parse(data.csv, {
          columns: true,
          skip_empty_lines: true,
          bom: true,
          max_record_size: 20000,
          trim: true,
        });
      } catch {
        throw new AppError(
          422,
          "The CSV could not be read. Check headers, commas, and quoted values.",
        );
      }
      const max = ctx.limit("csvRows");
      if (
        !records.length ||
        records.length > 20000 ||
        (max !== -1 && records.length > max)
      )
        throw new AppError(
          422,
          "The CSV exceeds your import row limit or contains no rows.",
        );
      const seen = new Set<string>(),
        rows: any[] = [];
      let duplicates = 0;
      const errors: { row: number; message: string }[] = [];
      records.forEach((record, index) => {
        const mapped = Object.fromEntries(
          Object.entries(data.mapping)
            .filter(([, source]) => !!source)
            .map(([target, source]) => [target, record[source] || ""]),
        );
        if (mapped.email) mapped.email = mapped.email.toLowerCase();
        const parsed = providerSchema("ProspectBulkCreate").safeParse(mapped);
        if (!parsed.success || !z.email().safeParse(mapped.email).success) {
          if (errors.length < 30)
            errors.push({
              row: index + 2,
              message: "Invalid email or field mapping.",
            });
          return;
        }
        if (seen.has(mapped.email)) {
          duplicates++;
          return;
        }
        seen.add(mapped.email);
        rows.push(parsed.data);
      });
      if (errors.length)
        return Response.json(
          { error: "Correct the invalid rows before importing.", rows: errors },
          { status: 422 },
        );
      await enforceCapacity(ctx, "prospects", rows.length);
      return once(ctx.client.id, data.key, async () => {
        const job = await db.backgroundJob.create({
          data: {
            type: "prospect-import",
            clientId: ctx.client.id,
            actorId: ctx.user.id,
            total: rows.length,
            payload: encrypt(JSON.stringify({ rows, campaignId, listId })),
            dedupeKey: `import:${ctx.client.id}:${data.key}`,
          },
        });
        await db.auditLog.create({
          data: {
            actorId: ctx.user.id,
            clientId: ctx.client.id,
            action: "prospects.import-queued",
            resourceId: job.id,
            metadata: { rows: rows.length, duplicates },
          },
        });
        return { id: job.id, total: rows.length, duplicates };
      });
    });
  }
  if (section === "team") {
    const initial = await tenant(request, "team.manage");
    return withLease(`tenant:${initial.client.id}`, async () => {
      const ctx = await tenant(request, "team.manage");
      if (!id) {
        const parsed = z
          .object({ role: z.enum(["CLIENT_ADMIN", "CLIENT_MEMBER"]) })
          .passthrough()
          .parse(input);
        return createInvitation(ctx.client.id, ctx.user.id, parsed);
      }
      if (action === "revoke") {
        const changed = await db.invitation.updateMany({
          where: { id, clientId: ctx.client.id, acceptedAt: null },
          data: { revokedAt: new Date() },
        });
        if (!changed.count) throw new AppError(404, "Invitation not found.");
        return { ok: true };
      }
      const member = await db.clientMembership.findFirst({
        where: { id, clientId: ctx.client.id },
      });
      if (!member) throw new AppError(404, "Team member not found.");
      if (member.userId === ctx.user.id || member.role === "CLIENT_OWNER")
        throw new AppError(
          403,
          "The owner’s access must be changed by support.",
        );
      if (ctx.role !== "CLIENT_OWNER")
        throw new AppError(403, "Only the owner may change team access.");
      if (input.action === "remove") {
        if (!input.confirm) throw new AppError(422, "Confirm removal.");
        await db.clientMembership.delete({ where: { id } });
      } else {
        const role = z
          .enum(["CLIENT_ADMIN", "CLIENT_MEMBER"])
          .parse(input.role);
        await db.clientMembership.update({ where: { id }, data: { role } });
      }
      await db.auditLog.create({
        data: {
          actorId: ctx.user.id,
          clientId: ctx.client.id,
          action: "team.access-changed",
          resourceId: id,
        },
      });
      return { ok: true };
    });
  }
  throw new AppError(404, "Not found.");
});
