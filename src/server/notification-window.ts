import { withLease } from "@/lib/locks";
import { collectReplyAlerts } from "./reply-alerts";
import { processNativePush } from "./native-push";
import { processPushDeliveries } from "./push";

export const NOTIFICATION_INTERVAL_MS = 15_000;
const WINDOW_MS = 45_000;

// The existing authenticated minute cron keeps this request alive. No detached
// timers or extra daemon: all work is awaited before returning to the scheduler.
export async function processNotificationWindow() {
  return withLease("notifications:window", async () => {
    const started = Date.now();
    const outcomes: Record<string, unknown> = {};
    let passes = 0;
    const stage = async (name: string, run: () => Promise<unknown>) => {
      try { outcomes[name] = await run(); }
      catch { outcomes[name] = { error: "Stage failed; inspect system health." }; }
    };
    for (let offset = 0; offset <= WINDOW_MS; offset += NOTIFICATION_INTERVAL_MS) {
      const due = started + offset;
      // A slow provider must not cause a burst of missed polls or an endless loop.
      if (offset > 0 && Date.now() > due) continue;
      if (Date.now() < due) await new Promise((resolve) => setTimeout(resolve, due - Date.now()));
      await stage("replies", collectReplyAlerts);
      // A failed scan or slow browser-push endpoint must not delay Android push.
      await Promise.all([
        stage("nativePush", processNativePush),
        stage("push", processPushDeliveries),
      ]);
      passes++;
    }
    return { ...outcomes, passes, intervalSeconds: NOTIFICATION_INTERVAL_MS / 1000 };
  }, 240);
}
