// Isolated UI QA: every API response is a fixture. No live replies, orders or login.
import { chromium } from "@playwright/test";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../apps/mobile/dist");
const out = path.resolve(__dirname, "../apps/mobile/qa-results");
fs.mkdirSync(out, { recursive: true });
const types = {
  ".js": "application/javascript",
  ".html": "text/html",
  ".png": "image/png",
  ".ttf": "font/ttf",
  ".ico": "image/x-icon",
};
const server = http.createServer((req, res) => {
  const route = decodeURIComponent(
    new URL(req.url, "http://localhost").pathname,
  );
  let file = path.resolve(root, "." + route);
  if (
    !file.startsWith(root + path.sep) ||
    !fs.existsSync(file) ||
    fs.statSync(file).isDirectory()
  )
    file = path.join(root, "index.html");
  res.setHeader(
    "Content-Type",
    types[path.extname(file)] || "application/octet-stream",
  );
  fs.createReadStream(file).pipe(res);
});
const context = {
  user: { id: "qa-user", name: "Alex Morgan", email: "qa@example.test" },
  client: { id: "qa-workspace", company: "Demo workspace · UI check" },
  role: "CLIENT_OWNER",
  activePackageId: "growth",
  permissions: {
    "inbox.view": true,
    "inbox.reply": true,
    "analytics.view": true,
  },
};
const message = {
  id: "opaque-fixture-1",
  fromEmail: "sarah.lee@example.test",
  toEmail: "team@example.test",
  createdAt: "2026-10-05T10:30:00Z",
  subject: "A quick conversation next week?",
  body: "<p>Thanks for reaching out. Tuesday works well for us.</p><p>Could you share a little more about your approach?</p>",
  preview: "Thanks for reaching out. Tuesday works well for us.",
};
const plans = [
  {
    id: "launch",
    name: "Launch",
    price: "500",
    setupPrice: "1500",
    currency: "USD",
    serviceType: "EMAIL",
    active: true,
    requiresLimitReview: false,
    minimumMonths: 0,
    limits: [{ key: "monthlyEmails", value: 5000 }],
  },
  {
    id: "growth",
    name: "Growth",
    price: "1000",
    setupPrice: "2500",
    currency: "USD",
    serviceType: "EMAIL",
    active: true,
    requiresLimitReview: false,
    minimumMonths: 0,
    limits: [{ key: "monthlyEmails", value: 25000 }],
  },
  {
    id: "scale",
    name: "Scale",
    price: "1500",
    setupPrice: "4000",
    currency: "USD",
    serviceType: "EMAIL",
    active: true,
    requiresLimitReview: false,
    minimumMonths: 0,
    limits: [{ key: "monthlyEmails", value: 50000 }],
  },
];
(async () => {
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const origin = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({
    headless: true,
    channel: process.env.QA_BROWSER || "chrome",
  });
  const errors = [];
  try {
    const page = await browser.newPage({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 1,
    });
    page.on("pageerror", (e) => errors.push(e.message));
    let replyWrites = 0,
      orderWrites = 0,
      starred = false,
      orders = [],
      readAt = null;
    await page.route("**/*", async (route) => {
      const req = route.request(),
        url = new URL(req.url());
      if (url.origin === origin) return route.continue();
      if (url.origin !== "https://app.reliantoutreach.com")
        return route.abort();
      const headers = {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "content-type,authorization",
        "Access-Control-Expose-Headers": "set-auth-token",
      };
      if (req.method() === "OPTIONS")
        return route.fulfill({ status: 204, headers });
      let body = {},
        code = 200;
      const p = url.pathname;
      if (p === "/api/auth/sign-in/email") {
        headers["set-auth-token"] = "qa-signed-token.fixture";
        body = { user: context.user };
      } else if (p === "/api/auth/get-session")
        body = { user: context.user, session: {} };
      else if (p === "/api/mobile/workspaces")
        body = {
          user: context.user,
          items: [{ client: context.client }],
          activeClientId: context.client.id,
        };
      else if (p === "/api/mobile/context") body = context;
      else if (p === "/api/mobile/inbox")
        body = {
          items: [
            message,
            {
              ...message,
              id: "opaque-fixture-2",
              fromEmail: "daniel.ross@example.test",
              subject: "Let’s explore this",
              preview: "This looks interesting. What would the next step be?",
              createdAt: "2026-10-04T12:00:00Z",
            },
          ],
          pagination: {},
        };
      else if (p === "/api/mobile/inbox/thread")
        body = {
          items: [
            {
              ...message,
              id: "sent-fixture",
              fromEmail: "team@example.test",
              toEmail: message.fromEmail,
              createdAt: "2026-10-04T10:00:00Z",
              body: "<p>Hi Sarah, I thought our outreach service could be a good fit for your team. Happy to share more.</p>",
            },
            message,
          ],
          pagination: {},
        };
      else if (p === "/api/mobile/conversation-state") {
        if (req.method() === "POST") {
          const data = req.postDataJSON();
          if (data.starred !== undefined) starred = data.starred;
          if (data.read) readAt = new Date().toISOString();
        }
        body = { items: [{ email: message.fromEmail, starred, readAt }] };
      } else if (p === "/api/mobile/stats")
        body = {
          snapshot: {
            values: {
              sentCount: 12460,
              replyCount: 684,
              prospects: 3210,
              senders: 12,
            },
            capturedAt: "2026-10-05T10:00:00Z",
          },
          monthly: {
            values: { monthlyEmails: 8076 },
            capturedAt: "2026-10-05T10:00:00Z",
          },
          month: "2026-10",
          capacity: 25000,
          connection: { lastSyncAt: "2026-10-05T10:00:00Z" },
        };
      else if (p === "/api/mobile/plans")
        body = { items: plans, activePackageId: "growth", canRequest: true };
      else if (p === "/api/mobile/orders") {
        if (req.method() === "POST") {
          orderWrites++;
          orders = [
            {
              id: "qa-request-1",
              packageName: "Scale",
              price: "1500",
              currency: "USD",
              status: "pending_review",
              createdAt: new Date().toISOString(),
              history: [
                {
                  status: "pending_review",
                  at: new Date().toISOString(),
                  note: "Request received. Your current package remains active.",
                },
              ],
            },
          ];
        }
        body = { items: orders };
      } else if (p === "/api/mobile/push")
        body = { configured: false, device: null };
      else if (p === "/api/mobile/reply") {
        replyWrites++;
        code = 500;
        body = { error: "Unexpected send in UI test" };
      } else if (p !== "/api/auth/sign-out") {
        code = 404;
        body = { error: "Unmocked API route" };
      }
      return route.fulfill({
        status: code,
        contentType: "application/json",
        headers,
        body: JSON.stringify(body),
      });
    });
    await page.goto(origin);
    await page.getByRole("button", { name: "Sign in  →" }).waitFor();
    await page.screenshot({
      path: path.join(out, "login-dark.png"),
      fullPage: true,
    });
    await page
      .getByLabel("Email address", { exact: true })
      .fill("qa@example.test");
    await page
      .getByLabel("Password", { exact: true })
      .fill("Local-fixture-only-123!");
    await page.getByRole("button", { name: "Sign in  →" }).click();
    await page.getByRole("button", { name: /Sarah Lee/ }).waitFor();
    await page.screenshot({ path: path.join(out, "inbox-dark.png") });
    await page.getByRole("button", { name: /Sarah Lee/ }).click();
    await page
      .getByText("Could you share a little more about your approach?", {
        exact: false,
      })
      .waitFor();
    await page
      .getByLabel("Reply message")
      .fill("Draft preview only. This is never sent.");
    await page.getByRole("button", { name: "Review and send reply" }).click();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await page
      .getByText("Send this reply?", { exact: true })
      .waitFor({ state: "hidden" });
    assert.equal(replyWrites, 0);
    await page.screenshot({ path: path.join(out, "conversation-dark.png") });
    await page
      .getByRole("button", { name: "Star conversation", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Unstar conversation", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("tab", { name: "Stats" }).click();
    await page.getByText("8,076", { exact: true }).waitFor();
    await page.screenshot({ path: path.join(out, "stats-dark.png") });
    await page.getByRole("tab", { name: "Plans", exact: true }).click();
    await page.getByText("ACTIVE", { exact: true }).waitFor();
    await page.screenshot({
      path: path.join(out, "plans-dark.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", { name: "Request package change", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "Submit request" }).click();
    await page
      .getByText("Request received. Your current package remains active.")
      .waitFor();
    assert.equal(orderWrites, 1);
    await page.screenshot({
      path: path.join(out, "order-status.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Account and settings" }).click();
    await page.getByRole("button", { name: "Light", exact: true }).click();
    await page.screenshot({
      path: path.join(out, "account-light.png"),
      fullPage: true,
    });
    await page.getByRole("button", { name: "Back", exact: true }).click();
    await page.getByRole("tab", { name: "Inbox", exact: true }).click();
    for (const width of [360, 390, 430, 768]) {
      await page.setViewportSize({ width, height: 844 });
      await page.screenshot({
        path: path.join(out, "inbox-light-" + width + ".png"),
      });
      assert(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth + 1,
        ),
        "Horizontal overflow at " + width,
      );
    }
    assert.equal(errors.length, 0, errors.join("\n"));
    console.log(
      JSON.stringify({
        passed: true,
        replyWrites,
        simulatedOrderWrites: orderWrites,
        screenshots: out,
        widths: [360, 390, 430, 768],
      }),
    );
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
