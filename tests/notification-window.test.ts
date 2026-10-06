import { vi, beforeEach, afterEach, it, expect } from "vitest";
vi.mock("@/lib/locks", () => ({ withLease: vi.fn((_key, fn) => fn()) }));
vi.mock("@/server/reply-alerts", () => ({ collectReplyAlerts: vi.fn() }));
vi.mock("@/server/native-push", () => ({ processNativePush: vi.fn() }));
vi.mock("@/server/push", () => ({ processPushDeliveries: vi.fn() }));
import { collectReplyAlerts } from "@/server/reply-alerts";
import { processNativePush } from "@/server/native-push";
import { processPushDeliveries } from "@/server/push";
import { processNotificationWindow } from "@/server/notification-window";
import { withLease } from "@/lib/locks";
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
  vi.resetAllMocks();
  vi.mocked(withLease).mockImplementation(async (_key, fn) => fn());
  vi.mocked(collectReplyAlerts).mockResolvedValue({ scanned: 1, failed: 0, queued: 1 });
});
afterEach(() => vi.useRealTimers());
it("checks at 0, 15, 30 and 45 seconds without repeating maintenance", async () => {
  const times: number[] = [];
  vi.mocked(collectReplyAlerts).mockImplementation(async () => {
    times.push(Date.now());
    return { scanned: 1, failed: 0, queued: 1 };
  });
  const running = processNotificationWindow();
  await vi.runAllTimersAsync();
  expect((await running).passes).toBe(4);
  expect(times).toEqual([0, 15000, 30000, 45000]);
  expect(processNativePush).toHaveBeenCalledTimes(4);
  expect(withLease).toHaveBeenCalledWith("notifications:window", expect.any(Function), 240);
});
it("still submits queued native alerts when collection or web push fails", async () => {
  vi.mocked(collectReplyAlerts).mockRejectedValue(new Error("Provider unavailable"));
  vi.mocked(processPushDeliveries).mockRejectedValue(new Error("Web push unavailable"));
  const running = processNotificationWindow();
  await vi.runAllTimersAsync();
  await running;
  expect(processNativePush).toHaveBeenCalledTimes(4);
});
it("skips missed intervals after a slow request instead of bursting", async () => {
  const times: number[] = [];
  vi.mocked(collectReplyAlerts).mockImplementation(async () => {
    times.push(Date.now());
    await new Promise((resolve) => setTimeout(resolve, 20000));
    return { scanned: 1, failed: 0, queued: 0 };
  });
  const running = processNotificationWindow();
  await vi.runAllTimersAsync();
  expect((await running).passes).toBe(2);
  expect(times).toEqual([0, 30000]);
});
