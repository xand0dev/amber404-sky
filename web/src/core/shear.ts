// Зсув вітру (SPEC §7.5a): зміна напряму ≥ 45° між сусідніми шарами по 50 м при швидкості > 2 м/с.
export interface Layer { altM: number; speed: number; dir: number }
export function angleDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
export function shears(layers: Layer[]): { altM: number; deg: number }[] {
  const out: { altM: number; deg: number }[] = [];
  for (let i = 1; i < layers.length; i++) {
    const a = layers[i - 1], b = layers[i];
    if (a.speed > 2 && b.speed > 2) {
      const d = angleDiff(a.dir, b.dir);
      if (d >= 45) out.push({ altM: b.altM, deg: Math.round(d) });
    }
  }
  return out;
}
