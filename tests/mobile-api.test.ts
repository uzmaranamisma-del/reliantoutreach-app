import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  tenant: vi.fn(),
  identity: vi.fn(),
  db: {
    clientMembership: { findUnique: vi.fn() },
    replyEvent: { findFirst: vi.fn() },
    nativeDevice: { deleteMany: vi.fn() },
    session: { update: vi.fn() },
    $transaction: vi.fn(),
  },
  list: vi.fn(),
  thread: vi.fn(),
}));
vi.mock("@/lib/access", () => ({
  tenant: mock.tenant,
  identity: mock.identity,
}));
vi.mock("@/lib/db", () => ({ db: mock.db }));
vi.mock("@/lib/locks", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/manyreach/service", () => ({ list: mock.list }));
vi.mock("@/lib/manyreach/public", () => ({
  resolve: () => ({ i: "provider-id" }),
}));
vi.mock("@/server/outreach", () => ({ thread: mock.thread, reply: vi.fn() }));
vi.mock("@/server/native-push", () => ({ nativePushConfigured: () => false }));
vi.mock("@/server/package-requests", () => ({
  listPackageRequests: vi.fn(),
  requestPackage: vi.fn(),
  updatePackageRequest: vi.fn(),
}));
import { GET, POST } from "@/app/api/mobile/[...path]/route";
const ctx = {
  user: { id: "u1", name: "Test", email: "qa@example.test" },
  session: { id: "s1" },
  client: { id: "c1", company: "Client", packageId: "p1" },
  role: "CLIENT_OWNER",
  impersonating: false,
  can: () => true,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.test");
  mock.tenant.mockResolvedValue(ctx);
  mock.identity.mockResolvedValue(ctx);
});
const route = (...path: string[]) => ({ params: Promise.resolve({ path }) });
const request = (data: unknown, origin = "https://app.example.test") =>
  new Request("https://app.example.test/api/mobile", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
it("does not allow mobile requests to use administrator impersonation", async () => {
  mock.tenant.mockResolvedValue({ ...ctx, impersonating: true });
  expect(
    (
      await GET(
        new Request("https://app.example.test/api/mobile/context"),
        route("context"),
      )
    ).status,
  ).toBe(403);
});
it("requires active membership before a workspace switch", async () => {
  mock.db.clientMembership.findUnique.mockResolvedValue({
    disabled: true,
    client: { status: "ACTIVE" },
  });
  expect(
    (await POST(request({ clientId: "another-client" }), route("workspace")))
      .status,
  ).toBe(403);
  expect(mock.db.$transaction).not.toHaveBeenCalled();
});
it("preserves the web origin restriction for mobile writes", async () => {
  expect(
    (await POST(request({}, "https://evil.example.test"), route("workspace")))
      .status,
  ).toBe(403);
});
it("does not resolve a notification from a different client", async () => {
  mock.db.replyEvent.findFirst.mockResolvedValue(null);
  const id = "a".repeat(64);
  expect(
    (
      await GET(
        new Request("https://app.example.test/api/mobile/event/" + id),
        route("event", id),
      )
    ).status,
  ).toBe(404);
  expect(mock.db.replyEvent.findFirst).toHaveBeenCalledWith({
    where: { id, clientId: "c1" },
  });
});
it("requires inbox permission before reading messages or event targets", async () => {
  mock.tenant.mockResolvedValue({ ...ctx, can: () => false });
  expect(
    (
      await GET(
        new Request("https://app.example.test/api/mobile/inbox"),
        route("inbox"),
      )
    ).status,
  ).toBe(403);
  expect(mock.list).not.toHaveBeenCalled();
});
it("adds stable display keys without exposing provider IDs", async () => {
  mock.list.mockResolvedValue({
    items: [{ id: "encrypted-one", fromEmail: "lead@example.test" }],
    pagination: {},
  });
  const first = await (
    await GET(
      new Request("https://app.example.test/api/mobile/inbox"),
      route("inbox"),
    )
  ).json();
  mock.list.mockResolvedValue({
    items: [{ id: "encrypted-two", fromEmail: "lead@example.test" }],
    pagination: {},
  });
  const second = await (
    await GET(
      new Request("https://app.example.test/api/mobile/inbox"),
      route("inbox"),
    )
  ).json();
  expect(first.items[0].key).toBe(second.items[0].key);
  expect(first.items[0].key).not.toContain("provider-id");
});
