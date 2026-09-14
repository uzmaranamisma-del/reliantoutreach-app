import { vi, it, expect, beforeEach } from "vitest";
vi.mock("@/server/jobs", () => ({
  processJobs: vi.fn().mockResolvedValue({ processed: 2 }),
  scheduleReconciliation: vi.fn(),
}));
import { POST } from "../src/app/api/internal/cron/process-jobs/route";
import { processJobs } from "../src/server/jobs";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "sufficiently-long-cron-secret";
});
it("rejects missing authorization without processing", async () => {
  const response = await POST(
    new Request("https://app.example/api", { method: "POST" }),
    {},
  );
  expect(response.status).toBe(401);
  expect(processJobs).not.toHaveBeenCalled();
});
it("accepts only the configured bearer secret", async () => {
  const response = await POST(
    new Request("https://app.example/api", {
      method: "POST",
      headers: { Authorization: "Bearer sufficiently-long-cron-secret" },
    }),
    {},
  );
  expect(response.status).toBe(200);
  expect(processJobs).toHaveBeenCalledTimes(1);
});
it("fails closed when no cron secret is configured", async () => {
  delete process.env.CRON_SECRET;
  const response = await POST(
    new Request("https://app.example/api", {
      method: "POST",
      headers: { Authorization: "Bearer " },
    }),
    {},
  );
  expect(response.status).toBe(401);
});
