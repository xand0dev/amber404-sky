// #138: деплой на push / ручний запуск бере поточні дані з Pages замість нового запиту до Open-Meteo.
// argv: <base_url Pages> <тека даних>; env: EVENT (github.event_name).
// Рішення — web/src/core/datasync.ts (тести там). Пише в $GITHUB_OUTPUT `stale=true|false`:
// true → workflow запускає повний `make data`. Будь-яка помилка → stale=true, код виходу 0.
// Файли пишемо лише всі разом, з одного деплою Pages (deploy.yml серіалізує concurrency `pages`):
// дані різних запитів не змішуємо (AGENTS.md).
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_FILES, PROFILE_INDEX, dataPlan, profileFiles, sameRun } from '../../web/src/core/datasync.ts';

const [base = '', out = 'web/public/data'] = process.argv.slice(2);
const event = process.env.EVENT ?? '';
const bust = `?t=${Date.now()}`; // повз кеш CDN Pages

function done(stale, reason) {
  console.log(`${stale ? 'make data: ' : ''}${reason}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `stale=${stale}\n`);
  process.exit(0);
}

async function get(name) {
  const url = new URL(`data/${name}.json${bust}`, base.endsWith('/') ? base : `${base}/`);
  const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new Error(`${name}.json: HTTP ${r.status}`);
  const text = await r.text();
  return { text, json: JSON.parse(text) };
}

try {
  if (event === 'schedule') done(true, dataPlan(event, null, Date.now()).reason);
  let meta = null;
  try {
    meta = await get('meta');
  } catch (e) {
    console.log(`meta.json з Pages: ${e.message}`);
  }
  const plan = dataPlan(event, meta?.json ?? null, Date.now());
  if (plan.fetch) done(true, plan.reason);
  const files = { meta };
  for (const name of DATA_FILES) if (name !== 'meta') files[name] = await get(name);
  // §6.2 (#165): профіль — тека profile/ (index + години з його переліку), усі години з того самого запуску
  files[PROFILE_INDEX] = await get(PROFILE_INDEX);
  const hours = profileFiles(files[PROFILE_INDEX].json);
  for (const name of hours) files[name] = await get(name);
  if (!sameRun(files[PROFILE_INDEX].json, hours.map((n) => files[n].json))) throw new Error('години профілю з різних запусків');
  mkdirSync(join(out, 'profile'), { recursive: true });
  for (const name of Object.keys(files)) writeFileSync(join(out, `${name}.json`), files[name].text);
  done(false, plan.reason);
} catch (e) {
  done(true, `не вдалося взяти дані з Pages: ${e.message}`);
}
