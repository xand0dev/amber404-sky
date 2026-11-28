// Контракти даних (SPEC §6). Єдине місце, звідки web читає типи. Змінює лише власник F0.

export type SourceStatus = 'ok' | 'partial' | 'nodata';

export interface SourceMeta {
  id: string;
  name: string;
  license: string;
  fetchedAt: string;
  status: SourceStatus;
  note: string;
}

export interface Grid {
  lat0: number; // північ, рядок 0
  lon0: number; // захід, стовпець 0
  step: number;
  nr: number;
  nc: number;
}

export interface Meta {
  generatedAt: string;
  mock: boolean;
  grid: Grid;
  times: string[]; // ISO UTC, 48 значень
  sources: SourceMeta[];
}

/** [рівень][година][точка] або [година][точка]; null — немає даних. */
export type Field3 = (number | null)[][][];
export type Field2 = (number | null)[][];

export interface Profile {
  generatedAt: string;
  sources: string[];
  levels: number[]; // м над землею, 16 рівнів
  spd: Field3; // м/с × 10
  dir: Field3; // градуси, звідки дме
  gust: Field2; // м/с × 10, 10 м
  temp: Field2; // °C × 10, 2 м
  precip: Field2; // мм/год × 10
  rh: Field2; // %
  vis: Field2; // м / 100
}

/** §6.2 (#165): на диску профіль розбитий за годинами — profile/index.json + profile/hNN.json.
 *  Сайт збирає їх у Profile (core/profileHours); година, якої ще нема, — undefined (= немає даних). */
export type ProfileVar = 'spd' | 'dir' | 'gust' | 'temp' | 'precip' | 'rh' | 'vis';

export interface ProfileIndex {
  generatedAt: string;
  sources: string[];
  grid: Grid;
  levels: number[];
  vars: { id: string; perLevel: boolean; unit: string }[];
  hours: { t: string; file: string }[]; // 48 годин, file — «h00.json» у теці profile/
}

export interface ProfileHour {
  generatedAt: string; // = index.generatedAt, інакше година з іншого запуску
  hour: number;
  t: string;
  spd: (number | null)[][]; // [рівень][точка]
  dir: (number | null)[][];
  gust: (number | null)[]; // [точка]
  temp: (number | null)[];
  precip: (number | null)[];
  rh: (number | null)[];
  vis: (number | null)[];
}

export interface Galileo {
  generatedAt: string;
  sources: string[];
  elevationMaskDeg: number;
  points: { name: string; lat: number; lon: number }[];
  visible: (number | null)[][]; // [точка][година]
  pdop: (number | null)[][];
}

export interface Kp {
  generatedAt: string;
  sources: string[];
  series: { t: string; kp: number; observed: boolean }[];
}

export interface Climate {
  generatedAt: string;
  sources: string[];
  year: number;
  cities: Record<string, Record<string, number[]>>; // місто → профіль → 12 місяців, %
}

export type Energy = 'battery' | 'fuel';

export interface DroneProfile {
  id: string;
  name: string;
  nameEn?: string; // назва англійською (issue #108); немає — показ name
  use: string;
  useEn?: string;
  massKg: number;
  energy: Energy;
  enduranceMin: number;
  cruiseMs: number;
  windMs: number;
  gustMs: number;
  tMinC: number;
  precipMmH: number;
  bandM: [number, number];
  defaultAltM: number;
  kind: 'multirotor' | 'wing';
  source: 'assumption' | string;
}

export interface City {
  name: string;
  nameEn?: string; // назва англійською (issue #125); немає — транслітерація name (F3, cityName)
  lat: number;
  lon: number;
}

/** static/relief.json (SPEC §7.6a, `cop-dem`). Рядок 0 = lat0 — ПІВДЕНЬ, не як у Grid:
 *  точка (r, c) — lat0 + r·step, lon0 + c·step; індекс r * nc + c. */
export interface Relief {
  source: 'cop-dem' | string;
  lat0: number; // південь, рядок 0
  lon0: number; // захід, стовпець 0
  step: number; // градуси
  nr: number;
  nc: number;
  elev: (number | null)[]; // цілі метри н. р. м.; null — море (≤ 0 м)
}

// Години профілю (profile/hNN.json) перелічені в profile/index.json.
export const DATA_FILES = ['meta', 'profile/index', 'galileo', 'kp', 'climate'] as const;
export type DataFile = (typeof DATA_FILES)[number];
