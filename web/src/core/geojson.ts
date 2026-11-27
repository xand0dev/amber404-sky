// Малюнки на карті (SPEC §7.13): модель фігур і обмін GeoJSON (RFC 7946) / KML 2.2. Чистий TS без DOM.
// Загальні позначки — без тактичних знаків і без шару цілей (Конституція 8). Координати фігур — [lat, lon], як у projection.ts.

export type ShapeKind = 'point' | 'line' | 'arrow' | 'area' | 'text';
export const SHAPE_KINDS: readonly ShapeKind[] = ['point', 'line', 'arrow', 'area', 'text'];

export interface Shape {
  id: string;
  kind: ShapeKind;
  /** #rrggbb */
  color: string;
  /** [lat, lon]; для області кільце не замкнене. */
  coords: [number, number][];
  /** Підпис точки або текст напису. */
  label?: string;
}

type Pos = number[];
export type Geometry =
  | { type: 'Point'; coordinates: Pos }
  | { type: 'LineString'; coordinates: Pos[] }
  | { type: 'Polygon'; coordinates: Pos[][] };
export interface Feature { type: 'Feature'; geometry: Geometry; properties: { kind: ShapeKind; color: string; name?: string } }
export interface FeatureCollection { type: 'FeatureCollection'; features: Feature[] }

export const DEFAULT_COLOR = '#e2a72e';
const HEX = /^#[0-9a-f]{6}$/i;
const MIN_PTS: Record<ShapeKind, number> = { point: 1, text: 1, line: 2, arrow: 2, area: 3 };

let seq = 0;
export const newId = () => `${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

const isLatLon = (p: unknown): p is [number, number] =>
  Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v))
  && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180;

/** Перевірка фігури з localStorage чи імпорту. */
export function isShape(v: unknown): v is Shape {
  if (!v || typeof v !== 'object') return false;
  const s = v as Partial<Shape>;
  if (typeof s.id !== 'string' || !SHAPE_KINDS.includes(s.kind as ShapeKind)) return false;
  if (typeof s.color !== 'string' || !HEX.test(s.color)) return false;
  if (s.label !== undefined && typeof s.label !== 'string') return false;
  if (!Array.isArray(s.coords) || !s.coords.every(isLatLon)) return false;
  const n = s.coords.length, min = MIN_PTS[s.kind as ShapeKind];
  return s.kind === 'point' || s.kind === 'text' ? n === 1 : n >= min;
}

const ll = ([lat, lon]: [number, number]): Pos => [lon, lat];

function geometryOf(s: Shape): Geometry {
  if (s.kind === 'point' || s.kind === 'text') return { type: 'Point', coordinates: ll(s.coords[0]) };
  if (s.kind === 'area') { const r = s.coords.map(ll); return { type: 'Polygon', coordinates: [[...r, r[0]]] }; }
  return { type: 'LineString', coordinates: s.coords.map(ll) };
}

export function toGeoJSON(shapes: Shape[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: shapes.map((s) => ({
      type: 'Feature',
      geometry: geometryOf(s),
      properties: { kind: s.kind, color: s.color, ...(s.label ? { name: s.label } : {}) },
    })),
  };
}

const toLatLon = (p: unknown): [number, number] | null => {
  if (!Array.isArray(p) || p.length < 2) return null;
  const q: [number, number] = [p[1], p[0]];
  return isLatLon(q) ? q : null;
};
const toLatLons = (ps: unknown): [number, number][] | null => {
  if (!Array.isArray(ps)) return null;
  const r = ps.map(toLatLon);
  return r.every((p) => p !== null) ? (r as [number, number][]) : null;
};
const openRing = (r: [number, number][]) =>
  r.length > 1 && r[0][0] === r.at(-1)![0] && r[0][1] === r.at(-1)![1] ? r.slice(0, -1) : r;

/** Геометрія → [тип за замовчуванням, координати] для кожної частини (Multi* розгортаються). */
function parts(g: unknown): ['point' | 'line' | 'area', unknown][] {
  if (!g || typeof g !== 'object') return [];
  const { type, coordinates: c, geometries } = g as { type?: string; coordinates?: unknown; geometries?: unknown };
  const many = (k: 'point' | 'line' | 'area') => (Array.isArray(c) ? c.map((x): ['point' | 'line' | 'area', unknown] => [k, x]) : []);
  switch (type) {
    case 'Point': return [['point', c]];
    case 'LineString': return [['line', c]];
    case 'Polygon': return [['area', c]];
    case 'MultiPoint': return many('point');
    case 'MultiLineString': return many('line');
    case 'MultiPolygon': return many('area');
    case 'GeometryCollection': return Array.isArray(geometries) ? geometries.flatMap(parts) : [];
    default: return [];
  }
}

function shapesOf(geometry: unknown, props: unknown): Shape[] {
  const p = (props && typeof props === 'object' ? props : {}) as Record<string, unknown>;
  const color = typeof p.color === 'string' && HEX.test(p.color) ? p.color : DEFAULT_COLOR;
  const name = typeof p.name === 'string' ? p.name : typeof p.label === 'string' ? p.label : undefined;
  const out: Shape[] = [];
  for (const [base, c] of parts(geometry)) {
    let coords: [number, number][] | null;
    if (base === 'point') { const q = toLatLon(c); coords = q && [q]; }
    else if (base === 'line') coords = toLatLons(c);
    else coords = Array.isArray(c) ? toLatLons(c[0]) : null;
    if (!coords) continue;
    if (base === 'area') coords = openRing(coords);
    // kind з нашого експорту, якщо він сумісний з геометрією; інакше — за типом геометрії.
    const k = p.kind;
    const kind: ShapeKind = base === 'point' && k === 'text' ? 'text' : base === 'line' && k === 'arrow' ? 'arrow' : base;
    const s: Shape = { id: newId(), kind, color, coords, ...(name ? { label: name } : {}) };
    if (isShape(s)) out.push(s);
  }
  return out;
}

/** Імпорт GeoJSON: FeatureCollection, Feature або Geometry. Неправильні фігури пропускаються. */
export function fromGeoJSON(v: unknown): Shape[] {
  const t = v && typeof v === 'object' ? (v as { type?: unknown }).type : undefined;
  if (t === 'FeatureCollection') {
    const fs = (v as { features?: unknown }).features;
    if (!Array.isArray(fs)) throw new Error('Не GeoJSON: немає features');
    return fs.flatMap((f) => (f && typeof f === 'object' ? shapesOf(f.geometry, f.properties) : []));
  }
  if (t === 'Feature') { const f = v as { geometry?: unknown; properties?: unknown }; return shapesOf(f.geometry, f.properties); }
  if (typeof t === 'string' && parts(v).length) return shapesOf(v, null);
  throw new Error('Не GeoJSON: очікується FeatureCollection, Feature або Geometry');
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
/** #rrggbb → aabbggrr (KML). */
const kmlColor = (hex: string, a = 'ff') => a + hex.slice(5, 7) + hex.slice(3, 5) + hex.slice(1, 3);
const kmlCoords = (ps: [number, number][]) => ps.map(([lat, lon]) => `${lon},${lat}`).join(' ');

function placemark(s: Shape): string {
  const c = s.color.toLowerCase(), name = s.label ? `<name>${esc(s.label)}</name>` : '';
  const desc = `<ExtendedData><Data name="kind"><value>${s.kind}</value></Data></ExtendedData>`;
  let style: string, geom: string;
  if (s.kind === 'point' || s.kind === 'text') {
    style = `<Style><IconStyle><color>${kmlColor(c)}</color></IconStyle><LabelStyle><color>${kmlColor(c)}</color></LabelStyle></Style>`;
    geom = `<Point><coordinates>${kmlCoords(s.coords)}</coordinates></Point>`;
  } else if (s.kind === 'area') {
    style = `<Style><LineStyle><color>${kmlColor(c)}</color><width>2</width></LineStyle><PolyStyle><color>${kmlColor(c, '55')}</color></PolyStyle></Style>`;
    geom = `<Polygon><outerBoundaryIs><LinearRing><coordinates>${kmlCoords([...s.coords, s.coords[0]])}</coordinates></LinearRing></outerBoundaryIs></Polygon>`;
  } else {
    style = `<Style><LineStyle><color>${kmlColor(c)}</color><width>3</width></LineStyle></Style>`;
    geom = `<LineString><coordinates>${kmlCoords(s.coords)}</coordinates></LineString>`;
  }
  return `<Placemark>${name}${style}${desc}${geom}</Placemark>`;
}

/** Експорт KML 2.2 (стрілка — лінія з kind=arrow у ExtendedData). */
export function toKML(shapes: Shape[], title = 'AMBER Sky — малюнки'): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${esc(title)}</name>\n`
    + shapes.map(placemark).join('\n') + '\n</Document></kml>\n';
}
