import { expect, it } from "vitest";
import { brandingInput, defaultBranding } from "@/lib/branding";
import { validateSchedule } from "@/lib/manyreach/schedule";
it.each([
  "javascript:alert(1)",
  "data:text/html,hello",
  "http://example.com/privacy",
])("rejects unsafe policy URL %s", (url) => {
  expect(
    brandingInput.safeParse({ ...defaultBranding, privacyUrl: url }).success,
  ).toBe(false);
});
it("accepts optional policy links and a published HTTPS policy", () => {
  expect(brandingInput.safeParse(defaultBranding).success).toBe(true);
  expect(
    brandingInput.safeParse({
      ...defaultBranding,
      privacyUrl: "https://example.com/privacy",
    }).success,
  ).toBe(true);
});
it.each([
  { scheduleSending: true },
  { scheduleSending: true, sendMon: true },
  {
    scheduleSending: true,
    sendMon: true,
    sendMonAfter: 1020,
    sendMonBefore: 540,
  },
  {
    scheduleSending: true,
    sendMon: true,
    sendMonAfter: 0,
    sendMonBefore: 1500,
  },
])("rejects incomplete or reversed schedules: %j", (value) =>
  expect(() => validateSchedule(value)).toThrow(),
);
it("accepts a valid schedule or explicit disabled scheduling", () => {
  expect(() =>
    validateSchedule({
      scheduleSending: true,
      sendMon: true,
      sendMonAfter: 540,
      sendMonBefore: 1020,
    }),
  ).not.toThrow();
  expect(() => validateSchedule({ scheduleSending: false })).not.toThrow();
});
