"""F1-AC4: після збору — частка не-null значень і 3 рядки контрольних значень для Києва в лозі.
Сам живий прогін (`make data`) — у PR; тут — що лог справді є і рахує правильно, на фікстурі.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import httpx

from sky.contracts import GRID, HOURS, NPTS, point
from sky.forecast import fetch as f

FIX = json.loads((Path(__file__).parent / "openmeteo_2x3.json").read_text("utf-8"))
RAW = [pt for b in FIX for pt in b["response"]]
NOW = datetime(2026, 11, 27, 19, 21, tzinfo=UTC)
KYIV_I = 4 * GRID["nc"] + 17


def _full_client() -> httpx.Client:
    def handler(req: httpx.Request) -> httpx.Response:
        n = len(req.url.params["latitude"].split(","))
        return httpx.Response(200, json=[RAW[k % 6] for k in range(n)])

    return httpx.Client(transport=httpx.MockTransport(handler))


def test_kyiv_node_is_nearest_grid_point():
    assert f.KYIV_I == KYIV_I
    assert point(4, 17) == (50.5, 30.5)  # Київ 50.45, 30.52 → найближчий вузол


def test_non_null_share():
    pts: list[dict | None] = [None] * NPTS
    pts[:342] = [RAW[0]] * 342  # половина сітки
    p = f.pack(f.Collected(RAW[0]["hourly"]["time"], pts, "partial"), NOW)
    assert abs(f.non_null_share(p) - 0.5) < 1e-9


def test_three_kyiv_control_lines_with_decoded_values():
    pts: list[dict | None] = [None] * NPTS
    pts[KYIV_I] = RAW[0]
    p = f.pack(f.Collected(RAW[0]["hourly"]["time"], pts, "ok"), NOW)
    lines = f.control_lines(p)
    assert len(lines) == 3
    raw = RAW[0]["hourly"]
    for line, h in zip(lines, (0, HOURS // 2, HOURS - 1), strict=True):
        assert line.startswith(f"Київ (50.5, 30.5) {p['times'][h]}")
        assert f"t {p['temp'][h][KYIV_I] / 10:.1f} °C" in line
        assert f"пориви {p['gust'][h][KYIV_I] / 10:.1f} м/с" in line
        assert f"10 м {round(raw['wind_speed_10m'][h] * 10) / 10:.1f} м/с" in line


def test_kyiv_without_data_says_so():
    p = f.pack(f.Collected(RAW[0]["hourly"]["time"], [None] * NPTS, "nodata"), NOW)
    assert all("немає даних" in s for s in f.control_lines(p))


def test_fetch_logs_share_and_kyiv(capsys):
    f.fetch(NOW, client=_full_client(), sleep=lambda s: None)
    err = capsys.readouterr().err.splitlines()
    assert any(s.startswith("openmeteo: не null 100.0%") for s in err)
    assert sum(s.startswith("Київ (50.5, 30.5)") for s in err) == 3
