// Регресія #84: у папці F4 не має бути файлів, що відрізняються лише регістром (Saved.tsx / saved.ts) —
// на macOS і Windows імпорт підтягує не той модуль і сайт показує білий екран, а CI на Linux цього не бачить.
import { describe, expect, it } from 'vitest';

const files = [...Object.keys(import.meta.glob('./*')), ...Object.keys(import.meta.glob('../route/*'))];
const stem = (f: string) => f.replace(/\.(test\.)?(tsx?|css)$/, '').replace(/\.test-util$/, '').toLowerCase();

describe('#84: імена модулів F4 без колізій регістру', () => {
  it('є що перевіряти', () => expect(files.length).toBeGreaterThan(10));
  it('жодні два модулі не відрізняються лише регістром', () => {
    const byStem = new Map<string, Set<string>>();
    for (const f of files) {
      if (f.endsWith('.css')) continue; // panel.css / Panel.tsx імпортуються з явним розширенням
      const k = stem(f), orig = f.replace(/\.(test\.)?(tsx?)$/, '');
      byStem.set(k, (byStem.get(k) ?? new Set()).add(orig));
    }
    const clashes = [...byStem.values()].filter((s) => s.size > 1).map((s) => [...s].join(' / '));
    expect(clashes).toEqual([]);
  });
});
