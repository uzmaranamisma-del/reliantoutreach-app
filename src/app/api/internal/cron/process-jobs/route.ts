import { secretMatches } from "@/lib/crypto";
import { endpoint, AppError } from "@/lib/errors";
import { processJobs, scheduleReconciliation } from "@/server/jobs";
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
  await scheduleReconciliation();
  return processJobs();
});
