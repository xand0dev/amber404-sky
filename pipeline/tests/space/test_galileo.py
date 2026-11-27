"""F2-AC1: Galileo — видимі супутники > 10° і PDOP для Києва збігаються з еталоном skyfield з точністю 0.1."""

from __future__ import annotations

import json
import math
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from sky.galileo import fetch as gal
from sky.galileo.geometry import pdop
from sky.galileo.orbit import parse_tle

HERE = Path(__file__).parent
TLE = (HERE / "galileo_2026-11-27.tle").read_text()
REF = json.loads((HERE / "galileo_reference_kyiv.json").read_text())
KYIV = (50.45, 30.52)


def _t(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=UTC)


def _check(rows: list[dict]) -> None:
    sats = parse_tle(TLE)
    times = [_t(r["t"]) for r in rows]
    visible, pd = gal.compute(sats, [{"name": "Київ", "lat": KYIV[0], "lon": KYIV[1]}], times)
    for h, r in enumerate(rows):
        assert abs(visible[0][h] - r["visible"]) <= 0.1, r["t"]
        assert abs(pd[0][h] - r["pdop"]) <= 0.1, (r["t"], pd[0][h], r["pdop"])


def test_ac1_kyiv_matches_skyfield_reference_fixture():
    """Given TLE (фікстура) і моменти часу; When розрахунок для Києва; Then = еталон skyfield (збережений)."""
    assert REF["by"] == "skyfield" and len(REF["rows"]) >= 10
    _check(REF["rows"])


def test_ac1_kyiv_matches_skyfield_live():
    """Те саме, але еталон рахує skyfield просто в тесті (коли skyfield встановлено)."""
    pytest.importorskip("skyfield")
    from tests.space.skyfield_reference import reference

    t0 = datetime(2026, 11, 27, 12, 30, tzinfo=UTC)
    times = [t0 + timedelta(hours=h) for h in range(0, 48, 5)]
    _check(reference(TLE, *KYIV, times))


def test_tle_fixture_has_all_galileo():
    assert len(parse_tle(TLE)) == 32


def test_pdop_known_geometry():
    # зеніт + три супутники на горизонті через 120°: G^T G діагональна → PDOP аналітично
    units = [(0.0, 0.0, 1.0)] + [(math.sin(a), math.cos(a), 0.0) for a in (0, 2 * math.pi / 3, 4 * math.pi / 3)]
    # x,y: 3/2 кожна → 2/3; z і clock: [[1,1],[1,4]] → inv z = 4/3
    assert pdop(units) == pytest.approx(math.sqrt(2 / 3 + 2 / 3 + 4 / 3))


def test_pdop_needs_four_satellites():
    assert pdop([(0.0, 0.0, 1.0), (1.0, 0.0, 0.0), (0.0, 1.0, 0.0)]) is None


def test_fetch_builds_16_cities_48_hours():
    now = datetime(2026, 11, 27, 12, 17, tzinfo=UTC)
    out = gal.fetch(now, get_tle=lambda: TLE)
    assert out["_status"] == "ok"
    assert out["elevationMaskDeg"] == 10 and out["sources"] == ["celestrak-galileo"]
    assert len(out["points"]) == 16 and out["points"][0]["name"] == "Київ"
    assert len(out["visible"]) == 16 and all(len(row) == 48 for row in out["visible"])
    assert len(out["pdop"]) == 16 and all(len(row) == 48 for row in out["pdop"])
    assert all(isinstance(v, int) for row in out["visible"] for v in row)


def test_fetch_source_down_is_nodata_not_old_data():
    def down() -> str:
        raise TimeoutError("celestrak timeout")

    out = gal.fetch(datetime(2026, 11, 27, 12, tzinfo=UTC), get_tle=down)
    assert out["_status"] == "nodata" and "timeout" in out["_note"]
    assert all(v is None for row in out["visible"] + out["pdop"] for v in row)


def test_fetch_empty_tle_is_nodata():
    out = gal.fetch(datetime(2026, 11, 27, 12, tzinfo=UTC), get_tle=lambda: "")
    assert out["_status"] == "nodata"
