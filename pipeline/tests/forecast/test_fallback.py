"""План Б SPEC §12 (issue #93): Open-Meteo недоступний → цілий попередній прогноз з Pages з його справжнім часом,
статус partial і причина. Ніколи не змішуємо старі й нові дані; старий > 12 год або битий → nodata.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx

from sky.contracts import HOURS, NPTS, join_profile, split_profile
from sky.forecast import fetch as f

FIX = json.loads((Path(__file__).parent / "openmeteo_2x3.json").read_text("utf-8"))
RAW = [pt for b in FIX for pt in b["response"]]
NOW = datetime(2026, 11, 28, 9, 10, tzinfo=UTC)


def _old(age_h: float, status: str = "ok", now: datetime = NOW) -> tuple[dict, dict]:
    """Попередній деплой: профіль і meta.json, зібрані age_h год тому відносно now."""
    t0 = now - timedelta(hours=age_h)
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
        if req.url.path.endswith("meta.json"):
            return httpx.Response(200, json=meta)
        index, hours = split_profile(prof, meta["times"])  # §6.2 (#165): на Pages профіль за годинами
        if req.url.path.endswith("profile/index.json"):
            return httpx.Response(200, json=index)
        return httpx.Response(200, json=hours[int(req.url.path[-7:-5])])

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


SECOND = f.grid_points()[114]  # перша точка пакета 2


def _south_down(req: httpx.Request) -> httpx.Response:
    """Пакет 2 падає і в основному проході, і у фінальній спробі; решта — ок. Бракує 114 / 684 ≈ 17 % точок."""
    first = (float(req.url.params["latitude"].split(",")[0]), float(req.url.params["longitude"].split(",")[0]))
    return httpx.Response(429) if first == SECOND else _ok(req)


def test_partial_fresh_with_complete_previous_uses_whole_previous():
    """#139 C: свіжий partial (бракує > 10 %) + попередній ok ≤ 12 год → цілий попередній, нічого не змішуємо."""
    prof, meta = _old(3)
    c, _ = _client(_south_down, (prof, meta))
    p = f.fetch(NOW, client=c, sleep=lambda s: None)
    assert p["_status"] == "partial"
    assert "неповний" in p["_note"] and prof["generatedAt"] in p["_note"] and "пакет 2" in p["_note"]
    assert p["_fetchedAt"] == p["generatedAt"] == prof["generatedAt"]
    assert p["times"] == meta["times"]
    assert p["spd"] == prof["spd"] and p["temp"] == prof["temp"]  # усі точки — зі старого, жодної свіжої


def test_partial_fresh_kept_when_previous_was_partial_too():
    """Попередній сам неповний (або сам план Б) — не кращий; лишаємо свіжий з діркою, не змішуємо."""
    c, _ = _client(_south_down, _old(3, status="partial"))
    p = f.fetch(NOW, client=c, sleep=lambda s: None)
    assert p["_status"] == "partial" and "пакет 2" in p["_note"]
    assert "_fetchedAt" not in p
    assert all(p["temp"][0][i] is None for i in range(114, 228))  # дірка лишається діркою
    assert all(p["temp"][0][i] is not None for i in range(114))  # свіже — свіже


def test_partial_fresh_kept_when_previous_too_old_or_unreachable():
    for pages in (_old(13), None, "broken"):
        c, _ = _client(_south_down, pages)
        p = f.fetch(NOW, client=c, sleep=lambda s: None)
        assert p["_status"] == "partial" and "пакет 2" in p["_note"]
        assert "_fetchedAt" not in p
        assert all(p["temp"][0][i] is None for i in range(114, 228))


def test_missing_share_threshold():
    """Поріг #139 C: план Б для partial — лише якщо бракує понад 10 % точок сітки."""
    assert f.PARTIAL_MAX_MISSING == 0.10
    assert f.missing_share([None] * 68 + [{}] * 616) <= f.PARTIAL_MAX_MISSING  # 68 / 684 ≈ 9.9 %
    assert f.missing_share([None] * 114 + [{}] * 570) > f.PARTIAL_MAX_MISSING  # один пакет ≈ 16.7 %


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

    # build бере справжній годинник (datetime.now), тож і «старий» прогноз — 3 год від справжнього now,
    # інакше з фіксованим NOW тест падає, щойно минає 12 год (вік > 12 → план Б не застосовується).
    prof, meta = _old(3, now=datetime.now(UTC))
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
    d = tmp_path / "profile"
    index = json.loads((d / "index.json").read_text("utf-8"))
    written = join_profile(index, [json.loads((d / h["file"]).read_text("utf-8")) for h in index["hours"]])
    assert not any(k.startswith("_") for k in written) and written["spd"] == prof["spd"]


def test_previous_with_hours_from_another_run_is_not_used():
    """§6.2 (#165): на Pages одна з годин — з іншого запуску → план Б не змішує, nodata."""
    prof, meta = _old(3)
    index, hours = split_profile(prof, meta["times"])
    hours[7] = dict(hours[7], generatedAt="2000-01-01T00:00:00Z")

    def handler(req: httpx.Request) -> httpx.Response:
        if req.url.host == "api.open-meteo.com":
            return _down(req)
        if req.url.path.endswith("meta.json"):
            return httpx.Response(200, json=meta)
        if req.url.path.endswith("index.json"):
            return httpx.Response(200, json=index)
        return httpx.Response(200, json=hours[int(req.url.path[-7:-5])])

    p = f.fetch(NOW, client=httpx.Client(transport=httpx.MockTransport(handler)), sleep=lambda s: None)
    assert p["_status"] == "nodata"
    assert "попередній прогноз недоступний" in p["_note"]
