import { expect, it, vi } from "vitest";
vi.mock("@/lib/db", () => ({ db: {} }));
import { packageInput } from "@/server/admin";
import {
  publishedPackages,
  approvedTechnicalLimits,
} from "@/lib/package-catalog";
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
it("activates website plans with owner-approved technical limits and published commercial capacities", () => {
  expect(publishedPackages.map((p) => [p.name, p.price, p.setupPrice])).toEqual(
    [
      ["Launch", 500, 558],
      ["Growth", 1000, 930],
      ["Scale", 1500, 1488],
      ["LinkedIn Outreach", 2500, 558],
    ],
  );
  expect(
    publishedPackages
      .filter((p) => p.serviceType === "EMAIL")
      .map((p) => p.monthlyEmails),
  ).toEqual([5000, 25000, 50000]);
  expect(approvedTechnicalLimits).toHaveLength(6);
  expect(
    approvedTechnicalLimits.every(
      (p) => p.value === -1 && p.key !== "monthlyEmails",
    ),
  ).toBe(true);
  expect(
    publishedPackages.find((p) => p.serviceType === "LINKEDIN")?.active,
  ).toBe(false);
  expect(
    publishedPackages
      .filter((p) => p.serviceType === "EMAIL")
      .every((p) => p.active && !p.requiresLimitReview),
  ).toBe(true);
});
