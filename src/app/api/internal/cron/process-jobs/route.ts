import { secretMatches } from "@/lib/crypto";
import { endpoint, AppError } from "@/lib/errors";
import { processJobs, scheduleReconciliation } from "@/server/jobs";
import { processNotificationWindow } from "@/server/notification-window";
import { collectMonthlyUsage } from "@/server/monthly-usage";
export const runtime = "nodejs";
export const POST = endpoint(async (request) => {
  if (
    !secretMatches(
      request.headers.get("authorization") || "",
      `Bearer ${process.env.CRON_SECRET || ""}`,
    ) ||
    !process.env.CRON_SECRET
  )
    throw new AppError(401, "Unauthorized.");
  // Notification polling has its own lease and runs alongside maintenance,
  // so imports and usage scans cannot add a minute to new reply alerts.
  const outcomes: Record<string, unknown> = {};
  const stage = async (name: string, run: () => Promise<unknown>) => {
    try { outcomes[name] = await run(); }
    catch { outcomes[name] = { error: "Stage failed; inspect system health." }; }
  };
  await Promise.all([
    stage("notifications", processNotificationWindow),
    (async () => {
      await stage("jobs", async () => { await scheduleReconciliation(); return processJobs(); });
      await stage("usage", collectMonthlyUsage);
    })(),
  ]);
  return outcomes;
});
