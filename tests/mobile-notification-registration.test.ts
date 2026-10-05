import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  permission: vi.fn(),
  request: vi.fn(),
  channel: vi.fn(),
  token: vi.fn(),
  api: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  remove: vi.fn(),
  config: {
    extra: { androidPushConfigured: true, eas: { projectId: "project" } },
  },
}));
vi.mock("../apps/mobile/node_modules/react-native/index.js", () => ({
  Platform: { OS: "android" },
}));
vi.mock("../apps/mobile/node_modules/expo-device/build/Device.js", () => ({
  isDevice: true,
}));
vi.mock(
  "../apps/mobile/node_modules/expo-constants/build/Constants.js",
  () => ({ default: { expoConfig: mocks.config } }),
);
vi.mock("../apps/mobile/node_modules/expo-crypto/build/Crypto.js", () => ({
  randomUUID: () => "installation",
}));
vi.mock(
  "../apps/mobile/node_modules/expo-notifications/build/index.js",
  () => ({
    getPermissionsAsync: mocks.permission,
    requestPermissionsAsync: mocks.request,
    setNotificationChannelAsync: mocks.channel,
    getExpoPushTokenAsync: mocks.token,
    AndroidImportance: { HIGH: 4, DEFAULT: 3 },
    AndroidNotificationVisibility: { PRIVATE: 0 },
  }),
);
vi.mock("../apps/mobile/src/lib/api", () => ({ api: mocks.api }));
vi.mock("../apps/mobile/src/lib/storage", () => ({
  storage: { get: mocks.get, set: mocks.set, remove: mocks.remove },
}));
import {
  connectNotifications,
  registerPush,
} from "../apps/mobile/src/lib/notifications";
beforeEach(() => {
  vi.clearAllMocks();
  mocks.config.extra.androidPushConfigured = true;
  mocks.permission.mockResolvedValue({ granted: true, canAskAgain: true });
  mocks.request.mockResolvedValue({ granted: true, canAskAgain: true });
  mocks.token.mockResolvedValue({ data: "ExponentPushToken[test]" });
  mocks.api.mockResolvedValue({ configured: true });
  mocks.get.mockResolvedValue(null);
});
it("creates Android channels before asking permission and registers after consent", async () => {
  mocks.permission.mockResolvedValue({ granted: false, canAskAgain: true });
  await connectNotifications("user.client", true);
  expect(mocks.channel.mock.invocationCallOrder[0]).toBeLessThan(
    mocks.request.mock.invocationCallOrder[0],
  );
  expect(mocks.api).toHaveBeenCalledWith(
    "/api/mobile/push",
    expect.objectContaining({
      installationId: "installation",
      replies: true,
      orders: true,
    }),
  );
  expect(mocks.set).toHaveBeenCalledWith("push.enabled.user.client", "1");
});
it("does not re-prompt denied permission or enroll the device", async () => {
  mocks.permission.mockResolvedValue({ granted: false, canAskAgain: false });
  await expect(connectNotifications("u.c", true)).rejects.toThrow(
    "phone settings",
  );
  expect(mocks.request).not.toHaveBeenCalled();
  expect(mocks.api).not.toHaveBeenCalled();
  expect(mocks.set).toHaveBeenCalledWith("push.error.u.c", expect.any(String));
});
it("never marks a build without Firebase configured as registered", async () => {
  mocks.config.extra.androidPushConfigured = false;
  await expect(connectNotifications("u.c")).rejects.toThrow(
    "missing Android push setup",
  );
  expect(mocks.token).not.toHaveBeenCalled();
  expect(mocks.set).not.toHaveBeenCalledWith("push.enabled.u.c", "1");
});
it("does not attach a token to a workspace changed during permission/token lookup", async () => {
  await expect(
    registerPush({ replies: true, orders: false }, false, () => false),
  ).rejects.toThrow("Workspace changed");
  expect(mocks.api).not.toHaveBeenCalled();
});
it("preserves notification category choices during reconnect", async () => {
  mocks.get.mockImplementation(async (key: string) =>
    key.startsWith("push.prefs")
      ? '{"replies":false,"orders":true}'
      : "installation",
  );
  await connectNotifications("u.c");
  expect(mocks.api).toHaveBeenCalledWith(
    "/api/mobile/push",
    expect.objectContaining({ replies: false, orders: true }),
  );
  expect(mocks.request).not.toHaveBeenCalled();
});
