// Path guard (docs/PIPELINE.md §5). stdin: список змінених файлів; argv[2]: гілка.
// stdout: JSON { feature, own, shared, foreign }. Код 1, якщо PR фічі чіпає папку іншої фічі.
// Гілка feat/F0-… — це власник спільних файлів: усе для неї «own».
import { readFileSync } from 'node:fs';
import { FEATURES, ownsFile } from './paths.mjs';

const branch = process.argv[2] ?? '';
const m = /^feat\/(F[0-4])(?:[-/].*)?$/.exec(branch);
const feature = m ? m[1] : null;
const files = readFileSync(0, 'utf8').split('\n').map((f) => f.trim()).filter(Boolean);
const r = { feature, own: [], shared: [], foreign: [] };
for (const f of files) {
  if (feature === 'F0') r.own.push(f);
  else if (feature && ownsFile(feature, f)) r.own.push(f);
  else if (feature && Object.keys(FEATURES).some((id) => id !== feature && ownsFile(id, f))) r.foreign.push(f);
  else r.shared.push(f);
}
console.log(JSON.stringify(r));
if (!feature) console.error(`::notice::Гілка «${branch}» не feat/F<N> — усі файли вважаються спільними.`);
if (r.shared.length) console.error(`::notice::Спільні файли (рев'ю чергової F0): ${r.shared.join(', ')}`);
if (r.foreign.length) { console.error(`::error::PR чіпає папки інших фіч: ${r.foreign.join(', ')}`); process.exit(1); }
