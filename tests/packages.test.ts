import { expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
import { packageInput } from "@/server/admin";
import { publishedPackages } from "@/lib/package-catalog";
const base = {
  name: "Launch",
  description: "Service",
  price: 500,
  billingLabel: "per month",
  features: [],
  limits: [],
  active: false,
  requiresLimitReview: true,
};
it("allows saving incomplete limits as a draft but refuses activation", () => {
  expect(packageInput.safeParse(base).success).toBe(true);
  expect(packageInput.safeParse({ ...base, active: true }).success).toBe(false);
});
it("rejects duplicate limits and invalid negative capacity", () => {
  expect(
    packageInput.safeParse({
      ...base,
      limits: [{ key: "prospects", value: -2 }],
    }).success,
  ).toBe(false);
  expect(
    packageInput.safeParse({
      ...base,
      limits: [
        { key: "prospects", value: 100 },
        { key: "prospects", value: 200 },
      ],
    }).success,
  ).toBe(false);
});
it("keeps website packages unassigned drafts with only published email capacities", () => {
  expect(publishedPackages.map((p) => [p.name, p.price, p.setupPrice])).toEqual(
    [
      ["Launch", 500, 1500],
      ["Growth", 1000, 2500],
      ["Scale", 1500, 4000],
      ["LinkedIn Outreach", 2500, 1500],
    ],
  );
  expect(publishedPackages.every((p) => p.active === false)).toBe(true);
  expect(
    publishedPackages
      .filter((p) => p.serviceType === "EMAIL")
      .every((p) => p.requiresLimitReview),
  ).toBe(true);
});
