// Merged service worker: handles PWA install criteria AND OneSignal push,
// both registered at the same root scope to avoid a scope conflict where
// only one service worker can control "/" at a time.
importScripts("https://cdn.onesignal.com/sdks/OneSignalSDKWorker.js");

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      // Network request failed (offline, backgrounded tab, etc).
      // Return a fallback response instead of throwing an unhandled
      // rejection inside the service worker.
      return new Response(null, { status: 408, statusText: "Network error" });
    })
  );
});