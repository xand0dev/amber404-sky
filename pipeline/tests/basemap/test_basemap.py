"""Issue #99 (SPEC §7.6a, §8 `s2cloudless`, `ne-water`): супутникова мозаїка й вода — статичні файли.

Логіка перевіряється без мережі (синтетичні лінії, shapefile у tmp_path, фальшивий транспорт httpx);
закомічені `satellite.jpg` і `water.json` — на розмір і рамку.
"""

from __future__ import annotations

import json
from pathlib import Path

import httpx
import pytest
import shapefile

from sky.basemap import build as bm

ROOT = Path(__file__).parents[3]
STATIC = ROOT / "web" / "public" / "data" / "static"
X0, Y0, X1, Y1 = bm.BBOX


def _inside(p: list[float] | tuple[float, float]) -> bool:
    return X0 - 1e-9 <= p[0] <= X1 + 1e-9 and Y0 - 1e-9 <= p[1] <= Y1 + 1e-9


def _coords(geom: dict) -> list[list[float]]:
    c = geom["coordinates"]
    if geom["type"] == "LineString":
        return c
    if geom["type"] in ("MultiLineString", "Polygon"):
        return [p for part in c for p in part]
    if geom["type"] == "MultiPolygon":
        return [p for poly in c for ring in poly for p in ring]
    raise AssertionError(geom["type"])


# --- AC1: запит WMS ---


def test_wms_url_is_one_getmap_for_the_map_frame():
    url = httpx.URL(bm.wms_url())
    q = dict(url.params)
    assert url.host == "tiles.maps.eox.at" and url.path == "/wms"
    assert q["request"] == "GetMap"
    assert q["layers"] == "s2cloudless-2020"
    assert q["srs"] == "EPSG:4326"
    assert q["bbox"] == "22,44,40.5,52.5"
    assert (q["width"], q["height"]) == ("1480", "680")
    assert q["format"] == "image/jpeg"


def _jpeg(w: int, h: int) -> bytes:
    sof = b"\xff\xc0\x00\x11\x08" + h.to_bytes(2, "big") + w.to_bytes(2, "big") + b"\x03" + b"\x00" * 9
    return b"\xff\xd8" + b"\xff\xe0\x00\x04JF" + sof + b"\xff\xd9"


def test_jpeg_size_reads_sof_marker():
    assert bm.jpeg_size(_jpeg(1480, 680)) == (1480, 680)
    with pytest.raises(ValueError):
        bm.jpeg_size(b"<ServiceExceptionReport/>")


def test_fetch_satellite_retries_on_429_then_returns_jpeg():
    calls = []

    def handler(req: httpx.Request) -> httpx.Response:
        calls.append(req)
        if len(calls) == 1:
            return httpx.Response(429)
        return httpx.Response(200, content=_jpeg(1480, 680), headers={"content-type": "image/jpeg"})

    with httpx.Client(transport=httpx.MockTransport(handler)) as c:
        data = bm.fetch_satellite(c, pause_s=0)
    assert len(calls) == 2
    assert bm.jpeg_size(data) == (1480, 680)


def test_fetch_satellite_rejects_wms_error_xml():
    def handler(req: httpx.Request) -> httpx.Response:
        return httpx.Response(200, content=b"<ServiceExceptionReport/>", headers={"content-type": "text/xml"})

    with httpx.Client(transport=httpx.MockTransport(handler)) as c, pytest.raises(RuntimeError):
        bm.fetch_satellite(c, pause_s=0)


# --- AC4: обрізання по рамці ---


def test_clip_line_cuts_segment_at_frame_edge():
    out = bm.clip_line([(20.0, 48.0), (30.0, 48.0)])
    assert out == [[(22.0, 48.0), (30.0, 48.0)]]


def test_clip_line_outside_frame_is_dropped():
    assert bm.clip_line([(10.0, 10.0), (15.0, 12.0)]) == []


def test_clip_line_leaving_and_reentering_gives_two_pieces():
    out = bm.clip_line([(30.0, 50.0), (30.0, 55.0), (35.0, 55.0), (35.0, 50.0)])
    assert len(out) == 2
    assert all(_inside(p) for piece in out for p in piece)
    assert out[0][-1] == (30.0, 52.5) and out[1][0] == (35.0, 52.5)


def test_clip_ring_keeps_polygon_inside_frame_and_closed():
    ring = [(39.0, 50.0), (42.0, 50.0), (42.0, 51.0), (39.0, 51.0), (39.0, 50.0)]
    out = bm.clip_ring(ring)
    assert out[0] == out[-1]
    assert all(_inside(p) for p in out)
    assert max(p[0] for p in out) == pytest.approx(40.5)
    assert bm.clip_ring([(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 0.0)]) == []


# --- AC4: спрощення не порожнє ---


def test_simplify_keeps_ends_and_is_not_empty():
    line = [(22.0 + i * 0.001, 48.0 + (0.002 if i % 2 else 0.0)) for i in range(1001)]
    out = bm.simplify(line, bm.TOL)
    assert 2 <= len(out) < 50
    assert out[0] == line[0] and out[-1] == line[-1]


def test_simplify_keeps_real_bend():
    out = bm.simplify([(22.0, 48.0), (23.0, 49.0), (24.0, 48.0)], bm.TOL)
    assert len(out) == 3


# --- AC2: shapefile → GeoJSON ---


def _shapes(tmp: Path) -> tuple[Path, Path]:
    rv = tmp / "rivers"
    w = shapefile.Writer(str(rv), shapeType=shapefile.POLYLINE)
    w.field("name", "C")
    w.field("name_uk", "C")
    w.line([[(20.0, 47.0), (30.0, 47.0), (30.005, 47.001), (31.0, 47.0)]])
    w.record("Dnipro", "Дніпро")
    w.line([[(0.0, 0.0), (1.0, 1.0)]])
    w.record("Far", "")
    w.close()
    lk = tmp / "lakes"
    w = shapefile.Writer(str(lk), shapeType=shapefile.POLYGON)
    w.field("name", "C")
    w.field("name_uk", "C")
    w.poly([[(33.0, 47.0), (33.0, 48.0), (34.0, 48.0), (34.0, 47.0), (33.0, 47.0)]])
    w.record("Lake", "")
    w.close()
    return rv.with_suffix(".shp"), lk.with_suffix(".shp")


def test_build_water_is_clipped_geojson(tmp_path: Path):
    rivers, lakes = _shapes(tmp_path)
    gj = bm.build_water(rivers, lakes)
    assert gj["type"] == "FeatureCollection"
    kinds = sorted(f["properties"]["kind"] for f in gj["features"])
    assert kinds == ["lake", "river"]
    river = next(f for f in gj["features"] if f["properties"]["kind"] == "river")
    assert river["properties"]["name"] == "Дніпро"
    for f in gj["features"]:
        pts = _coords(f["geometry"])
        assert pts and all(_inside(p) for p in pts)


# --- AC1/AC2/AC4: закомічені файли ---


def test_committed_satellite_jpg_size_and_dimensions():
    p = STATIC / "satellite.jpg"
    assert p.stat().st_size <= 400 * 1024
    w, h = bm.jpeg_size(p.read_bytes())
    assert abs(w - 1480) <= 20 and abs(h - 680) <= 20


def test_committed_water_json_size_and_frame():
    p = STATIC / "water.json"
    assert p.stat().st_size <= 300 * 1024
    gj = json.loads(p.read_text("utf-8"))
    assert gj["type"] == "FeatureCollection"
    kinds = {f["properties"]["kind"] for f in gj["features"]}
    assert kinds == {"river", "lake"}
    for f in gj["features"]:
        pts = _coords(f["geometry"])
        assert pts and all(_inside(p) for p in pts)


def test_hi_boxes_cover_frame_without_gaps():
    from sky.basemap.build import BBOX, HI_GRID, hi_boxes

    boxes = dict(hi_boxes())
    assert len(boxes) == HI_GRID * HI_GRID
    nw, se = boxes["satellite-hi-00.jpg"], boxes[f"satellite-hi-{HI_GRID - 1}{HI_GRID - 1}.jpg"]
    assert (nw[0], nw[3]) == (BBOX[0], BBOX[3])
    assert abs(se[2] - BBOX[2]) < 1e-9 and abs(se[1] - BBOX[1]) < 1e-9
    assert abs(boxes["satellite-hi-00.jpg"][2] - boxes["satellite-hi-01.jpg"][0]) < 1e-9


def test_wms_url_takes_box_and_size():
    from sky.basemap.build import wms_url

    u = wms_url((22, 48.25, 31.25, 52.5), 3200, 1470)
    assert "width=3200" in u and "height=1470" in u and "bbox=22%2C48.25%2C31.25%2C52.5" in u
