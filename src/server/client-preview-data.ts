import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { forClient, type ProviderPage } from "@/lib/manyreach/client";
import { opaque, publicRecord, resolve } from "@/lib/manyreach/public";
import { limitKeys } from "@/lib/permissions";

const providerKinds = z.enum([
  "campaigns",
  "prospects",
  "lists",
  "senders",
  "messages",
]);
const querySchema = z.object({
  page: z.coerce.number().int().min(1).max(400).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  cursor: z.string().max(1000).optional(),
});

export async function clientPreviewData(
  clientId: string,
  section: string,
  query: Record<string, string>,
) {
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      mapping: { select: { lastSyncAt: true, lastError: true } },
      package: { include: { limits: true } },
      limits: true,
    },
  });
  if (!client) throw new AppError(404, "Client not found.");

  if (section === "usage")
    return {
      package: client.package.name,
      billingLabel: client.package.billingLabel,
      plan: {
        description: client.package.description,
        price: client.package.price.toString(),
        setupPrice: client.package.setupPrice.toString(),
        currency: client.package.currency,
        minimumMonths: client.package.minimumMonths,
        setupIncludes: client.package.setupIncludes,
        monthlyIncludes: client.package.monthlyIncludes,
        commercialTerms: client.package.commercialTerms,
      },
      limits: Object.fromEntries(
        limitKeys.map((key) => [
          key,
          client.limits.find((x) => x.key === key)?.value ??
            client.package.limits.find((x) => x.key === key)?.value ??
            0,
        ]),
      ),
      snapshot: await db.usageSnapshot.findUnique({
        where: { clientId_period: { clientId, period: "current" } },
      }),
    };
  if (section === "team")
    return {
      items: await db.clientMembership.findMany({
        where: { clientId },
        select: {
          id: true,
          role: true,
          disabled: true,
          user: { select: { name: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      invitations: await db.invitation.findMany({
        where: { clientId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          sentAt: true,
          acceptedAt: true,
          revokedAt: true,
          expiresAt: true,
        },
        orderBy: { createdAt: "desc" },
      }),
    };
  if (section === "notifications")
    return {
      items: await db.notification.findMany({
        where: { clientId },
        select: { id: true, title: true, createdAt: true, readAt: true },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    };
  if (section === "settings")
    return {
      company: client.company,
      owner: `${client.firstName} ${client.lastName}`.trim(),
      email: client.email,
      phone: client.phone,
      website: client.website,
      industry: client.industry,
      country: client.country,
      timezone: client.timezone,
      status: client.status,
      connected: !!client.mapping,
      lastSyncAt: client.mapping?.lastSyncAt,
      lastError: client.mapping?.lastError,
    };
  if (section === "analytics")
    return {
      snapshot: await db.usageSnapshot.findUnique({
        where: { clientId_period: { clientId, period: "current" } },
      }),
    };

  const kind = providerKinds.parse(section === "inbox" ? "messages" : section);
  if (!client.mapping)
    return {
      connected: false,
      items: [],
      pagination: {
        currentPage: 1,
        pageSize: 25,
        totalItems: 0,
        nextCursor: null,
      },
    };
  const q = querySchema.parse(query);
  let params: Record<string, unknown> = { page: q.page, limit: q.limit };
  if (kind === "campaigns")
    params = {
      "pageQuery.page": q.page,
      "pageQuery.limit": q.limit,
      "pageQuery.includeArchived": true,
    };
  if (kind === "messages") params.type = "Reply";
  if (q.cursor)
    params[kind === "campaigns" ? "pageQuery.startingAfter" : "startingAfter"] =
      resolve(clientId, `preview-cursor:${kind}`, q.cursor).i;
  const result = await (
    await forClient(clientId)
  ).request<ProviderPage>(`/${kind}`, "GET", undefined, params);
  if (!Array.isArray(result.items) || !result.pagination)
    throw new AppError(502, "The outreach response could not be read.");
  return {
    connected: true,
    items: result.items.map((row) => publicRecord(clientId, kind, row)),
    pagination: {
      ...result.pagination,
      nextCursor: result.pagination.nextCursor
        ? opaque(
            clientId,
            `preview-cursor:${kind}`,
            result.pagination.nextCursor,
          )
        : null,
    },
    updatedAt: new Date().toISOString(),
  };
}
