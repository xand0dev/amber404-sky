// F0-AC1: кожен JSON у web/public/data/ валідний за своєю schema з contracts/.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const files = [
  ['meta', 'web/public/data/meta.json'],
  ['profile-index', 'web/public/data/profile/index.json'],
  ['galileo', 'web/public/data/galileo.json'],
  ['kp', 'web/public/data/kp.json'],
  ['climate', 'web/public/data/climate.json'],
  ['profiles', 'web/public/data/static/profiles.json'],
  ['cities', 'web/public/data/static/cities.json'],
  ['borders', 'web/public/data/static/borders.json'],
  ['relief', 'web/public/data/static/relief.json'],
];
// §6.2 (#165): години профілю — з переліку index.json; кожна з того самого запуску, що й index.
const indexPath = resolve(root, 'web/public/data/profile/index.json');
const index = existsSync(indexPath) ? JSON.parse(readFileSync(indexPath, 'utf8')) : { hours: [] };
for (const h of index.hours ?? []) files.push(['profile-hour', `web/public/data/profile/${h.file}`, index.generatedAt]);
let bad = 0;
if (existsSync(resolve(root, 'web/public/data/profile.json'))) {
  console.error('✗ web/public/data/profile.json: старий формат (#165) — запусти make data-mock'); bad++;
}
for (const [schema, file, gen] of files) {
  const path = resolve(root, file);
  if (!existsSync(path)) { console.error(`✗ ${file}: немає файлу (запусти make data-mock)`); bad++; continue; }
  const validate = ajv.compile(JSON.parse(readFileSync(resolve(root, `contracts/${schema}.schema.json`), 'utf8')));
  const json = JSON.parse(readFileSync(path, 'utf8'));
  if (gen && json.generatedAt !== gen) { console.error(`✗ ${file}: інший запуск, ніж profile/index.json`); bad++; continue; }
  if (validate(json)) console.log(`✓ ${file}`);
  else { console.error(`✗ ${file}: ${ajv.errorsText(validate.errors).slice(0, 400)}`); bad++; }
}
process.exit(bad ? 1 : 0);
