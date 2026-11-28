"""#165: profile.json розбитий за годинами → profile/index.json + profile/h00…h47.json (SPEC §6.2).
Сума годин = вихідний профіль, ті самі значення; схеми з contracts/; старий profile.json не пишеться."""

import json
from pathlib import Path

import jsonschema
import pytest

from sky.build import build
from sky.contracts import GRID, HOURS, LEVELS, NPTS, hour_file, join_profile, split_profile
from sky.mocks import build_mock

ROOT = Path(__file__).resolve().parents[2]


def schema(name: str) -> dict:
    return json.loads((ROOT / "contracts" / f"{name}.schema.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def mock():
    return build_mock()


def test_hour_file_names():
    assert hour_file(0) == "h00.json" and hour_file(7) == "h07.json" and hour_file(47) == "h47.json"


def test_split_shapes_and_schemas(mock):
    index, hours = split_profile(mock["profile"], mock["meta"]["times"])
    jsonschema.validate(index, schema("profile-index"))
    assert index["grid"] == GRID and index["levels"] == LEVELS
    assert [h["file"] for h in index["hours"]] == [hour_file(h) for h in range(HOURS)]
    assert [h["t"] for h in index["hours"]] == mock["meta"]["times"]
    assert {v["id"] for v in index["vars"]} == {"spd", "dir", "gust", "temp", "precip", "rh", "vis"}
    assert len(hours) == HOURS
    for h, hf in enumerate(hours):
        jsonschema.validate(hf, schema("profile-hour"))
        assert hf["hour"] == h and hf["t"] == mock["meta"]["times"][h]
        assert hf["generatedAt"] == index["generatedAt"]  # усі години — з одного запуску
        assert len(hf["spd"]) == len(LEVELS) and len(hf["spd"][0]) == NPTS and len(hf["temp"]) == NPTS


def test_sum_of_hours_is_the_source_profile(mock):
    """Ті самі значення: година h у файлі = [рівень][h] / [h] у вихідному профілі; злиття назад — той самий профіль."""
    p = mock["profile"]
    index, hours = split_profile(p, mock["meta"]["times"])
    assert hours[5]["spd"][3] == p["spd"][3][5] and hours[47]["vis"] == p["vis"][47]
    assert join_profile(index, hours) == p


def test_null_survives_split(mock):
    p = json.loads(json.dumps(mock["profile"]))
    p["spd"][0][1][2] = None
    p["temp"][1][3] = None
    index, hours = split_profile(p, mock["meta"]["times"])
    assert hours[1]["spd"][0][2] is None and hours[1]["temp"][3] is None
    assert join_profile(index, hours) == p


def test_join_refuses_mixed_runs(mock):
    """Години з іншого запуску не змішуємо (AGENTS.md)."""
    index, hours = split_profile(mock["profile"], mock["meta"]["times"])
    hours[3] = dict(hours[3], generatedAt="2000-01-01T00:00:00Z")
    with pytest.raises(ValueError):
        join_profile(index, hours)


def test_build_writes_new_format_only(tmp_path):
    (tmp_path / "profile.json").write_text("{}")  # залишок старого формату
    meta = build(mock_only=True, out=tmp_path)
    assert not (tmp_path / "profile.json").exists()
    index = json.loads((tmp_path / "profile" / "index.json").read_text("utf-8"))
    jsonschema.validate(index, schema("profile-index"))
    assert [h["t"] for h in index["hours"]] == meta["times"]
    hours = [json.loads((tmp_path / "profile" / h["file"]).read_text("utf-8")) for h in index["hours"]]
    assert len(hours) == HOURS
    assert join_profile(index, hours)["spd"][0][0] == build_mock()["profile"]["spd"][0][0]
