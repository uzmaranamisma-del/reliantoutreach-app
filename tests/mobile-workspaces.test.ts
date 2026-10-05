import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({
  capacity: vi.fn(),
  db: {
    clientMembership: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    client: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
    user: { findUnique: vi.fn() },
    invitation: { updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
vi.mock("@/lib/db", () => ({ db: mock.db }));
vi.mock("@/lib/locks", () => ({
  withLease: (_key: string, fn: () => unknown) => fn(),
}));
vi.mock("@/server/invitations", () => ({ teamCapacity: mock.capacity }));
import {
  ensureMobileWorkspace,
  mobileWorkspaces,
} from "@/server/mobile-workspaces";
const user = { id: "admin", email: "owner@example.test", superadmin: true };
const main = {
  id: "main",
  company: "My main account",
  email: user.email,
  status: "ACTIVE",
  mapping: { providerType: "organization" },
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.db.clientMembership.findMany.mockResolvedValue([]);
  mock.db.clientMembership.findUnique.mockResolvedValue(null);
  mock.db.clientMembership.create.mockResolvedValue({ id: "membership" });
  mock.db.client.findMany.mockResolvedValue([
    { id: main.id, company: main.company },
  ]);
  mock.db.client.findFirst.mockResolvedValue({ id: main.id });
  mock.db.client.findUnique.mockResolvedValue(main);
  mock.db.user.findUnique.mockResolvedValue({ ...user, disabled: false });
  mock.db.$transaction.mockImplementation((fn) => fn(mock.db));
});
it("lists only owned active main accounts without a previous membership and requires selection", async () => {
  const result = await mobileWorkspaces(user, "main");
  expect(result.items).toEqual([
    { client: { id: main.id, company: main.company } },
  ]);
  expect(result.activeClientId).toBeNull();
  expect(mock.db.client.findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        email: user.email,
        status: "ACTIVE",
        mapping: { is: { providerType: "organization" } },
        memberships: { none: { userId: user.id } },
      },
    }),
  );
  expect(mock.db.clientMembership.create).not.toHaveBeenCalled();
});
it("keeps an existing selected membership active", async () => {
  mock.db.clientMembership.findMany.mockResolvedValue([
    { client: { id: "assigned", company: "Assigned" } },
  ]);
  expect((await mobileWorkspaces(user, "assigned")).activeClientId).toBe(
    "assigned",
  );
});
it("never discovers or auto-joins main accounts for normal client users", async () => {
  const clientUser = { ...user, superadmin: false };
  expect((await mobileWorkspaces(clientUser, null)).items).toEqual([]);
  await expect(ensureMobileWorkspace(clientUser, "main")).rejects.toMatchObject(
    { status: 403 },
  );
  expect(mock.db.client.findMany).not.toHaveBeenCalled();
  expect(mock.db.clientMembership.create).not.toHaveBeenCalled();
});
it("enrolls the owner using ordinary permissions, with an audit trail and no invitation send", async () => {
  await ensureMobileWorkspace(user, "main");
  expect(mock.capacity).toHaveBeenCalledWith("main", 1, user.email);
  expect(mock.db.clientMembership.create).toHaveBeenCalledWith({
    data: { userId: "admin", clientId: "main", role: "CLIENT_OWNER" },
  });
  expect(mock.db.invitation.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        clientId: "main",
        email: user.email,
        acceptedAt: null,
        revokedAt: null,
      },
    }),
  );
  expect(mock.db.auditLog.create).toHaveBeenCalledWith({
    data: {
      actorId: "admin",
      clientId: "main",
      action: "mobile.main-account-joined",
      resourceId: "membership",
    },
  });
});
it("rejects guessed workspace IDs that do not match the main-account ownership query", async () => {
  mock.db.client.findFirst.mockResolvedValue(null);
  await expect(
    ensureMobileWorkspace(user, "other-client"),
  ).rejects.toMatchObject({ status: 403 });
  expect(mock.db.client.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: {
        id: "other-client",
        email: user.email,
        status: "ACTIVE",
        mapping: { is: { providerType: "organization" } },
      },
    }),
  );
  expect(mock.db.$transaction).not.toHaveBeenCalled();
});
it.each([
  { ...main, email: "someone-else@example.test" },
  { ...main, status: "SUSPENDED" },
  { ...main, mapping: { providerType: "workspace" } },
  { ...main, mapping: null },
])(
  "rechecks ownership, connection and status before granting access: %j",
  async (client) => {
    mock.db.client.findUnique.mockResolvedValue(client);
    await expect(ensureMobileWorkspace(user, "main")).rejects.toMatchObject({
      status: 403,
    });
    expect(mock.db.clientMembership.create).not.toHaveBeenCalled();
  },
);
it.each([
  { ...user, superadmin: false },
  { ...user, disabled: true },
])("rejects a user whose admin access was revoked", async (owner) => {
  mock.db.user.findUnique.mockResolvedValue(owner);
  await expect(ensureMobileWorkspace(user, "main")).rejects.toMatchObject({
    status: 403,
  });
  expect(mock.db.clientMembership.create).not.toHaveBeenCalled();
});
it("preserves disabled memberships even for the main owner", async () => {
  mock.db.clientMembership.findUnique.mockResolvedValue({
    disabled: true,
    client: main,
  });
  await expect(ensureMobileWorkspace(user, "main")).rejects.toMatchObject({
    status: 403,
  });
  expect(mock.db.$transaction).not.toHaveBeenCalled();
});
it("does not elevate an existing member's role or create duplicate memberships", async () => {
  mock.db.clientMembership.findUnique.mockResolvedValue({
    disabled: false,
    role: "CLIENT_MEMBER",
    client: main,
  });
  await ensureMobileWorkspace(user, "main");
  expect(mock.db.$transaction).not.toHaveBeenCalled();
});
it("rechecks membership after acquiring the lease", async () => {
  mock.db.clientMembership.findUnique
    .mockResolvedValueOnce(null)
    .mockResolvedValue({ disabled: true, client: main });
  await expect(ensureMobileWorkspace(user, "main")).rejects.toMatchObject({
    status: 403,
  });
  expect(mock.db.$transaction).not.toHaveBeenCalled();
});
it("honors the workspace team capacity", async () => {
  mock.capacity.mockRejectedValue(new Error("Team member limit reached."));
  await expect(ensureMobileWorkspace(user, "main")).rejects.toThrow(
    "Team member limit reached.",
  );
  expect(mock.db.$transaction).not.toHaveBeenCalled();
});
