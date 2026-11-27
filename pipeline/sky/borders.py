"""Кордони для карти (SPEC §6.6): Natural Earth 1:10m, версія Ukraine POV (Крим — Україна).

Використання: uv run python -m sky.borders <шлях до ne_10m_admin_0_countries_ukr.shp> <вихідний json>
Береться все, що перетинає рамку карти; лінії спрощуються Дуглас-Пекером до ≈ 100 КБ.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import shapefile

BBOX = (19.0, 42.5, 43.0, 54.0)  # lon_min, lat_min, lon_max, lat_max — з запасом навколо сітки
TOL = 0.025  # градуси, допуск спрощення


def _dp(pts: list[tuple[float, float]], tol: float) -> list[tuple[float, float]]:
    if len(pts) < 3:
        return pts
    (x1, y1), (x2, y2) = pts[0], pts[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = (dx * dx + dy * dy) ** 0.5 or 1e-12
    imax, dmax = 0, -1.0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm
        if d > dmax:
            imax, dmax = i, d
    if dmax <= tol:
        return [pts[0], pts[-1]]
    return _dp(pts[: imax + 1], tol)[:-1] + _dp(pts[imax:], tol)


def simplify(ring: list[tuple[float, float]], tol: float = TOL) -> list[list[float]]:
    # Замкнене кільце: перша точка = остання, тож ділимо його в найдальшій від початку точці.
    x0, y0 = ring[0]
    k = max(range(len(ring)), key=lambda i: (ring[i][0] - x0) ** 2 + (ring[i][1] - y0) ** 2)
    out = _dp(ring[: k + 1], tol)[:-1] + _dp(ring[k:], tol)
    return [[round(x, 3), round(y, 3)] for x, y in out]


def _hits(bbox: tuple[float, float, float, float]) -> bool:
    return not (bbox[2] < BBOX[0] or bbox[0] > BBOX[2] or bbox[3] < BBOX[1] or bbox[1] > BBOX[3])


def build(shp: Path) -> dict:
    r = shapefile.Reader(str(shp), encoding="utf-8")
    fields = [f[0] for f in r.fields[1:]]
    features = []
    for sr in r.iterShapeRecords():
        if not _hits(sr.shape.bbox):
            continue
        rec = dict(zip(fields, sr.record, strict=False))
        parts = list(sr.shape.parts) + [len(sr.shape.points)]
        rings = []
        for a, b in zip(parts[:-1], parts[1:], strict=False):
            ring = [(float(x), float(y)) for x, y in sr.shape.points[a:b]]
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            if not _hits((min(xs), min(ys), max(xs), max(ys))):
                continue
            s = simplify(ring)
            if len(s) >= 4:
                rings.append(s)
        if rings:
            features.append({"iso": rec.get("ADM0_A3", ""), "name": rec.get("NAME", ""), "rings": rings})
    return {"source": "ne-ukr", "pov": "UKR", "features": features}


def main() -> None:
    shp, out = Path(sys.argv[1]), Path(sys.argv[2])
    data = build(shp)
    out.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{out}: {out.stat().st_size // 1024} KB, {len(data['features'])} країн")


if __name__ == "__main__":
    main()
