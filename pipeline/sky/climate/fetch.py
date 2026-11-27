"""Клімат ERA5 (SPEC §6.5, §7.8, §8 `era5`): % годин місяця, коли профіль пройшов би правила §7.4.
Викликається з sky.build (`fetch(now) -> dict`); окремо: `uv run python -m sky.climate.fetch`.

Джерело — Open-Meteo Archive `models=era5` (план Б з §8): для CDS API потрібна залежність `cdsapi`
і розбір GRIB/NetCDF, яких у pyproject нема (assumption, див. PR).
Правила — лише NO-GO з §7.4 без хмар, видимості, Kp і Galileo: вітер, пориви, температура, опади,
обмерзання. «Пройшла» = не NO-GO (CAUTION теж льотна година, assumption).
Вітер: ERA5 має 10 і 100 м — беремо рівень, найближчий до `defaultAltM` профілю (assumption).
Година з пропуском значення — NO-DATA, у знаменник не йде. Місто, де хоч один місяць без даних,
не пишемо (статус `partial`), значень не вигадуємо.
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path

YEAR = 2025
CITIES = ["Київ", "Львів", "Харків", "Одеса", "Дніпро"]
# ключ у climate.json → id у profiles.json; «wing» = крило електро (assumption: найсуворіше з крил)
PROFILES = {"fpv7": "fpv7", "fpv10": "fpv10", "heavy": "heavy", "wing": "wingE"}
LEVELS = {"ws10": 10, "ws100": 100}
VARS = {
    "ws10": "wind_speed_10m",
    "ws100": "wind_speed_100m",
    "g": "wind_gusts_10m",
    "t": "temperature_2m",
    "p": "precipitation",
    "rh": "relative_humidity_2m",
}
URL = "https://archive-api.open-meteo.com/v1/archive"
TRIES, PAUSE_S, TIMEOUT_S = 3, 5.0, 60.0
STATIC = Path(__file__).resolve().parents[3] / "web" / "public" / "data" / "static"

Hour = tuple[str, dict]  # ("YYYY-MM", {ws10, ws100, g, t, p, rh})


def load_profiles(static: Path = STATIC) -> dict[str, dict]:
    by_id = {p["id"]: p for p in json.loads((static / "profiles.json").read_text("utf-8"))}
    return {k: by_id[v] for k, v in PROFILES.items()}


def load_cities(static: Path = STATIC) -> list[dict]:
    by_name = {c["name"]: c for c in json.loads((static / "cities.json").read_text("utf-8"))}
    return [by_name[n] for n in CITIES]


def wind_level(p: dict) -> str:
    return min(LEVELS, key=lambda k: abs(LEVELS[k] - p["defaultAltM"]))


def icing(t: float, rh: float, p: float) -> bool:
    """§7.4: −10 ≤ t ≤ 2 і (rh ≥ 90 або p > 0.05)."""
    return -10 <= t <= 2 and (rh >= 90 or p > 0.05)


def flyable(h: dict, p: dict) -> bool | None:
    """True — жодного NO-GO з §7.4 (вітер, пориви, t, опади, обмерзання); None — бракує значення."""
    ws = h.get(wind_level(p))
    vals = [ws, h.get("g"), h.get("t"), h.get("p"), h.get("rh")]
    if any(v is None for v in vals):
        return None
    _, g, t, pr, rh = vals
    nogo = ws > p["windMs"] or g > p["gustMs"] or t < p["tMinC"] or pr > max(p["precipMmH"], 0.05) or icing(t, rh, pr)
    return not nogo


def parse(text: str) -> list[Hour]:
    """Відповідь Open-Meteo Archive → погодинні значення. Різна довжина рядів → ValueError."""
    hourly = json.loads(text)["hourly"]
    times = hourly["time"]
    cols = {k: hourly[v] for k, v in VARS.items()}
    if not times or any(len(c) != len(times) for c in cols.values()):
        raise ValueError("ERA5: ряди різної довжини або порожні")
    return [(t[:7], {k: c[i] for k, c in cols.items()}) for i, t in enumerate(times)]


def monthly(hours: list[Hour], profiles: dict[str, dict], year: int = YEAR) -> dict[str, list[float | None]]:
    """% льотних годин по місяцях року; місяць без жодної години з даними → None."""
    out: dict[str, list[float | None]] = {}
    for key, p in profiles.items():
        ok, total = [0] * 12, [0] * 12
        for ym, h in hours:
            if not ym.startswith(f"{year}-"):
                continue
            f = flyable(h, p)
            if f is None:
                continue
            m = int(ym[5:7]) - 1
            total[m] += 1
            ok[m] += f
        out[key] = [round(100 * o / n, 1) if n else None for o, n in zip(ok, total, strict=True)]
    return out


def download(lat: float, lon: float, year: int = YEAR) -> str:
    """Таймаут / 429 / порожня відповідь → повтор з паузою; після останньої спроби — виняток."""
    import httpx

    params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": f"{year}-01-01",
        "end_date": f"{year}-12-31",
        "hourly": ",".join(VARS.values()),
        "models": "era5",
        "wind_speed_unit": "ms",
        "timezone": "GMT",
    }
    err: Exception = RuntimeError("порожня відповідь")
    for k in range(TRIES):
        try:
            r = httpx.get(URL, params=params, timeout=TIMEOUT_S)
            r.raise_for_status()
            if r.text.strip():
                return r.text
            err = RuntimeError("порожня відповідь Open-Meteo Archive")
        except Exception as e:  # noqa: BLE001
            err = e
        if k < TRIES - 1:
            time.sleep(PAUSE_S * (k + 1))
    raise err


def fetch(now: datetime, get_json: Callable[[float, float], str] | None = None) -> dict:
    out: dict = {"generatedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "sources": ["era5"], "year": YEAR, "cities": {}}
    profiles = load_profiles()
    failed: list[str] = []
    for c in load_cities():
        try:
            res = monthly(parse((get_json or download)(c["lat"], c["lon"])), profiles)
        except Exception as e:  # noqa: BLE001 — місто без даних → пропуск з причиною, без чужих даних
            failed.append(f"{c['name']}: {type(e).__name__}: {e}"[:80])
            continue
        empty = sorted({m + 1 for v in res.values() for m, x in enumerate(v) if x is None})
        if empty:
            failed.append(f"{c['name']}: нема даних за місяці {empty}")
            continue
        out["cities"][c["name"]] = res
    src = "Open-Meteo Archive models=era5"
    if not out["cities"]:
        return out | {"_status": "nodata", "_note": f"{src}: " + "; ".join(failed)[:180]}
    if failed:
        return out | {"_status": "partial", "_note": f"{src}: " + "; ".join(failed)[:180]}
    return out | {"_status": "ok", "_note": f"{src}, {YEAR}, {len(out['cities'])} міст × 4 профілі"}


def main() -> None:
    out = fetch(datetime.now(UTC))
    print(out["_status"], out["_note"])
    for name, res in out["cities"].items():
        print(name, json.dumps(res, ensure_ascii=False))


if __name__ == "__main__":
    main()
