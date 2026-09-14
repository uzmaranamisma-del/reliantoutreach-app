import { notFound, redirect } from "next/navigation";
import { admin } from "@/lib/access";
import { db } from "@/lib/db";
import { permissions, getEffectivePermission } from "@/lib/permissions";
import { Shell } from "@/components/shell";
import { Dashboard } from "@/features/portal/dashboard";
import type { ClientPreview } from "@/lib/client-preview";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let who;
  try {
    who = await admin();
  } catch {
    redirect("/login");
  }
  const { id } = await params;
  const client = await db.client.findUnique({
    where: { id },
    include: { package: { include: { features: true } }, permissions: true },
  });
  if (!client) notFound();
  const [snapshot, activity] = await Promise.all([
    db.usageSnapshot.findUnique({
      where: { clientId_period: { clientId: id, period: "current" } },
    }),
    db.auditLog.findMany({
      where: { clientId: id },
      select: { id: true, action: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const preview: ClientPreview = {
    id,
    name: `${client.firstName} ${client.lastName}`.trim(),
    company: client.company,
    package: client.package.name,
    permissions: Object.fromEntries(
      permissions.map((p) => [
        p,
        getEffectivePermission(
          p,
          "CLIENT_OWNER",
          client.package.features,
          client.permissions,
        ),
      ]),
    ),
    snapshot: snapshot
      ? {
          values: snapshot.values as Record<string, number>,
          capturedAt: snapshot.capturedAt.toISOString(),
        }
      : null,
    activity: activity.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
  };
  return (
    <Shell name={who.user.name} preview={preview}>
      <Dashboard preview={preview} />
    </Shell>
  );
}
