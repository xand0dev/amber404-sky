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
  use: string;
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
  lat: number;
  lon: number;
}

export const DATA_FILES = ['meta', 'profile', 'galileo', 'kp', 'climate'] as const;
export type DataFile = (typeof DATA_FILES)[number];
