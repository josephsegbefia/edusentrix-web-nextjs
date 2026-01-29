/* eslint-disable no-restricted-globals */
const VERSION = "v1";
const STATIC_CACHE = `edusentrix-static-${VERSION}`;
const API_CACHE = `edusentrix-api-${VERSION}`;
const PAGE_CACHE = `edusentrix-pages-${VERSION}`;

const STATIC_ASSETS = [
  "/manifest.webmanifest",
  "/logo/edusentrix-logo.png",
  "/pwa/icon-192.png",
  "/pwa/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => undefined)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => ![STATIC_CACHE, API_CACHE, PAGE_CACHE].includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok && !isNoStore(response)) {
    cache.put(request, response.clone());
  }
  return response;
}

async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const response = await fetch(request);
    if (response && response.ok && !isNoStore(response)) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw new Error("Network error");
  }
}

function isNoStore(response) {
  const cacheControl = response.headers.get("Cache-Control");
  return cacheControl ? cacheControl.includes("no-store") : false;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/logo/") ||
    url.pathname.startsWith("/pwa/") ||
    request.destination === "style" ||
    request.destination === "script" ||
    request.destination === "image" ||
    request.destination === "font";

  if (isStaticAsset) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  if (url.pathname.startsWith("/api/teacher/") && request.method === "GET") {
    event.respondWith(networkFirst(request, API_CACHE));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, PAGE_CACHE));
  }
});
