import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { withLease } from "@/lib/locks";
import { teamCapacity } from "@/server/invitations";

type MobileUser = { id: string; email: string; superadmin: boolean; emailVerified: boolean };
const clientSelect = { id: true, company: true } as const;
const unavailable = () => new AppError(403, "Workspace access is unavailable.");

// Main-account access becomes an ordinary membership, so replies, package
// permissions and push delivery keep using the existing tenant checks.
export async function mobileWorkspaces(
  user: MobileUser,
  activeClientId: string | null,
) {
  const memberships = await db.clientMembership.findMany({
    where: { userId: user.id, disabled: false, client: { status: "ACTIVE" } },
    select: { client: { select: clientSelect } },
    orderBy: { createdAt: "asc" },
  });
  const mainAccounts = user.superadmin || user.emailVerified
    ? await db.client.findMany({
        where: {
          ...(user.superadmin ? {} : { email: user.email }),
          status: "ACTIVE",
          mapping: { is: { providerType: "organization" } },
          // A revoked membership must never become a new access candidate.
          memberships: { none: { userId: user.id } },
        },
        select: clientSelect,
        orderBy: { createdAt: "asc" },
      })
    : [];
  return {
    items: [...memberships, ...mainAccounts.map((client) => ({ client }))],
    // The app must POST a selection before opening an unjoined main account.
    activeClientId: memberships.some((m) => m.client.id === activeClientId)
      ? activeClientId
      : null,
  };
}

export async function ensureMobileWorkspace(
  user: MobileUser,
  clientId: string,
) {
  const where = { userId_clientId: { userId: user.id, clientId } };
  const member = await db.clientMembership.findUnique({
    where,
    include: { client: true },
  });
  if (member) {
    if (member.disabled || member.client.status !== "ACTIVE")
      throw unavailable();
    return; // Preserve an existing member's role and permissions.
  }
  if (!user.superadmin && !user.emailVerified) throw unavailable();

  await withLease(`tenant:${clientId}`, async () => {
    const existing = await db.clientMembership.findUnique({
      where,
      include: { client: true },
    });
    if (existing) {
      if (existing.disabled || existing.client.status !== "ACTIVE")
        throw unavailable();
      return;
    }
    const eligible = await db.client.findFirst({
      where: {
        id: clientId,
        ...(user.superadmin ? {} : { email: user.email }),
        status: "ACTIVE",
        mapping: { is: { providerType: "organization" } },
      },
      select: { id: true },
    });
    if (!eligible) throw unavailable();
    await teamCapacity(clientId, 1, user.email);
    await db.$transaction(async (tx) => {
      const owner = await tx.user.findUnique({ where: { id: user.id } });
      const client = await tx.client.findUnique({
        where: { id: clientId },
        include: { mapping: true },
      });
      if (
        !owner ||
        owner.disabled ||
        !client ||
        client.status !== "ACTIVE" ||
        client.mapping?.providerType !== "organization" ||
        // The client contact email is the administrator's assigned owner.
        // An existing verified owner needs no second invitation or mobile toggle.
        (!owner.superadmin && (!owner.emailVerified || client.email.toLowerCase() !== owner.email.toLowerCase())) ||
        owner.superadmin !== user.superadmin
      )
        throw unavailable();
      const membership = await tx.clientMembership.create({
        data: { clientId, userId: user.id, role: "CLIENT_OWNER" },
      });
      // Reusing an existing login needs no owner invitation or password reset.
      await tx.invitation.updateMany({
        where: {
          clientId,
          email: owner.email,
          acceptedAt: null,
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          clientId,
          action: "mobile.main-account-joined",
          resourceId: membership.id,
        },
      });
    });
  });
}
