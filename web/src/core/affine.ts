// Прив'язка власної карти за 3 точками (SPEC §7.14, F5-AC1): афінне перетворення піксель → lat/lon.
// assumption: афінна модель точна лише для невеликої ділянки (десятки км) — кривизну проєкції не враховує.

/** Точка прив'язки: піксель зображення ↔ координати. */
export interface Anchor { x: number; y: number; lat: number; lon: number }

/** [a, b, c, d, e, f]: out1 = a·in1 + b·in2 + c; out2 = d·in1 + e·in2 + f. */
export type Affine = [number, number, number, number, number, number];

export function applyAffine(m: Affine, in1: number, in2: number): [number, number] {
  return [m[0] * in1 + m[1] * in2 + m[2], m[3] * in1 + m[4] * in2 + m[5]];
}

export function invertAffine(m: Affine): Affine | null {
  const [a, b, c, d, e, f] = m, det = a * e - b * d;
  if (!Number.isFinite(det) || Math.abs(det) < 1e-12) return null;
  return [e / det, -b / det, (b * f - c * e) / det, -d / det, a / det, (c * d - a * f) / det];
}

/** Рівно 3 точки → (x, y) ↦ (lat, lon). null, якщо точки на одній прямій чи не числа. */
export function fitAffine(pts: Anchor[]): Affine | null {
  if (pts.length !== 3 || pts.some((p) => ![p.x, p.y, p.lat, p.lon].every(Number.isFinite))) return null;
  const [p, q, r] = pts;
  // Розв'язок у відносних координатах від p — стійкіший для великих пікселів.
  const x1 = q.x - p.x, y1 = q.y - p.y, x2 = r.x - p.x, y2 = r.y - p.y;
  const det = x1 * y2 - x2 * y1;
  const span = Math.max(Math.hypot(x1, y1), Math.hypot(x2, y2));
  if (span === 0 || Math.abs(det) < 1e-9 * span * span) return null;
  const solve = (v1: number, v2: number): [number, number] => [(v1 * y2 - v2 * y1) / det, (x1 * v2 - x2 * v1) / det];
  const [a, b] = solve(q.lat - p.lat, r.lat - p.lat);
  const [d, e] = solve(q.lon - p.lon, r.lon - p.lon);
  return [a, b, p.lat - a * p.x - b * p.y, d, e, p.lon - d * p.x - e * p.y];
}

/** Композиція: спершу inner, потім outer. */
export function composeAffine(outer: Affine, inner: Affine): Affine {
  const [a, b, c, d, e, f] = outer, [p, q, r, s, t, u] = inner;
  return [a * p + b * s, a * q + b * t, a * r + b * u + c, d * p + e * s, d * q + e * t, d * r + e * u + f];
}
