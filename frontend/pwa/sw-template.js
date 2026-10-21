/* GhostPay caches public application code only. No API, wallet, bank or RPC data. */
const BUILD = '__BUILD_ID__';
const SHELL = `ghostpay-shell-${BUILD}`;
const ASSETS = `ghostpay-assets-${BUILD}`;
const PRECACHE = __PRECACHE__;
const ownCache = name => /^ghostpay-(shell|assets)-/.test(name);
const publicAsset = path => /^\/assets\/[\w.-]+\.(js|css|wasm)$/.test(path) || /^\/icons\/ghostpay-(180|192|512)\.png$/.test(path) || ['/inter.woff2', '/instrument-serif-italic.woff2', '/offline-retry.js', '/manifest.webmanifest'].includes(path);

self.addEventListener('install', event => {
  event.waitUntil(caches.open(SHELL).then(cache => cache.addAll(PRECACHE.map(path => new Request(path, { cache: 'reload', credentials: 'omit' })))));
  // Updates wait. Never reload an open wallet or payment form automatically.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    const previous = names.filter(name => name.startsWith('ghostpay-shell-') && name !== SHELL).at(-1);
    const keep = new Set([SHELL, ASSETS, previous, previous?.replace('ghostpay-shell-', 'ghostpay-assets-')]);
    await Promise.all(names.filter(name => ownCache(name) && !keep.has(name)).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') event.waitUntil(self.skipWaiting());
});
async function readCached(request) {
  const names = [SHELL, ASSETS, ...(await caches.keys()).filter(ownCache)];
  for (const name of [...new Set(names)]) {
    const cached = await (await caches.open(name)).match(request);
    if (cached) return cached;
  }
}
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search || request.headers.has('authorization')) return;
  if (/^\/(api|contracts|_matrix|_synapse|auth)(\/|$)/.test(url.pathname)) return;
  if (request.mode === 'navigate') {
    const savedApp = url.pathname === '/' || url.pathname === '/chat' || url.pathname === '/index.html';
    event.respondWith(fetch(request, { cache: 'no-store' }).catch(async () => {
      const fallback = await readCached(savedApp ? '/index.html' : '/offline.html');
      return fallback || new Response('Reconnect to open GhostPay.', { status: 503, headers: { 'Content-Type': 'text/plain' } });
    }));
    return;
  }
  if (!publicAsset(url.pathname)) return;
  event.respondWith((async () => {
    const cached = await readCached(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && response.type === 'basic' && !/no-store/i.test(response.headers.get('cache-control') || '') && !/text\/html/i.test(response.headers.get('content-type') || '')) {
      const cache = await caches.open(ASSETS);
      await cache.put(request, response.clone());
      const keys = await cache.keys();
      await Promise.all(keys.slice(0, Math.max(0, keys.length - 120)).map(key => cache.delete(key)));
    }
    return response;
  })());
});
