const CACHE = "reliantoutreach-shell-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE)
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

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "ReliantOutreach", body: event.data?.text() || "New update" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "ReliantOutreach", {
      body: data.body || "You have a new workspace update.",
      icon: "/brand-logo.png",
      badge: "/brand-logo.png",
      tag: data.tag || "reliantoutreach-update",
      data: { url: data.url || "/app/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || "/app/notifications";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(
      (windows) => {
        const existing = windows.find((window) => "focus" in window);
        if (existing) {
          existing.navigate(target);
          return existing.focus();
        }
        return clients.openWindow(target);
      },
    ),
  );
});
