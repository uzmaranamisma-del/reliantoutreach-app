import { vi, it, expect, beforeEach } from "vitest";
vi.mock("next/headers", () => ({ headers: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getAuth: () => ({
    api: {
      getSession: vi
        .fn()
        .mockResolvedValue({ user: { id: "u1" }, session: { id: "s1" } }),
    },
  }),
}));
vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    session: { findUnique: vi.fn() },
    clientMembership: { findFirst: vi.fn() },
    client: { findUnique: vi.fn() },
  },
}));
import { db } from "@/lib/db";
import { tenant, admin } from "../src/lib/access";
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.user.findUnique).mockResolvedValue({
    id: "u1",
    disabled: false,
    superadmin: false,
  } as any);
  vi.mocked(db.session.findUnique).mockResolvedValue({
    id: "s1",
    expiresAt: new Date(Date.now() + 100000),
  } as any);
  vi.mocked(db.clientMembership.findFirst).mockResolvedValue({
    clientId: "A",
    role: "CLIENT_MEMBER",
  } as any);
  vi.mocked(db.client.findUnique).mockResolvedValue({
    id: "A",
    status: "ACTIVE",
    package: {
      features: [
        { key: "campaigns.view", enabled: true },
        { key: "campaigns.edit", enabled: true },
      ],
      limits: [],
    },
    permissions: [],
    limits: [],
  } as any);
});
it("resolves the tenant from membership regardless of user-supplied query tenant", async () => {
  const result = await tenant(
    new Request("https://app.example/api?clientId=B"),
    "campaigns.view",
  );
  expect(result.client.id).toBe("A");
  expect(db.client.findUnique).toHaveBeenCalledWith(
    expect.objectContaining({ where: { id: "A" } }),
  );
});
it("rejects member writes on the server", async () => {
  await expect(
    tenant(new Request("https://app.example"), "campaigns.edit"),
  ).rejects.toMatchObject({ status: 403 });
});
it("blocks suspended tenants", async () => {
  vi.mocked(db.client.findUnique).mockResolvedValue({
    status: "SUSPENDED",
  } as any);
  await expect(
    tenant(new Request("https://app.example")),
  ).rejects.toMatchObject({ status: 403 });
});
it("blocks client users from Superadmin APIs", async () => {
  await expect(admin(new Request("https://app.example"))).rejects.toMatchObject(
    { status: 403 },
  );
});
it("ignores an expired impersonation", async () => {
  vi.mocked(db.user.findUnique).mockResolvedValue({
    id: "u1",
    disabled: false,
    superadmin: true,
  } as any);
  vi.mocked(db.session.findUnique).mockResolvedValue({
    id: "s1",
    expiresAt: new Date(Date.now() + 100000),
    impersonatingClientId: "B",
    impersonationExpiresAt: new Date(0),
  } as any);
  expect((await tenant(new Request("https://app.example"))).client.id).toBe(
    "A",
  );
});
