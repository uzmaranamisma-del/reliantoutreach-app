"use client";
import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/browser-api";

export function PwaRuntime() {
  const pathname = usePathname();
  const [permission, setPermission] = useState<string>("loading");
  const [status, setStatus] = useState("Checking notification connection…");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [config, setConfig] = useState<any>();
  const load = useCallback(async () => {
    const value = await api("/api/portal/push");
    setConfig(value);
    return value;
  }, []);
  const connect = useCallback(async () => {
    setError("");
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("Open the installed app in a supported browser to enable alerts."); return;
    }
    const current = await load();
    if (!current.configured) { setStatus("Notifications need administrator setup."); return; }
    if (current.impersonating) { setStatus("Sign in to your own workspace to enable alerts."); return; }
    if (Notification.permission !== "granted") return;
    const registration = await navigator.serviceWorker.register("/sw.js");
    await Promise.race([navigator.serviceWorker.ready, new Promise((_, reject) => setTimeout(() => reject(new Error("Notification service is not ready. Reconnect in a moment.")), 10000))]);
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const padding = "=".repeat((4 - current.publicKey.length % 4) % 4);
      const key = Uint8Array.from(atob((current.publicKey + padding).replaceAll("-", "+").replaceAll("_", "/")), c => c.charCodeAt(0));
      subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
    }
    const json = subscription.toJSON();
    await api("/api/portal/push", { action: "subscribe", endpoint: json.endpoint, keys: json.keys });
    await load();
    setStatus("This device is connected. Alerts can arrive while the app is closed.");
  }, [load]);
  useEffect(() => {
    setPermission("Notification" in window ? Notification.permission : "unsupported");
    connect().catch(e => setError(e.message || "Notification connection failed. Reconnect below."));
  }, [connect]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setError("");
    try { await action(); } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  if (permission === "loading") return null;
  const detailed = pathname === "/app/notifications";
  if (!detailed && permission === "granted" && !error) return null;
  return <section className={detailed ? "panel content-panel notification-settings" : "pwa-actions"} aria-label="Notification settings" role="status">
    {detailed && <h2>Notification settings</h2>}
    {error ? <p role="alert">{error}</p> : detailed && <p>{status}</p>}
    {permission === "denied" && <p>Notifications are blocked. Allow them in this browser’s site settings, then reconnect.</p>}
    {permission === "unsupported" && <p>On iPhone, install from Safari → Share → Add to Home Screen, then open the installed app.</p>}
    {permission !== "unsupported" && <button type="button" disabled={busy || !config?.configured || config?.impersonating} onClick={() => run(async () => {
      const value = await Notification.requestPermission(); setPermission(value);
      if (value === "granted") await connect();
    })}>{busy ? "Connecting…" : permission === "granted" ? "Reconnect alerts" : "Enable alerts"}</button>}
    {detailed && permission === "granted" && <button type="button" disabled={busy} onClick={() => run(async () => {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) throw new Error("Reconnect this device first.");
      const result = await api("/api/portal/push", { action: "test", endpoint: subscription.endpoint });
      setStatus(result.message);
    })}>Send me a test notification</button>}
    {detailed && <>
      <p className="muted">Reply checks run in the background. Delivery depends on cron, network and device settings. Last check: {config?.scan?.lastScanAt ? new Date(config.scan.lastScanAt).toLocaleString() : "Waiting for first run"}. {config?.scan?.lastError}</p>
      <h3>Your registered devices</h3>
      {(config?.devices || []).map((device: any, index: number) => <p key={device.id}>Device {index + 1}{device.current ? " · Current login" : ""} · Registered {new Date(device.createdAt).toLocaleDateString()} <button type="button" disabled={busy} onClick={() => run(async () => {
        await api("/api/portal/push", { action: "remove-device", id: device.id });
        await load(); setStatus("Device removed. Reconnect on that device to enable alerts again.");
      })}>Remove</button></p>)}
    </>}
  </section>;
}
