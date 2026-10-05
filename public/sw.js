const CACHE = "reliantoutreach-shell-v1";
const NOTICE_CACHE = "reliantoutreach-notifications-v1";
const NOTICE_LEDGER = "/__notification_receipts__";
let deliveryQueue = Promise.resolve();

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                key.startsWith("reliantoutreach-") &&
                key !== CACHE &&
                key !== NOTICE_CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/"))
    return;
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request)),
  );
});

async function deliverNotification(data) {
  // IDs survive worker restarts, page reloads and dismissal from the phone tray.
  // Serial processing also prevents simultaneous redeliveries from racing.
  const eventId = data.eventId || data.tag;
  let cache;
  let receipts = [];
  try {
    cache = await caches.open(NOTICE_CACHE);
    const saved = await cache.match(NOTICE_LEDGER);
    const parsed = saved ? await saved.json() : [];
    if (Array.isArray(parsed))
      receipts = parsed.filter(
        (item) =>
          typeof item.id === "string" &&
          Number.isFinite(item.at) &&
          item.at > Date.now() - 30 * 86400000,
      );
    if (eventId && receipts.some((item) => item.id === eventId)) return;
  } catch {
    /* Storage failures must not prevent new alerts. */
  }

  await self.registration.showNotification(data.title || "ReliantOutreach", {
    body: data.body || "You have a new workspace update.",
    icon: "/android-chrome-192x192.png",
    tag: eventId || "reliantoutreach-update",
    renotify: false,
    data: { url: data.url || "/app/notifications" },
  });
  // Save only after display succeeds, allowing a failed delivery to be retried.
  if (cache && eventId) {
    receipts.push({ id: eventId, at: Date.now() });
    try {
      await cache.put(
        NOTICE_LEDGER,
        new Response(JSON.stringify(receipts.slice(-1000))),
      );
    } catch {
      /* Notification was delivered; disk may be full. */
    }
  }
}

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "ReliantOutreach",
      body: event.data?.text() || "New update",
    };
  }
  if (!data || typeof data !== "object") data = {};
  const delivery = deliveryQueue.then(() => deliverNotification(data));
  deliveryQueue = delivery.catch(() => undefined);
  event.waitUntil(delivery);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/app/notifications";
  event.waitUntil(
    clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((windows) => {
        const existing = windows.find((window) => "focus" in window);
        if (existing) {
          existing.navigate(target);
          return existing.focus();
        }
        return clients.openWindow(target);
      }),
  );
});
