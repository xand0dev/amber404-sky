"""Збірка: модуля джерела ще нема → nodata з причиною, а не чужі дані."""

import json
import socket

import pytest

from sky.build import build
from sky.mocks import build_mock

PROFILE = build_mock()["profile"]  # модуль профілю віддає цілий профіль §6.2


@pytest.fixture
def net_calls(monkeypatch):
    """Записує спроби зʼєднання: build ковтає винятки джерел, тож перевіряємо список, а не виняток."""
    calls: list[tuple] = []

    def deny(*a, **_k):
        calls.append(a)
        raise OSError("мережа в тестах заборонена")

    monkeypatch.setattr(socket.socket, "connect", deny)
    monkeypatch.setattr(socket, "create_connection", deny)
    monkeypatch.setattr(socket, "getaddrinfo", deny)
    return calls


def test_missing_module_is_nodata(tmp_path, monkeypatch, net_calls):
    monkeypatch.setattr("sky.build.REAL", {"profile": ("sky.forecast._nema_takoho", "openmeteo")})
    meta = build(mock_only=False, out=tmp_path)
    assert meta["mock"] is True
    statuses = {s["id"]: s for s in meta["sources"]}
    assert statuses["openmeteo"]["status"] == "nodata"
    assert "MOCK" in statuses["openmeteo"]["note"]
    assert json.loads((tmp_path / "meta.json").read_text())["mock"] is True
    assert net_calls == []


def _fake(monkeypatch, name: str, payload: dict) -> None:
    import sys
    import types

    m = types.ModuleType(name)
    m.fetch = lambda _now: dict(payload)
    monkeypatch.setitem(sys.modules, name, m)


def test_old_whole_forecast_keeps_its_time(tmp_path, monkeypatch, net_calls):
    """План Б §12 (#93): цілий попередній прогноз → generatedAt старий, плашка віку чесна."""
    _fake(
        monkeypatch,
        "sky._t_old",
        {**PROFILE, "_status": "partial", "_note": "показано прогноз від 10:00", "_fetchedAt": "2026-01-01T10:00:00Z"},
    )
    _fake(monkeypatch, "sky._t_new", {})
    monkeypatch.setattr("sky.build.REAL", {"profile": ("sky._t_old", "openmeteo"), "kp": ("sky._t_new", "noaa-kp")})
    meta = build(mock_only=False, out=tmp_path)
    st = {s["id"]: s for s in meta["sources"]}
    assert st["openmeteo"]["fetchedAt"] == "2026-01-01T10:00:00Z"
    assert st["openmeteo"]["status"] == "partial"
    assert meta["generatedAt"] == "2026-01-01T10:00:00Z"
    assert "_fetchedAt" not in json.loads((tmp_path / "profile" / "index.json").read_text())
    assert "_fetchedAt" not in json.loads((tmp_path / "profile" / "h00.json").read_text())


def test_nodata_source_does_not_age_forecast(tmp_path, monkeypatch, net_calls):
    """Джерело nodata (MOCK) не впливає на вік: беремо час справжніх джерел."""
    _fake(monkeypatch, "sky._t_new", PROFILE)
    monkeypatch.setattr(
        "sky.build.REAL", {"profile": ("sky._t_new", "openmeteo"), "kp": ("sky._nema_takoho", "noaa-kp")}
    )
    meta = build(mock_only=False, out=tmp_path)
    st = {s["id"]: s for s in meta["sources"]}
    assert meta["generatedAt"] == st["openmeteo"]["fetchedAt"]
