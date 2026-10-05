import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import { api } from "./api";
import { storage } from "./storage";
export type PushEvent = {
  clientId: string;
  eventId: string;
  kind: "reply" | "order";
};
let activeClientId: string | undefined;
let notificationsReady = false;
let seen: string[] = [];
export function notificationEvent(
  data: Record<string, unknown> = {},
): PushEvent | null {
  if (
    typeof data.clientId !== "string" ||
    data.clientId.length > 100 ||
    typeof data.eventId !== "string" ||
    data.eventId.length > 200 ||
    !["reply", "order"].includes(String(data.kind))
  )
    return null;
  return data as PushEvent;
}
export function setNotificationContext(clientId?: string) {
  activeClientId = clientId;
}
export async function initializeNotifications() {
  if (Platform.OS === "web" || notificationsReady) return;
  notificationsReady = true;
  try {
    const stored = JSON.parse((await storage.get("push.seen")) || "[]");
    seen = Array.isArray(stored)
      ? stored.filter((v) => typeof v === "string").slice(-40)
      : [];
  } catch {
    seen = [];
  }
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const event = notificationEvent(notification.request.content.data);
      let show = !!event && event.clientId === activeClientId;
      if (event) {
        const key = (
          await Crypto.digestStringAsync(
            Crypto.CryptoDigestAlgorithm.SHA256,
            `${event.clientId}:${event.eventId}`,
          )
        ).slice(0, 24);
        if (seen.includes(key)) show = false;
        else {
          seen = [...seen.slice(-39), key];
          await storage.set("push.seen", JSON.stringify(seen)).catch(() => {});
        }
      }
      return {
        shouldShowBanner: show,
        shouldShowList: show,
        shouldPlaySound: show,
        shouldSetBadge: false,
      };
    },
  });
}
export async function installationId() {
  let id = await storage.get("installation.id");
  if (!id) {
    id = Crypto.randomUUID();
    await storage.set("installation.id", id);
  }
  return id;
}
export async function registerPush(
  preferences: { replies: boolean; orders: boolean },
  askPermission = false,
) {
  if (Platform.OS === "web")
    throw new Error(
      "Push notifications are available in the installed Android and iPhone app.",
    );
  if (!Device.isDevice)
    throw new Error("Use a physical phone to enable notifications.");
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ||
    Constants.easConfig?.projectId;
  if (!projectId)
    throw new Error(
      "Push setup is awaiting the Expo, Firebase and Apple account configuration.",
    );
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("replies", {
      name: "New replies",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 180, 120, 180],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
    await Notifications.setNotificationChannelAsync("orders", {
      name: "Package updates",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  }
  let permission = await Notifications.getPermissionsAsync();
  if (!permission.granted && askPermission && permission.canAskAgain)
    permission = await Notifications.requestPermissionsAsync();
  if (!permission.granted)
    throw new Error(
      "Notifications are off. Enable them in your phone settings.",
    );
  const result = await Notifications.getExpoPushTokenAsync({ projectId });
  return api<{ configured: boolean }>("/api/mobile/push", {
    installationId: await installationId(),
    token: result.data,
    platform: Platform.OS,
    ...preferences,
  });
}
export async function clearDisplayedNotifications() {
  if (Platform.OS !== "web") {
    await Notifications.dismissAllNotificationsAsync();
    await Notifications.setBadgeCountAsync(0);
    await Notifications.clearLastNotificationResponseAsync();
  }
}
