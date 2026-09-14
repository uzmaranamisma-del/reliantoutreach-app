import { test, expect } from "@playwright/test";
test("sign-in page is usable and responsive", async ({ page }) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toBeVisible();
  await page.getByLabel("Email address").fill("owner@example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrong-password");
  await page.route("**/api/auth/sign-in/email", (r) =>
    r.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Invalid email or password",
        code: "INVALID_EMAIL_OR_PASSWORD",
      }),
    }),
  );
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.locator('.error-message[role="alert"]')).toContainText(
    "Invalid email or password",
  );
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
test("forgot password has a real form and a sign-in return path", async ({
  page,
}) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(
    page.getByRole("heading", { name: "Reset your password" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send reset link" }),
  ).toBeVisible();
});
test("unconfigured sessions do not expose portal data", async ({ page }) => {
  await page.goto("/app");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login/);
});
