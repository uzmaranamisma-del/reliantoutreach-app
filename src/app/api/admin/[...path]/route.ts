import { z } from "zod";
import { admin } from "@/lib/access";
import { db } from "@/lib/db";
import { endpoint, json, sameOrigin, AppError } from "@/lib/errors";
import { savePackage, createClient, clientInput } from "@/server/admin";
import {
  rotateConnection,
  changeMember,
  cancelJob,
  activateClient,
} from "@/server/admin-actions";
import { createInvitation } from "@/server/invitations";
import { permissions, limitKeys } from "@/lib/permissions";
import { withLease } from "@/lib/locks";
import { agencyRequest } from "@/lib/manyreach/client";
import { getBranding, saveBranding } from "@/server/settings";
import { queueOnboarding, onboardingStatus } from "@/server/onboarding";
import { processJobs } from "@/server/jobs";
import { clientPreviewData } from "@/server/client-preview-data";
export const GET = endpoint(async (request, context) => {
  await admin(request);
  const { path } = await context.params;
  const [section, id] = path;
  if (section === "clients" && id && path[2] === "sync")
    return onboardingStatus(id);
  if (section === "clients" && id && path[2] === "preview") {
    const previewUrl = new URL(request.url);
    return clientPreviewData(
      id,
      path[3] || "campaigns",
      Object.fromEntries(previewUrl.searchParams),
    );
  }
  if (section === "settings") return getBranding();
  const url = new URL(request.url);
  const page = z.coerce
    .number()
    .int()
    .min(1)
    .max(100000)
    .parse(url.searchParams.get("page") || 1);
  const search = (url.searchParams.get("search") || "").slice(0, 100);
  const skip = (page - 1) * 25;
  if (section === "packages" && id === "options")
    return {
      items: await db.package.findMany({
        where: {
          serviceType: "EMAIL",
          ...(url.searchParams.get("purpose") === "onboarding"
            ? {}
            : { active: true, requiresLimitReview: false }),
        },
        select: {
          id: true,
          name: true,
          active: true,
          requiresLimitReview: true,
          features: { select: { key: true, enabled: true } },
        },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      }),
    };
  if (section === "packages") {
    const where = search
      ? {
          OR: [
            { name: { contains: search } },
            { description: { contains: search } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      db.package.findMany({
        where,
        skip,
        include: {
          features: true,
          limits: true,
          _count: { select: { clients: true } },
        },
        orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
        take: 25,
      }),
      db.package.count({ where }),
    ]);
    return { items, total, page };
  }
  if (section === "clientspaces") {
    const spaces = await agencyRequest("/clientspaces", "GET", undefined, {
      page,
      limit: 25,
    });
    return {
      items: spaces.items.map((s: any) => ({
        id: s.clientspaceId,
        title: s.title,
      })),
      pagination: spaces.pagination,
    };
  }
  if (section === "clients" && id) {
    const c = await db.client.findUnique({
      where: { id },
      include: {
        package: { include: { features: true, limits: true } },
        permissions: true,
        limits: true,
        mapping: {
          select: { providerId: true, lastSyncAt: true, lastError: true },
        },
        memberships: {
          include: { user: { select: { id: true, email: true, name: true } } },
        },
        invitations: {
          select: {
            id: true,
            email: true,
            role: true,
            expiresAt: true,
            acceptedAt: true,
            revokedAt: true,
            sentAt: true,
          },
        },
      },
    });
    if (!c) throw new AppError(404, "Client not found.");
    return c;
  }
  if (section === "clients") {
    const where = search
      ? {
          OR: [
            { company: { contains: search } },
            { email: { contains: search } },
          ],
        }
      : {};
    const [items, total] = await Promise.all([
      db.client.findMany({
        where,
        skip,
        take: 25,
        orderBy: { createdAt: "desc" },
        include: {
          package: { select: { name: true } },
          mapping: { select: { lastSyncAt: true, lastError: true } },
          _count: { select: { memberships: true } },
        },
      }),
      db.client.count({ where }),
    ]);
    return { items, total, page };
  }
  if (section === "invitations")
    return {
      items: await db.invitation.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          expiresAt: true,
          acceptedAt: true,
          revokedAt: true,
          sentAt: true,
          clientId: true,
          client: { select: { company: true } },
        },
        skip,
        take: 25,
        orderBy: { createdAt: "desc" },
      }),
    };
  if (section === "users")
    return {
      items: await db.user.findMany({
        select: {
          id: true,
          name: true,
          email: true,
          disabled: true,
          superadmin: true,
          createdAt: true,
        },
        skip,
        take: 25,
        orderBy: { createdAt: "desc" },
      }),
    };
  if (section === "audit")
    return {
      items: await db.auditLog.findMany({
        skip,
        take: 25,
        orderBy: { createdAt: "desc" },
      }),
    };
  if (section === "jobs")
    return {
      items: await db.backgroundJob.findMany({
        select: {
          id: true,
          type: true,
          status: true,
          progress: true,
          total: true,
          attempts: true,
          error: true,
          runAfter: true,
          clientId: true,
        },
        skip,
        take: 25,
        orderBy: { createdAt: "desc" },
      }),
    };
  if (section === "system") {
    let provider = "Error";
    try {
      await agencyRequest("/account");
      provider = "Connected";
    } catch {}
    return {
      application: "Healthy",
      mysql: "Connected",
      provider,
      cron: await db.appSetting.findUnique({ where: { key: "cron.lastRun" } }),
      pendingJobs: await db.backgroundJob.count({
        where: { status: { in: ["pending", "retry"] } },
      }),
      failedJobs: await db.backgroundJob.count({ where: { status: "failed" } }),
      webhook: "Disabled — authenticity contract unverified",
      logs: await db.apiLog.findMany({
        take: 15,
        orderBy: { createdAt: "desc" },
      }),
    };
  }
  if (section === "overview") {
    const [clients, active, suspended, pending, activity, packages] =
      await Promise.all([
        db.client.count(),
        db.client.count({ where: { status: "ACTIVE" } }),
        db.client.count({ where: { status: "SUSPENDED" } }),
        db.invitation.count({
          where: {
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
        }),
        db.auditLog.findMany({ take: 10, orderBy: { createdAt: "desc" } }),
        db.package.findMany({
          select: {
            id: true,
            name: true,
            _count: { select: { clients: true } },
          },
        }),
      ]);
    return { clients, active, suspended, pending, activity, packages };
  }
  throw new AppError(404, "Not found.");
});
export const POST = endpoint(async (request, context) => {
  sameOrigin(request);
  const who = await admin(request);
  const { path } = await context.params;
  const [section, id, action] = path;
  const data = await json(request);
  if (section === "clients" && id && action === "sync")
    return queueOnboarding(who.user.id, id, data);
  if (section === "clients" && id && action === "sync-progress") {
    const jobId = z.string().min(1).max(100).parse(data.jobId);
    const state = await onboardingStatus(id, jobId);
    if (!state.job) throw new AppError(404, "Sync job not found.");
    if (["pending", "retry", "processing"].includes(state.job.status))
      await processJobs(state.job.id);
    else if (
      state.job.syncCompleted &&
      state.email &&
      ["pending", "retry", "processing"].includes(state.email.status)
    )
      await processJobs(state.email.id);
    return onboardingStatus(id, jobId);
  }
  if (section === "settings") return saveBranding(who.user.id, data);
  if (section === "jobs" && id && action === "cancel")
    return cancelJob(who.user.id, id);
  if (section === "packages") return savePackage(who.user.id, data, id);
  if (section === "clients" && !id) return createClient(who.user.id, data);
  if (section === "impersonation" && id === "stop") {
    await db.session.update({
      where: { id: who.session.id },
      data: { impersonatingClientId: null, impersonationExpiresAt: null },
    });
    await db.auditLog.create({
      data: { actorId: who.user.id, action: "impersonation.ended" },
    });
    return { ok: true };
  }
  if (section === "clients" && id)
    return withLease(`tenant:${id}`, async () => {
      const client = await db.client.findUniqueOrThrow({ where: { id } });
      if (action === "invite") {
        if (client.status !== "ACTIVE")
          throw new AppError(
            422,
            "Activate this workspace before inviting its owner.",
          );
        return createInvitation(id, who.user.id, data);
      }
      if (action === "impersonate") {
        await db.session.update({
          where: { id: who.session.id },
          data: {
            impersonatingClientId: id,
            impersonationExpiresAt: new Date(Date.now() + 1800000),
          },
        });
        await db.auditLog.create({
          data: {
            actorId: who.user.id,
            clientId: id,
            action: "impersonation.started",
          },
        });
        return { ok: true };
      }
      if (action === "suspend" || action === "reactivate") {
        if (data.confirm !== true)
          throw new AppError(422, "Confirm this action.");
        if (action === "reactivate") return activateClient(who.user.id, id);
        if (client.status === "DRAFT")
          throw new AppError(
            422,
            "This workspace is already an inactive draft.",
          );
        await db.client.update({
          where: { id },
          data: { status: "SUSPENDED" },
        });
      } else if (action === "package") {
        const packageId = z.string().min(1).parse(data.packageId);
        if (
          !(await db.package.findFirst({
            where: {
              id: packageId,
              active: true,
              serviceType: "EMAIL",
              requiresLimitReview: false,
            },
          }))
        )
          throw new AppError(422, "Choose an active, reviewed email package.");
        await db.client.update({ where: { id }, data: { packageId } });
      } else if (action === "overrides") {
        const input = z
          .object({
            permissions: z.array(
              z.object({ key: z.enum(permissions), enabled: z.boolean() }),
            ),
            limits: z.array(
              z.object({
                key: z.enum(limitKeys),
                value: z.number().int().min(-1).max(2147483647),
              }),
            ),
          })
          .parse(data);
        await db.client.update({
          where: { id },
          data: {
            permissions: { deleteMany: {}, create: input.permissions },
            limits: { deleteMany: {}, create: input.limits },
          },
        });
      } else if (action === "edit") {
        const input = clientInput
          .omit({
            packageId: true,
            connection: true,
            clientspaceId: true,
            sendNow: true,
          })
          .parse(data);
        await db.client.update({ where: { id }, data: input });
      } else if (action === "connection") {
        return rotateConnection(who.user.id, id, data);
      } else if (action === "members") {
        return changeMember(who.user.id, id, data);
      } else throw new AppError(404, "Action not found.");
      await db.auditLog.create({
        data: {
          actorId: who.user.id,
          clientId: id,
          action: `client.${action}`,
        },
      });
      return { ok: true };
    });
  if (section === "invitations" && id) {
    const invite = await db.invitation.findUniqueOrThrow({ where: { id } });
    return withLease(`tenant:${invite.clientId}`, async () => {
      if (invite.acceptedAt)
        throw new AppError(409, "Invitation already accepted.");
      await db.invitation.update({
        where: { id },
        data: { revokedAt: new Date() },
      });
      if (action === "resend")
        return createInvitation(invite.clientId, who.user.id, {
          email: invite.email,
          name: invite.name,
          role: invite.role,
          sendNow: true,
        });
      await db.auditLog.create({
        data: {
          actorId: who.user.id,
          clientId: invite.clientId,
          action: "invitation.revoked",
          resourceId: id,
        },
      });
      return { ok: true };
    });
  }
  if (section === "users" && id) {
    const disabled = z.boolean().parse(data.disabled);
    if (id === who.user.id)
      throw new AppError(422, "You cannot disable your own account.");
    await db.user.update({ where: { id }, data: { disabled } });
    if (disabled) await db.session.deleteMany({ where: { userId: id } });
    await db.auditLog.create({
      data: {
        actorId: who.user.id,
        action: "user.access-changed",
        resourceId: id,
      },
    });
    return { ok: true };
  }
  throw new AppError(404, "Not found.");
});
