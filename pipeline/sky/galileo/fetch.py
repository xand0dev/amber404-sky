"""Galileo (SPEC §6.3, §7.7): TLE з Celestrak → для 16 обласних центрів по годинах кількість супутників
вище 10° і PDOP лише по Galileo. Викликається з sky.build (`fetch(now) -> dict`).

`assumption`: супутники зі статусом «not usable» у сповіщеннях GSC не виключаються — рахуємо всі з групи.
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import datetime, timedelta
from pathlib import Path

from ..contracts import HOURS
from .geometry import elevation_deg, enu_unit, pdop, site_ecef_km
from .orbit import Sat, ecef_km, parse_tle

URL = "https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle"
CITIES = Path(__file__).resolve().parents[3] / "web" / "public" / "data" / "static" / "cities.json"
MASK_DEG = 10
TRIES, PAUSE_S, TIMEOUT_S = 3, 2.0, 15.0


def download_tle() -> str:
    """Таймаут / 429 / порожня відповідь → повтор з паузою; після останньої спроби — виняток."""
    import httpx

    err: Exception = RuntimeError("порожня відповідь")
    for k in range(TRIES):
        try:
            r = httpx.get(URL, timeout=TIMEOUT_S, follow_redirects=True)
            r.raise_for_status()
            if r.text.strip():
                return r.text
            err = RuntimeError("порожня відповідь Celestrak")
        except Exception as e:  # noqa: BLE001
            err = e
        if k < TRIES - 1:
            time.sleep(PAUSE_S * (k + 1))
    raise err


def compute(sats: list[Sat], points: list[dict], times: list[datetime]) -> tuple[list[list], list[list]]:
    """visible[p][h] — супутників вище маски; pdop[p][h] — PDOP (None, якщо видно < 4)."""
    sat_pos = [[ecef_km(s, t) for s in sats] for t in times]
    visible, pdops = [], []
    for pt in points:
        site = site_ecef_km(pt["lat"], pt["lon"])
        vrow, prow = [], []
        for pos in sat_pos:
            units = [u for u in (enu_unit(pt["lat"], pt["lon"], site, p) for p in pos) if elevation_deg(u) > MASK_DEG]
            vrow.append(len(units))
            d = pdop(units)
            prow.append(None if d is None else round(d, 2))
        visible.append(vrow)
        pdops.append(prow)
    return visible, pdops


def fetch(now: datetime, get_tle: Callable[[], str] = download_tle) -> dict:
    gen = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    t0 = now.replace(minute=0, second=0, microsecond=0)
    times = [t0 + timedelta(hours=h) for h in range(HOURS)]
    points = [{"name": c["name"], "lat": c["lat"], "lon": c["lon"]} for c in json.loads(CITIES.read_text("utf-8"))]
    out = {
        "generatedAt": gen,
        "sources": ["celestrak-galileo"],
        "elevationMaskDeg": MASK_DEG,
        "points": points,
        "visible": [[None] * HOURS for _ in points],
        "pdop": [[None] * HOURS for _ in points],
    }
    try:
        sats = parse_tle(get_tle())
    except Exception as e:  # noqa: BLE001 — джерело недоступне → nodata з причиною, без старих даних
        return out | {"_status": "nodata", "_note": f"Celestrak: {type(e).__name__}: {e}"[:200]}
    if not sats:
        return out | {"_status": "nodata", "_note": "Celestrak: у відповіді нема TLE"}
    out["visible"], out["pdop"] = compute(sats, points, times)
    return out | {"_status": "ok", "_note": f"{len(sats)} супутників, без фільтра «not usable» (assumption)"}
