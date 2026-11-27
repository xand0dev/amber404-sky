import { describe, expect, it } from 'vitest';
import { fromGeoJSON, isShape, toGeoJSON, toKML, type Shape } from './geojson';

const S: Shape[] = [
  { id: 'a', kind: 'point', color: '#e2a72e', coords: [[50.45, 30.52]], label: 'Старт' },
  { id: 'b', kind: 'line', color: '#e0532f', coords: [[50, 30], [50.1, 30.2]] },
  { id: 'c', kind: 'arrow', color: '#8cbf4f', coords: [[49, 31], [49.2, 31.5], [49.3, 32]] },
  { id: 'd', kind: 'area', color: '#ffffff', coords: [[48, 30], [48, 31], [48.5, 30.5]] },
  { id: 'e', kind: 'text', color: '#e6e2cc', coords: [[47, 33]], label: 'Поле <№2> & "сад"' },
];

describe('Given малюнки (SPEC §7.13); When експорт GeoJSON', () => {
  const fc = toGeoJSON(S);
  it('Then FeatureCollection за RFC 7946: [lon, lat], полігон замкнений', () => {
    expect(fc.type).toBe('FeatureCollection');
    expect(fc.features.map((f) => f.geometry.type)).toEqual(['Point', 'LineString', 'LineString', 'Polygon', 'Point']);
    expect(fc.features[0].geometry.coordinates).toEqual([30.52, 50.45]);
    const ring = fc.features[3].geometry.coordinates as number[][][];
    expect(ring[0][0]).toEqual([30, 48]);
    expect(ring[0].at(-1)).toEqual(ring[0][0]);
    expect(ring[0]).toHaveLength(4);
  });
  it('Then властивості kind, color, name — інші програми бачать підпис', () => {
    expect(fc.features[0].properties).toEqual({ kind: 'point', color: '#e2a72e', name: 'Старт' });
    expect(fc.features[2].properties.kind).toBe('arrow');
  });
  it('Then JSON → імпорт повертає ті самі фігури', () => {
    const back = fromGeoJSON(JSON.parse(JSON.stringify(fc)));
    const noId = (s: Shape) => ({ kind: s.kind, color: s.color, coords: s.coords, label: s.label });
    expect(back.map(noId)).toEqual(S.map(noId));
    expect(new Set(back.map((s) => s.id)).size).toBe(S.length);
  });
});

describe('Given GeoJSON з іншої програми; When імпорт', () => {
  it('Then без kind: Point → точка, LineString → лінія, Polygon → область; Multi* розгортається', () => {
    const r = fromGeoJSON({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { name: 'A' }, geometry: { type: 'Point', coordinates: [30, 50, 120] } },
        { type: 'Feature', properties: null, geometry: { type: 'LineString', coordinates: [[30, 50], [31, 51]] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[30, 50], [31, 50], [31, 51], [30, 50]]] } },
        { type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: [[30, 50], [32, 52]] } },
      ],
    });
    expect(r.map((s) => s.kind)).toEqual(['point', 'line', 'area', 'point', 'point']);
    expect(r[0]).toMatchObject({ coords: [[50, 30]], label: 'A' });
    expect(r[2].coords).toEqual([[50, 30], [50, 31], [51, 31]]);
    expect(r.every((s) => /^#[0-9a-f]{6}$/i.test(s.color))).toBe(true);
  });
  it('Then окремий Feature або Geometry теж приймається', () => {
    expect(fromGeoJSON({ type: 'Point', coordinates: [30, 50] })).toHaveLength(1);
    expect(fromGeoJSON({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [30, 50] } })).toHaveLength(1);
  });
  it('Then хибні координати, невідомий колір і сміття відкидаються, без винятку на фігуру', () => {
    const r = fromGeoJSON({
      type: 'FeatureCollection',
      features: [
        { type: 'Feature', properties: { color: 'red;x' }, geometry: { type: 'Point', coordinates: [30, 50] } },
        { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [30, 95] } },
        { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [[30, 50]] } },
        { type: 'Feature', properties: {}, geometry: null },
        { type: 'Feature', properties: { kind: 'target' }, geometry: { type: 'Point', coordinates: ['a', 50] } },
      ],
    });
    expect(r).toHaveLength(1);
    expect(r[0].color).not.toBe('red;x');
  });
  it('Then не GeoJSON → виняток з поясненням', () => {
    expect(() => fromGeoJSON({ foo: 1 })).toThrow(/GeoJSON/);
    expect(() => fromGeoJSON(null)).toThrow(/GeoJSON/);
  });
});

describe('Given малюнки; When експорт KML', () => {
  const k = toKML(S);
  it('Then KML 2.2: Placemark на кожну фігуру, координати lon,lat, полігон замкнений', () => {
    expect(k).toMatch(/^<\?xml version="1.0" encoding="UTF-8"\?>/);
    expect(k).toContain('xmlns="http://www.opengis.net/kml/2.2"');
    expect(k.match(/<Placemark>/g)).toHaveLength(S.length);
    expect(k).toContain('<Point><coordinates>30.52,50.45</coordinates></Point>');
    expect(k).toContain('<coordinates>30,48 31,48 30.5,48.5 30,48</coordinates>');
  });
  it('Then колір у форматі KML aabbggrr, підпис екранований', () => {
    expect(k).toContain('<color>ff2ea7e2</color>');
    expect(k).toContain('Поле &lt;№2&gt; &amp; &quot;сад&quot;');
    expect(k).not.toContain('<№2>');
  });
});

describe('isShape — перевірка того, що лежить у localStorage', () => {
  it('Then приймає правильні й відкидає зіпсовані', () => {
    expect(S.every(isShape)).toBe(true);
    expect(isShape({ ...S[1], coords: [[50, 30]] })).toBe(false);
    expect(isShape({ ...S[3], coords: [[50, 30], [51, 31]] })).toBe(false);
    expect(isShape({ ...S[0], kind: 'target' })).toBe(false);
    expect(isShape({ ...S[0], color: 'url(x)' })).toBe(false);
    expect(isShape(null)).toBe(false);
  });
});
