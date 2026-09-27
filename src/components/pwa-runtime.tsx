"use client";

import { useCallback, useEffect, useState } from "react";

export function PwaRuntime() {
  const [ready, setReady] = useState(false);
  const [permission, setPermission] =
    useState<NotificationPermission>("default");
  const [pushConfigured, setPushConfigured] = useState(false);

  useEffect(() => {
    setReady(true);
    if ("Notification" in window) setPermission(Notification.permission);
  }, []);

  const loadPushConfig = useCallback(async () => {
    const response = await fetch("/api/portal/push", {
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) return undefined;
    const config = await response.json();
    setPushConfigured(Boolean(config.configured && config.publicKey));
    return config as { configured: boolean; publicKey?: string };
  }, []);

  const registerPushSubscription = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    const config = await loadPushConfig();
    if (
      Notification.permission !== "granted" ||
      !config?.configured ||
      !config.publicKey
    )
      return;
    const registration = await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const padding = "=".repeat((4 - (config.publicKey.length % 4)) % 4);
      const key = Uint8Array.from(
        atob(
          (config.publicKey + padding)
            .replaceAll("-", "+")
            .replaceAll("_", "/"),
        ),
        (char) => char.charCodeAt(0),
      );
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: key,
      });
    }
    const json = subscription.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return;
    await fetch("/api/portal/push", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "subscribe",
        endpoint: json.endpoint,
        keys: json.keys,
      }),
    });
  }, [loadPushConfig]);

  useEffect(() => {
    loadPushConfig().catch(() => undefined);
  }, [loadPushConfig]);

  // The service worker delivers alerts in both foreground and background.
  // UI refreshes only update the page; polling must not create a second alert.

  useEffect(() => {
    if (permission === "granted")
      registerPushSubscription().catch(() => undefined);
  }, [permission, registerPushSubscription]);

  async function enableAlerts() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  const canNotify = typeof window !== "undefined" && "Notification" in window;
  if (!ready) return null;
  if (permission === "granted" || permission === "denied" || !canNotify)
    return null;
  return (
    <div className="pwa-actions" role="status">
      {permission === "default" &&
        pushConfigured &&
        typeof window !== "undefined" &&
        "Notification" in window && (
          <button type="button" onClick={enableAlerts}>
            Enable alerts
          </button>
        )}
    </div>
  );
}
