"""Синтетичні дані за контрактами §6 (бейдж MOCK). Детерміновані: однаковий вхід → однаковий файл.

Сцена: вітер посилюється з висотою й повертає праворуч; на сході — смуга сильного вітру (NO-GO);
на півночі — холод і волога (обмерзання, низькі хмари); у центрі — спокійно (GO).
"""

from __future__ import annotations

import math
from datetime import UTC, datetime, timedelta

from .contracts import GRID, HOURS, LEVELS, NPTS, SourceMeta, point

CITIES = [
    ("Київ", 50.45, 30.52),
    ("Львів", 49.84, 24.03),
    ("Харків", 49.99, 36.23),
    ("Одеса", 46.48, 30.72),
    ("Дніпро", 48.46, 35.05),
]


def _times(now: datetime) -> list[str]:
    t0 = now.replace(minute=0, second=0, microsecond=0)
    return [(t0 + timedelta(hours=h)).strftime("%Y-%m-%dT%H:00:00Z") for h in range(HOURS)]


def _surface(lat: float, lon: float, h: int) -> dict:
    north = (lat - 44) / 8.5  # 0 південь … 1 північ
    east = (lon - 22) / 18.5
    day = math.sin((h - 6) / 24 * 2 * math.pi)
    temp = 6 - 10 * north + 4 * day
    rh = 60 + 35 * north - 10 * day
    return {
        "temp": temp,
        "rh": min(100.0, rh),
        "precip": 0.4 if north > 0.75 and 10 < h < 30 else 0.0,
        "vis": 4 if north > 0.85 and h < 12 else 300,
        "gust_base": 3 + 9 * east,
    }


def _wind(lat: float, lon: float, h: int, alt: float) -> tuple[float, float]:
    east = (lon - 22) / 18.5
    front = math.exp(-((lon - (34 + 0.08 * h)) ** 2) / 4)  # смуга, що повзе на схід
    speed10 = 2.5 + 3 * east + 7 * front
    speed = speed10 * (1 + 0.9 * math.log10(alt / 10 + 1))
    direction = (250 + 0.04 * alt + 10 * math.sin(lat)) % 360
    return speed, direction


def build_mock(now: datetime | None = None) -> dict[str, dict]:
    now = now or datetime.now(UTC)
    gen = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    times = _times(now)
    spd = [[[0] * NPTS for _ in range(HOURS)] for _ in LEVELS]
    dirs = [[[0] * NPTS for _ in range(HOURS)] for _ in LEVELS]
    surf = {k: [[0] * NPTS for _ in range(HOURS)] for k in ("gust", "temp", "precip", "rh", "vis")}
    for r in range(GRID["nr"]):
        for c in range(GRID["nc"]):
            i = r * GRID["nc"] + c
            lat, lon = point(r, c)
            for h in range(HOURS):
                s = _surface(lat, lon, h)
                for li, alt in enumerate(LEVELS):
                    w, d = _wind(lat, lon, h, alt)
                    spd[li][h][i] = round(w * 10)
                    dirs[li][h][i] = round(d)
                w10, _ = _wind(lat, lon, h, 10)
                surf["gust"][h][i] = round((w10 * 1.5 + s["gust_base"] * 0.3) * 10)
                surf["temp"][h][i] = round(s["temp"] * 10)
                surf["precip"][h][i] = round(s["precip"] * 10)
                surf["rh"][h][i] = round(s["rh"])
                surf["vis"][h][i] = round(s["vis"])
    srcs = ["openmeteo", "celestrak-galileo", "noaa-kp", "era5"]
    meta = {
        "generatedAt": gen,
        "mock": True,
        "grid": GRID,
        "times": times,
        "sources": [SourceMeta(x, "ok", gen, "MOCK").to_json() for x in srcs],
    }
    profile = {"generatedAt": gen, "sources": ["openmeteo"], "levels": LEVELS, "spd": spd, "dir": dirs, **surf}
    gal_pts = [{"name": n, "lat": la, "lon": lo} for n, la, lo in CITIES]
    galileo = {
        "generatedAt": gen,
        "sources": ["celestrak-galileo"],
        "elevationMaskDeg": 10,
        "points": gal_pts,
        "visible": [[8 + (h + k) % 4 - (3 if 20 <= h <= 22 else 0) for h in range(HOURS)] for k in range(len(gal_pts))],
        "pdop": [
            [round(1.8 + 0.3 * ((h + k) % 3) + (2.6 if 20 <= h <= 22 else 0), 1) for h in range(HOURS)]
            for k in range(len(gal_pts))
        ],
    }
    kp = {
        "generatedAt": gen,
        "sources": ["noaa-kp"],
        "series": [
            {"t": times[0][:11] + f"{(int(times[0][11:13]) // 3) * 3:02d}:00:00Z", "kp": 2.33, "observed": True}
        ],
    }
    t0 = datetime.strptime(kp["series"][0]["t"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)
    kp["series"] += [
        {
            "t": (t0 + timedelta(hours=3 * k)).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "kp": 5.33 if k in (6, 7) else 2.67,
            "observed": False,
        }
        for k in range(1, 18)
    ]
    climate = {
        "generatedAt": gen,
        "sources": ["era5"],
        "year": 2025,
        "cities": {
            n: {
                p: [round(55 + 25 * math.sin((m - 1) / 12 * 2 * math.pi) - 5 * j) for m in range(12)]
                for j, p in enumerate(["fpv7", "fpv10", "heavy", "wing"])
            }
            for n, _, _ in CITIES
        },
    }
    return {"meta": meta, "profile": profile, "galileo": galileo, "kp": kp, "climate": climate}
