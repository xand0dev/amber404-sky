"""Підкладки (SPEC §7.6a, §8 `s2cloudless`, `ne-water`) → web/public/data/static/{satellite.jpg,water.json}.

Запускається руками, раз (не в deploy і не в `make data`): результат комітиться.
    uv run python -m sky.basemap.build

- Супутник: ОДИН запит WMS GetMap до EOX на всю рамку карти — жодних тайлів, браузер нікуди не ходить.
  JPEG кодує сервер EOX (assumption: якість задати не можна, перевіряємо лише розмір ≤ 400 КБ).
- Вода: Natural Earth 1:10m ріки (центральні лінії) й озера → обрізати по рамці → Дуглас-Пекер ≤ 0,01°.
  Кордонів тут немає, тож Крим не чіпаємо (кордони — F0, версія Ukraine POV).
"""

from __future__ import annotations

import io
import json
import tempfile
import time
import zipfile
from pathlib import Path
from urllib.parse import urlencode

import httpx
import shapefile

BBOX = (22.0, 44.0, 40.5, 52.5)  # lon_min, lat_min, lon_max, lat_max — рамка карти (SPEC §8 `s2cloudless`)
WIDTH, HEIGHT = 1480, 680  # 18,5° × 8,5° → ~0,0125°/px, пропорція рамки
TOL = 0.01  # градуси, допуск спрощення (issue #99)
WMS = "https://tiles.maps.eox.at/wms"
LAYER = "s2cloudless-2020"
NE = "https://naciscdn.org/naturalearth/10m/physical/"
RIVERS, LAKES = "ne_10m_rivers_lake_centerlines", "ne_10m_lakes"
TRIES, PAUSE_S, TIMEOUT_S = 3, 2.0, 60.0
OUT = Path(__file__).resolve().parents[3] / "web" / "public" / "data" / "static"

Pt = tuple[float, float]


# --- супутник ---


def wms_url() -> str:
    q = {
        "service": "WMS",
        "request": "GetMap",
        "version": "1.1.1",
        "layers": LAYER,
        "styles": "",
        "srs": "EPSG:4326",
        "bbox": ",".join(f"{v:g}" for v in BBOX),
        "width": WIDTH,
        "height": HEIGHT,
        "format": "image/jpeg",
    }
    return f"{WMS}?{urlencode(q)}"


def jpeg_size(data: bytes) -> tuple[int, int]:
    """(ширина, висота) з маркера SOF; не JPEG → ValueError."""
    if data[:2] != b"\xff\xd8":
        raise ValueError("не JPEG")
    i = 2
    while i + 4 <= len(data):
        if data[i] != 0xFF:
            raise ValueError("зламаний JPEG")
        marker = data[i + 1]
        seg = int.from_bytes(data[i + 2 : i + 4], "big")
        if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
            h = int.from_bytes(data[i + 5 : i + 7], "big")
            w = int.from_bytes(data[i + 7 : i + 9], "big")
            return w, h
        i += 2 + seg
    raise ValueError("немає SOF у JPEG")


def _get(client: httpx.Client, url: str, pause_s: float) -> bytes:
    """Таймаут / 429 / порожня відповідь → повтор з паузою; після останньої спроби — виняток."""
    err: Exception = RuntimeError("порожня відповідь")
    for k in range(TRIES):
        try:
            r = client.get(url, timeout=TIMEOUT_S, follow_redirects=True)
            r.raise_for_status()
            if r.content:
                return r.content
            err = RuntimeError(f"порожня відповідь {url}")
        except Exception as e:  # noqa: BLE001
            err = e
        if k < TRIES - 1:
            time.sleep(pause_s * (k + 1))
    raise err


def fetch_satellite(client: httpx.Client, pause_s: float = PAUSE_S) -> bytes:
    data = _get(client, wms_url(), pause_s)
    try:
        jpeg_size(data)
    except ValueError as e:
        # WMS повертає помилки як XML з кодом 200.
        raise RuntimeError(f"EOX WMS віддав не JPEG: {data[:200]!r}") from e
    return data


# --- вода: обрізання по рамці ---


def _inside(p: Pt) -> bool:
    return BBOX[0] <= p[0] <= BBOX[2] and BBOX[1] <= p[1] <= BBOX[3]


def _clip_segment(a: Pt, b: Pt) -> tuple[Pt, Pt] | None:
    """Liang-Barsky: частина відрізка a→b у рамці або None."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    t0, t1 = 0.0, 1.0
    for p, q in ((-dx, a[0] - BBOX[0]), (dx, BBOX[2] - a[0]), (-dy, a[1] - BBOX[1]), (dy, BBOX[3] - a[1])):
        if p == 0:
            if q < 0:
                return None
            continue
        t = q / p
        if p < 0:
            t0 = max(t0, t)
        else:
            t1 = min(t1, t)
        if t0 > t1:
            return None

    def at(t: float) -> Pt:
        if t == 0.0:
            return a
        if t == 1.0:
            return b
        return (a[0] + t * dx, a[1] + t * dy)

    return at(t0), at(t1)


def clip_line(pts: list[Pt]) -> list[list[Pt]]:
    """Лінія → шматки всередині рамки (лінія може виходити й повертатись)."""
    pieces: list[list[Pt]] = []
    cur: list[Pt] = []
    for a, b in zip(pts[:-1], pts[1:], strict=False):
        seg = _clip_segment(a, b)
        if seg is None:
            if cur:
                pieces.append(cur)
                cur = []
            continue
        s, e = seg
        if cur and cur[-1] != s:
            pieces.append(cur)
            cur = []
        if not cur:
            cur = [s]
        cur.append(e)
        if e != b:  # вийшли з рамки
            pieces.append(cur)
            cur = []
    if cur:
        pieces.append(cur)
    return [p for p in pieces if len(p) >= 2]


def clip_ring(ring: list[Pt]) -> list[Pt]:
    """Sutherland-Hodgman: замкнене кільце → замкнене кільце в рамці або [] (якщо нічого не лишилось)."""
    x0, y0, x1, y1 = BBOX
    edges = (
        (lambda p: p[0] >= x0, lambda a, b: (x0, a[1] + (b[1] - a[1]) * (x0 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[0] <= x1, lambda a, b: (x1, a[1] + (b[1] - a[1]) * (x1 - a[0]) / (b[0] - a[0]))),
        (lambda p: p[1] >= y0, lambda a, b: (a[0] + (b[0] - a[0]) * (y0 - a[1]) / (b[1] - a[1]), y0)),
        (lambda p: p[1] <= y1, lambda a, b: (a[0] + (b[0] - a[0]) * (y1 - a[1]) / (b[1] - a[1]), y1)),
    )
    pts = ring[:-1] if ring and ring[0] == ring[-1] else list(ring)
    for keep, cross in edges:
        if not pts:
            break
        out: list[Pt] = []
        for i, b in enumerate(pts):
            a = pts[i - 1]
            if keep(b):
                if not keep(a):
                    out.append(cross(a, b))
                out.append(b)
            elif keep(a):
                out.append(cross(a, b))
        pts = out
    if len(pts) < 3:
        return []
    return pts + [pts[0]]


# --- вода: спрощення ---


def simplify(pts: list[Pt], tol: float = TOL) -> list[Pt]:
    """Дуглас-Пекер (ітеративно — довгі ріки не впираються в глибину рекурсії). Кінці лишаються."""
    n = len(pts)
    if n < 3:
        return list(pts)
    keep = [False] * n
    keep[0] = keep[-1] = True
    stack = [(0, n - 1)]
    while stack:
        i0, i1 = stack.pop()
        (xa, ya), (xb, yb) = pts[i0], pts[i1]
        dx, dy = xb - xa, yb - ya
        norm = (dx * dx + dy * dy) ** 0.5
        imax, dmax = 0, -1.0
        for i in range(i0 + 1, i1):
            x, y = pts[i]
            d = abs(dy * x - dx * y + xb * ya - yb * xa) / norm if norm else ((x - xa) ** 2 + (y - ya) ** 2) ** 0.5
            if d > dmax:
                imax, dmax = i, d
        if dmax > tol:
            keep[imax] = True
            stack += [(i0, imax), (imax, i1)]
    return [p for p, k in zip(pts, keep, strict=True) if k]


def _simplify_ring(ring: list[Pt], tol: float = TOL) -> list[Pt]:
    # Замкнене кільце: перша точка = остання, тож ділимо його в найдальшій від початку точці.
    x0, y0 = ring[0]
    k = max(range(len(ring)), key=lambda i: (ring[i][0] - x0) ** 2 + (ring[i][1] - y0) ** 2)
    return simplify(ring[: k + 1], tol)[:-1] + simplify(ring[k:], tol)


def _round(pts: list[Pt]) -> list[list[float]]:
    out: list[list[float]] = []
    for x, y in pts:
        p = [round(x, 3), round(y, 3)]
        if not out or out[-1] != p:
            out.append(p)
    return out


# --- вода: shapefile → GeoJSON ---


def _hits(bbox: list[float]) -> bool:
    return not (bbox[2] < BBOX[0] or bbox[0] > BBOX[2] or bbox[3] < BBOX[1] or bbox[1] > BBOX[3])


def _parts(shape: shapefile.Shape) -> list[list[Pt]]:
    idx = list(shape.parts) + [len(shape.points)]
    return [[(float(x), float(y)) for x, y in shape.points[a:b]] for a, b in zip(idx[:-1], idx[1:], strict=False)]


def _features(shp: Path, kind: str) -> list[dict]:
    r = shapefile.Reader(str(shp), encoding="utf-8")
    fields = [f[0] for f in r.fields[1:]]
    out = []
    for sr in r.iterShapeRecords():
        if not sr.shape.points or not _hits(sr.shape.bbox):
            continue
        rec = dict(zip(fields, sr.record, strict=False))
        name = (rec.get("name_uk") or rec.get("name") or "").strip()
        if kind == "river":
            lines = [_round(simplify(piece)) for part in _parts(sr.shape) for piece in clip_line(part)]
            lines = [ln for ln in lines if len(ln) >= 2]
            if not lines:
                continue
            geom = {"type": "MultiLineString", "coordinates": lines}
        else:
            rings = []
            for part in _parts(sr.shape):
                c = clip_ring(part)
                if c:
                    s = _round(_simplify_ring(c))
                    if len(s) >= 4:
                        rings.append(s)
            if not rings:
                continue
            # Кільця NE не розбираємо на зовнішні й дірки (assumption): кожне — окремий полігон для обведення.
            geom = {"type": "MultiPolygon", "coordinates": [[ring] for ring in rings]}
        out.append({"type": "Feature", "properties": {"kind": kind, "name": name}, "geometry": geom})
    return out


def build_water(rivers_shp: Path, lakes_shp: Path) -> dict:
    return {
        "type": "FeatureCollection",
        "source": "ne-water",
        "features": _features(lakes_shp, "lake") + _features(rivers_shp, "river"),
    }


def _ne(client: httpx.Client, name: str, tmp: Path) -> Path:
    zipfile.ZipFile(io.BytesIO(_get(client, f"{NE}{name}.zip", PAUSE_S))).extractall(tmp)
    return tmp / f"{name}.shp"


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    with httpx.Client(headers={"User-Agent": "amber404-sky basemap"}) as client:
        sat = OUT / "satellite.jpg"
        sat.write_bytes(fetch_satellite(client))
        w, h = jpeg_size(sat.read_bytes())
        print(f"{sat}: {w}×{h}, {sat.stat().st_size // 1024} KB")
        with tempfile.TemporaryDirectory() as d:
            tmp = Path(d)
            data = build_water(_ne(client, RIVERS, tmp), _ne(client, LAKES, tmp))
    water = OUT / "water.json"
    water.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"{water}: {water.stat().st_size // 1024} KB, {len(data['features'])} об'єктів")


if __name__ == "__main__":
    main()
