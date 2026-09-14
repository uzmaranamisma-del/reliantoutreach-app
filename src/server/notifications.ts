import { db } from "@/lib/db";
// Read terminal jobs in stable order so busy workspaces cannot starve older notices.
export async function syncJobNotifications() {
  const cursor = await db.appSetting.findUnique({
    where: { key: "notifications.jobCursor" },
  });
  const saved = cursor?.value as { at?: string; id?: string } | undefined;
  const after = saved?.at ? new Date(saved.at) : new Date(0);
  const jobs = await db.backgroundJob.findMany({
    where: {
      clientId: { not: null },
      status: { in: ["completed", "failed", "cancelled"] },
      OR: [
        { updatedAt: { gt: after } },
        { updatedAt: after, id: { gt: saved?.id || "" } },
      ],
    },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: 100,
    select: {
      id: true,
      clientId: true,
      type: true,
      status: true,
      updatedAt: true,
    },
  });
  for (const job of jobs) {
    await db.notification.upsert({
      where: { id: `job:${job.id}` },
      create: {
        id: `job:${job.id}`,
        clientId: job.clientId!,
        title: `${job.type === "prospect-import" ? "Prospect import / enrollment" : job.type === "reconcile" ? "Workspace sync" : job.type === "client-onboarding" ? "Workspace setup" : "Invitation delivery"}: ${job.status}`,
      },
      update: {},
    });
  }
  if (jobs.length) {
    const value = {
      at: jobs.at(-1)!.updatedAt.toISOString(),
      id: jobs.at(-1)!.id,
    };
    await db.appSetting.upsert({
      where: { key: "notifications.jobCursor" },
      create: { key: "notifications.jobCursor", value },
      update: { value },
    });
  }
}
