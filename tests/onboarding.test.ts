import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/locks", () => ({
  withLease: (_: string, fn: () => unknown) => fn(),
}));
vi.mock("@/lib/mail", () => ({ mailConfigured: vi.fn(() => true) }));
vi.mock("@/server/invitations", () => ({ teamCapacity: vi.fn() }));
vi.mock("@/lib/crypto", () => ({
  encrypt: (s: string) => `encrypted:${s}`,
  hash: () => "hashed-token",
  token: () => "private-token",
}));
vi.mock("@/lib/manyreach/client", () => ({
  providerRequest: vi.fn(),
  forClient: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  db: {
    client: { findUniqueOrThrow: vi.fn(), update: vi.fn() },
    user: { findUnique: vi.fn() },
    manyreachClientspace: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      update: vi.fn(),
    },
    backgroundJob: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    invitation: { findFirst: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    clientMembership: { findFirst: vi.fn(), count: vi.fn() },
    usageSnapshot: { upsert: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
import { db } from "@/lib/db";
import { forClient, providerRequest } from "@/lib/manyreach/client";
import { mailConfigured } from "@/lib/mail";
import {
  queueOnboarding,
  onboardingStage,
  onboardingStatus,
} from "@/server/onboarding";
import { syncDataStage, syncValues } from "@/server/sync-data";
const request = vi.fn();
const client = {
  id: "A",
  status: "DRAFT",
  company: "Test",
  email: "owner@example.test",
  firstName: "Owner",
  lastName: "",
  package: { active: true, requiresLimitReview: false, serviceType: "EMAIL" },
  mapping: null,
};
const job = { id: "j1", clientId: "A", actorId: "admin" };
const key = "35e16bc3-b684-4f42-8fe8-6f789f64bc91";
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(db.client.findUniqueOrThrow).mockResolvedValue(client as any);
  vi.mocked(db.user.findUnique).mockResolvedValue({
    superadmin: true,
    disabled: false,
  } as any);
  vi.mocked(db.clientMembership.count).mockResolvedValue(0);
  vi.mocked(db.backgroundJob.create).mockResolvedValue({
    id: "email-job",
  } as any);
  vi.mocked(db.invitation.create).mockResolvedValue({ id: "invite1" } as any);
  vi.mocked(db.$transaction).mockImplementation(async (fn: any) => fn(db));
  vi.mocked(mailConfigured).mockReturnValue(true);
  vi.mocked(forClient).mockResolvedValue({ request } as any);
  request
    .mockReset()
    .mockResolvedValue({ items: [], pagination: { totalItems: 0 } });
});
it("resolves a matching Subaccount from an agency key and stores only its isolated key", async () => {
  vi.mocked(providerRequest)
    .mockResolvedValueOnce({ id: 1, keyType: "agency" })
    .mockResolvedValueOnce({ items: [], pagination: { totalItems: 0 } })
    .mockResolvedValueOnce({
      items: [{ clientspaceId: 10, title: "Test", apiKey: "isolated-key" }],
      pagination: { totalItems: 1 },
    })
    .mockResolvedValueOnce({ id: 10, keyType: "clientspace" });
  await queueOnboarding("admin", "A", { key, apiKey: "agency-secret" });
  expect(db.manyreachClientspace.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        providerId: 10,
        encryptedApiKey: "encrypted:isolated-key",
      }),
    }),
  );
  expect(
    JSON.stringify(vi.mocked(db.manyreachClientspace.upsert).mock.calls),
  ).not.toContain("agency-secret");
  expect(db.invitation.create).not.toHaveBeenCalled();
});
it("does not guess a Subaccount when an agency key has no exact company match", async () => {
  vi.mocked(providerRequest)
    .mockResolvedValueOnce({ id: 1, keyType: "agency" })
    .mockResolvedValueOnce({
      items: [
        {
          clientspaceId: 10,
          title: "Different client",
          apiKey: "isolated-key",
        },
      ],
      pagination: { totalItems: 1 },
    });
  vi.mocked(providerRequest).mockResolvedValueOnce({
    items: [],
    pagination: { totalItems: 0 },
  });
  await expect(
    queueOnboarding("admin", "A", { key, apiKey: "agency-secret" }),
  ).rejects.toThrow('Clientspace named "Test"');
  expect(db.manyreachClientspace.upsert).not.toHaveBeenCalled();
});
it("accepts an isolated workspace key without agency lookup or a name match", async () => {
  vi.mocked(providerRequest).mockResolvedValue({
    id: 10,
    keyType: "workspace",
    title: "Other display name",
  });
  await queueOnboarding("admin", "A", { key, apiKey: "workspace-key" });
  expect(providerRequest).toHaveBeenCalledTimes(1);
  expect(db.manyreachClientspace.findUnique).toHaveBeenCalledWith({
    where: {
      providerType_providerId: { providerType: "workspace", providerId: 10 },
    },
  });
  expect(db.manyreachClientspace.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        providerType: "workspace",
        providerId: 10,
        encryptedApiKey: "encrypted:workspace-key",
      }),
    }),
  );
});
it("finds a workspace on a later page using an organization key", async () => {
  vi.mocked(providerRequest)
    .mockResolvedValueOnce({ id: 1, keyType: "organization" })
    .mockResolvedValueOnce({
      items: [{ workspaceId: 2, title: "Other" }],
      pagination: { totalItems: 2, nextCursor: 2 },
    })
    .mockResolvedValueOnce({
      items: [{ workspaceId: 10, title: " test ", apiKey: "workspace-key" }],
      pagination: { totalItems: 2 },
    })
    .mockResolvedValueOnce({ items: [], pagination: { totalItems: 0 } })
    .mockResolvedValueOnce({ id: 10, keyType: "workspace" });
  await queueOnboarding("admin", "A", { key, apiKey: "organization-key" });
  expect(providerRequest).toHaveBeenNthCalledWith(
    3,
    "organization-key",
    "onboarding:A",
    "/workspaces",
    "GET",
    undefined,
    { limit: 100, startingAfter: 2 },
  );
  expect(db.manyreachClientspace.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        providerType: "workspace",
        encryptedApiKey: "encrypted:workspace-key",
      }),
    }),
  );
});
it("rejects a matching name in both account types without choosing a tenant", async () => {
  vi.mocked(providerRequest)
    .mockResolvedValueOnce({ id: 1, keyType: "organization" })
    .mockResolvedValueOnce({
      items: [{ workspaceId: 10, title: "Test", apiKey: "workspace-key" }],
      pagination: { totalItems: 1 },
    })
    .mockResolvedValueOnce({
      items: [{ clientspaceId: 10, title: "Test", apiKey: "clientspace-key" }],
      pagination: { totalItems: 1 },
    });
  await expect(
    queueOnboarding("admin", "A", { key, apiKey: "organization-key" }),
  ).rejects.toThrow("No unique");
  expect(db.manyreachClientspace.upsert).not.toHaveBeenCalled();
});
it("rejects changing the account type even when its numeric ID matches", async () => {
  vi.mocked(db.client.findUniqueOrThrow).mockResolvedValue({
    ...client,
    mapping: { providerId: 10, providerType: "clientspace" },
  } as any);
  vi.mocked(providerRequest).mockResolvedValue({
    id: 10,
    keyType: "workspace",
  });
  await expect(
    queueOnboarding("admin", "A", { key, apiKey: "workspace-key" }),
  ).rejects.toThrow("different account");
  expect(db.manyreachClientspace.upsert).not.toHaveBeenCalled();
});
it("rejects a lookup with missing pages before saving a connection", async () => {
  vi.mocked(providerRequest)
    .mockResolvedValueOnce({ id: 1, keyType: "organization" })
    .mockResolvedValueOnce({
      items: [{ workspaceId: 10, title: "Test", apiKey: "workspace-key" }],
      pagination: { totalItems: 2 },
    });
  await expect(
    queueOnboarding("admin", "A", { key, apiKey: "organization-key" }),
  ).rejects.toThrow("incomplete");
  expect(db.manyreachClientspace.upsert).not.toHaveBeenCalled();
});
it("rejects a clientspace already assigned to another tenant", async () => {
  vi.mocked(providerRequest).mockResolvedValue({
    id: 10,
    keyType: "clientspace",
  });
  vi.mocked(db.manyreachClientspace.findUnique).mockResolvedValue({
    clientId: "B",
  } as any);
  await expect(
    queueOnboarding("admin", "A", { key, apiKey: "secret-key" }),
  ).rejects.toThrow("another client");
  expect(db.backgroundJob.create).not.toHaveBeenCalled();
});
it("queues a resumable sync with an encrypted key and no premature invitation", async () => {
  vi.mocked(providerRequest).mockResolvedValue({
    id: 10,
    keyType: "clientspace",
  });
  await queueOnboarding("admin", "A", { key, apiKey: "secret-key" });
  expect(db.manyreachClientspace.upsert).toHaveBeenCalledWith(
    expect.objectContaining({
      create: expect.objectContaining({
        clientId: "A",
        encryptedApiKey: "encrypted:secret-key",
      }),
    }),
  );
  expect(db.backgroundJob.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({ type: "client-onboarding", total: 6 }),
    }),
  );
  expect(db.invitation.create).not.toHaveBeenCalled();
});
it("reuses a queued sync on duplicate submission", async () => {
  vi.mocked(db.backgroundJob.findFirst).mockResolvedValue({
    id: "existing",
  } as any);
  expect(
    await queueOnboarding("admin", "A", { key, apiKey: "secret-key" }),
  ).toEqual({ id: "existing" });
  expect(providerRequest).not.toHaveBeenCalled();
});
it("verifies every data collection before activation or invitation", async () => {
  const payload: any = {};
  for (let stage = 0; stage < 5; stage++) {
    const result = await onboardingStage(job, payload);
    expect(result).toEqual({ done: false, progress: stage + 1 });
    expect(db.client.update).not.toHaveBeenCalled();
    expect(db.invitation.create).not.toHaveBeenCalled();
  }
  expect(request.mock.calls.map((c) => c[0])).toEqual([
    "/campaigns",
    "/prospects",
    "/lists",
    "/senders",
    "/messages",
  ]);
  await onboardingStage(job, payload);
  expect(db.client.update).toHaveBeenCalledWith({
    where: { id: "A" },
    data: { status: "ACTIVE" },
  });
  expect(db.invitation.create).toHaveBeenCalledTimes(1);
  expect(db.backgroundJob.create).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        type: "invitation-email",
        dedupeKey: "onboard-invite:j1",
      }),
    }),
  );
});
it("accepts a final campaign page whose provider cursor remains present", async () => {
  const payload: any = {};
  request.mockResolvedValueOnce({
    items: [],
    pagination: { totalItems: 0, nextCursor: 123 },
  });
  expect(await syncDataStage("A", payload)).toBe(false);
  expect(payload.stage).toBe(1);
  expect(payload.cursor).toBeUndefined();
});
it("accepts a full campaign page even when Manyreach includes a next cursor", async () => {
  const payload: any = {};
  request.mockResolvedValueOnce({
    items: [
      {
        sentCount: 1,
        replyCount: 0,
        openCount: 0,
        clickCount: 0,
        bounceCount: 0,
        interestedCount: 0,
      },
    ],
    pagination: { totalItems: 1, nextCursor: 123 },
  });
  expect(await syncDataStage("A", payload)).toBe(false);
  expect(payload.stage).toBe(1);
  expect(payload.cursor).toBeUndefined();
});
it("never activates or invites after a provider failure", async () => {
  request.mockRejectedValue(new Error("unavailable"));
  await expect(onboardingStage(job, {})).rejects.toThrow("unavailable");
  expect(db.client.update).not.toHaveBeenCalled();
  expect(db.invitation.create).not.toHaveBeenCalled();
});
it("keeps a new client inactive when SMTP is missing", async () => {
  vi.mocked(mailConfigured).mockReturnValue(false);
  await expect(onboardingStage(job, { stage: 5, counts: {} })).rejects.toThrow(
    "SMTP",
  );
  expect(db.client.update).not.toHaveBeenCalled();
  expect(db.invitation.create).not.toHaveBeenCalled();
});
it("does not duplicate an invitation if publication is revisited", async () => {
  vi.mocked(db.backgroundJob.findUnique).mockResolvedValue({
    id: "existing-email",
    result: { invitationId: "existing-invite" },
  } as any);
  const result = await onboardingStage(job, { stage: 5, counts: {} });
  expect(result.result?.invitationJobId).toBe("existing-email");
  expect(db.invitation.create).not.toHaveBeenCalled();
});
it("does not send another invitation to an owner with existing access", async () => {
  vi.mocked(db.clientMembership.findFirst).mockResolvedValue({
    id: "member",
  } as any);
  vi.mocked(mailConfigured).mockReturnValue(false);
  const result = await onboardingStage(job, { stage: 5, counts: {} });
  expect(result.result?.ownerAlreadyHasAccess).toBe(true);
  expect(db.invitation.create).not.toHaveBeenCalled();
});
it("rechecks administrator access before each stage", async () => {
  vi.mocked(db.user.findUnique).mockResolvedValue({
    superadmin: true,
    disabled: true,
  } as any);
  await expect(onboardingStage(job, {})).rejects.toThrow("access changed");
  expect(request).not.toHaveBeenCalled();
});
it("aggregates all campaign pages and omits unavailable metrics", async () => {
  request
    .mockResolvedValueOnce({
      items: [{ sentCount: 5 }],
      pagination: { totalItems: 2, nextCursor: "next" },
    })
    .mockResolvedValueOnce({
      items: [{ sentCount: 7, openCount: 2 }],
      pagination: { totalItems: 2 },
    });
  const payload: any = {};
  await syncDataStage("A", payload);
  expect(payload.stage).toBe(0);
  await syncDataStage("A", payload);
  expect(payload.stage).toBe(1);
  expect(syncValues(payload, 1)).toEqual({
    campaigns: 2,
    sentCount: 12,
    teamMembers: 1,
  });
  expect(request.mock.calls[1][3]["pageQuery.startingAfter"]).toBe("next");
});
it("rejects missing campaign pages rather than publishing partial totals", async () => {
  request.mockResolvedValue({ items: [], pagination: { totalItems: 2 } });
  await expect(syncDataStage("A", {})).rejects.toThrow("pages were missing");
});
it("bounds status reads to the requested client and never exposes job payload", async () => {
  vi.mocked(db.backgroundJob.findFirst).mockResolvedValue({
    id: "j1",
    status: "pending",
    progress: 0,
    total: 6,
    payload: "private",
    result: null,
  } as any);
  const state = await onboardingStatus("A", "j1");
  expect(db.backgroundJob.findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { clientId: "A", type: "client-onboarding", id: "j1" },
    }),
  );
  expect(JSON.stringify(state)).not.toContain("private");
});
