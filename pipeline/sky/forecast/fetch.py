"""Прогноз Open-Meteo (SPEC §6.2, §7.1, §8): 684 вузли сітки → запити пакетами ≤ 120 точок.

F1-AC1: пауза між пакетами; 429 / 5xx / таймаут / порожня відповідь → повтор з наростаючою паузою до 5 разів;
кожна відповідь перевіряється (кількість точок = розмір пакета, `times` = спільні для всіх пакетів).
F1-AC2: пакет, що так і не завантажився, дає `None` для своїх точок і статус `partial` з причиною.
Дані іншого пакета чи попереднього запуску ніколи не підставляються.

Пакування у profile.json (u, v → 16 висот) — issue #2; до того `fetch(now)` не готова, і build пише MOCK.
"""

from __future__ import annotations

import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime

import httpx

from ..contracts import GRID, HOURS, point

URL = "https://api.open-meteo.com/v1/forecast"
BATCH = 114  # 684 = 6 × 114, ліміт Open-Meteo — ≤ 120 точок за запит (§8)
PAUSE_S = 1.5  # між пакетами; на 6-му запиті без паузи був 429 (§8)
RETRIES = 5
BACKOFF_S = 2.0  # паузи повторів: 2, 4, 8, 16, 32 с
TIMEOUT_S = 30.0

HOURLY = (
    [f"wind_{k}_{a}m" for a in (10, 80, 120, 180) for k in ("speed", "direction")]
    + [
        f"{k}_{p}hPa"
        for p in (1000, 975, 950, 925, 900, 850)
        for k in ("wind_speed", "wind_direction", "geopotential_height")
    ]
    + ["wind_gusts_10m", "temperature_2m", "precipitation", "relative_humidity_2m", "visibility"]
)

Point = tuple[float, float]
Sleep = Callable[[float], None]


class BatchError(Exception):
    """Пакет не завантажився або відповідь не пройшла перевірку."""


@dataclass
class Collected:
    times: list[str]
    points: list[dict | None]  # відповідь Open-Meteo на точку або None, у порядку i = r * nc + c
    status: str  # ok | partial | nodata
    note: str = ""


def grid_points() -> list[Point]:
    return [point(r, c) for r in range(GRID["nr"]) for c in range(GRID["nc"])]


def batches(points: Sequence[Point], size: int = BATCH) -> list[list[Point]]:
    return [list(points[k : k + size]) for k in range(0, len(points), size)]


def request_params(batch: Sequence[Point]) -> dict:
    return {
        "latitude": ",".join(str(lat) for lat, _ in batch),
        "longitude": ",".join(str(lon) for _, lon in batch),
        "hourly": ",".join(HOURLY),
        "wind_speed_unit": "ms",
        "forecast_hours": HOURS,
        "timezone": "GMT",
    }


def _check(data: object, n: int) -> list[dict]:
    if isinstance(data, dict):  # одна точка — Open-Meteo віддає об'єкт, не список
        data = [data]
    if not isinstance(data, list) or len(data) != n:
        got = len(data) if isinstance(data, list) else type(data).__name__
        raise BatchError(f"точок {got} ≠ {n}")
    for k, pt in enumerate(data):
        times = (pt.get("hourly") or {}).get("time") if isinstance(pt, dict) else None
        if not times or len(times) != HOURS:
            raise BatchError(f"точка {k}: годин {len(times or [])} ≠ {HOURS}")
    return data


def get_batch(client: httpx.Client, batch: Sequence[Point], sleep: Sleep = time.sleep) -> list[dict]:
    """Один пакет з повторами. Після 5 повторів — BatchError з останньою причиною."""
    reason = ""
    for attempt in range(RETRIES + 1):
        if attempt:
            sleep(BACKOFF_S * 2 ** (attempt - 1))
        try:
            r = client.get(URL, params=request_params(batch), timeout=TIMEOUT_S)
        except httpx.HTTPError as e:
            reason = f"{type(e).__name__}"
            continue
        if r.status_code == 429 or r.status_code >= 500:
            reason = f"HTTP {r.status_code}"
            continue
        if r.status_code != 200:
            raise BatchError(f"HTTP {r.status_code}")
        if not r.content.strip():
            reason = "порожня відповідь"
            continue
        try:
            data = r.json()
        except ValueError:
            reason = "не JSON"
            continue
        return _check(data, len(batch))
    raise BatchError(f"{reason} після {RETRIES} повторів")


def collect(
    points: Sequence[Point],
    client: httpx.Client,
    sleep: Sleep = time.sleep,
    size: int = BATCH,
    pause_s: float = PAUSE_S,
) -> Collected:
    out: list[dict | None] = [None] * len(points)
    times: list[str] = []
    errors: list[tuple[int, str]] = []
    parts = batches(points, size)
    for b, batch in enumerate(parts):
        if b:
            sleep(pause_s)
        try:
            data = get_batch(client, batch, sleep)
            t = data[0]["hourly"]["time"]
            if any(pt["hourly"]["time"] != t for pt in data) or (times and t != times):
                raise BatchError("times не збігаються з іншими пакетами")
        except BatchError as e:
            errors.append((b + 1, str(e)))
            continue  # точки пакета лишаються None — нічого не підставляємо
        times = times or t
        out[b * size : b * size + len(batch)] = data
    if not errors:
        return Collected(times, out, "ok")
    note = "Open-Meteo: " + "; ".join(f"пакет {b}/{len(parts)}: {why}" for b, why in errors)
    status = "nodata" if len(errors) == len(parts) else "partial"
    return Collected(times, out, status, note[:200])


def fetch(now: datetime) -> dict:
    """Контракт build.py. Пакування у profile.json (§6.2) — issue #2; до того build ставить nodata і MOCK."""
    raise NotImplementedError("пакування у profile.json — issue #2, поки MOCK")
