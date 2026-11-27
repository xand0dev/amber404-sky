"""Еталон F2-AC1: видимі супутники Galileo > маски й PDOP, пораховані skyfield (SGP4/SDP4) + numpy.

Не залежить від коду sky.galileo — незалежна перевірка. Потрібен skyfield (див. «Contract requests» у PR).
"""

from __future__ import annotations

from datetime import datetime
from io import BytesIO


def reference(tle_text: str, lat: float, lon: float, times: list[datetime], mask_deg: float = 10.0) -> list[dict]:
    import numpy as np
    from skyfield.api import load, wgs84
    from skyfield.iokit import parse_tle_file

    ts = load.timescale(builtin=True)
    sats = list(parse_tle_file(BytesIO(tle_text.encode()), ts))
    site = wgs84.latlon(lat, lon)
    out = []
    for when in times:
        t = ts.from_datetime(when)
        rows = []
        for sat in sats:
            alt, az, _ = (sat - site).at(t).altaz()
            if alt.degrees > mask_deg:
                e, a = alt.radians, az.radians
                rows.append([np.cos(e) * np.sin(a), np.cos(e) * np.cos(a), np.sin(e), 1.0])
        pdop = None
        if len(rows) >= 4:
            g = np.array(rows)
            q = np.linalg.inv(g.T @ g)
            pdop = float(np.sqrt(q[0, 0] + q[1, 1] + q[2, 2]))
        out.append({"t": when.strftime("%Y-%m-%dT%H:%M:%SZ"), "visible": len(rows), "pdop": pdop})
    return out
