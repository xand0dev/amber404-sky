"""Перегенерувати еталон для F2-AC1 (потрібен skyfield, у залежностях його ще нема):

cd pipeline && uv run --with skyfield python -m tests.space.make_galileo_reference
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from tests.space.skyfield_reference import reference

HERE = Path(__file__).parent
TLE = HERE / "galileo_2026-11-27.tle"
OUT = HERE / "galileo_reference_kyiv.json"
KYIV = (50.45, 30.52)
T0 = datetime(2026, 11, 27, 12, tzinfo=UTC)
TIMES = [T0 + timedelta(hours=h) for h in range(0, 48, 3)]


def main() -> None:
    rows = reference(TLE.read_text(), *KYIV, TIMES)
    data = {"tle": TLE.name, "lat": KYIV[0], "lon": KYIV[1], "elevationMaskDeg": 10, "by": "skyfield", "rows": rows}
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
