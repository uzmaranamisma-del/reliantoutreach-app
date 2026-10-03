import { beforeEach, expect, it, vi } from "vitest";
vi.mock("@/lib/access", () => ({ tenant: vi.fn() }));
vi.mock("@/lib/locks", () => ({ rateLimit: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    aiWorkspace: { findUnique: vi.fn(), create: vi.fn(), updateMany: vi.fn() },
    auditLog: { create: vi.fn() },
    $transaction: vi.fn(),
  },
}));
import { db } from "@/lib/db";
import { tenant } from "@/lib/access";
import { aiProfileInput, defaultAiProfile } from "@/lib/ai-workspace";
import { readAiWorkspace, saveAiWorkspace } from "@/server/ai-workspace";
import { GET, POST } from "@/app/api/portal/ai-workspace/route";
import { AppError } from "@/lib/errors";
beforeEach(() => {
  vi.resetAllMocks();
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example";
  vi.mocked(tenant).mockResolvedValue({
    role: "CLIENT_OWNER",
    client: { id: "workspace-A" },
    user: { id: "owner" },
  } as never);
  vi.mocked(db.aiWorkspace.findUnique).mockResolvedValue(null);
  vi.mocked(db.aiWorkspace.updateMany).mockResolvedValue({ count: 1 });
  vi.mocked(db.$transaction).mockImplementation(async (fn: any) => fn(db));
});
const request = () =>
  new Request(
    "https://app.example/api/portal/ai-workspace?clientId=workspace-B",
  );
it("reads the authenticated workspace and reports unavailable AI honestly", async () => {
  const response = await GET(request(), {});
  expect(db.aiWorkspace.findUnique).toHaveBeenCalledWith({
    where: { clientId: "workspace-A" },
  });
  expect(await response.json()).toMatchObject({
    status: "not_connected",
    revision: 0,
    canEdit: true,
  });
});
it("denies unauthenticated reads and member writes", async () => {
  vi.mocked(tenant).mockRejectedValueOnce(new AppError(401, "Please sign in."));
  expect((await GET(request(), {})).status).toBe(401);
  expect(db.aiWorkspace.findUnique).not.toHaveBeenCalled();
  vi.mocked(tenant).mockResolvedValueOnce({ role: "CLIENT_MEMBER" } as never);
  await expect(
    saveAiWorkspace(request(), { profile: defaultAiProfile, revision: 0 }),
  ).rejects.toMatchObject({ status: 403 });
  expect(db.$transaction).not.toHaveBeenCalled();
});
it("stores knowledge under the authenticated tenant without logging its contents", async () => {
  await saveAiWorkspace(request(), {
    profile: { ...defaultAiProfile, business: "Approved information" },
    revision: 0,
  });
  expect(db.aiWorkspace.create).toHaveBeenCalledWith({
    data: {
      clientId: "workspace-A",
      profile: { ...defaultAiProfile, business: "Approved information" },
    },
  });
  expect(db.auditLog.create).toHaveBeenCalledWith({
    data: {
      actorId: "owner",
      clientId: "workspace-A",
      action: "ai.workspace-prepared",
    },
  });
});
it("rejects injected tenant or activation fields", async () => {
  await expect(
    saveAiWorkspace(request(), {
      profile: defaultAiProfile,
      revision: 0,
      clientId: "workspace-B",
    }),
  ).rejects.toThrow();
  expect(
    aiProfileInput.safeParse({ ...defaultAiProfile, enabled: true }).success,
  ).toBe(false);
  expect(db.$transaction).not.toHaveBeenCalled();
});
it.each([
  "javascript:alert(1)",
  "http://example.com",
  "https://user:pass@example.com",
])("rejects unsafe booking URL %s", (bookingUrl) => {
  expect(
    aiProfileInput.safeParse({ ...defaultAiProfile, bookingUrl }).success,
  ).toBe(false);
});
it("rejects stale revisions and racing first saves", async () => {
  vi.mocked(db.aiWorkspace.updateMany).mockResolvedValueOnce({ count: 0 });
  await expect(
    saveAiWorkspace(request(), { profile: defaultAiProfile, revision: 2 }),
  ).rejects.toMatchObject({ status: 409 });
  expect(db.aiWorkspace.updateMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { clientId: "workspace-A", revision: 2 },
    }),
  );
  vi.mocked(db.aiWorkspace.create).mockRejectedValueOnce({ code: "P2002" });
  await expect(
    saveAiWorkspace(request(), { profile: defaultAiProfile, revision: 0 }),
  ).rejects.toMatchObject({ status: 409 });
  expect(db.auditLog.create).not.toHaveBeenCalled();
});
it("blocks cross-origin updates before persistence", async () => {
  const response = await POST(
    new Request("https://app.example/api/portal/ai-workspace", {
      method: "POST",
      headers: {
        origin: "https://other.example",
        "content-type": "application/json",
      },
      body: JSON.stringify({ profile: defaultAiProfile, revision: 0 }),
    }),
    {},
  );
  expect(response.status).toBe(403);
  expect(db.$transaction).not.toHaveBeenCalled();
});
it("preview readers cannot edit and setup never reports connected", async () => {
  expect(await readAiWorkspace("workspace-A")).toMatchObject({
    canEdit: false,
    status: "not_connected",
  });
});
