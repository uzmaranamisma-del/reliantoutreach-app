import { headers } from "next/headers";
import { getAuth } from "./auth";
import { db } from "./db";
import { AppError } from "./errors";
import {
  getEffectivePermission,
  getEffectiveLimit,
  type Permission,
  type LimitKey,
} from "./permissions";
export async function identity(request?: Request) {
  const session = await getAuth().api.getSession({
    headers: request?.headers || (await headers()),
  });
  if (!session) throw new AppError(401, "Please sign in.");
  const [user, stored] = await Promise.all([
    db.user.findUnique({ where: { id: session.user.id } }),
    db.session.findUnique({ where: { id: session.session.id } }),
  ]);
  if (!user || user.disabled || !stored || stored.expiresAt < new Date())
    throw new AppError(401, "Please sign in.");
  return { user, session: stored };
}
export async function admin(request?: Request) {
  const who = await identity(request);
  if (!who.user.superadmin) throw new AppError(403, "Unauthorized.");
  return who;
}
export async function tenant(request?: Request, permission?: Permission) {
  const who = await identity(request);
  const impersonating =
    who.user.superadmin &&
    who.session.impersonatingClientId &&
    who.session.impersonationExpiresAt &&
    who.session.impersonationExpiresAt > new Date();
  const member = await db.clientMembership.findFirst({
    where: {
      userId: who.user.id,
      disabled: false,
      ...(who.session.activeClientId
        ? { clientId: who.session.activeClientId }
        : {}),
    },
    orderBy: { createdAt: "asc" },
  });
  const clientId = impersonating
    ? who.session.impersonatingClientId
    : member?.clientId;
  if (!clientId)
    throw new AppError(403, "No workspace is assigned to this account.");
  const client = await db.client.findUnique({
    where: { id: clientId },
    include: {
      package: { include: { features: true, limits: true } },
      permissions: true,
      limits: true,
    },
  });
  if (!client || client.status !== "ACTIVE")
    throw new AppError(
      403,
      "Your workspace is currently unavailable. Please contact support.",
    );
  const role = impersonating ? "CLIENT_OWNER" : member!.role;
  const can = (p: Permission) =>
    getEffectivePermission(
      p,
      role,
      client.package.features,
      client.permissions,
    );
  if (permission && !can(permission))
    throw new AppError(
      403,
      "Your account does not have permission for this action.",
    );
  return {
    ...who,
    client,
    role,
    impersonating: !!impersonating,
    can,
    limit: (key: LimitKey) =>
      getEffectiveLimit(key, client.package.limits, client.limits),
  };
}
export type Tenant = Awaited<ReturnType<typeof tenant>>;
