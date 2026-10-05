import { z } from "zod";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { withLease } from "@/lib/locks";
import type { Tenant } from "@/lib/access";

export const orderTransitions: Record<string, string[]> = {
  pending_review: ["approved", "declined", "cancelled"],
  approved: ["activated", "fulfilled", "declined", "cancelled"],
  activated: [],
  fulfilled: [],
  declined: [],
  cancelled: [],
};
export const canTransitionOrder = (from: string, to: string) =>
  !!orderTransitions[from]?.includes(to);
export async function listPackageRequests(clientId: string) {
  return {
    items: await db.packageRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  };
}
export async function requestPackage(ctx: Tenant, input: unknown) {
  if (ctx.role === "CLIENT_MEMBER")
    throw new AppError(
      403,
      "Only workspace owners and administrators can request a package change.",
    );
  const data = z
    .object({
      packageId: z.string().max(100),
      key: z.string().uuid(),
      note: z.string().trim().max(1000).optional(),
      confirm: z.literal(true),
    })
    .parse(input);
  return withLease(`package-request:${ctx.client.id}`, async () => {
    const existing = await db.packageRequest.findUnique({
      where: {
        clientId_requestKey: { clientId: ctx.client.id, requestKey: data.key },
      },
    });
    if (existing) return existing;
    if (
      await db.packageRequest.findFirst({
        where: {
          clientId: ctx.client.id,
          status: { in: ["pending_review", "approved"] },
        },
      })
    )
      throw new AppError(409, "A package request is already being reviewed.");
    const plan = await db.package.findUnique({ where: { id: data.packageId } });
    if (!plan?.active || plan.requiresLimitReview)
      throw new AppError(
        409,
        "This package is not available for a change request.",
      );
    if (ctx.client.packageId === plan.id)
      throw new AppError(409, "This is already your active package.");
    return db.packageRequest.create({
      data: {
        clientId: ctx.client.id,
        requestedBy: ctx.user.id,
        packageId: plan.id,
        packageName: plan.name,
        price: String(plan.price),
        setupPrice: String(plan.setupPrice),
        currency: plan.currency,
        requestKey: data.key,
        note: data.note,
        history: [
          {
            status: "pending_review",
            at: new Date().toISOString(),
            note: "Request received. Your current package remains active.",
          },
        ],
      },
    });
  });
}
export async function updatePackageRequest(
  clientId: string,
  actorId: string,
  input: unknown,
  isAdmin: boolean,
) {
  const data = z
    .object({
      id: z.string().max(100),
      status: z.enum([
        "approved",
        "activated",
        "fulfilled",
        "declined",
        "cancelled",
      ]),
      note: z.string().trim().max(1000).default(""),
      confirm: z.literal(true),
    })
    .parse(input);
  if (!isAdmin && data.status !== "cancelled")
    throw new AppError(403, "Only an administrator can update this status.");
  return withLease(`package-request:${clientId}`, async () => {
    const order = await db.packageRequest.findFirst({
      where: { id: data.id, clientId },
    });
    if (!order) throw new AppError(404, "Request not found.");
    if (order.status === data.status) return order;
    if (!canTransitionOrder(order.status, data.status))
      throw new AppError(
        409,
        "This request has already changed. Refresh to see its latest status.",
      );
    return db.$transaction(async (tx) => {
      if (data.status === "fulfilled") {
        const plan = await tx.package.findUnique({
          where: { id: order.packageId },
        });
        if (!plan || plan.serviceType === "EMAIL")
          throw new AppError(
            409,
            "Email packages must be activated. Mark fulfilled only for a separately delivered service.",
          );
      }
      if (data.status === "activated") {
        const plan = await tx.package.findUnique({
          where: { id: order.packageId },
        });
        if (
          !plan?.active ||
          plan.requiresLimitReview ||
          plan.serviceType !== "EMAIL"
        )
          throw new AppError(
            409,
            "Only a ready email package can be activated for this outreach workspace. Fulfil other services separately.",
          );
        if (
          String(plan.price) !== order.price ||
          String(plan.setupPrice) !== order.setupPrice ||
          plan.currency !== order.currency
        )
          throw new AppError(
            409,
            "The package price has changed. Decline this request and ask the client to review a new request.",
          );
        await tx.client.update({
          where: { id: clientId },
          data: { packageId: plan.id },
        });
      }
      const result = await tx.packageRequest.update({
        where: { id: order.id },
        data: {
          status: data.status,
          notificationPending: true,
          history: [
            ...(Array.isArray(order.history) ? order.history : []),
            {
              status: data.status,
              at: new Date().toISOString(),
              note: data.note,
            },
          ],
        },
      });
      await tx.auditLog.create({
        data: {
          actorId,
          clientId,
          resourceId: order.id,
          action: `package.request.${data.status}`,
        },
      });
      return result;
    });
  });
}
