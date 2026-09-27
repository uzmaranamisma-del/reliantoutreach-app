import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import mariadb from "mariadb";
const databaseUrl = new URL(process.env.DATABASE_URL || "mysql://none:none@127.0.0.1/none");
const pool = mariadb.createPool({ host: databaseUrl.hostname, port: Number(databaseUrl.port || 3306), user: decodeURIComponent(databaseUrl.username), password: decodeURIComponent(databaseUrl.password), database: databaseUrl.pathname.slice(1), cachingRsaPublicKey: process.env.DATABASE_RSA_PUBLIC_KEY, connectionLimit: 2 });
const enabled = process.env.E2E_DATABASE_TESTS === "true";
test.skip(!enabled, "Requires an isolated test database");
const suffix = randomUUID();
const userId = `e2e-${suffix}`;
const email = `${suffix}@example.test`;
const password = "E2e-only-Strong-password-927!";
let clientId: string, otherId: string, packageId: string;
test.beforeAll(async () => {
  if (!enabled) return;
  if (!/_(ci|test)$/.test(new URL(process.env.DATABASE_URL!).pathname)) throw new Error("E2E_DATABASE_TESTS requires a database ending in _ci or _test");
  packageId = randomUUID(); clientId = randomUUID(); otherId = randomUUID();
  await pool.query("INSERT INTO Package (id,name,description,price,billingLabel,updatedAt) VALUES (?,?,?,0,'test',NOW())", [packageId, `E2E ${suffix}`, "Test"]);
  for (const key of ["inbox.view", "inbox.manage", "inbox.reply"]) await pool.query("INSERT INTO PackageFeature (id,packageId,`key`,enabled) VALUES (?,?,?,true)", [randomUUID(), packageId, key]);
  for (const id of [clientId, otherId]) await pool.query("INSERT INTO Client (id,company,firstName,lastName,email,country,packageId,updatedAt) VALUES (?,'E2E workspace','Test','Owner',?,'PK',?,NOW())", [id,email,packageId]);
  await pool.query("INSERT INTO User (id,name,email,emailVerified,updatedAt) VALUES (?,'Read only tester',?,true,NOW())", [userId,email]);
  await pool.query("INSERT INTO Account (id,accountId,providerId,userId,password,updatedAt) VALUES (?,?,'credential',?,?,NOW())", [userId,userId,userId,await hashPassword(password)]);
  await pool.query("INSERT INTO ClientMembership (id,userId,clientId,role) VALUES (?,?,?,'CLIENT_MEMBER')", [randomUUID(),userId,clientId]);
  await pool.query("INSERT INTO Notification (id,clientId,title) VALUES (?,?,'Test workspace update'), (?,?,'Other workspace private notice')", [`notice-${suffix}`,clientId,`other-${suffix}`,otherId]);
});
test.afterAll(async () => {
  if (!enabled || !packageId) return;
  await pool.query("DELETE FROM Notification WHERE clientId IN (?,?)", [clientId,otherId]);
  await pool.query("DELETE FROM Client WHERE id IN (?,?)", [clientId,otherId]);
  await pool.query("DELETE FROM User WHERE id=?", [userId]);
  await pool.query("DELETE FROM Package WHERE id=?", [packageId]);
  await pool.end();
});
test("real login, tenant isolation, read-only permission and personal acknowledgments", async ({ page }) => {
  test.setTimeout(90000);
  // Mock provider-backed reads only. Authentication and tested APIs use MySQL.
  await page.route("**/api/portal/campaigns?*", r => r.fulfill({ json: { items: [] } }));
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/app/, { timeout: 25000 });
  const origin = new URL(page.url()).origin;
  const metadata = await page.request.post("/api/portal/inbox/meta", { headers: { Origin: origin }, data: { email: "a@example.test", status: "CLOSED", tags: [], notes: "Must not save", assigneeId: null } });
  expect(metadata.status()).toBe(403);
  const notices = await (await page.request.get("/api/portal/notifications")).json();
  expect(notices.items.some((n: any) => n.id === `other-${suffix}`)).toBe(false);
  expect((await page.request.post(`/api/portal/notifications/other-${suffix}`, { headers: { Origin: origin }, data: {} })).status()).toBe(404);
  expect((await page.request.post(`/api/portal/notifications/notice-${suffix}`, { headers: { Origin: origin }, data: {} })).status()).toBe(200);
  expect((await pool.query("SELECT readAt FROM Notification WHERE id=?", [`notice-${suffix}`]))[0].readAt).toBeNull();
  expect((await pool.query("SELECT * FROM NotificationRead WHERE userId=? AND notificationId=?", [userId,`notice-${suffix}`])).length).toBe(1);
  expect((await page.request.get("/api/admin/clients")).status()).toBe(403);
  await pool.query("UPDATE ClientMembership SET role='CLIENT_OWNER' WHERE userId=? AND clientId=?", [userId,clientId]);
  await pool.query("INSERT INTO ConversationMeta (id,clientId,fromEmail,notes,status,updatedAt) VALUES (?,?,'alice@example.test','Alice only','MEETING',NOW())", [randomUUID(),clientId]);
  await page.route("**/api/portal/inbox?*", r => r.fulfill({ json: { items: [
    { id: "alice-old", fromEmail: "alice@example.test", subject: "Old Alice", createdAt: "2026-09-01", preview: "old" },
    { id: "alice-new", fromEmail: "alice@example.test", subject: "Latest Alice", createdAt: "2026-09-03", preview: "latest" },
    { id: "bob", fromEmail: "bob@example.test", subject: "Hello Bob", createdAt: "2026-09-02", preview: "hello" },
  ], pagination: { totalItems: 3 } } }));
  await page.route("**/api/portal/inbox/thread?*", r => r.fulfill({ json: { items: [], pagination: {} } }));
  await page.goto("/app/inbox");
  await expect(page.locator("button.conversation")).toHaveCount(2);
  await page.getByRole("button", { name: /Latest Alice/ }).click();
  await page.locator("#reply").fill("Saved Alice draft");
  await page.getByText("Conversation details", { exact: true }).click();
  await expect(page.getByLabel("Internal notes")).toHaveValue("Alice only");
  if (await page.getByRole("button", { name: "Back to replies" }).isVisible()) await page.getByRole("button", { name: "Back to replies" }).click();
  await page.getByRole("button", { name: /Hello Bob/ }).click();
  await expect(page.locator("#reply")).toHaveValue("");
  if (!(await page.getByLabel("Internal notes").isVisible())) await page.getByText("Conversation details", { exact: true }).click();
  await expect(page.getByLabel("Internal notes")).toHaveValue("");
  if (await page.getByRole("button", { name: "Back to replies" }).isVisible()) await page.getByRole("button", { name: "Back to replies" }).click();
  await page.getByRole("button", { name: /Latest Alice/ }).click();
  await expect(page.locator("#reply")).toHaveValue("Saved Alice draft");
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
});
