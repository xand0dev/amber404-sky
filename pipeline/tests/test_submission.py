"""Подача на Taikai (SPEC §9, «Подача»): опис до 2 сторінок, ролі, кейс 2, Copernicus і Galileo, список API."""

import re
from pathlib import Path

SUBMISSION = Path(__file__).resolve().parents[2] / "docs" / "pitch" / "submission.md"

# ≈ 2 сторінки A4 англійського тексту (assumption: ~500 слів на сторінку).
MAX_WORDS = 1000

TEAM = ["@xand0dev", "@kingsneverdie17", "@Bulka0801", "@gonivanko", "@oljyaaa"]

# id джерел із SPEC §8 — кожне має бути у списку API.
SOURCE_URLS = [
    "api.open-meteo.com",
    "data.ecmwf.int",
    "cds.climate.copernicus.eu",
    "archive-api.open-meteo.com",
    "celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle",
    "services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json",
    "ne_10m_admin_0_countries_ukr",
]


def _text() -> str:
    return SUBMISSION.read_text(encoding="utf-8")


def _section(text: str, heading: str) -> str:
    m = re.search(rf"^## {re.escape(heading)}\n(.*?)(?=^## |\Z)", text, re.M | re.S)
    assert m, f"немає розділу «## {heading}»"
    return m.group(1)


def test_exists_and_in_english():
    text = _text()
    assert text.startswith("# AMBER Sky")
    assert not re.search(r"[а-яіїєґ]", _section(text, "Description").lower())


def test_description_fits_two_pages():
    words = re.findall(r"\b\w[\w'’-]*\b", _section(_text(), "Description"))
    assert 0 < len(words) <= MAX_WORDS


def test_challenge_2():
    text = _text()
    assert "Challenge 2" in text
    assert "Space-enabled crisis response and civil resilience" in text


def test_copernicus_and_galileo():
    eu = _section(_text(), "EU space data")
    assert "Copernicus" in eu and "ERA5" in eu
    assert "Galileo" in eu and "PDOP" in eu


def test_roles_cover_whole_team():
    roles = _section(_text(), "Team and roles")
    for handle in TEAM:
        assert handle in roles, handle
    assert "submits" in roles.lower()


def test_api_list_has_every_spec_source():
    apis = _section(_text(), "APIs and data sources")
    for url in SOURCE_URLS:
        assert url in apis, url
