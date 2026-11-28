// Мінімальні типи Node лише для тестів візуальної системи (#88), що читають CSS з диска: vitest віддає вміст .css
// порожнім, а @types/node у проєкті немає (package.json і tsconfig — не F3). Тільки те, що справді викликається.
declare module 'node:fs' {
  export interface Dirent { name: string; isDirectory(): boolean }
  export function readFileSync(path: string, enc: 'utf8'): string;
  export function readdirSync(path: string, opts: { withFileTypes: true }): Dirent[];
}
declare module 'node:path' {
  export function join(...p: string[]): string;
  export function relative(from: string, to: string): string;
}
declare const process: { cwd(): string };
