// Merged service worker: handles PWA install criteria AND OneSignal push,
// both registered at the same root scope to avoid a scope conflict where
// only one service worker can control "/" at a time.
importScripts(
  "https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js"
);

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return new Response(null, {
        status: 408,
        statusText: "Network error",
      });
    })
  );
});
