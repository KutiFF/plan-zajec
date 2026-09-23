/* global APP_VERSION */

// PL: Wersja jest współdzielona z aplikacją. EN: The app and worker share one version.
importScripts("./assets/js/version.js?app-shell");

const CACHE_PREFIX = "plan-zajec-shell-v";
const SHELL_CACHE = CACHE_PREFIX + APP_VERSION.replaceAll(".", "-");
const LEGACY_CACHE = "plan-zajec-shell-v09";
const LEGACY_URL = new URL("./Plan_zajec_v0.9.html", self.registration.scope).href;

// PL: Pełna powłoka potrzebna do pracy offline. EN: Complete shell required offline.
const SHELL_ASSETS = [
  "./index.html",
  "./app-icon.png",
  "./assets/css/app.css?app-shell",
  "./assets/js/version.js?app-shell",
  "./assets/js/editor.js?app-shell",
  "./assets/js/state-and-export.js?app-shell",
  "./assets/js/text-formatting.js?app-shell",
  "./assets/js/schedule-and-settings.js?app-shell",
  "./assets/js/theme-preview-bootstrap.js?app-shell",
  "./assets/fonts/roboto-400-latin-ext.woff2",
  "./assets/fonts/roboto-400-latin.woff2",
  "./assets/fonts/roboto-700-latin-ext.woff2",
  "./assets/fonts/roboto-700-latin.woff2",
].map((path) => new URL(path, self.registration.scope).href);

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      const responses = await Promise.all(
        SHELL_ASSETS.map(async (url) => {
          const response = await fetch(url, { cache: "reload" });
          if (!response.ok) {
            throw new Error(`Nie udało się pobrać zasobu powłoki: ${url}`);
          }
          return [url, response];
        }),
      );

      await Promise.all(responses.map(([url, response]) => cache.put(url, response)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.clients.claim();
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(
            (name) =>
              name.startsWith(CACHE_PREFIX) && name !== SHELL_CACHE && name !== LEGACY_CACHE,
          )
          .map((name) => caches.delete(name)),
      );
    })(),
  );
});

// PL: Nawigacja korzysta z sieci i wraca do cache bez internetu.
// EN: Navigations prefer the network and fall back to cache when offline.
async function networkFirst(request, fallbackUrl) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(fallbackUrl === LEGACY_URL ? LEGACY_CACHE : SHELL_CACHE);
      await cache.put(fallbackUrl, response.clone());
    }
    return response;
  } catch (error) {
    const cached = await caches.match(fallbackUrl);
    if (cached) return cached;
    throw error;
  }
}

// PL: Pliki aplikacji korzystają z sieci, a cache jest bezpiecznym trybem offline.
// Dzięki temu jedna strona nie miesza plików JavaScript z różnych wydań.
// EN: App files prefer the network and use cache as an offline fallback.
// This prevents one page from mixing JavaScript files from different releases.
async function shellAssetNetworkFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fetch(request, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Nie udało się odświeżyć zasobu: ${request.url}`);
    await cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = (await cache.match(request)) || (await caches.match(request));
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    const shellUrl = SHELL_ASSETS[0];
    const fallbackUrl = url.pathname === new URL(LEGACY_URL).pathname ? LEGACY_URL : shellUrl;
    event.respondWith(networkFirst(request, fallbackUrl));
    return;
  }

  if (SHELL_ASSETS.includes(request.url)) {
    event.respondWith(shellAssetNetworkFirst(request));
  }
});
