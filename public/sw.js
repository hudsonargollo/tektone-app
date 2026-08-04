// Web Push service worker. Registered from src/lib/push.js — its only job is
// to turn a push event into an OS notification and route a click back into
// the app, mirroring the ?card=<id> deep link App.jsx already handles for
// email links.

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "TEKTONE", body: event.data ? event.data.text() : "" };
  }
  const { title = "TEKTONE", body = "", cardId } = payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: cardId || undefined,
      renotify: Boolean(cardId),
      data: { cardId },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cardId = event.notification.data?.cardId;
  const url = cardId ? `/?card=${cardId}` : "/";

  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clientsList) {
        if ("focus" in client) {
          await client.focus();
          if (cardId && "navigate" in client) {
            try {
              await client.navigate(url);
            } catch {
              /* focused client will still be on the app, close enough */
            }
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })()
  );
});
