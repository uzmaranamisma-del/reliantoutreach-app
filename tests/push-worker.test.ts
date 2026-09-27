import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync("public/sw.js", "utf8");
function storage() {
  const stores = new Map<string, Map<string, string>>();
  return {
    keys: async () => [...stores.keys()],
    delete: async (key: string) => stores.delete(key),
    open: async (key: string) => {
      if (!stores.has(key)) stores.set(key, new Map());
      const entries = stores.get(key)!;
      return {
        match: async (path: string) =>
          entries.has(path) ? new Response(entries.get(path)) : undefined,
        put: async (path: string, response: Response) => {
          entries.set(path, await response.text());
        },
      };
    },
  };
}
function worker(
  caches = storage(),
  showNotification = vi.fn().mockResolvedValue(undefined),
) {
  const handlers = new Map<string, (event: any) => void>();
  runInNewContext(source, {
    self: {
      addEventListener: (kind: string, fn: (event: any) => void) =>
        handlers.set(kind, fn),
      registration: { showNotification },
      skipWaiting: vi.fn(),
    },
    caches,
    Response,
    Date,
  });
  const dispatch = (kind: string, data?: unknown) => {
    let done: Promise<unknown> = Promise.resolve();
    handlers.get(kind)!({
      data: { json: () => data },
      waitUntil: (value: Promise<unknown>) => {
        done = value;
      },
    });
    return done;
  };
  return {
    push: (data: unknown) => dispatch("push", data),
    activate: () => dispatch("activate"),
    showNotification,
  };
}
const notice = {
  eventId: "client-a:reply-1",
  title: "New reply",
  url: "/app/inbox",
};

describe("mobile notification delivery", () => {
  it("alerts once across duplicates, concurrent delivery and worker restart", async () => {
    const cache = storage();
    const display = vi.fn().mockResolvedValue(undefined);
    const first = worker(cache, display);
    await Promise.all([
      first.push(notice),
      first.push(notice),
      first.push(notice),
    ]);
    // A refresh or dismissed notification cannot clear the saved receipt.
    const restarted = worker(cache, display);
    await restarted.activate();
    await restarted.push(notice);
    expect(display).toHaveBeenCalledTimes(1);
    await restarted.push({ ...notice, eventId: "client-a:reply-2" });
    await restarted.push({ ...notice, eventId: "client-b:reply-1" });
    expect(display).toHaveBeenCalledTimes(3);
    expect(display.mock.calls[0][1]).toMatchObject({
      renotify: false,
      data: { url: "/app/inbox" },
    });
  });
  it("retries a failed display and still delivers later events", async () => {
    const display = vi
      .fn()
      .mockRejectedValueOnce(new Error("display failed"))
      .mockResolvedValue(undefined);
    const runtime = worker(storage(), display);
    await expect(runtime.push(notice)).rejects.toThrow("display failed");
    await runtime.push(notice);
    await runtime.push(notice);
    expect(display).toHaveBeenCalledTimes(2);
  });
  it("handles legacy payloads and keeps unrelated caches on activation", async () => {
    const cache = storage();
    await cache.open("unrelated-cache");
    await cache.open("reliantoutreach-old-shell");
    const runtime = worker(cache);
    await runtime.push({ tag: "job:legacy", title: "Import completed" });
    await runtime.activate();
    await worker(cache, runtime.showNotification).push({
      tag: "job:legacy",
      title: "Import completed",
    });
    expect(runtime.showNotification).toHaveBeenCalledTimes(1);
    expect(await cache.keys()).toContain("unrelated-cache");
    expect(await cache.keys()).not.toContain("reliantoutreach-old-shell");
  });
  it("does not lose new alerts when persistent storage is unavailable", async () => {
    const cache = storage();
    cache.open = async () => {
      throw new Error("Storage unavailable");
    };
    const runtime = worker(cache);
    await runtime.push(notice);
    expect(runtime.showNotification).toHaveBeenCalledOnce();
  });
});
