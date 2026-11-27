"""F1-AC1, F1-AC2: збір Open-Meteo пакетами ≤ 120 точок, повтори на 429, перевірка відповідей,
пакет, що не завантажився, = None (дані іншого пакета ніколи не підставляються).

Фікстура `openmeteo_2x3.json` — справжня відповідь Open-Meteo (27.11.2026) на 2 пакети по 3 вузли сітки.
HTTP — лише httpx.MockTransport, без мережі.
"""

from __future__ import annotations

import copy
import json
from pathlib import Path

import httpx
import pytest

from sky.contracts import GRID, HOURS, NPTS, point
from sky.forecast import fetch as f

FIX = json.loads((Path(__file__).parent / "openmeteo_2x3.json").read_text("utf-8"))
PTS = [tuple(p) for b in FIX for p in b["points"]]  # 6 точок, 2 пакети по 3


def _lats(req: httpx.Request) -> list[float]:
    return [float(x) for x in req.url.params["latitude"].split(",")]


def _fixture_for(req: httpx.Request) -> list[dict]:
    """Відповідь фікстури для пакета, якому належать координати запиту."""
    lats = _lats(req)
    for b in FIX:
        if [p[0] for p in b["points"]] == lats:
            return copy.deepcopy(b["response"])
    raise AssertionError(f"неочікуваний пакет {lats}")


def _client(handler) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def _batch_no(req: httpx.Request) -> int:
    return 1 if _lats(req)[0] == FIX[0]["points"][0][0] else 2


class Sleeps(list):
    def __call__(self, s: float) -> None:
        self.append(s)


# ---------- F1-AC1: пакети ≤ 120 з паузою ----------


def test_grid_points_order_is_r_times_nc_plus_c():
    pts = f.grid_points()
    assert len(pts) == NPTS == 684
    r, c = 5, 7
    assert pts[r * GRID["nc"] + c] == point(r, c)


def test_684_points_go_in_batches_of_at_most_120_with_pause_between():
    pts = f.grid_points()
    seen: list[list[tuple[float, float]]] = []

    def handler(req: httpx.Request) -> httpx.Response:
        lats = _lats(req)
        lons = [float(x) for x in req.url.params["longitude"].split(",")]
        seen.append(list(zip(lats, lons, strict=True)))
        one = FIX[0]["response"][0]
        return httpx.Response(200, json=[one] * len(lats))

    sleeps = Sleeps()
    out = f.collect(pts, _client(handler), sleep=sleeps)

    assert len(seen) == 6
    assert all(len(b) <= 120 for b in seen)
    assert [p for b in seen for p in b] == pts  # порядок i = r * nc + c збережено
    assert sleeps == [f.PAUSE_S] * 5  # пауза між пакетами, не після останнього
    assert out.status == "ok" and out.note == ""
    assert len(out.points) == 684 and all(p is not None for p in out.points)


def test_request_asks_section_6_2_variables_in_ms_for_48_hours():
    p = f.request_params(PTS[:3])
    hourly = p["hourly"].split(",")
    for v in (
        "wind_speed_10m",
        "wind_direction_180m",
        "wind_speed_850hPa",
        "geopotential_height_1000hPa",
        "wind_gusts_10m",
        "temperature_2m",
        "precipitation",
        "relative_humidity_2m",
        "visibility",
    ):
        assert v in hourly
    assert p["wind_speed_unit"] == "ms"
    assert p["forecast_hours"] == HOURS
    assert p["latitude"].count(",") == 2


# ---------- F1-AC1: 429 → наростаюча пауза, до 5 повторів ----------


def test_429_retried_with_growing_pause_then_succeeds():
    calls = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(1)
        if len(calls) <= 2:
            return httpx.Response(429, text="Too many requests")
        return httpx.Response(200, json=_fixture_for(req))

    sleeps = Sleeps()
    got = f.get_batch(_client(handler), FIX[0]["points"], sleep=sleeps)
    assert len(calls) == 3
    assert sleeps == [2.0, 4.0]
    assert got == FIX[0]["response"]


def test_429_gives_up_after_5_retries():
    calls = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(1)
        return httpx.Response(429)

    sleeps = Sleeps()
    with pytest.raises(f.BatchError, match="429"):
        f.get_batch(_client(handler), FIX[0]["points"], sleep=sleeps)
    assert len(calls) == 6  # 1 спроба + 5 повторів
    assert sleeps == [2.0, 4.0, 8.0, 16.0, 32.0]


# ---------- F1-AC1: кожна відповідь перевіряється ----------


def test_wrong_point_count_fails_batch():
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_fixture_for(req)[:2])

    with pytest.raises(f.BatchError, match="точок 2 ≠ 3"):
        f.get_batch(_client(handler), FIX[0]["points"], sleep=Sleeps())


def test_batch_with_different_times_is_rejected():
    def handler(req: httpx.Request) -> httpx.Response:
        resp = _fixture_for(req)
        if _batch_no(req) == 2:
            for pt in resp:
                pt["hourly"]["time"] = pt["hourly"]["time"][1:] + ["2099-01-01T00:00"]
        return httpx.Response(200, json=resp)

    out = f.collect(PTS, _client(handler), sleep=Sleeps(), size=3)
    assert out.status == "partial"
    assert out.points[3:] == [None, None, None]
    assert "пакет 2" in out.note and "times" in out.note


# ---------- F1-AC2: регресія — пакет не завантажився → None, а не сусідні дані ----------


def test_failed_batch_is_none_never_neighbour_data():
    def handler(req: httpx.Request) -> httpx.Response:
        if _batch_no(req) == 2:
            return httpx.Response(429)
        return httpx.Response(200, json=_fixture_for(req))

    out = f.collect(PTS, _client(handler), sleep=Sleeps(), size=3)

    assert out.points[:3] == FIX[0]["response"]  # пакет 1 — дослівно
    assert out.points[3:] == [None, None, None]  # пакет 2 — None, а не копія пакета 1
    assert out.times == FIX[0]["response"][0]["hourly"]["time"]
    assert out.status == "partial"
    assert "пакет 2" in out.note and "429" in out.note
    assert len(out.note) <= 200


def test_all_batches_failed_is_nodata():
    out = f.collect(PTS, _client(lambda req: httpx.Response(429)), sleep=Sleeps(), size=3)
    assert out.status == "nodata"
    assert out.points == [None] * 6
    assert out.times == []


def test_all_batches_ok():
    out = f.collect(PTS, _client(lambda req: httpx.Response(200, json=_fixture_for(req))), sleep=Sleeps(), size=3)
    assert out.status == "ok" and out.note == ""
    assert out.points == FIX[0]["response"] + FIX[1]["response"]


def test_timeout_and_empty_response_are_retried():
    calls = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(1)
        if len(calls) == 1:
            raise httpx.ReadTimeout("timeout", request=req)
        if len(calls) == 2:
            return httpx.Response(200, content=b"")
        return httpx.Response(200, json=_fixture_for(req))

    sleeps = Sleeps()
    assert f.get_batch(_client(handler), FIX[0]["points"], sleep=sleeps) == FIX[0]["response"]
    assert sleeps == [2.0, 4.0]


def test_fetch_waits_for_packing_issue_2():
    with pytest.raises(NotImplementedError):
        f.fetch(None)
