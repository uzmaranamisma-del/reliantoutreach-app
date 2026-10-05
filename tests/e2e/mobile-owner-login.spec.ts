import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import mariadb from "mariadb";

const enabled = process.env.E2E_DATABASE_TESTS === "true";
test.skip(!enabled, "Requires an isolated test database");
const databaseUrl = new URL(process.env.DATABASE_URL || "mysql://none:none@127.0.0.1/none");
const pool = mariadb.createPool({
  host: databaseUrl.hostname, port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username), password: decodeURIComponent(databaseUrl.password),
  database: databaseUrl.pathname.slice(1), connectionLimit: 2,
  cachingRsaPublicKey: process.env.DATABASE_RSA_PUBLIC_KEY,
});
const suffix = randomUUID();
const ownerId = `owner-${suffix}`, adminId = `admin-${suffix}`;
const ownerEmail = `owner-${suffix}@example.test`, adminEmail = `admin-${suffix}@example.test`;
const mainId = randomUUID(), foreignId = randomUUID(), packageId = randomUUID();
const password = "Isolated-Mobile-Login-Only-527!";

test.beforeAll(async () => {
  if (!enabled) return;
  if (!/_(ci|test)$/.test(databaseUrl.pathname)) throw new Error("An isolated test database is required");
  await pool.query("INSERT INTO Package (id,name,description,price,billingLabel,updatedAt) VALUES (?,?,?,0,'test',NOW())", [packageId, `Mobile ${suffix}`, "Test"]);
  await pool.query("INSERT INTO PackageLimit (id,packageId,`key`,value) VALUES (?,?,'teamMembers',-1)", [randomUUID(), packageId]);
  for (const key of ["inbox.view", "inbox.reply", "analytics.view"])
    await pool.query("INSERT INTO PackageFeature (id,packageId,`key`,enabled) VALUES (?,?,?,true)", [randomUUID(), packageId, key]);
  for (const [id, email, admin] of [[ownerId, ownerEmail, false], [adminId, adminEmail, true]] as const) {
    await pool.query("INSERT INTO User (id,name,email,emailVerified,superadmin,updatedAt) VALUES (?,'Mobile tester',?,true,?,NOW())", [id, email, admin]);
    await pool.query("INSERT INTO Account (id,accountId,providerId,userId,password,updatedAt) VALUES (?,?,'credential',?,?,NOW())", [id, id, id, await hashPassword(password)]);
  }
  for (const [id, email] of [[mainId, ownerEmail], [foreignId, `foreign-${suffix}@example.test`]]) {
    await pool.query("INSERT INTO Client (id,company,firstName,lastName,email,country,packageId,updatedAt) VALUES (?,'Main account login test','Main','Owner',?,'PK',?,NOW())", [id, email, packageId]);
    await pool.query("INSERT INTO ManyreachClientspace (id,clientId,providerId,providerType,encryptedApiKey) VALUES (?,?,?,'organization','isolated-no-provider-calls')", [randomUUID(), id, parseInt(randomUUID().slice(0, 7), 16)]);
  }
  await pool.query("INSERT INTO Invitation (id,clientId,email,name,role,tokenHash,expiresAt) VALUES (?,?,?,'Existing owner','CLIENT_OWNER',?,DATE_SUB(NOW(),INTERVAL 1 DAY))", [randomUUID(), mainId, ownerEmail, randomUUID().replaceAll("-", "").padEnd(64, "0")]);
});

test.afterAll(async () => {
  if (!enabled) return;
  await pool.query("DELETE FROM Client WHERE id IN (?,?)", [mainId, foreignId]);
  await pool.query("DELETE FROM User WHERE id IN (?,?)", [ownerId, adminId]);
  await pool.query("DELETE FROM Package WHERE id=?", [packageId]);
  await pool.end();
});

test("existing owner credentials select the main account without an enable action, with an expired invite", async ({ playwright, page, baseURL }) => {
  const origin = new URL(baseURL!).origin;
  const login = await playwright.request.newContext({ baseURL: origin });
  const response = await login.post("/api/auth/sign-in/email", { headers: { Origin: origin }, data: { email: ownerEmail, password } });
  expect(response.status()).toBe(200);
  const token = response.headers()["set-auth-token"];
  expect(token).toBeTruthy();
  await login.dispose();
  const native = await playwright.request.newContext({ baseURL: origin, extraHTTPHeaders: { Origin: origin, Authorization: `Bearer ${token}` } });
  try {
    const workspaces = await (await native.get("/api/mobile/workspaces")).json();
    expect(workspaces.items.map((item: any) => item.client.id)).toEqual([mainId]);
    expect(workspaces.activeClientId).toBeNull();
    expect((await native.post("/api/mobile/workspace", { data: { clientId: foreignId } })).status()).toBe(403);
    // The installed APK already performs this selection automatically for one workspace.
    expect((await native.post("/api/mobile/workspace", { data: { clientId: mainId } })).status()).toBe(200);
    const context = await (await native.get("/api/mobile/context")).json();
    expect(context.client.id).toBe(mainId);
    expect(context.role).toBe("CLIENT_OWNER");
    expect(context.permissions["inbox.reply"]).toBe(true);
    expect((await native.get("/api/mobile/stats")).status()).toBe(200);
    expect((await native.get("/api/mobile/plans")).status()).toBe(200);
    expect((await native.get("/api/mobile/orders")).status()).toBe(200);
    expect((await native.get("/api/admin/clients")).status()).toBe(403);
    expect((await native.post("/api/mobile/workspace", { data: { clientId: mainId } })).status()).toBe(200);
    expect((await pool.query("SELECT * FROM ClientMembership WHERE userId=? AND clientId=?", [ownerId, mainId])).length).toBe(1);
    await pool.query("UPDATE ClientMembership SET disabled=true WHERE userId=? AND clientId=?", [ownerId, mainId]);
    expect((await (await native.get("/api/mobile/workspaces")).json()).items).toEqual([]);
    expect((await native.post("/api/mobile/workspace", { data: { clientId: mainId } })).status()).toBe(403);
  } finally { await native.dispose(); }

  await page.request.post("/api/auth/sign-in/email", { headers: { Origin: origin }, data: { email: adminEmail, password } });
  await page.goto(`/admin/clients/${mainId}`);
  await expect(page.getByRole("heading", { name: "Main account login test", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enable my mobile access", exact: true })).toHaveCount(0);
  const adminWorkspaces = await (await page.request.get("/api/mobile/workspaces")).json();
  expect(adminWorkspaces.items.some((item: any) => item.client.id === mainId)).toBe(true);
  expect((await page.request.post("/api/mobile/workspace", { headers: { Origin: origin }, data: { clientId: mainId } })).status()).toBe(200);
  expect((await (await page.request.get("/api/mobile/context")).json()).role).toBe("CLIENT_OWNER");
});
