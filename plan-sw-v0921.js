// The 1.0 shell contains its complete CSS, JS, icons and fonts.
// The previous release remains available offline as an independent fallback.
const SHELL_CACHE = 'plan-zajec-shell-v10-mobile';
const SHELL_URL = new URL('./index.html', self.registration.scope).href;
const ICON_URL = new URL('./app-icon.png', self.registration.scope).href;
const PREVIOUS_CACHE = 'plan-zajec-shell-v09';
const PREVIOUS_URL = new URL('./Plan_zajec_v0.9.html', self.registration.scope).href;

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const response = await fetch(SHELL_URL, { cache: 'reload' });
    if (!response.ok) throw new Error('Nowa wersja aplikacji nie jest kompletna');
    const cache = await caches.open(SHELL_CACHE);
    const icon = await fetch(ICON_URL, { cache: 'reload' });
    if (!icon.ok) throw new Error('Brakuje ikony aplikacji');
    await Promise.all([cache.put(SHELL_URL, response), cache.put(ICON_URL, icon)]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    await self.clients.claim();
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('plan-zajec-shell-') && name !== SHELL_CACHE && name !== PREVIOUS_CACHE)
      .map(name => caches.delete(name)));
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method === 'GET' && request.url === ICON_URL) {
    event.respondWith(caches.match(ICON_URL).then(cached => cached || fetch(request)));
    return;
  }
  if (request.method !== 'GET' || request.mode !== 'navigate') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  const target = url.pathname === new URL(SHELL_URL).pathname ? SHELL_URL
    : url.pathname === new URL(PREVIOUS_URL).pathname ? PREVIOUS_URL : null;
  if (!target) return;

  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(target === SHELL_URL ? SHELL_CACHE : PREVIOUS_CACHE);
        await cache.put(target, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(target);
      if (cached) return cached;
      throw error;
    }
  })());
});
