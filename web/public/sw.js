// Service worker AMBER Sky (SPEC §7.11): застосунок і останній пакет даних у кеші, без мережі працює все,
// крім оновлення прогнозу. Лише GET того самого походження — запитів із координатами немає (OPSEC).
/* global self, caches, fetch, URL, setTimeout, clearTimeout -- глобали ServiceWorkerGlobalScope */
const VERSION = 'v1';
const SHELL = `amber-shell-${VERSION}`;
const DATA = `amber-data-${VERSION}`;
const CORE = ['./', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png'];
// Пакет даних — ті самі файли, що читає web/src/app/data.ts.
const DATA_FILES = ['meta.json', 'profile.json', 'galileo.json', 'kp.json', 'climate.json',
  'static/profiles.json', 'static/cities.json', 'static/borders.json'].map((f) => `data/${f}`);
const NET_TIMEOUT_MS = 5000;

const abs = (p) => new URL(p, self.location.href).href;
const dataPrefix = abs('data/');

async function store(cacheName, url) {
  try {
    const res = await fetch(url);
    if (res.ok) await (await caches.open(cacheName)).put(url, res);
    return res;
  } catch {
    return null;
  }
}

async function precache() {
  const index = await store(SHELL, abs('./'));
  // assets зібраної сторінки (./assets/index-<hash>.js|css) — з її ж index.html
  const html = index ? await (await caches.open(SHELL)).match(abs('./')).then((r) => r.text()) : '';
  const assets = [...html.matchAll(/(?:src|href)="(\.\/[^"]+)"/g)].map((m) => abs(m[1]));
  const shell = [...new Set([...CORE.slice(1).map(abs), ...assets])];
  await Promise.all([...shell.map((u) => store(SHELL, u)), ...DATA_FILES.map((f) => store(DATA, abs(f)))]);
}

function withTimeout(p, ms) {
  let t;
  const timer = new Promise((_, rej) => { t = setTimeout(() => rej(new Error('timeout')), ms); });
  return Promise.race([p, timer]).finally(() => clearTimeout(t));
}

// Мережа першою (свіжий прогноз), без мережі — кеш. Ніколи не підставляє інший файл, крім index.html для навігації.
async function networkFirst(req, cacheName, fallbackUrl) {
  try {
    const res = await withTimeout(fetch(req), NET_TIMEOUT_MS);
    if (res.ok) {
      const copy = res.clone();
      await (await caches.open(cacheName)).put(req, copy);
      return res;
    }
    const hit = await caches.match(req);
    return hit || res;
  } catch (e) {
    const hit = (await caches.match(req)) || (fallbackUrl && (await caches.match(fallbackUrl)));
    if (hit) return hit;
    throw e;
  }
}

// assets з хешем у назві не змінюються — кеш першим.
async function cacheFirst(req) {
  const hit = await caches.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) await (await caches.open(SHELL)).put(req, res.clone());
  return res;
}

self.addEventListener('install', (e) => {
  e.waitUntil(precache().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== DATA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith(self.location.origin)) return;
  if (req.mode === 'navigate') e.respondWith(networkFirst(req, SHELL, abs('./')));
  else if (req.url.startsWith(dataPrefix)) e.respondWith(networkFirst(req, DATA));
  else e.respondWith(cacheFirst(req));
});
