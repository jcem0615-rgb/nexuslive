/*
 * Nexus Live service worker.
 *
 * Rule 8, and it is the whole design of this file: /api and anything carrying
 * a balance is NEVER cached and NEVER served from a cache. Money has to be
 * live. Everything here is about the shell — HTML, static chunks, icons —
 * so the app opens instantly and degrades to a readable offline page.
 */

const VERSION = 'v1';
const SHELL_CACHE = `nexus-shell-${VERSION}`;
const ASSET_CACHE = `nexus-assets-${VERSION}`;
const OFFLINE_URL = '/offline';

const SHELL_ASSETS = [
  OFFLINE_URL,
  '/manifest.json',
  '/logo.svg',
  '/logo-mark.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
];

/** Paths that must always hit the network, cache untouched. */
function isNeverCached(url) {
  return (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/admin') ||
    url.pathname.startsWith('/wallet') ||
    url.pathname.startsWith('/_next/webpack-hmr')
  );
}

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(?:css|js|woff2?|png|jpg|jpeg|svg|webp|avif|ico)$/.test(url.pathname)
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Balances, sessions, the admin portal: straight to the network, always.
  if (isNeverCached(url)) return;

  // Pages: network first so a signed-in user never sees another user's shell,
  // with the offline page as the only fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(SHELL_CACHE);
        return (await cache.match(OFFLINE_URL)) ?? Response.error();
      }),
    );
    return;
  }

  // Build output and icons are content-hashed or stable: serve from cache and
  // refresh in the background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.open(ASSET_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached ?? Response.error());
        return cached ?? network;
      }),
    );
  }
});
