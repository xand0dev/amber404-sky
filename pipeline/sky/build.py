"""Збірка даних (SPEC §5): кожне джерело → свій файл у web/public/data/. Змінює лише власник F0.

Порядок: справжнє джерело (модулі F1/F2) → якщо модуля ще нема або він упав, файл береться з mocks,
а `meta.mock = true` і статус джерела — `nodata` з причиною. Дані іншого джерела не підставляються.

План Б §12 (issue #93): модуль може віддати цілий попередній прогноз зі старим часом у `_fetchedAt`.
Тоді `meta.generatedAt` — найстаріший `fetchedAt` серед справжніх джерел, і плашка віку на сайті чесна.

  uv run python -m sky.build --mock        # лише синтетика
  uv run python -m sky.build               # справжні джерела, де готові
"""

from __future__ import annotations

import argparse
import importlib
import json
from datetime import UTC, datetime
from pathlib import Path

from .contracts import PROFILE_DIR, SourceMeta, split_profile
from .mocks import build_mock

OUT = Path(__file__).resolve().parents[2] / "web" / "public" / "data"

# файл → (модуль з функцією fetch(now) -> dict, id джерела)
REAL = {
    "profile": ("sky.forecast.fetch", "openmeteo"),
    "galileo": ("sky.galileo.fetch", "celestrak-galileo"),
    "kp": ("sky.space.fetch", "noaa-kp"),
    "climate": ("sky.climate.fetch", "era5"),
}


def write(name: str, data: dict, out: Path) -> None:
    out.mkdir(parents=True, exist_ok=True)
    (out / f"{name}.json").write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")


def write_profile(prof: dict, times: list[str], out: Path) -> None:
    """§6.2 (#165): profile/index.json + profile/h00…h47.json; старого profile.json більше немає."""
    index, hours = split_profile(prof, times)
    d = out / PROFILE_DIR
    for hf, h in zip(hours, index["hours"], strict=True):
        write(h["file"].removesuffix(".json"), hf, d)
    write("index", index, d)  # index останнім: поки його немає, сайт не бачить напівзаписаних годин
    (out / "profile.json").unlink(missing_ok=True)


def generated_at(statuses: list[dict], gen: str, mock_only: bool) -> str:
    """Вік прогнозу = найстаріше справжнє джерело (ok / partial); без справжніх — час збірки."""
    if mock_only:
        return gen
    real = [s["fetchedAt"] for s in statuses if s["status"] in ("ok", "partial")]
    return min(real, default=gen)  # ISO-8601 UTC «...Z» порівнюється як рядок


def build(mock_only: bool, out: Path = OUT) -> dict:
    now = datetime.now(UTC)
    gen = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    mock = build_mock(now)
    files = dict(mock)
    statuses: list[dict] = []
    any_mock = mock_only
    for name, (mod, sid) in REAL.items():
        if mock_only:
            statuses.append(SourceMeta(sid, "ok", gen, "MOCK").to_json())
            continue
        try:
            files[name] = importlib.import_module(mod).fetch(now)
            at = files[name].pop("_fetchedAt", None) or gen
            statuses.append(
                SourceMeta(sid, files[name].pop("_status", "ok"), at, files[name].pop("_note", "")).to_json()
            )
        except ModuleNotFoundError:
            any_mock = True
            statuses.append(SourceMeta(sid, "nodata", gen, "модуль ще не готовий — MOCK").to_json())
        except Exception as e:  # noqa: BLE001 — будь-яка помилка джерела → nodata з причиною
            any_mock = True
            statuses.append(SourceMeta(sid, "nodata", gen, f"{type(e).__name__}: {e}"[:200]).to_json())
    meta = dict(mock["meta"], generatedAt=generated_at(statuses, gen, mock_only), mock=any_mock, sources=statuses)
    if "profile" in files and not mock_only and files["profile"] is not mock["profile"]:
        meta["times"] = files["profile"].get("times", meta["times"])
        files["profile"].pop("times", None)
    files["meta"] = meta
    for name, data in files.items():
        if name == "profile":
            write_profile(data, meta["times"], out)
        else:
            write(name, data, out)
    return meta


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mock", action="store_true")
    ap.add_argument("--out", type=Path, default=OUT)
    a = ap.parse_args()
    meta = build(a.mock, a.out)
    print(
        json.dumps(
            {"mock": meta["mock"], "sources": [(s["id"], s["status"]) for s in meta["sources"]]}, ensure_ascii=False
        )
    )


if __name__ == "__main__":
    main()
