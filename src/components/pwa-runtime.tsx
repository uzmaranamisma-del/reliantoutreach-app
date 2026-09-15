"use client";

import { useEffect, useRef, useState } from "react";

type InstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaRuntime() {
  const [installPrompt, setInstallPrompt] = useState<InstallPrompt>();
  const [ready, setReady] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>(
    "default",
  );
  const lastId = useRef<string | undefined>(undefined),
    lastReplyId = useRef<string | undefined>(undefined);

  useEffect(() => {
    setReady(true);
    if ("Notification" in window) setPermission(Notification.permission);
    const onInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPrompt);
    };
    window.addEventListener("beforeinstallprompt", onInstallPrompt);
    navigator.serviceWorker?.register("/sw.js").catch(() => undefined);
    return () => window.removeEventListener("beforeinstallprompt", onInstallPrompt);
  }, []);

  useEffect(() => {
    let stopped = false;
    const showAlert = async (title: string, body: string, url: string, tag: string) => {
      if (Notification.permission !== "granted") return;
      const registration = await navigator.serviceWorker?.ready;
      if (registration) {
        await registration.showNotification(title, {
          body,
          icon: "/brand-logo.png",
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

  async function enableAlerts() {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result);
  }

  async function install() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(undefined);
  }

  const canNotify =
    typeof window !== "undefined" && "Notification" in window;
  if (!ready) return null;
  if (
    !installPrompt &&
    (permission === "granted" || permission === "denied" || !canNotify)
  )
    return null;
  return (
    <div className="pwa-actions" role="status">
      {permission === "default" &&
        typeof window !== "undefined" &&
        "Notification" in window && (
        <button type="button" onClick={enableAlerts}>
          Enable alerts
        </button>
      )}
      {installPrompt && (
        <button type="button" onClick={install}>
          Install app
        </button>
      )}
    </div>
  );
}
