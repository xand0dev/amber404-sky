"""Kp (SPEC §6.4, §8 `noaa-kp`): прогноз NOAA SWPC → kp.json, 3-годинні інтервали.
Викликається з sky.build (`fetch(now) -> dict`).

`observed: true` лише для рядків NOAA «observed»; «estimated» і «predicted» → `false` (assumption).
Рядок без kp чи з kp поза 0–9 відкидаємо (статус `partial`), значень не вигадуємо.
"""

from __future__ import annotations

import json
import time
from collections.abc import Callable
from datetime import UTC, datetime

URL = "https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json"
TRIES, PAUSE_S, TIMEOUT_S = 3, 2.0, 15.0


def download() -> str:
    """Таймаут / 429 / порожня відповідь → повтор з паузою; після останньої спроби — виняток."""
    import httpx

    err: Exception = RuntimeError("порожня відповідь")
    for k in range(TRIES):
        try:
            r = httpx.get(URL, timeout=TIMEOUT_S, follow_redirects=True)
            r.raise_for_status()
            if r.text.strip():
                return r.text
            err = RuntimeError("порожня відповідь NOAA")
        except Exception as e:  # noqa: BLE001
            err = e
        if k < TRIES - 1:
            time.sleep(PAUSE_S * (k + 1))
    raise err


def _rows(data: object) -> list[dict]:
    """Нинішній формат — список об'єктів; старий — список списків із рядком-заголовком."""
    if not isinstance(data, list) or not data:
        return []
    if isinstance(data[0], list):
        head = data[0]
        return [dict(zip(head, r, strict=False)) for r in data[1:] if isinstance(r, list)]
    return [r for r in data if isinstance(r, dict)]


def _row(r: dict) -> dict | None:
    try:
        t = datetime.fromisoformat(str(r["time_tag"]).replace(" ", "T").removesuffix("Z")).replace(tzinfo=UTC)
        v = float(r["kp"])
    except (KeyError, TypeError, ValueError):
        return None
    if not 0 <= v <= 9:
        return None
    return {"t": t.strftime("%Y-%m-%dT%H:%M:%SZ"), "kp": round(v, 2), "observed": r.get("observed") == "observed"}


def parse(text: str) -> list[dict]:
    """Відповідь NOAA → series §6.4 (за часом). Неправильні рядки відкидаються."""
    rows = [x for x in (_row(r) for r in _rows(json.loads(text))) if x]
    return sorted(rows, key=lambda x: x["t"])


def fetch(now: datetime, get_json: Callable[[], str] | None = None) -> dict:
    out = {"generatedAt": now.strftime("%Y-%m-%dT%H:%M:%SZ"), "sources": ["noaa-kp"], "series": []}
    try:
        text = (get_json or download)()
        raw = _rows(json.loads(text))
        series = parse(text)
    except Exception as e:  # noqa: BLE001 — джерело недоступне → nodata з причиною, без старих даних
        return out | {"_status": "nodata", "_note": f"NOAA: {type(e).__name__}: {e}"[:200]}
    if not series:
        return out | {"_status": "nodata", "_note": "NOAA: у відповіді нема інтервалів Kp"}
    out["series"] = series
    dropped = len(raw) - len(series)
    if dropped:
        return out | {"_status": "partial", "_note": f"{len(series)} інтервалів, відкинуто {dropped} неправильних"}
    return out | {"_status": "ok", "_note": f"{len(series)} інтервалів по 3 год"}
