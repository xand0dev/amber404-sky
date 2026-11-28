"""План Б SPEC §12 (issue #93): Open-Meteo недоступний → цілий попередній прогноз з Pages з його справжнім часом,
статус partial і причина. Ніколи не змішуємо старі й нові дані; старий > 12 год або битий → nodata.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx

from sky.contracts import HOURS, NPTS
from sky.forecast import fetch as f

FIX = json.loads((Path(__file__).parent / "openmeteo_2x3.json").read_text("utf-8"))
RAW = [pt for b in FIX for pt in b["response"]]
NOW = datetime(2026, 11, 28, 9, 10, tzinfo=UTC)


def _old(age_h: float, status: str = "ok") -> tuple[dict, dict]:
    """Попередній деплой: profile.json і meta.json, зібрані age_h год тому."""
    t0 = NOW - timedelta(hours=age_h)
    gen = t0.strftime("%Y-%m-%dT%H:%M:%SZ")
    times = [(t0.replace(minute=0) + timedelta(hours=h)).strftime("%Y-%m-%dT%H:00:00Z") for h in range(HOURS)]
    col = f.Collected([t[:16] for t in times], [RAW[k % 6] for k in range(NPTS)], "ok")
    prof = {k: v for k, v in f.pack(col, t0).items() if not k.startswith("_") and k != "times"}
    meta = {"generatedAt": gen, "times": times, "sources": [{"id": "openmeteo", "status": status, "note": ""}]}
    return prof, meta


def _client(om, pages: tuple[dict, dict] | None | str) -> tuple[httpx.Client, list[str]]:
    """om(req) — відповідь Open-Meteo; pages — (profile, meta), None (404) або 'broken'."""
    hosts: list[str] = []

    def handler(req: httpx.Request) -> httpx.Response:
        hosts.append(req.url.host)
        if req.url.host == "api.open-meteo.com":
            return om(req)
        if pages is None:
            return httpx.Response(404)
        if pages == "broken":
            return httpx.Response(200, content=b"<html>")
        prof, meta = pages
        return httpx.Response(200, json=prof if req.url.path.endswith("profile.json") else meta)

    return httpx.Client(transport=httpx.MockTransport(handler)), hosts


def _ok(req: httpx.Request) -> httpx.Response:
    n = len(req.url.params["latitude"].split(","))
    return httpx.Response(200, json=[RAW[k % 6] for k in range(n)])


def _down(req: httpx.Request) -> httpx.Response:
    return httpx.Response(429)


def test_open_meteo_down_uses_whole_previous_forecast_with_its_real_time():
    prof, meta = _old(3)
    c, _ = _client(_down, (prof, meta))
    p = f.fetch(NOW, client=c, sleep=lambda s: None)
    assert p["_status"] == "partial"
    assert "Open-Meteo недоступний" in p["_note"] and prof["generatedAt"] in p["_note"]
    assert p["generatedAt"] == prof["generatedAt"]  # старий час, не «зараз»
    assert p["_fetchedAt"] == prof["generatedAt"]  # build → meta.sources.fetchedAt і meta.generatedAt
    assert p["times"] == meta["times"]
    assert p["spd"] == prof["spd"] and p["temp"] == prof["temp"]


def test_fresh_data_never_touches_pages():
    c, hosts = _client(_ok, _old(3))
    p = f.fetch(NOW, client=c, sleep=lambda s: None)
    assert p["_status"] == "ok"
    assert "_fetchedAt" not in p  # свіжі дані — час збірки ставить build
    assert "xand0dev.github.io" not in hosts


def test_partial_fresh_is_kept_never_mixed_with_old():
    second = f.grid_points()[114]  # перша точка пакета 2 — він падає і в основному проході, і у фінальній спробі

    def om(req: httpx.Request) -> httpx.Response:
        first = (float(req.url.params["latitude"].split(",")[0]), float(req.url.params["longitude"].split(",")[0]))
        return httpx.Response(429) if first == second else _ok(req)

    c, hosts = _client(om, _old(3))
    p = f.fetch(NOW, client=c, sleep=lambda s: None)
    assert p["_status"] == "partial" and "пакет 2" in p["_note"]
    assert all(p["temp"][0][i] is None for i in range(114, 228))  # дірка лишається діркою
    assert "xand0dev.github.io" not in hosts


def test_previous_older_than_12h_is_not_used():
    c, _ = _client(_down, _old(13))
    p = f.fetch(NOW, client=c, sleep=lambda s: None)
    assert p["_status"] == "nodata"
    assert all(x is None for x in p["temp"][0])
    assert "старший за 12 год" in p["_note"]


def test_previous_without_openmeteo_data_is_not_used():
    c, _ = _client(_down, _old(2, status="nodata"))
    p = f.fetch(NOW, client=c, sleep=lambda s: None)
    assert p["_status"] == "nodata"


def test_pages_unreachable_or_broken_is_nodata():
    for pages in (None, "broken"):
        c, _ = _client(_down, pages)
        p = f.fetch(NOW, client=c, sleep=lambda s: None)
        assert p["_status"] == "nodata"
        assert "times" not in p


def test_build_end_to_end_meta_age_is_old_forecast_time(tmp_path, monkeypatch):
    """Справжній build + fetch: Open-Meteo лежить → meta.generatedAt і fetchedAt = час старого прогнозу."""
    from sky import build as b

    prof, meta = _old(3)
    mock_client, _ = _client(_down, (prof, meta))  # до підміни httpx.Client, інакше рекурсія
    monkeypatch.setattr(httpx, "Client", lambda *a, **k: mock_client)
    monkeypatch.setattr(f.fetch, "__defaults__", (None, lambda s: None))  # build кличе fetch(now) без sleep
    monkeypatch.setattr(b, "REAL", {"profile": ("sky.forecast.fetch", "openmeteo")})
    out = b.build(mock_only=False, out=tmp_path)
    om = next(s for s in out["sources"] if s["id"] == "openmeteo")
    assert om["status"] == "partial" and "Open-Meteo недоступний" in om["note"]
    assert om["fetchedAt"] == prof["generatedAt"]
    assert out["generatedAt"] == prof["generatedAt"]  # плашка віку: 3 год, а не «щойно»
    assert out["times"] == meta["times"]
    written = json.loads((tmp_path / "profile.json").read_text("utf-8"))
    assert not any(k.startswith("_") for k in written) and written["spd"] == prof["spd"]
