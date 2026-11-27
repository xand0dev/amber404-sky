"""Збірка: модуля джерела ще нема → nodata з причиною, а не чужі дані."""

import json

from sky.build import build


def test_missing_module_is_nodata(tmp_path):
    meta = build(mock_only=False, out=tmp_path)
    assert meta["mock"] is True
    statuses = {s["id"]: s for s in meta["sources"]}
    assert statuses["openmeteo"]["status"] == "nodata"
    assert "MOCK" in statuses["openmeteo"]["note"]
    assert json.loads((tmp_path / "meta.json").read_text())["mock"] is True
