import { vi, it, expect, beforeEach } from "vitest";
vi.mock("better-auth/crypto", () => ({
  hashPassword: vi.fn().mockResolvedValue("secure-password-hash"),
}));
vi.mock("@/lib/locks", () => ({
  withLease: (_key: string, fn: () => Promise<unknown>) => fn(),
}));
vi.mock("@/lib/db", () => ({
  db: { invitation: { findUnique: vi.fn() }, $transaction: vi.fn() },
}));
import { db } from "@/lib/db";
import { acceptInvitation } from "../src/server/invitations";
const input = {
  token: "a".repeat(43),
  name: "New Owner",
  password: "test-password-12345",
  confirmPassword: "test-password-12345",
  acceptTerms: true,
};
let tx: any;
beforeEach(() => {
  vi.clearAllMocks();
  tx = {
    invitation: {
      findUnique: vi.fn().mockResolvedValue({
        id: "i1",
        clientId: "A",
        email: "owner@example.com",
        role: "CLIENT_OWNER",
        client: { status: "ACTIVE" },
        expiresAt: new Date(Date.now() + 100000),
        revokedAt: null,
        acceptedAt: null,
      }),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    client: {
      findUniqueOrThrow: vi.fn().mockResolvedValue({
        id: "A",
        package: { limits: [{ key: "teamMembers", value: 3 }] },
        limits: [],
      }),
    },
    user: { findUnique: vi.fn().mockResolvedValue(null), create: vi.fn() },
    clientMembership: { count: vi.fn().mockResolvedValue(0), create: vi.fn() },
    auditLog: { create: vi.fn() },
  };
  vi.mocked(db.invitation.findUnique).mockResolvedValue({
    id: "i1",
    clientId: "A",
  } as any);
  vi.mocked(db.$transaction).mockImplementation(async (fn: any) => fn(tx));
});
it("creates an authenticated account and membership in the same transaction as consumption", async () => {
  const result = await acceptInvitation(input);
  expect(result.email).toBe("owner@example.com");
  expect(tx.user.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        emailVerified: true,
        accounts: {
          create: expect.objectContaining({
            providerId: "credential",
            password: "secure-password-hash",
          }),
        },
      }),
    }),
  );
  expect(tx.clientMembership.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ clientId: "A", role: "CLIENT_OWNER" }),
    }),
  );
  expect(tx.invitation.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({ acceptedAt: null, revokedAt: null }),
    }),
  );
});
it.each(["expired", "revoked", "accepted"])(
  "rejects %s invitations before creating an account",
  async (state) => {
    const invite = await tx.invitation.findUnique();
    if (state === "expired") invite.expiresAt = new Date(0);
    if (state === "revoked") invite.revokedAt = new Date();
    if (state === "accepted") invite.acceptedAt = new Date();
    tx.invitation.findUnique.mockResolvedValue(invite);
    await expect(acceptInvitation(input)).rejects.toMatchObject({
      status: 410,
    });
    expect(tx.user.create).not.toHaveBeenCalled();
  },
);
it("never overwrites an existing account password using an invitation", async () => {
  tx.user.findUnique.mockResolvedValue({ id: "existing", disabled: false });
  await expect(acceptInvitation(input)).rejects.toMatchObject({
    code: "SIGN_IN_REQUIRED",
  });
  expect(tx.user.create).not.toHaveBeenCalled();
});
it("requires atomic one-time token consumption", async () => {
  tx.invitation.updateMany.mockResolvedValue({ count: 0 });
  await expect(acceptInvitation(input)).rejects.toThrow("already used");
});
it("rechecks the current team limit at acceptance", async () => {
  tx.clientMembership.count.mockResolvedValue(3);
  await expect(acceptInvitation(input)).rejects.toMatchObject({ status: 403 });
  expect(tx.user.create).not.toHaveBeenCalled();
});
