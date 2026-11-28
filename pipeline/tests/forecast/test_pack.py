"""F1-AC3 (+ §6.2): пакування відповіді Open-Meteo у profile.json — індекс r * nc + c, масштаби, null збережено;
інтерполяція u, v (не швидкості й кута) на 16 висот; рівні тиску лише вище 200 м над землею.
F1-AC2 на рівні profile.json: точки пакета, що не завантажився, — null.
"""

from __future__ import annotations

import copy
import json
import math
from datetime import UTC, datetime
from pathlib import Path

import httpx
import jsonschema
import pytest

from sky.contracts import GRID, HOURS, LEVELS, NPTS
from sky.forecast import fetch as f

HERE = Path(__file__).parent
FIX = json.loads((HERE / "openmeteo_2x3.json").read_text("utf-8"))
RAW = [pt for b in FIX for pt in b["response"]]  # 6 справжніх точок
SCHEMA = json.loads((HERE.parents[2] / "contracts" / "profile.schema.json").read_text("utf-8"))
NOW = datetime(2026, 11, 27, 19, 21, tzinfo=UTC)
TIMES = RAW[0]["hourly"]["time"]


def _collected(points: dict[int, dict], status: str = "ok", note: str = "") -> f.Collected:
    out: list[dict | None] = [None] * NPTS
    for i, pt in points.items():
        out[i] = pt
    return f.Collected(list(TIMES), out, status, note)


def _synthetic(elev: float, levels: dict[str, tuple[float | None, float | None, float | None]]) -> dict:
    """Точка з однаковими 48 годинами. levels: ключ '10m' або '850hPa' → (швидкість, напрямок, геопотенціал)."""
    hourly: dict[str, list] = {"time": list(TIMES)}
    for v in f.HOURLY:
        hourly[v] = [None] * HOURS
    for k, (s, d, gh) in levels.items():
        hourly[f"wind_speed_{k}"] = [s] * HOURS
        hourly[f"wind_direction_{k}"] = [d] * HOURS
        if k.endswith("hPa"):
            hourly[f"geopotential_height_{k}"] = [gh] * HOURS
    return {"latitude": 50, "longitude": 30, "elevation": elev, "hourly": hourly}


def _lv(alt: int) -> int:
    return LEVELS.index(alt)


# ---------- F1-AC3: індекс r * nc + c, масштаби, null ----------


def test_point_goes_to_index_r_times_nc_plus_c_with_scales():
    r, c = 5, 7
    i = r * GRID["nc"] + c
    raw = RAW[0]["hourly"]
    p = f.pack(_collected({i: RAW[0]}), NOW)

    for h in (0, 17, 47):
        assert p["gust"][h][i] == round(raw["wind_gusts_10m"][h] * 10)
        assert p["temp"][h][i] == round(raw["temperature_2m"][h] * 10)
        assert p["precip"][h][i] == round(raw["precipitation"][h] * 10)
        assert p["rh"][h][i] == round(raw["relative_humidity_2m"][h])
        assert p["vis"][h][i] == round(raw["visibility"][h] / 100)
        # 10 м — рівень джерела, інтерполяція не змінює: швидкість ×10, напрямок у градусах
        assert p["spd"][_lv(10)][h][i] == round(raw["wind_speed_10m"][h] * 10)
        assert abs((p["dir"][_lv(10)][h][i] - raw["wind_direction_10m"][h] + 180) % 360 - 180) <= 1
    # інші точки — null, сусідні індекси не зачеплено
    assert p["temp"][0][i - 1] is None and p["temp"][0][i + 1] is None
    assert p["spd"][0][0][i + GRID["nc"]] is None


def test_null_values_are_kept():
    pt = copy.deepcopy(RAW[1])
    pt["hourly"]["visibility"][3] = None
    pt["hourly"]["temperature_2m"][4] = None
    p = f.pack(_collected({10: pt}), NOW)
    assert p["vis"][3][10] is None and p["vis"][2][10] is not None
    assert p["temp"][4][10] is None and p["temp"][5][10] is not None


def _assert_shape(p: dict) -> None:
    """Форма за §6.2 без jsonschema (повна перевірка схеми — у test_fetch_full_grid_valid_profile)."""
    assert set(SCHEMA["required"]) <= set(p)
    for k in ("spd", "dir"):
        assert len(p[k]) == len(LEVELS) and all(len(hh) == HOURS and all(len(r) == NPTS for r in hh) for hh in p[k])
    for k in ("gust", "temp", "precip", "rh", "vis"):
        assert len(p[k]) == HOURS and all(len(r) == NPTS for r in p[k])


def test_shape_and_schema():
    p = f.pack(_collected({k: RAW[k] for k in range(6)}), NOW)
    _assert_shape(p)
    assert p["levels"] == LEVELS
    assert p["sources"] == ["openmeteo"]
    assert p["generatedAt"] == "2026-11-27T19:21:00Z"
    assert p["times"][0] == "2026-11-27T19:00:00Z" and len(p["times"]) == HOURS


# ---------- §6.2: інтерполяція u, v ----------


def test_interpolates_u_v_not_speed_and_angle():
    # 10 м: 10 м/с з півночі; 80 м: 10 м/с зі сходу. На 50 м (f = 40/70) — вектор, не 10 м/с і не 51°.
    pt = _synthetic(100, {"10m": (10, 0, None), "80m": (10, 90, None)})
    p = f.pack(_collected({0: pt}), NOW)
    fr = 40 / 70
    u, v = -10 * fr, -10 * (1 - fr)
    assert p["spd"][_lv(50)][0][0] == round(math.hypot(u, v) * 10)  # 71, а не 100
    assert p["dir"][_lv(50)][0][0] == round(math.degrees(math.atan2(-u, -v)) % 360)  # 53, а не 45


def test_linear_in_height_between_levels():
    pt = _synthetic(100, {"10m": (5, 270, None), "80m": (12, 270, None)})
    p = f.pack(_collected({0: pt}), NOW)
    assert p["spd"][_lv(50)][0][0] == round((5 + 7 * 40 / 70) * 10)  # 90
    assert p["dir"][_lv(50)][0][0] == 270


def test_pressure_levels_only_above_200m_and_height_is_gh_minus_elevation():
    pt = _synthetic(
        100,
        {
            "10m": (4, 270, None),
            "180m": (6, 270, None),
            "1000hPa": (50, 90, 250),  # 150 м над землею — відкидаємо
            "975hPa": (10, 270, 400),  # 300 м над землею
        },
    )
    p = f.pack(_collected({0: pt}), NOW)
    assert p["spd"][_lv(150)][0][0] == round((4 + 2 * 140 / 170) * 10)  # між 10 і 180 м, без 1000 гПа
    assert p["spd"][_lv(250)][0][0] == round((6 + 4 * 70 / 120) * 10)  # між 180 і 300 м
    assert p["dir"][_lv(250)][0][0] == 270


def test_above_top_level_takes_last_value():
    pt = _synthetic(0, {"10m": (3, 180, None), "900hPa": (15, 200, 600)})
    p = f.pack(_collected({0: pt}), NOW)
    for alt in (700, 800, 900, 1000):
        assert p["spd"][_lv(alt)][0][0] == 150
        assert p["dir"][_lv(alt)][0][0] == 200


def test_no_wind_below_lowest_available_level_is_null():
    pt = _synthetic(0, {"80m": (8, 90, None), "120m": (9, 90, None)})
    p = f.pack(_collected({0: pt}), NOW)
    assert p["spd"][_lv(10)][0][0] is None and p["spd"][_lv(50)][0][0] is None
    assert p["spd"][_lv(100)][0][0] == 85


def test_no_wind_at_all_is_null():
    pt = _synthetic(0, {})
    p = f.pack(_collected({0: pt}), NOW)
    assert all(p["spd"][li][0][0] is None and p["dir"][li][0][0] is None for li in range(len(LEVELS)))


def test_real_fixture_profile_is_plausible():
    p = f.pack(_collected({k: RAW[k] for k in range(6)}), NOW)
    for k in range(6):
        for h in range(HOURS):
            col = [p["spd"][li][h][k] for li in range(len(LEVELS))]
            assert all(x is not None and 0 <= x < 800 for x in col)
            assert all(0 <= p["dir"][li][h][k] < 360 for li in range(len(LEVELS)))


# ---------- F1-AC2 на рівні profile.json + fetch(now) ----------


def _client_fixture_tiled() -> httpx.Client:
    """684 точки: кожна відповідь — справжня точка фікстури (по колу)."""

    def handler(req: httpx.Request) -> httpx.Response:
        n = len(req.url.params["latitude"].split(","))
        return httpx.Response(200, json=[RAW[k % 6] for k in range(n)])

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_fetch_full_grid_valid_profile():
    p = f.fetch(NOW, client=_client_fixture_tiled(), sleep=lambda s: None)
    assert p["_status"] == "ok" and p["_note"] == ""
    body = {k: v for k, v in p.items() if not k.startswith("_") and k != "times"}
    jsonschema.validate(body, SCHEMA)
    assert all(x is not None for x in p["spd"][_lv(100)][0])


def test_fetch_failed_batch_is_null_in_profile_never_neighbour():
    # 2-й пакет (точки 114…227) завжди 429 — і в основному проході, і у фінальній спробі, отже null
    second = f.grid_points()[114]

    def handler(req: httpx.Request) -> httpx.Response:
        first = (float(req.url.params["latitude"].split(",")[0]), float(req.url.params["longitude"].split(",")[0]))
        if first == second:
            return httpx.Response(429)
        n = len(req.url.params["latitude"].split(","))
        return httpx.Response(200, json=[RAW[k % 6] for k in range(n)])

    p = f.fetch(NOW, client=httpx.Client(transport=httpx.MockTransport(handler)), sleep=lambda s: None)
    assert p["_status"] == "partial" and "пакет 2" in p["_note"]
    for key in ("gust", "temp", "rh", "vis", "precip"):
        assert all(p[key][h][i] is None for h in range(HOURS) for i in range(114, 228))
        assert p[key][0][113] is not None and p[key][0][228] is not None
    assert all(p["spd"][li][h][i] is None for li in range(len(LEVELS)) for h in (0, 47) for i in range(114, 228))


def test_fetch_all_failed_is_nodata_all_null():
    c = httpx.Client(transport=httpx.MockTransport(lambda req: httpx.Response(429)))
    p = f.fetch(NOW, client=c, sleep=lambda s: None)
    assert p["_status"] == "nodata"
    assert "times" not in p  # build лишає meta.times від now, а не вигадує
    assert all(x is None for x in p["temp"][0])
    _assert_shape(p)


@pytest.mark.parametrize("bad", ["2026-11-27T19:00", "2026-11-27T19:00Z"])
def test_iso_time(bad):
    assert f.iso_utc(bad) == "2026-11-27T19:00:00Z"
