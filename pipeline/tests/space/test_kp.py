"""F2-AC2: Kp від NOAA → kp.json за §6.4; недоступне джерело → nodata, без падіння збірки.

Фікстура `noaa_kp_2026-11-27.json` — справжня відповідь NOAA SWPC (27.11.2026). Без мережі.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

import jsonschema
import pytest

from sky import build as b
from sky.space import fetch as kp

HERE = Path(__file__).parent
ROOT = HERE.parents[2]
FIX = (HERE / "noaa_kp_2026-11-27.json").read_text("utf-8")
SCHEMA = json.loads((ROOT / "contracts" / "kp.schema.json").read_text("utf-8"))
NOW = datetime(2026, 11, 27, 9, 30, tzinfo=UTC)


def _boom() -> str:
    raise TimeoutError("timed out")


def test_ac2_fixture_parses_to_kp_json_by_schema():
    """Given NOAA Kp (фікстура); When парсинг; Then kp.json за §6.4."""
    out = kp.fetch(NOW, get_json=lambda: FIX)
    assert out.pop("_status") == "ok"
    out.pop("_note")
    jsonschema.validate(out, SCHEMA)
    assert out["generatedAt"] == "2026-11-27T09:30:00Z"
    assert out["sources"] == ["noaa-kp"]
    assert len(out["series"]) == 81
    assert out["series"][0] == {"t": "2026-11-20T00:00:00Z", "kp": 0.67, "observed": True}
    assert out["series"][-1] == {"t": "2026-11-30T00:00:00Z", "kp": 1.67, "observed": False}


def test_ac2_observed_only_for_observed_estimated_and_predicted_are_false():
    rows = kp.parse(FIX)
    src = json.loads(FIX)
    for r, s in zip(rows, src, strict=True):
        assert r["observed"] is (s["observed"] == "observed")


def test_ac2_series_is_3_hour_intervals_sorted():
    ts = [datetime.strptime(r["t"], "%Y-%m-%dT%H:%M:%SZ") for r in kp.parse(FIX)]
    assert all((b_ - a).total_seconds() == 3 * 3600 for a, b_ in zip(ts, ts[1:], strict=False))


def test_ac2_legacy_array_of_arrays_format_also_parses():
    legacy = json.dumps(
        [
            ["time_tag", "kp", "observed", "noaa_scale"],
            ["2026-11-27 09:00:00", "3.33", "observed", None],
            ["2026-11-27 12:00:00", "5.00", "predicted", "G1"],
        ]
    )
    assert kp.parse(legacy) == [
        {"t": "2026-11-27T09:00:00Z", "kp": 3.33, "observed": True},
        {"t": "2026-11-27T12:00:00Z", "kp": 5.0, "observed": False},
    ]


def test_ac2_bad_rows_are_dropped_and_status_partial():
    """Рядок без kp чи з kp поза 0–9 не вигадуємо — відкидаємо, статус partial."""
    src = json.loads(FIX)[:3]
    src[1]["kp"] = None
    src[2]["kp"] = 12
    out = kp.fetch(NOW, get_json=lambda: json.dumps(src))
    assert out["_status"] == "partial"
    assert [r["t"] for r in out["series"]] == ["2026-11-20T00:00:00Z"]


@pytest.mark.parametrize("body", ["", "[]", "not json", '{"a": 1}', '[["time_tag","kp","observed"]]'])
def test_ac2_empty_or_garbage_response_is_nodata(body):
    out = kp.fetch(NOW, get_json=lambda: body)
    assert out["_status"] == "nodata" and out["_note"]
    assert out["series"] == []
    jsonschema.validate({k: v for k, v in out.items() if not k.startswith("_")}, SCHEMA)


def test_ac2_unavailable_source_is_nodata_with_reason():
    """Given NOAA недоступне; When fetch; Then nodata з причиною, порожня серія (без старих даних)."""
    out = kp.fetch(NOW, get_json=_boom)
    assert out["_status"] == "nodata"
    assert "TimeoutError" in out["_note"]
    assert out["series"] == []


def test_download_retries_with_pause_then_raises(monkeypatch):
    import httpx

    calls, sleeps = [], []

    def get(url, **kw):
        calls.append(url)
        return httpx.Response(429, request=httpx.Request("GET", url))

    monkeypatch.setattr(httpx, "get", get)
    monkeypatch.setattr(kp.time, "sleep", sleeps.append)
    with pytest.raises(httpx.HTTPStatusError):
        kp.download()
    assert len(calls) == kp.TRIES and calls[0] == kp.URL
    assert len(sleeps) == kp.TRIES - 1 and all(s > 0 for s in sleeps)


def test_ac2_build_does_not_crash_when_noaa_is_down(monkeypatch, tmp_path):
    """Given NOAA недоступне; When повна збірка; Then збірка не падає, noaa-kp = nodata, kp.json за схемою."""
    monkeypatch.setattr(kp, "download", _boom)
    monkeypatch.setattr(b, "REAL", {"kp": b.REAL["kp"]})
    meta = b.build(mock_only=False, out=tmp_path)
    st = {s["id"]: s for s in meta["sources"]}
    assert st["noaa-kp"]["status"] == "nodata" and "TimeoutError" in st["noaa-kp"]["note"]
    jsonschema.validate(json.loads((tmp_path / "kp.json").read_text("utf-8")), SCHEMA)
