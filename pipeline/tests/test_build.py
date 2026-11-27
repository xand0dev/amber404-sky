"""Збірка: модуля джерела ще нема → nodata з причиною, а не чужі дані."""

import json
import socket

import pytest

from sky.build import build


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
