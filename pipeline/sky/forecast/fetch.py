"""Прогноз Open-Meteo (SPEC §6.2, §7.1, §8): 684 вузли сітки → запити пакетами ≤ 120 точок.

F1-AC1: пауза між пакетами; 429 / 5xx / таймаут / порожня відповідь → повтор з наростаючою паузою до 5 разів;
кожна відповідь перевіряється (кількість точок = розмір пакета, `times` = спільні для всіх пакетів).
F1-AC2: пакет, що так і не завантажився, дає `None` для своїх точок і статус `partial` з причиною.
Дані іншого пакета чи попереднього запуску ніколи не підставляються.

F1-AC3 / §6.2: пакування у profile.json — вітер 10/80/120/180 м і рівні 1000…850 гПа (висота над землею =
geopotential_height − elevation, лише вище 200 м), сортування за висотою, лінійна інтерполяція u, v на LEVELS;
вище верхнього рівня — його значення; нижче нижнього наявного — null. Масштаби: м/с, °C, мм/год × 10; rh %;
видимість м / 100. Індекс точки i = r * nc + c.
"""

from __future__ import annotations

import math
import sys
import time
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import datetime

import httpx

from ..contracts import GRID, HOURS, LEVELS, NPTS, point

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


HEIGHT_M = (10, 80, 120, 180)
PRESSURE_HPA = (1000, 975, 950, 925, 900, 850)
MIN_PRESSURE_AGL_M = 200  # рівні тиску беремо лише вище 200 м (§6.2)
SURFACE = {  # ключ profile.json → (змінна Open-Meteo, множник)
    "gust": ("wind_gusts_10m", 10),
    "temp": ("temperature_2m", 10),
    "precip": ("precipitation", 10),
    "rh": ("relative_humidity_2m", 1),
    "vis": ("visibility", 0.01),
}


def iso_utc(t: str) -> str:
    """'2026-11-27T19:00' (Open-Meteo, timezone=GMT) → '2026-11-27T19:00:00Z'."""
    return t.rstrip("Z")[:16] + ":00Z"


def _uv(spd: float, deg: float) -> tuple[float, float]:
    """Напрямок «звідки дме» → вектор «куди дме»."""
    a = math.radians(deg)
    return -spd * math.sin(a), -spd * math.cos(a)


def _column(pt: dict, h: int) -> list[tuple[float, float, float]]:
    """(висота над землею, u, v) для години h, відсортовано за висотою; рівні без даних пропущено."""
    hr, elev = pt["hourly"], pt.get("elevation")
    col = []
    for m in HEIGHT_M:
        s, d = hr.get(f"wind_speed_{m}m", [None] * HOURS)[h], hr.get(f"wind_direction_{m}m", [None] * HOURS)[h]
        if s is not None and d is not None:
            col.append((float(m), *_uv(s, d)))
    if elev is not None:
        for p in PRESSURE_HPA:
            s = hr.get(f"wind_speed_{p}hPa", [None] * HOURS)[h]
            d = hr.get(f"wind_direction_{p}hPa", [None] * HOURS)[h]
            gh = hr.get(f"geopotential_height_{p}hPa", [None] * HOURS)[h]
            if s is not None and d is not None and gh is not None and gh - elev > MIN_PRESSURE_AGL_M:
                col.append((gh - elev, *_uv(s, d)))
    return sorted(col)


def _at(col: list[tuple[float, float, float]], alt: float) -> tuple[float, float] | None:
    if not col or alt < col[0][0]:
        return None  # нижче найнижчого наявного рівня — немає даних
    for (z0, u0, v0), (z1, u1, v1) in zip(col, col[1:], strict=False):
        if z0 <= alt <= z1:
            f = 0.0 if z1 == z0 else (alt - z0) / (z1 - z0)
            return u0 + f * (u1 - u0), v0 + f * (v1 - v0)
    return col[-1][1], col[-1][2]  # вище останнього — значення останнього


def _scale(x: float | None, k: float) -> int | None:
    return None if x is None else round(x * k)


def pack(col: Collected, now: datetime) -> dict:
    nl = len(LEVELS)
    spd = [[[None] * NPTS for _ in range(HOURS)] for _ in range(nl)]
    dirs = [[[None] * NPTS for _ in range(HOURS)] for _ in range(nl)]
    surf = {k: [[None] * NPTS for _ in range(HOURS)] for k in SURFACE}
    for i, pt in enumerate(col.points):
        if pt is None:
            continue  # пакет не завантажився — null, нічого не підставляємо
        for h in range(HOURS):
            c = _column(pt, h)
            for li, alt in enumerate(LEVELS):
                uv = _at(c, alt)
                if uv is not None:
                    spd[li][h][i] = round(math.hypot(*uv) * 10)
                    dirs[li][h][i] = round(math.degrees(math.atan2(-uv[0], -uv[1]))) % 360
            for key, (var, k) in SURFACE.items():
                surf[key][h][i] = _scale(pt["hourly"].get(var, [None] * HOURS)[h], k)
    out = {
        "generatedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sources": ["openmeteo"],
        "levels": list(LEVELS),
        "spd": spd,
        "dir": dirs,
        **surf,
        "_status": col.status,
        "_note": col.note,
    }
    if col.times:  # build переносить у meta.times; без даних — лишає times від now
        out["times"] = [iso_utc(t) for t in col.times]
    return out


KYIV_RC = (4, 17)  # вузол (50.5, 30.5), найближчий до Києва (50.45, 30.52)
KYIV_I = KYIV_RC[0] * GRID["nc"] + KYIV_RC[1]
FIELDS3, FIELDS2 = ("spd", "dir"), tuple(SURFACE)


def non_null_share(p: dict) -> float:
    """Частка не-null значень у всіх полях profile.json (F1-AC4: ≥ 95 % на живому прогоні)."""
    total = good = 0
    for k in FIELDS3:
        for lvl in p[k]:
            for row in lvl:
                total += len(row)
                good += sum(x is not None for x in row)
    for k in FIELDS2:
        for row in p[k]:
            total += len(row)
            good += sum(x is not None for x in row)
    return good / total if total else 0.0


def _x10(x: int | None, unit: str) -> str:
    return "—" if x is None else f"{x / 10:.1f} {unit}"


def control_lines(p: dict) -> list[str]:
    """3 рядки контролю для Києва (F1-AC4): перша, середня й остання година."""
    lat, lon = point(*KYIV_RC)
    times, i, out = p.get("times") or [], KYIV_I, []
    for h in (0, HOURS // 2, HOURS - 1):
        head = f"Київ ({lat}, {lon}) {times[h] if h < len(times) else f'година {h}'}:"
        if all(p[k][h][i] is None for k in FIELDS2) and all(p["spd"][li][h][i] is None for li in range(len(LEVELS))):
            out.append(f"{head} немає даних")
            continue
        wind = ", ".join(
            f"{alt} м {_x10(p['spd'][li][h][i], 'м/с')} з {p['dir'][li][h][i]}°"
            for li, alt in enumerate(LEVELS)
            if alt in (10, 100, 500)
        )
        vis = p["vis"][h][i]
        out.append(
            f"{head} вітер {wind}; пориви {_x10(p['gust'][h][i], 'м/с')}; t {_x10(p['temp'][h][i], '°C')}; "
            f"опади {_x10(p['precip'][h][i], 'мм/год')}; rh {p['rh'][h][i]} %; "
            f"видимість {'—' if vis is None else f'{vis / 10:.1f} км'}"
        )
    return out


def _log(p: dict) -> None:
    print(f"openmeteo: не null {non_null_share(p) * 100:.1f}%, статус {p['_status']} {p['_note']}", file=sys.stderr)
    for line in control_lines(p):
        print(line, file=sys.stderr)


PAGES = "https://xand0dev.github.io/amber404-sky/data/"
FALLBACK_MAX_H = 12  # assumption: старіший прогноз уже не допомагає вирішити «летіти чи ні»


def previous(client: httpx.Client, now: datetime) -> tuple[dict | None, str]:
    """План Б §12 (#93): цілий попередній profile.json з Pages, якщо він справжній і не старший за 12 год.
    Повертає (профіль з times, причина відмови)."""
    try:
        meta = client.get(PAGES + "meta.json", timeout=TIMEOUT_S).raise_for_status().json()
        prof = client.get(PAGES + "profile.json", timeout=TIMEOUT_S).raise_for_status().json()
        src = next(s for s in meta["sources"] if s["id"] == "openmeteo")
        gen = datetime.strptime(prof["generatedAt"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=now.tzinfo)
        times = meta["times"]
    except Exception as e:  # noqa: BLE001 — недоступний чи битий попередній прогноз → без плану Б
        return None, f"попередній прогноз недоступний ({type(e).__name__})"
    if src.get("status") not in ("ok", "partial"):
        return None, "у попередньому прогнозі теж немає даних Open-Meteo"
    if (now - gen).total_seconds() > FALLBACK_MAX_H * 3600:
        return None, f"попередній прогноз старший за {FALLBACK_MAX_H} год"
    if len(times) != HOURS or len(prof.get("spd") or []) != len(LEVELS):
        return None, "попередній прогноз не за контрактом"
    return {**prof, "times": times}, ""


def _fetch(now: datetime, client: httpx.Client, sleep: Sleep) -> dict:
    p = pack(collect(grid_points(), client, sleep), now)
    if p["_status"] != "nodata":
        return p  # ok або partial — свіжі дані, ніколи не змішуємо зі старими
    old, why = previous(client, now)
    if old is None:
        return p | {"_note": f"{why}; {p['_note']}"[:200]}
    note = f"Open-Meteo недоступний; показано прогноз від {old['generatedAt']} ({p['_note'][12:]})"
    return old | {"_status": "partial", "_note": note[:200]}


def fetch(now: datetime, client: httpx.Client | None = None, sleep: Sleep = time.sleep) -> dict:
    """Контракт build.py: profile.json (§6.2) + times, _status, _note; у stderr — частка не-null і контроль Києва.
    Open-Meteo зовсім недоступний → цілий попередній прогноз з Pages з його справжнім часом (план Б, #93)."""
    if client is None:
        with httpx.Client() as c:
            p = _fetch(now, c, sleep)
    else:
        p = _fetch(now, client, sleep)
    _log(p)
    return p
