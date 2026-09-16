"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function PwaRuntime() {
  const [ready, setReady] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    "default",
  );
  const [pushConfigured, setPushConfigured] = useState(false);
  const lastId = useRef<string | undefined>(undefined),
    lastReplyId = useRef<string | undefined>(undefined);

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

  useEffect(() => {
    let stopped = false;
    const showAlert = async (title: string, body: string, url: string, tag: string) => {
      if (Notification.permission !== "granted") return;
      const registration = await navigator.serviceWorker?.ready;
      if (registration) {
        await registration.showNotification(title, {
          body,
          icon: "/app-icon-192.png",
          tag,
          data: { url },
        });
      } else new Notification(title, { body });
    };
    const check = async () => {
      try {
        const [notificationResponse, inboxResponse] = await Promise.all([
          fetch("/api/portal/notifications?page=1", {
            credentials: "include",
            cache: "no-store",
          }),
          fetch("/api/portal/inbox?page=1", {
            credentials: "include",
            cache: "no-store",
          }),
        ]);
        if (notificationResponse.ok) {
          const data = await notificationResponse.json();
          const newest = data.items?.[0];
          if (newest && !stopped) {
            if (lastId.current && lastId.current !== newest.id)
              await showAlert(
                newest.title || "New workspace update",
                "Open Notifications to review this update.",
                "/app/notifications",
                newest.id,
              );
            lastId.current = newest.id;
          }
        }
        if (inboxResponse.ok) {
          const data = await inboxResponse.json();
          const newest = data.items?.[0];
          if (newest && !stopped) {
            if (lastReplyId.current && lastReplyId.current !== newest.id)
              await showAlert(
                `New reply from ${newest.fromEmail || "your prospect"}`,
                newest.preview || newest.subject || "Open Inbox to read the message.",
                "/app/inbox",
                `reply-${newest.id}`,
              );
            lastReplyId.current = newest.id;
          }
        }
      } catch {
        // The app may be on a public or signed-out route; retry quietly.
      }
    };
    check();
    const timer = window.setInterval(check, 15000);
    return () => {
      stopped = true;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (permission === "granted")
      registerPushSubscription().catch(() => undefined);
  }, [permission, registerPushSubscription]);

  async function enableAlerts() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
    if (result === "granted") await registerPushSubscription();
  }

  const canNotify =
    typeof window !== "undefined" && "Notification" in window;
  if (!ready) return null;
  if (
    (permission === "granted" || permission === "denied" || !canNotify)
  )
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
