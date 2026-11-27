"""F2-AC3, F2-AC4: клімат ERA5 → % льотних годин по місяцях (SPEC §6.5, §7.8, правила §7.4).

Фікстура `era5_kyiv_2025-01-01_2d.json` — справжня відповідь Open-Meteo Archive (`models=era5`),
Київ, 01–02.01.2025, 48 год. Без мережі.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import jsonschema
import pytest

from sky.climate import fetch as cl

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
FIX = (HERE / "era5_kyiv_2025-01-01_2d.json").read_text("utf-8")
SCHEMA = json.loads((ROOT / "contracts" / "climate.schema.json").read_text("utf-8"))
NOW = datetime(2026, 11, 27, 22, 0, tzinfo=UTC)
P = cl.load_profiles()


def _h(**kw) -> dict:
    """Спокійна година, яка проходить усі правила для будь-якого з 4 профілів."""
    return {"ws10": 2.0, "ws100": 3.0, "g": 4.0, "t": 15.0, "p": 0.0, "rh": 50.0} | kw


# --- F2-AC3: правила §7.4 (без хмар, видимості, Kp, Galileo) -------------------------------------


def test_profiles_are_four_from_static_catalog():
    assert list(P) == ["fpv7", "fpv10", "heavy", "wing"]
    assert P["wing"]["id"] == "wingE"
    assert (P["fpv7"]["windMs"], P["fpv7"]["gustMs"], P["fpv7"]["tMinC"], P["fpv7"]["precipMmH"]) == (10, 13, -15, 0.5)


def test_wind_level_nearest_to_profile_altitude():
    """ERA5 має 10 і 100 м; беремо рівень, найближчий до робочої висоти профілю (80/120 → 100 м, §7.8)."""
    assert cl.wind_level(P["fpv7"]) == "ws10"  # defaultAltM 50
    assert cl.wind_level(P["fpv10"]) == "ws100"  # 80
    assert cl.wind_level(P["heavy"]) == "ws100"  # 100
    assert cl.wind_level(P["wing"]) == "ws100"  # 400


@pytest.mark.parametrize(
    ("kw", "ok"),
    [
        ({}, True),
        ({"ws10": 10.0}, True),  # на межі
        ({"ws10": 10.1}, False),  # за межею
        ({"ws100": 30.0}, True),  # fpv7 летить на 10 м — 100 м не враховуємо
        ({"g": 13.0}, True),
        ({"g": 13.1}, False),
        ({"t": -15.0, "rh": 50}, True),
        ({"t": -15.1, "rh": 50}, False),
        ({"p": 0.5, "t": 15.0}, True),
        ({"p": 0.51, "t": 15.0}, False),
    ],
)
def test_nogo_limits_fpv7(kw, ok):
    assert cl.flyable(_h(**kw), P["fpv7"]) is ok


def test_wind_100m_for_heavy():
    assert cl.flyable(_h(ws10=20.0, ws100=7.0), P["heavy"]) is True
    assert cl.flyable(_h(ws10=1.0, ws100=7.1), P["heavy"]) is False


def test_precip_threshold_is_max_of_profile_and_005():
    """`p > max(опади, 0.05)` — для профілю з опадами 0 поріг 0.05."""
    zero = dict(P["fpv7"], precipMmH=0)
    assert cl.flyable(_h(p=0.05), zero) is True
    assert cl.flyable(_h(p=0.06), zero) is False


@pytest.mark.parametrize(
    ("t", "rh", "p", "icing"),
    [
        (-10.0, 90, 0.0, True),  # нижня межа t, rh на межі
        (2.0, 95, 0.0, True),  # верхня межа t
        (2.1, 95, 0.0, False),
        (-10.1, 95, 0.0, False),
        (0.0, 89, 0.0, False),
        (0.0, 50, 0.05, False),  # опади на межі — ще ні
        (0.0, 50, 0.06, True),
    ],
)
def test_icing_rule(t, rh, p, icing):
    assert cl.icing(t, rh, p) is icing
    assert cl.flyable(_h(t=t, rh=rh, p=p), P["wing"]) is (not icing)


def test_missing_value_is_nodata_not_flyable():
    assert cl.flyable(_h(ws10=None), P["fpv7"]) is None
    assert cl.flyable(_h(g=None), P["heavy"]) is None


def test_ac3_fixture_two_days_percent():
    """Given ряди ERA5 на 2 дні; When розрахунок; Then % годин за §7.8.

    fpv7 (вітер 10 м ≤ 10, пориви ≤ 13): 01.01 00:00 (1.8 °C, 92%) і 01:00 (2.0 °C, 90%) — обмерзання;
    02.01 08:00 і 09:00 — пориви 13.4 і 13.2 > 13. Решта 44 з 48 год проходять → 91.7%.
    """
    hours = cl.parse(FIX)
    assert len(hours) == 48
    res = cl.monthly(hours, P)
    assert res["fpv7"][0] == 91.7
    assert res["fpv7"][1:] == [None] * 11  # місяців без даних не вигадуємо
    # heavy (вітер 100 м ≤ 7, пориви ≤ 8): лише 01.01 02:00–04:00 (вітер 6.74…7.18, пориви 7.1…7.2)
    # 02:00 ws100 6.74 g 7.1 rh 88 → так; 03:00 ws100 7.18 → ні; 04:00 7.70 → ні; 00:00/01:00 обмерзання.
    assert res["heavy"][0] == round(100 * 1 / 48, 1)
    for k in ("fpv10", "wing"):
        assert 0 <= res[k][0] <= 100


def test_monthly_skips_nodata_hours():
    hours = [("2025-03", _h()), ("2025-03", _h(ws10=None)), ("2025-03", _h(ws10=50.0))]
    assert cl.monthly(hours, P)["fpv7"][2] == 50.0


# --- F2-AC4: climate.json на 5 міст × 4 профілі × 12 місяців --------------------------------------


def _year_json(lat: float, lon: float) -> str:
    """Синтетична відповідь Open-Meteo: по 2 години на кожен місяць 2025."""
    times = [f"2025-{m:02d}-15T{h:02d}:00" for m in range(1, 13) for h in (10, 11)]
    n = len(times)
    hourly = {
        "time": times,
        "wind_speed_10m": [3.0, 11.0] * 12,
        "wind_speed_100m": [5.0] * n,
        "wind_gusts_10m": [6.0] * n,
        "temperature_2m": [12.0] * n,
        "precipitation": [0.0] * n,
        "relative_humidity_2m": [60] * n,
    }
    return json.dumps({"latitude": lat, "longitude": lon, "hourly": hourly})


def _strip(out: dict) -> tuple[str, str]:
    return out.pop("_status"), out.pop("_note")


def test_ac4_climate_json_shape_and_schema():
    seen: list[tuple[float, float]] = []

    def get(lat, lon):
        seen.append((lat, lon))
        return _year_json(lat, lon)

    out = cl.fetch(NOW, get_json=get)
    status, _ = _strip(out)
    assert status == "ok"
    jsonschema.validate(out, SCHEMA)
    assert out["generatedAt"] == "2026-11-27T22:00:00Z"
    assert out["sources"] == ["era5"] and out["year"] == 2025
    assert list(out["cities"]) == ["Київ", "Львів", "Харків", "Одеса", "Дніпро"]
    assert seen[0] == (50.45, 30.52)
    for c in out["cities"].values():
        assert list(c) == ["fpv7", "fpv10", "heavy", "wing"]
        assert all(len(v) == 12 for v in c.values())
        assert c["fpv7"] == [50.0] * 12  # 11 м/с на 10 м > 10
        assert c["heavy"] == [100.0] * 12  # 5 м/с на 100 м ≤ 7


def test_one_city_fails_is_partial_without_foreign_data():
    def get(lat, lon):
        if lat == 49.99:  # Харків
            raise TimeoutError("timed out")
        return _year_json(lat, lon)

    out = cl.fetch(NOW, get_json=get)
    status, note = _strip(out)
    assert status == "partial"
    assert "Харків" in note
    assert "Харків" not in out["cities"]
    assert len(out["cities"]) == 4
    jsonschema.validate(out, SCHEMA)


def test_month_without_data_drops_city():
    """Місяць без годин → значення не вигадуємо: місто випадає, статус partial."""

    def get(lat, lon):
        d = json.loads(_year_json(lat, lon))
        if lat == 46.48:  # Одеса без грудня
            d["hourly"] = {k: v[:-2] for k, v in d["hourly"].items()}
        return json.dumps(d)

    out = cl.fetch(NOW, get_json=get)
    status, note = _strip(out)
    assert status == "partial" and "Одеса" in note
    assert "Одеса" not in out["cities"]


def test_all_fail_is_nodata():
    def boom(lat, lon):
        raise TimeoutError("timed out")

    out = cl.fetch(NOW, get_json=boom)
    status, note = _strip(out)
    assert status == "nodata"
    assert out["cities"] == {}
    jsonschema.validate(out, SCHEMA)


def test_bad_response_lengths_rejected():
    d = json.loads(FIX)
    d["hourly"]["wind_gusts_10m"] = d["hourly"]["wind_gusts_10m"][:-1]
    with pytest.raises(ValueError):
        cl.parse(json.dumps(d))
