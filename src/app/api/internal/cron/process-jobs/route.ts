import { secretMatches } from "@/lib/crypto";
import { endpoint, AppError } from "@/lib/errors";
import { processJobs, scheduleReconciliation } from "@/server/jobs";
import { collectReplyAlerts } from "@/server/reply-alerts";
import { processPushDeliveries } from "@/server/push";
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
  // Independent stages: a provider outage must not block queued push retries.
  const outcomes: Record<string, unknown> = {};
  for (const [name, run] of [
    ["replies", collectReplyAlerts],
    ["push", processPushDeliveries],
    ["jobs", async () => { await scheduleReconciliation(); return processJobs(); }],
    ["usage", collectMonthlyUsage],
  ] as const) {
    try { outcomes[name] = await run(); }
    catch { outcomes[name] = { error: "Stage failed; inspect system health." }; }
  }
  return outcomes;
});
