"""F0-AC1: mocks відповідають контрактам §6; індекс сітки i = r * nc + c."""

import json
from pathlib import Path

import jsonschema
import pytest

from sky.contracts import GRID, LEVELS, NPTS, point
from sky.mocks import build_mock

ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture(scope="module")
def mock():
    return build_mock()


@pytest.mark.parametrize("name", ["meta", "profile", "galileo", "kp", "climate"])
def test_mock_matches_schema(mock, name):
    schema = json.loads((ROOT / "contracts" / f"{name}.schema.json").read_text(encoding="utf-8"))
    jsonschema.validate(mock[name], schema)


def test_grid_index_and_corners():
    assert NPTS == 684
    assert point(0, 0) == (52.5, 22.0)
    assert point(GRID["nr"] - 1, GRID["nc"] - 1) == (44.0, 40.5)


def test_profile_shape(mock):
    p = mock["profile"]
    assert p["levels"] == LEVELS
    assert len(p["spd"]) == 16 and len(p["spd"][0]) == 48 and len(p["spd"][0][0]) == NPTS
    assert mock["meta"]["mock"] is True


def test_borders_ukraine_pov():
    b = json.loads((ROOT / "web/public/data/static/borders.json").read_text(encoding="utf-8"))
    ukr = next(f for f in b["features"] if f["iso"] == "UKR")

    def inside(x, y, ring):
        c = False
        for (x1, y1), (x2, y2) in zip(ring, ring[1:] + ring[:1], strict=False):
            if (y1 > y) != (y2 > y) and x < (x2 - x1) * (y - y1) / (y2 - y1) + x1:
                c = not c
        return c

    assert any(inside(34.10, 44.95, r) for r in ukr["rings"]), "Сімферополь має бути в Україні (Ukraine POV)"
