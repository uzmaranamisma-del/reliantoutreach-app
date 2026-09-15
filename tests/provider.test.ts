import { vi, it, expect, beforeEach } from "vitest";
vi.mock("@/lib/db", () => ({
  db: {
    apiLog: { create: vi.fn() },
    requestBucket: { update: vi.fn() },
    manyreachClientspace: { findUnique: vi.fn() },
  },
}));
vi.mock("@/lib/locks", () => ({
  rateLimit: vi.fn(),
  withProviderSlot: (_bucket: string, fn: () => Promise<unknown>) => fn(),
}));
import { db } from "@/lib/db";
import { forClient, providerRequest } from "../src/lib/manyreach/client";
import { encrypt } from "../src/lib/crypto";
beforeEach(() => {
  vi.clearAllMocks();
  process.env.ENCRYPTION_KEY = "1".repeat(64);
  process.env.MANYREACH_API_BASE_URL = "https://api.manyreach.com/api/v2";
});
it("authenticates client calls with the resolved clientspace key", async () => {
  vi.mocked(db.manyreachClientspace.findUnique).mockResolvedValue({
    clientId: "A",
    providerId: 44,
    encryptedApiKey: encrypt("client-key"),
  } as any);
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({ items: [], pagination: { totalItems: 0 } }),
      ),
    );
  vi.stubGlobal("fetch", fetch);
  const client = await forClient("A");
  await client.request("/campaigns", "GET", undefined, {
    "pageQuery.limit": 25,
  });
  const [url, options] = fetch.mock.calls[0];
  expect(url.toString()).toBe(
    "https://api.manyreach.com/api/v2/campaigns?pageQuery.limit=25",
  );
  expect(options.headers["X-API-Key"]).toBe("client-key");
  expect(options.cache).toBe("no-store");
});
it("does not fall back to the agency key if a tenant mapping is missing", async () => {
  vi.mocked(db.manyreachClientspace.findUnique).mockResolvedValue(null);
  await expect(forClient("unknown")).rejects.toThrow("administrator attention");
});
it("never retries an ambiguous POST", async () => {
  const fetch = vi.fn().mockRejectedValue(new Error("Timeout"));
  vi.stubGlobal("fetch", fetch);
  await expect(
    providerRequest("key", "test", "/campaigns", "POST", { name: "Test" }),
  ).rejects.toMatchObject({ ambiguous: true });
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("honors 429 cooldown without retrying immediately", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response("{}", { status: 429, headers: { "Retry-After": "90" } }),
    );
  vi.stubGlobal("fetch", fetch);
  await expect(
    providerRequest("key", "test", "/campaigns"),
  ).rejects.toMatchObject({ status: 429 });
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(db.requestBucket.update).toHaveBeenCalled();
});
it("does not retry authorization or permanent validation errors", async () => {
  for (const status of [401, 403, 422]) {
    const fetch = vi.fn().mockResolvedValue(new Response("{}", { status }));
    vi.stubGlobal("fetch", fetch);
    await expect(providerRequest("key", "test", "/senders")).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(1);
  }
});
it("does not allow an arbitrary credential destination", async () => {
  process.env.MANYREACH_API_BASE_URL = "https://evil.example/api/v2";
  await expect(providerRequest("secret", "test", "/account")).rejects.toThrow(
    "not configured",
  );
});
