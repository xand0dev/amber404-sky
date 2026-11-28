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


# §6.2 (#165): профіль на диску розбитий за годинами — profile/index.json + profile/h00…h47.json,
# щоб перший екран вантажив лише поточну годину. У пам'яті (модулі джерел, тести) — цілий профіль.
PROFILE_DIR = "profile"
LEVEL_VARS = ("spd", "dir")  # [рівень][точка] у файлі години
SURFACE_VARS = ("gust", "temp", "precip", "rh", "vis")  # [точка]
VAR_UNITS = {
    "spd": "м/с × 10",
    "dir": "градуси, звідки дме",
    "gust": "м/с × 10, 10 м",
    "temp": "°C × 10, 2 м",
    "precip": "мм/год × 10",
    "rh": "%",
    "vis": "м / 100",
}


def hour_file(h: int) -> str:
    return f"h{h:02d}.json"


def split_profile(prof: dict, times: list[str]) -> tuple[dict, list[dict]]:
    """Цілий профіль → (index, файли годин). Значення не змінюються, лише перекладаються за годинами."""
    index = {
        "generatedAt": prof["generatedAt"],
        "sources": prof["sources"],
        "grid": GRID,
        "levels": prof["levels"],
        "vars": [{"id": k, "perLevel": k in LEVEL_VARS, "unit": VAR_UNITS[k]} for k in (*LEVEL_VARS, *SURFACE_VARS)],
        "hours": [{"t": t, "file": hour_file(h)} for h, t in enumerate(times)],
    }
    hours = [
        {
            "generatedAt": prof["generatedAt"],
            "hour": h,
            "t": t,
            **{k: [lvl[h] for lvl in prof[k]] for k in LEVEL_VARS},
            **{k: prof[k][h] for k in SURFACE_VARS},
        }
        for h, t in enumerate(times)
    ]
    return index, hours


def join_profile(index: dict, hours: list[dict]) -> dict:
    """Зворотне до split_profile. Години з іншого запуску (інший generatedAt) не змішуємо — ValueError."""
    if len(hours) != len(index["hours"]):
        raise ValueError("кількість годин не збігається з index")
    for h, hf in enumerate(hours):
        if hf.get("generatedAt") != index["generatedAt"] or hf.get("hour") != h:
            raise ValueError(f"година {h} не з цього запуску")
    return {
        "generatedAt": index["generatedAt"],
        "sources": index["sources"],
        "levels": index["levels"],
        **{k: [[hf[k][li] for hf in hours] for li in range(len(index["levels"]))] for k in LEVEL_VARS},
        **{k: [hf[k] for hf in hours] for k in SURFACE_VARS},
    }
