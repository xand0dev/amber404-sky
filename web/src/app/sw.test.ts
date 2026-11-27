import { beforeEach, describe, expect, it, vi } from 'vitest';
import swSrc from '../../public/sw.js?raw';

// Поведінковий тест web/public/sw.js у фейковому ServiceWorkerGlobalScope (F3-AC9, §7.11).
const ORIGIN = 'https://amber.test/sky/';
const INDEX = '<html><head><link rel="manifest" href="./manifest.webmanifest" /><script type="module" crossorigin src="./assets/index-abc.js"></script><link rel="stylesheet" crossorigin href="./assets/index-def.css"></head></html>';

type Req = { url: string; method: string; mode: string };
type Handler = (e: Record<string, unknown>) => void;

function makeCaches() {
  const store = new Map<string, Map<string, Response>>();
  const key = (r: string | Req) => (typeof r === 'string' ? r : r.url);
  const open = async (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    const c = store.get(name)!;
    return {
      put: async (r: string | Req, res: Response) => { c.set(key(r), res); },
      match: async (r: string | Req) => c.get(key(r))?.clone(),
    };
  };
  return {
    store,
    api: {
      open,
      keys: async () => [...store.keys()],
      delete: async (n: string) => store.delete(n),
      match: async (r: string | Req) => {
        for (const c of store.values()) { const hit = c.get(key(r)); if (hit) return hit.clone(); }
        return undefined;
      },
    },
  };
}

let handlers: Record<string, Handler>;
let caches: ReturnType<typeof makeCaches>;
let net: Map<string, string>;
let online: boolean;
const fetchMock = vi.fn(async (r: string | Req) => {
  const url = typeof r === 'string' ? r : r.url;
  if (!online) throw new TypeError('Failed to fetch');
  const body = net.get(url);
  return body == null ? new Response('nf', { status: 404 }) : new Response(body, { status: 200 });
});
const self = {
  location: { href: `${ORIGIN}sw.js`, origin: 'https://amber.test' },
  addEventListener: (t: string, h: Handler) => { handlers[t] = h; },
  skipWaiting: vi.fn(async () => {}),
  clients: { claim: vi.fn(async () => {}) },
};

async function fire(type: string, extra: Record<string, unknown> = {}) {
  const waits: Promise<unknown>[] = [];
  let responded: Promise<Response> | undefined;
  handlers[type]({ ...extra, waitUntil: (p: Promise<unknown>) => waits.push(p), respondWith: (p: Promise<Response>) => { responded = p; p.catch(() => {}); } });
  await Promise.all(waits);
  return responded;
}
const req = (path: string, mode = 'cors', method = 'GET'): Req => ({ url: new URL(path, ORIGIN).href, method, mode });
const u = (p: string) => new URL(p, ORIGIN).href;

beforeEach(() => {
  handlers = {}; caches = makeCaches(); online = true; fetchMock.mockClear();
  net = new Map([
    [u('./'), INDEX], [u('index.html'), INDEX], [u('manifest.webmanifest'), '{}'],
    [u('assets/index-abc.js'), 'js'], [u('assets/index-def.css'), 'css'],
    [u('icons/icon-192.png'), 'png'], [u('icons/icon-512.png'), 'png'],
    [u('data/meta.json'), '{"v":1}'], [u('data/profile.json'), '{}'], [u('data/kp.json'), '{}'],
    [u('data/static/profiles.json'), '[]'], [u('data/static/cities.json'), '[]'], [u('data/static/borders.json'), '{}'],
  ]);
  new Function('self', 'caches', 'fetch', swSrc)(self, caches.api, fetchMock);
});

const cached = () => new Set([...caches.store.values()].flatMap((c) => [...c.keys()]));

describe('F3-AC9: після одного відкриття все потрібне в кеші', () => {
  it('install кешує оболонку, зібрані assets з index.html, іконки й пакет даних', async () => {
    await fire('install');
    const c = cached();
    for (const p of ['./', 'manifest.webmanifest', 'assets/index-abc.js', 'assets/index-def.css', 'icons/icon-192.png', 'icons/icon-512.png',
      'data/meta.json', 'data/profile.json', 'data/kp.json', 'data/static/profiles.json', 'data/static/cities.json', 'data/static/borders.json']) {
      expect(c.has(u(p)), p).toBe(true);
    }
    // необовʼязкових файлів (galileo, climate) немає на сервері — 404 не кешуємо й install не падає
    expect(c.has(u('data/galileo.json'))).toBe(false);
    expect(self.skipWaiting).toHaveBeenCalled();
  });

  it('без мережі: навігація, assets і дані віддаються з кешу', async () => {
    await fire('install');
    online = false;
    const nav = await fire('fetch', { request: req('./?x=1', 'navigate') });
    expect(await nav!.text()).toBe(INDEX);
    expect(await (await fire('fetch', { request: req('assets/index-abc.js') }))!.text()).toBe('js');
    expect(await (await fire('fetch', { request: req('data/meta.json') }))!.text()).toBe('{"v":1}');
  });

  it('з мережею дані беруться свіжі й оновлюють кеш (оновлення прогнозу)', async () => {
    await fire('install');
    net.set(u('data/meta.json'), '{"v":2}');
    expect(await (await fire('fetch', { request: req('data/meta.json') }))!.text()).toBe('{"v":2}');
    online = false;
    expect(await (await fire('fetch', { request: req('data/meta.json') }))!.text()).toBe('{"v":2}');
  });

  it('assets, яких не було при install, кешуються при першому запиті', async () => {
    await fire('install');
    net.set(u('assets/chunk-1.js'), 'chunk');
    await (await fire('fetch', { request: req('assets/chunk-1.js') }))!.text();
    online = false;
    expect(await (await fire('fetch', { request: req('assets/chunk-1.js') }))!.text()).toBe('chunk');
  });

  it('немає ні мережі, ні кешу — помилка, а не чужі дані', async () => {
    online = false;
    await expect(fire('fetch', { request: req('data/climate.json') })).rejects.toThrow('Failed to fetch');
  });

  it('чужі домени й не-GET не перехоплює (OPSEC §7.11)', async () => {
    expect(await fire('fetch', { request: { url: 'https://other.test/x', method: 'GET', mode: 'cors' } })).toBeUndefined();
    expect(await fire('fetch', { request: req('data/meta.json', 'cors', 'POST') })).toBeUndefined();
  });

  it('activate прибирає кеші старих версій і бере сторінки під контроль', async () => {
    await caches.api.open('amber-old');
    await fire('install');
    await fire('activate');
    expect([...caches.store.keys()].some((k) => k === 'amber-old')).toBe(false);
    expect(caches.store.size).toBeGreaterThan(0);
    expect(self.clients.claim).toHaveBeenCalled();
  });
});
