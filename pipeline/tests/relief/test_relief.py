"""Рельєф (issue #98): сітка, море → null, відмивка, PNG, повтор після 429 — без мережі."""

import json
import struct
import zlib

import httpx
import numpy as np

from sky.relief import build as rb


def _client(elev_of, fail_first: int = 0) -> tuple[httpx.Client, list[int]]:
    calls = [0]

    def handler(req: httpx.Request) -> httpx.Response:
        calls[0] += 1
        if calls[0] <= fail_first:
            return httpx.Response(429, json={"error": True})
        lats = [float(x) for x in req.url.params["latitude"].split(",")]
        lons = [float(x) for x in req.url.params["longitude"].split(",")]
        assert len(lats) <= rb.BATCH
        return httpx.Response(200, json={"elevation": [elev_of(a, o) for a, o in zip(lats, lons, strict=True)]})

    return httpx.Client(transport=httpx.MockTransport(handler)), calls


def test_grid_covers_map_box():
    nr, nc, pts = rb.grid()
    assert (nr, nc) == (58, 124)
    assert pts[0] == (44.0, 22.0) and pts[-1] == (
        52.55,
        40.45,
    )  # крок 0,15° не ділить рамку націло — останній вузол ≥ межі
    assert len(pts) == nr * nc


def test_sea_is_null_land_is_int():
    assert rb.to_elev([0.0, -3.0, None, 169.4, 2025.0]) == [None, None, None, 169, 2025]


def test_build_writes_files(tmp_path, monkeypatch):
    monkeypatch.setattr(rb, "BACKOFF_S", 0)
    # «гора» біля Говерли, море на півдні
    client, calls = _client(
        lambda a, o: 0.0 if a < 45.5 else 150.0 + 2000.0 * max(0, 1 - abs(a - 48.2) - abs(o - 24.5)), fail_first=1
    )
    d = rb.build(out=tmp_path, client=client, pause_s=0, cache=tmp_path / "raw.json")
    js = json.loads((tmp_path / "relief.json").read_text())
    assert js["source"] == "cop-dem" and js["nr"] * js["nc"] == len(js["elev"])
    assert js["elev"][0] is None  # 44° пн. ш. — море
    assert max(v for v in d["elev"] if v) > 1800
    assert calls[0] == len(range(0, js["nr"] * js["nc"], rb.BATCH)) + 1  # +1 — повтор після 429
    p = (tmp_path / "relief.png").read_bytes()
    assert p[:8] == b"\x89PNG\r\n\x1a\n"
    w, h = struct.unpack(">II", p[16:24])
    assert (w, h) == (rb.WIDTH, rb.HEIGHT)


def test_png_roundtrip():
    a = np.zeros((2, 3, 4), dtype=np.uint8)
    a[1, 2] = (10, 20, 30, 255)
    p = rb.png(a)
    idat = p[p.index(b"IDAT") + 4 : p.index(b"IEND") - 8]
    raw = zlib.decompress(idat)
    assert len(raw) == 2 * (1 + 3 * 4) and raw[-4:] == bytes((10, 20, 30, 255))


def test_light_from_northwest():
    """Схил, звернений на північний захід, світліший за звернений на південний схід."""
    nw = rb.hill(np.array([0.5]), np.array([-0.5]))  # висота росте на південний схід → схил дивиться на NW
    se = rb.hill(np.array([-0.5]), np.array([0.5]))
    flat = rb.hill(np.array([0.0]), np.array([0.0]))
    assert nw[0] > flat[0] > se[0]


def test_sea_transparent_land_opaque():
    nr, nc, _ = rb.grid()
    elev = [None if r < 10 else 100 for r in range(nr) for _c in range(nc)]  # південні 10 рядків — море
    rgba = rb.hillshade(elev, nr, nc, w=60, h=40)
    assert rgba[-1, 15, 3] == 0  # низ картинки — південь — прозорий
    assert rgba[0, 15, 3] == 255


def test_resume_from_cache(tmp_path, monkeypatch):
    """Обрив після частини запитів → наступний запуск докачує лише решту."""
    nr, nc, pts = rb.grid()
    cache = tmp_path / "raw.json"
    cache.write_text(json.dumps({"step": rb.STEP, "n": len(pts), "raw": [100.0] * (rb.BATCH * 3)}))
    client, calls = _client(lambda a, o: 200.0)
    rb.build(out=tmp_path, client=client, pause_s=0, cache=cache)
    assert calls[0] == len(range(rb.BATCH * 3, len(pts), rb.BATCH))
