import { beforeEach, describe, it, expect } from "vitest";
import {
  getEffectivePermission,
  getEffectiveLimit,
  withinLimit,
} from "../src/lib/permissions";
import { encrypt, decrypt, hash, secretMatches } from "../src/lib/crypto";
import {
  opaque,
  resolve,
  publicRecord,
  safeHtml,
} from "../src/lib/manyreach/public";
import { sameOrigin, json, AppError } from "../src/lib/errors";
import { providerSchema } from "../src/lib/manyreach/validation";
beforeEach(() => {
  process.env.ENCRYPTION_KEY = "1".repeat(64);
  process.env.NEXT_PUBLIC_APP_URL = "https://app.reliantoutreach.com";
});
describe("authorization policy", () => {
  it("a deny override wins over package permission", () =>
    expect(
      getEffectivePermission(
        "campaigns.edit",
        "CLIENT_OWNER",
        [{ key: "campaigns.edit", enabled: true }],
        [{ key: "campaigns.edit", enabled: false }],
      ),
    ).toBe(false));
  it("members cannot write even with an allow override", () =>
    expect(
      getEffectivePermission(
        "inbox.reply",
        "CLIENT_MEMBER",
        [],
        [{ key: "inbox.reply", enabled: true }],
      ),
    ).toBe(false));
  it("missing permissions deny by default", () =>
    expect(
      getEffectivePermission("senders.delete", "CLIENT_ADMIN", [], []),
    ).toBe(false));
  it("overrides replace limits including zero", () =>
    expect(
      getEffectiveLimit(
        "senders",
        [{ key: "senders", value: 30 }],
        [{ key: "senders", value: 0 }],
      ),
    ).toBe(0));
  it("boundary limits reject sender 31", () => {
    expect(withinLimit(29, 1, 30)).toBe(true);
    expect(withinLimit(30, 1, 30)).toBe(false);
    expect(withinLimit(900, 1, -1)).toBe(true);
  });
});
describe("encrypted identifiers", () => {
  it("exposes contact custom fields and tag names without provider tag IDs", () => {
    const record = publicRecord("client-A", "prospects", {
      prospectId: 42,
      email: "a@example.test",
      custom20: "Target account",
      notes: "Follow up",
      tags: [{ id: 919, name: "Qualified", apiKey: "private" }],
    });
    expect(record.custom20).toBe("Target account");
    expect(record.tags).toEqual(["Qualified"]);
    expect(JSON.stringify(record)).not.toContain("private");
    expect(JSON.stringify(record)).not.toContain("919");
  });
  it("encrypts with a unique nonce and verifies integrity", () => {
    const a = encrypt("secret");
    expect(a).not.toBe(encrypt("secret"));
    expect(decrypt(a)).toBe("secret");
    const bytes = Buffer.from(a, "base64url");
    bytes[15] ^= 1;
    expect(() => decrypt(bytes.toString("base64url"))).toThrow();
  });
  it("rejects cross-tenant IDs and cross-resource IDs", () => {
    const value = opaque("client-A", "campaigns", 42);
    expect(resolve("client-A", "campaigns", value).i).toBe("42");
    expect(() => resolve("client-B", "campaigns", value)).toThrow(
      "Resource not found",
    );
    expect(() => resolve("client-A", "senders", value)).toThrow();
  });
  it("does not expose credentials or provider IDs", () => {
    const record = publicRecord("client-A", "senders", {
      senderId: 42,
      email: "a@example.com",
      customSmtpPass: "private-password",
      apiKey: "secret-key",
      clientspaceId: 123,
      disconnectionReason: "Manyreach internal error",
    });
    expect(JSON.stringify(record)).not.toMatch(
      /private-password|secret-key|Manyreach|clientspaceId|senderId/,
    );
  });
  it("removes scripts, remote pixels, handlers and unsafe links from email HTML", () => {
    const output = safeHtml(
      '<script>alert(1)</script><img src="https://tracker.example/a"><a href="javascript:alert(1)" onclick="run()">hello</a><p>message</p>',
    );
    expect(output).not.toMatch(/script|img|onclick|tracker/);
    expect(output).toContain("<p>message</p>");
  });
  it("rejects missing secrets", () => {
    expect(secretMatches("", "")).toBe(false);
    expect(secretMatches("good", "good")).toBe(true);
    expect(secretMatches("good", "bad")).toBe(false);
    expect(hash("token")).toHaveLength(64);
  });
});
describe("request validation", () => {
  it("rejects cross-origin POST", () =>
    expect(() =>
      sameOrigin(
        new Request("https://app.reliantoutreach.com/api", {
          headers: { origin: "https://evil.example" },
        }),
      ),
    ).toThrow(AppError));
  it("requires an origin on browser writes", () =>
    expect(() =>
      sameOrigin(new Request("https://app.reliantoutreach.com/api")),
    ).toThrow());
  it("limits actual request bytes, not only Content-Length", async () => {
    await expect(
      json(
        new Request("https://app.reliantoutreach.com", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ x: "a".repeat(500) }),
        }),
        100,
      ),
    ).rejects.toThrow("too large");
  });
  it("accepts only official writable campaign fields", () => {
    expect(
      providerSchema("CampaignUpdate").safeParse({
        subject: "Updated",
        body: "<p>Hello</p>",
      }).success,
    ).toBe(true);
    expect(
      providerSchema("CampaignUpdate").safeParse({ clientspaceId: 5 }).success,
    ).toBe(false);
    expect(
      providerSchema("CampaignCreate").safeParse({
        name: "Test",
        dailyLimit: 10001,
      }).success,
    ).toBe(false);
  });
  it("uses the official follow-up delay units", () => {
    expect(
      providerSchema("FollowupCreate").safeParse({
        waitMin: 3,
        waitUnits: "Days",
      }).success,
    ).toBe(true);
    expect(
      providerSchema("FollowupCreate").safeParse({
        waitMin: 3,
        waitUnits: "Weeks",
      }).success,
    ).toBe(false);
  });
});
