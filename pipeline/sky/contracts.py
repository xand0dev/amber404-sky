"""Контракти даних (SPEC §6) на боці pipeline. Змінює лише власник F0."""

from __future__ import annotations

from dataclasses import dataclass

GRID = {"lat0": 52.5, "lon0": 22.0, "step": 0.5, "nr": 18, "nc": 38}
LEVELS = [10, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800, 900, 1000]
HOURS = 48
NPTS = GRID["nr"] * GRID["nc"]

SOURCES = {
    "openmeteo": ("Open-Meteo", "CC BY 4.0, non-commercial"),
    "ecmwf-open": ("ECMWF Open Data (IFS)", "CC BY 4.0"),
    "era5": ("Copernicus ERA5", "Copernicus licence"),
    "celestrak-galileo": ("CelesTrak Galileo GP", "open"),
    "noaa-kp": ("NOAA SWPC Kp forecast", "public domain"),
    "ne-ukr": ("Natural Earth, Ukraine POV", "public domain"),
}


def point(r: int, c: int) -> tuple[float, float]:
    """(lat, lon) вузла сітки. Рядок 0 = північ, стовпець 0 = захід, i = r * nc + c."""
    return GRID["lat0"] - r * GRID["step"], GRID["lon0"] + c * GRID["step"]


@dataclass
class SourceMeta:
    id: str
    status: str  # ok | partial | nodata
    fetchedAt: str
    note: str = ""

    def to_json(self) -> dict:
        name, lic = SOURCES.get(self.id, (self.id, ""))
        return {
            "id": self.id,
            "name": name,
            "license": lic,
            "fetchedAt": self.fetchedAt,
            "status": self.status,
            "note": self.note,
        }
