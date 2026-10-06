import { describe, expect, it } from "vitest";
import {
  newerRelease,
  reminderDue,
  REMINDER_INTERVAL,
} from "../apps/mobile/src/lib/attention-policy";
import { GET } from "@/app/api/mobile-release/route";
describe("mobile reminders and release checks", () => {
  it("allows the first reminder, suppresses refresh repeats and waits a week", () => {
    const now = 1800000000000;
    expect(reminderDue(null, now)).toBe(true);
    expect(reminderDue(String(now), now + 10000)).toBe(false);
    expect(reminderDue(String(now), now + REMINDER_INTERVAL - 1)).toBe(false);
    expect(reminderDue(String(now), now + REMINDER_INTERVAL)).toBe(true);
    expect(reminderDue(String(now + 10000), now)).toBe(false);
  });
  it("compares actual build numbers, not lexicographic version strings", () => {
    const release = {
      version: "1.0.1",
      build: 10,
      notes: "Notification improvements",
    };
    expect(newerRelease(release, "9")).toEqual(release);
    expect(newerRelease(release, "10")).toBeNull();
    expect(newerRelease(release, "11")).toBeNull();
    expect(newerRelease(release, null)).toBeNull();
  });
  it("rejects malformed releases and strips untrusted download links", () => {
    expect(
      newerRelease({ version: "1.0.1", build: "10", notes: "x" }, "2"),
    ).toBeNull();
    expect(
      newerRelease(
        { version: "1.0.1", build: 10, notes: "x".repeat(1001) },
        "2",
      ),
    ).toBeNull();
    expect(
      newerRelease(
        { version: "1.0.1", build: 10, notes: "x", url: "https://evil.test" },
        "2",
      ),
    ).not.toHaveProperty("url");
  });
  it("publishes only the available Android build with no stale cache or iOS promise", async () => {
    const response = GET(),
      body = await response.json();
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body.ios).toBeNull();
    expect(body.android.build).toBeGreaterThanOrEqual(3);
    expect(body.android.apk).toMatch(
      /^https:\/\/github\.com\/uzmaranamisma-del\/reliantoutreach-app\/releases\/download\/[^/]+\/[^/]+\.apk$/,
    );
  });
});
