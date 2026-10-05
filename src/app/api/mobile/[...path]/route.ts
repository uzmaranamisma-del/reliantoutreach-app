import { z } from "zod";
import { identity, tenant } from "@/lib/access";
import { db } from "@/lib/db";
import { AppError, endpoint, json, sameOrigin } from "@/lib/errors";
import { permissions } from "@/lib/permissions";
import { list } from "@/lib/manyreach/service";
import { thread, reply } from "@/server/outreach";
import { nativePushConfigured } from "@/server/native-push";
import {
  listPackageRequests,
  requestPackage,
  updatePackageRequest,
} from "@/server/package-requests";
import { rateLimit } from "@/lib/locks";
import { hash } from "@/lib/crypto";
import { resolve } from "@/lib/manyreach/public";
import {
  ensureMobileWorkspace,
  mobileWorkspaces,
} from "@/server/mobile-workspaces";
function stableMessages(
  clientId: string,
  page: { items: any[]; [key: string]: any },
) {
  return {
    ...page,
    items: page.items.map((message) => ({
      ...message,
      key: hash(
        JSON.stringify([clientId, resolve(clientId, "messages", message.id).i]),
      ),
    })),
  };
}

async function mobileTenant(request: Request) {
  const ctx = await tenant(request);
  if (ctx.impersonating)
    throw new AppError(
      403,
      "End administrator preview before using the mobile app.",
    );
  return ctx;
}
export const GET = endpoint(async (request, route) => {
  const { path } = await route.params,
    resource = path[0];
  const url = new URL(request.url);
  if (resource === "workspaces") {
    const who = await identity(request);
    return {
      user: { id: who.user.id, name: who.user.name, email: who.user.email },
      ...(await mobileWorkspaces(who.user, who.session.activeClientId)),
    };
  }
  const ctx = await mobileTenant(request),
    clientId = ctx.client.id;
  if (resource === "context")
    return {
      user: { id: ctx.user.id, name: ctx.user.name, email: ctx.user.email },
      client: { id: clientId, company: ctx.client.company },
      role: ctx.role,
      permissions: Object.fromEntries(permissions.map((p) => [p, ctx.can(p)])),
      activePackageId: ctx.client.packageId,
    };
  if (resource === "inbox") {
    if (!ctx.can("inbox.view"))
      throw new AppError(403, "Your account does not have inbox access.");
    if (path[1] === "thread")
      return stableMessages(
        clientId,
        await thread(
          ctx,
          z.string().email().max(254).parse(url.searchParams.get("email")),
          url.searchParams.get("cursor") || undefined,
        ),
      );
    return stableMessages(
      clientId,
      await list(ctx, "messages", Object.fromEntries(url.searchParams)),
    );
  }
  if (resource === "conversation-state") {
    if (!ctx.can("inbox.view"))
      throw new AppError(403, "Inbox access is unavailable.");
    const emails = z
      .array(z.string().email().max(254))
      .max(100)
      .parse(url.searchParams.getAll("email"));
    return {
      items: await db.mobileConversation.findMany({
        where: { clientId, userId: ctx.user.id, email: { in: emails } },
      }),
    };
  }
  if (resource === "stats") {
    if (!ctx.can("analytics.view"))
      throw new AppError(403, "Your account does not have statistics access.");
    const month = new Date().toISOString().slice(0, 7);
    const [snapshot, monthly, connection] = await Promise.all([
      db.usageSnapshot.findUnique({
        where: { clientId_period: { clientId, period: "current" } },
      }),
      db.usageSnapshot.findUnique({
        where: { clientId_period: { clientId, period: `month:${month}` } },
      }),
      db.manyreachClientspace.findUnique({
        where: { clientId },
        select: { lastSyncAt: true, lastError: true },
      }),
    ]);
    return {
      snapshot,
      monthly,
      month,
      capacity: ctx.limit("monthlyEmails"),
      connection,
    };
  }
  if (resource === "plans")
    return {
      activePackageId: ctx.client.packageId,
      canRequest: ctx.role !== "CLIENT_MEMBER",
      items: await db.package.findMany({
        where: { OR: [{ active: true }, { id: ctx.client.packageId }] },
        select: {
          id: true,
          name: true,
          price: true,
          setupPrice: true,
          currency: true,
          billingLabel: true,
          serviceType: true,
          monthlyMessages: true,
          initialMessages: true,
          minimumMonths: true,
          commercialTerms: true,
          requiresLimitReview: true,
          active: true,
          limits: {
            where: { key: "monthlyEmails" },
            select: { key: true, value: true },
          },
        },
        orderBy: { displayOrder: "asc" },
      }),
    };
  if (resource === "orders") return listPackageRequests(clientId);
  if (resource === "push") {
    const [device, scan, worker] = await Promise.all([
      db.nativeDevice.findFirst({
        where: {
          userId: ctx.user.id,
          clientId,
          sessionId: ctx.session.id,
          installationId: url.searchParams.get("installationId") || "",
        },
        select: { replies: true, orders: true, updatedAt: true },
      }),
      db.replyScan.findUnique({ where: { clientId } }),
      db.appSetting.findUnique({ where: { key: "native-push:last-run" } }),
    ]);
    return {
      configured: nativePushConfigured(),
      device,
      lastScanAt: scan?.lastScanAt,
      scanError: scan?.lastError,
      worker: worker?.value,
    };
  }
  if (resource === "event") {
    if (!ctx.can("inbox.view"))
      throw new AppError(403, "Inbox access is unavailable.");
    const id = z
      .string()
      .regex(/^[a-f0-9]{64}$/)
      .parse(path[1]);
    const event = await db.replyEvent.findFirst({ where: { id, clientId } });
    if (!event)
      throw new AppError(404, "This notification is no longer available.");
    return { email: event.conversationEmail };
  }
  throw new AppError(404, "Not found.");
});
export const POST = endpoint(async (request, route) => {
  sameOrigin(request);
  const { path } = await route.params,
    input = await json(request);
  if (path[0] === "workspace") {
    const who = await identity(request),
      { clientId } = z.object({ clientId: z.string().max(100) }).parse(input);
    await ensureMobileWorkspace(who.user, clientId);
    await db.$transaction([
      db.nativeDevice.deleteMany({ where: { sessionId: who.session.id } }),
      db.session.update({
        where: { id: who.session.id },
        data: {
          activeClientId: clientId,
          impersonatingClientId: null,
          impersonationExpiresAt: null,
        },
      }),
    ]);
    return { ok: true };
  }
  const ctx = await mobileTenant(request),
    clientId = ctx.client.id;
  await rateLimit(`mobile:${ctx.user.id}`, 90);
  if (path[0] === "reply") return reply(request, input);
  if (path[0] === "conversation-state") {
    if (!ctx.can("inbox.view"))
      throw new AppError(403, "Inbox access is unavailable.");
    const { email, read, starred } = z
      .object({
        email: z
          .string()
          .email()
          .max(254)
          .transform((e) => e.toLowerCase()),
        read: z.boolean().optional(),
        starred: z.boolean().optional(),
      })
      .parse(input);
    const data = {
      ...(read !== undefined ? { readAt: read ? new Date() : null } : {}),
      ...(starred !== undefined ? { starred } : {}),
    };
    return db.mobileConversation.upsert({
      where: {
        clientId_userId_email: { clientId, userId: ctx.user.id, email },
      },
      create: { clientId, userId: ctx.user.id, email, ...data },
      update: data,
    });
  }
  if (path[0] === "orders") {
    if (path[1] === "cancel") {
      if (ctx.role === "CLIENT_MEMBER")
        throw new AppError(
          403,
          "Only workspace administrators can cancel requests.",
        );
      return updatePackageRequest(
        clientId,
        ctx.user.id,
        { ...input, status: "cancelled" },
        false,
      );
    }
    return requestPackage(ctx, input);
  }
  if (path[0] === "push") {
    const installationId = z.string().uuid().parse(input.installationId);
    if (path[1] === "remove") {
      await db.nativeDevice.deleteMany({
        where: {
          installationId,
          userId: ctx.user.id,
          sessionId: ctx.session.id,
        },
      });
      return { ok: true };
    }
    const data = z
      .object({
        token: z
          .string()
          .regex(/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$/)
          .max(255),
        platform: z.enum(["android", "ios"]),
        replies: z.boolean(),
        orders: z.boolean(),
      })
      .parse(input);
    if (data.replies && !ctx.can("inbox.view"))
      throw new AppError(403, "Inbox access is required for reply alerts.");
    await db.$transaction(async (tx) => {
      // Token rotation / account switching cannot leave an old user's subscription.
      await tx.nativeDevice.deleteMany({
        where: { token: data.token, installationId: { not: installationId } },
      });
      const previous = await tx.nativeDevice.findUnique({
        where: { installationId },
      });
      if (
        previous &&
        (previous.userId !== ctx.user.id ||
          previous.clientId !== clientId ||
          previous.sessionId !== ctx.session.id ||
          previous.token !== data.token)
      )
        await tx.nativeDevice.delete({ where: { id: previous.id } });
      await tx.nativeDevice.upsert({
        where: { installationId },
        create: {
          installationId,
          ...data,
          userId: ctx.user.id,
          clientId,
          sessionId: ctx.session.id,
        },
        update: {
          ...data,
          userId: ctx.user.id,
          clientId,
          sessionId: ctx.session.id,
        },
      });
      await tx.replyScan.upsert({
        where: { clientId },
        create: { clientId },
        update: {},
      });
    });
    return { ok: true, configured: nativePushConfigured() };
  }
  throw new AppError(404, "Not found.");
});
