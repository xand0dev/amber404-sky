"""Рельєф (SPEC §7.6a, §8 `cop-dem`) → web/public/data/static/{relief.json,relief.png}.

Запускається руками, раз (не в deploy і не в `make data`): результат комітиться.
    uv run python -m sky.relief.build

- Висоти: Open-Meteo Elevation API (Copernicus DEM GLO-90), ≤ 100 точок за запит.
- Продовження після обриву — кеш у тимчасовій теці; темп ≤ 5 000 точок/год (годинний ліміт).
- Сітка 0,15° (58 × 124 ≈ 7,2 тис. точок). assumption: issue #98 просила 0,05° (63 тис.), але ліміт
  Open-Meteo рахує кожну точку (перевірено 27.11: 429 після ~600 точок/хв; < 10 тис./добу).
- Висота ≤ 0 м → null (море; assumption: мілкі ділянки нижче рівня моря теж стануть null).
- Відмивка: білінійно на 1480 × 680 (як satellite.jpg), світло з північного заходу (азимут 315°, кут 45°),
  сірий з прозорістю — щоб лягати під погодне поле; море прозоре.
"""

from __future__ import annotations

import json
import math
import struct
import tempfile
import time
import zlib
from pathlib import Path

import httpx
import numpy as np

LAT0, LAT1, LON0, LON1 = 44.0, 52.5, 22.0, 40.5  # рамка карти (як у basemap)
STEP = 0.15
WIDTH, HEIGHT = 1480, 680
BATCH = 100
API = "https://api.open-meteo.com/v1/elevation"
PAUSE_S = 76.0  # 100 точок / 76 с ≈ 4 700 точок/год: ліміт Open-Meteo 5 000/год (перевірено 27.11)
TRIES, BACKOFF_S, TIMEOUT_S = 8, 600.0, 30.0  # годинний ліміт → чекаємо по 10 хв
AZIMUTH, ALTITUDE, Z = 315.0, 45.0, 4.0  # Z — перебільшення рельєфу для дрібного масштабу (assumption)
CACHE = Path(tempfile.gettempdir()) / "amber-relief-raw.json"  # продовження після обриву
OUT = Path(__file__).resolve().parents[3] / "web" / "public" / "data" / "static"


def grid() -> tuple[int, int, list[tuple[float, float]]]:
    nr = round((LAT1 - LAT0) / STEP) + 1
    nc = round((LON1 - LON0) / STEP) + 1
    pts = [(round(LAT0 + r * STEP, 4), round(LON0 + c * STEP, 4)) for r in range(nr) for c in range(nc)]
    return nr, nc, pts


def fetch_batch(client: httpx.Client, pts: list[tuple[float, float]]) -> list[float]:
    params = {
        "latitude": ",".join(f"{p[0]:g}" for p in pts),
        "longitude": ",".join(f"{p[1]:g}" for p in pts),
    }
    for i in range(TRIES):
        try:
            r = client.get(API, params=params, timeout=TIMEOUT_S)
            if r.status_code == 429:
                raise httpx.HTTPStatusError("429", request=r.request, response=r)
            r.raise_for_status()
            el = r.json()["elevation"]
            if len(el) != len(pts):
                raise ValueError(f"очікували {len(pts)} висот, прийшло {len(el)}")
            return el
        except (httpx.HTTPError, ValueError):
            if i == TRIES - 1:
                raise
            time.sleep(BACKOFF_S)
    raise AssertionError("недосяжно")


def to_elev(raw: list[float | None]) -> list[int | None]:
    """Метри цілими; ≤ 0 або None → null (море)."""
    return [None if v is None or v <= 0 else round(v) for v in raw]


def hillshade(elev: list[int | None], nr: int, nc: int, w: int = WIDTH, h: int = HEIGHT) -> np.ndarray:
    """RGBA uint8 (h, w): рядок 0 — північ (LAT1). Море (null) прозоре."""
    g = np.array([np.nan if v is None else float(v) for v in elev]).reshape(nr, nc)  # рядок 0 — південь
    land = ~np.isnan(g)
    gz = np.where(land, g, 0.0)
    # білінійно в пікселі: y=0 → LAT1 (північ)
    ys = (LAT1 - (np.arange(h) + 0.5) * (LAT1 - LAT0) / h - LAT0) / STEP
    xs = ((np.arange(w) + 0.5) * (LON1 - LON0) / w) / STEP
    y0 = np.clip(np.floor(ys).astype(int), 0, nr - 2)
    x0 = np.clip(np.floor(xs).astype(int), 0, nc - 2)
    fy = np.clip(ys - y0, 0, 1)[:, None]
    fx = np.clip(xs - x0, 0, 1)[None, :]

    def bil(a: np.ndarray) -> np.ndarray:
        a00, a01 = a[y0][:, x0], a[y0][:, x0 + 1]
        a10, a11 = a[y0 + 1][:, x0], a[y0 + 1][:, x0 + 1]
        return (a00 * (1 - fx) + a01 * fx) * (1 - fy) + (a10 * (1 - fx) + a11 * fx) * fy

    z = bil(gz)
    m = bil(land.astype(float)) >= 0.5
    lat = LAT1 - (np.arange(h) + 0.5) * (LAT1 - LAT0) / h
    dx = ((LON1 - LON0) / w) * 111_320.0 * np.cos(np.radians(lat))[:, None]
    dy = ((LAT1 - LAT0) / h) * 110_570.0
    dzdx = np.gradient(z, axis=1) / dx  # схід +
    dzdy = -np.gradient(z, axis=0) / dy  # північ + (рядки йдуть на південь)
    shade = hill(dzdx * Z, dzdy * Z)
    rgba = np.zeros((h, w, 4), dtype=np.uint8)
    v = (shade * 255).astype(np.uint8)
    rgba[..., 0] = rgba[..., 1] = rgba[..., 2] = v
    rgba[..., 3] = np.where(m, 255, 0)
    return rgba


def hill(dzdx: np.ndarray, dzdy: np.ndarray) -> np.ndarray:
    """Яскравість 0…1 для схилу (dz/dx на схід, dz/dy на північ), світло з AZIMUTH."""
    az, alt = math.radians(AZIMUTH), math.radians(ALTITUDE)
    lx, ly, lz = math.sin(az) * math.cos(alt), math.cos(az) * math.cos(alt), math.sin(alt)
    nx, ny, nz = -dzdx, -dzdy, np.ones_like(dzdx)
    n = np.sqrt(nx**2 + ny**2 + nz**2)
    return np.clip((nx * lx + ny * ly + nz * lz) / n, 0, 1)


def png(rgba: np.ndarray) -> bytes:
    """Мінімальний PNG RGBA 8 біт (без Pillow)."""
    h, w, _ = rgba.shape
    raw = b"".join(b"\x00" + rgba[y].tobytes() for y in range(h))

    def chunk(t: bytes, d: bytes) -> bytes:
        return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


def build(
    out: Path = OUT, client: httpx.Client | None = None, pause_s: float = PAUSE_S, cache: Path | None = CACHE
) -> dict:
    nr, nc, pts = grid()
    raw: list[float] = []
    if cache and cache.exists():
        c0 = json.loads(cache.read_text())
        if c0.get("step") == STEP and c0.get("n") == len(pts):
            raw = c0["raw"]
    with client or httpx.Client() as c:
        for i in range(len(raw), len(pts), BATCH):
            raw += fetch_batch(c, pts[i : i + BATCH])
            if cache:
                cache.write_text(json.dumps({"step": STEP, "n": len(pts), "raw": raw}))
            if i + BATCH < len(pts):
                time.sleep(pause_s)
    elev = to_elev(raw)
    data = {"source": "cop-dem", "lat0": LAT0, "lon0": LON0, "step": STEP, "nr": nr, "nc": nc, "elev": elev}
    out.mkdir(parents=True, exist_ok=True)
    (out / "relief.json").write_text(json.dumps(data, separators=(",", ":")), encoding="utf-8")
    (out / "relief.png").write_bytes(png(hillshade(elev, nr, nc)))
    return data


def main() -> None:
    d = build()
    land = [v for v in d["elev"] if v is not None]
    print(json.dumps({"nr": d["nr"], "nc": d["nc"], "land": len(land), "max": max(land), "min": min(land)}))


if __name__ == "__main__":
    main()
