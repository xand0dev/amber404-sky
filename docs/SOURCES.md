# Джерела

Кожне джерело даних, ліміт дрона чи факт для пітчу — рядок у своєму розділі: що, звідки (URL), ліцензія, дата перевірки.

## F0

| Що | Джерело | Ліцензія | Перевірено |
|---|---|---|---|

| Онлайн-підкладка «Вулиці» (SPEC §7.6a v16), лише за вибором людини | https://tile.openstreetmap.org/{z}/{x}/{y}.png — OpenStreetMap Standard | ODbL, атрибуція «© OpenStreetMap contributors»; правила тайлів: https://operations.osmfoundation.org/policies/tiles/ (помірне використання) | 2026-11-28: CORS `*`, z5–19 |
| Онлайн-підкладка «Супутник 10 м» (SPEC §7.6a v16) | https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg — Sentinel-2 cloudless by EOX | CC BY-NC-SA 4.0 (некомерційно), атрибуція як у `s2cloudless` | 2026-11-28: CORS для github.io, z5–15 |
| Різкий супутник `static/satellite-hi-{00,01,10,11}.jpg` (#162): 4 WMS GetMap по 3200×1470 на чверті рамки | https://tiles.maps.eox.at/wms `layers=s2cloudless-2020` | як `s2cloudless` | 2026-11-28: 4 файли, 0,9–1,3 МБ |

## F1

| Що | Джерело | Ліцензія | Перевірено |
|---|---|---|---|
| Прогноз: вітер 10/80/120/180 м і 1000–850 гПа (+ геопотенціал), пориви 10 м, t 2 м, опади, rh, видимість; мульти-точки ≤ 120, `wind_speed_unit=ms`, `forecast_hours=48` | https://api.open-meteo.com/v1/forecast | CC BY 4.0, **лише некомерційно**; < 600/хв, < 10 000/добу (https://open-meteo.com/en/terms) | 2026-11-27: 684 точки, 6 пакетів, 100 % не null; координати зсуваються до вузла моделі |
| План Б для комерційної версії: ECMWF Open Data (IFS 0.25°/0.1°, крок 3 год, вітер 10/100 м, 1000/925/850 гПа, без видимості, GRIB2) | https://www.ecmwf.int/en/forecasts/datasets/open-data | CC BY 4.0 + ECMWF Terms of Use, комерційно з атрибуцією «© ECMWF» | 2026-11-27: документація; GRIB не завантажували. Деталі — `specs/F1/spec.md` |

## F2

| Що | Джерело | Ліцензія | Перевірено |
|---|---|---|---|
| Супутникова мозаїка `static/satellite.jpg` (SPEC §7.6a, §8 `s2cloudless`): один WMS GetMap `layers=s2cloudless-2020`, EPSG:4326, bbox 22,44,40.5,52.5, 1480×680 | https://tiles.maps.eox.at/wms — Sentinel-2 cloudless by EOX — Copernicus Sentinel data 2020 | CC BY-NC-SA 4.0 (некомерційно), атрибуція «Sentinel-2 cloudless by EOX — Copernicus Sentinel data 2020» | 2026-11-27: `python -m sky.basemap.build` → 1480×680, 244 КБ |
| Ріки й озера `static/water.json` (SPEC §7.6a, §8 `ne-water`): `ne_10m_rivers_lake_centerlines` + `ne_10m_lakes`, обрізано по рамці, Дуглас-Пекер 0,01° | Natural Earth 1:10m physical, https://naciscdn.org/naturalearth/10m/physical/ | public domain | 2026-11-27: 27 рік + 8 озер, 32 КБ. NE ще показує Каховське водосховище (спущене з 06.2023) — дані як є |
| Рельєф `static/relief.{json,png}` (SPEC §7.6a, §8 `cop-dem`): сітка 0,15° (58×124), ≤ 100 точок за запит, відмивка 1480×680 зі світлом з пн.-зх. | https://api.open-meteo.com/v1/elevation — Copernicus DEM GLO-90 | Copernicus DEM: © DLR e.V. 2010–2014 та © Airbus Defence and Space GmbH 2014–2018, надано за програмою Copernicus ЄС; Open-Meteo CC BY 4.0, некомерційно | 2026-11-28: `python -m sky.relief.build` → 6328 точок суші, макс. 2254 м (Фегераш), Київ 91 м, Говерла 1150 м (крок 0,15° не влучає у вершину); 28 КБ + 228 КБ |

## F3

| Що | Джерело | Ліцензія | Перевірено |
|---|---|---|---|
| Назви міст англійською на карті (#116): транслітерація українського алфавіту | Постанова КМУ № 55 від 27.01.2010 «Про впорядкування транслітерації українського алфавіту латиницею» (zakon.rada.gov.ua/laws/show/55-2010-п) | офіційний документ, не об'єкт авторського права | 2026-11-28, 16 міст з cities.json → Kyiv, Kharkiv, Zaporizhzhia… (unit-тест translit.test.ts) |
| Вузький шрифт слова вердикту (#88): Roboto Condensed 700, підмножини cyrillic і latin, woff2 у `web/src/ui/fonts/` | Google Fonts — https://fonts.google.com/specimen/Roboto+Condensed (файли з fonts.gstatic.com, v31) | SIL Open Font License 1.1 | 2026-11-28; Barlow Condensed відкинуто — на Google Fonts без кирилиці |

## F4

| Що | Джерело | Ліцензія | Перевірено |
|---|---|---|---|
| recon (клас Mavic): вітер 12 м/с, −10…40 °C, 958 г, 43 хв без вітру (лаб.) | DJI, специфікація Mavic 3 Pro — https://www.dji.com/mavic-3-pro/specs | сторінка виробника | 2026-11-27, пошук; у каталозі 30 хв — консервативно, assumption |
| recon (клас Mavic), друге джерело: вітер 10 м/с, пориви 10 м/с, 45 хв, 0–500 м; мороз −20 °C → 70% часу — «ок» | анонімна анкета оператора 28.11, 1 відповідь — `docs/pitch/interviews.md`, «Анкета 1» (#150) | — | рішення Олі 28.11: числа як у SPEC §7.3 (вітер 12, пориви 15), анкета — у `source` профілю й на екрані; оператор суворіший за паспорт, тож наш вердикт для recon оптимістичніший за практику |
| wingE (клас «Лелека-100»): ≈5 кг, до 2.5 год, крейсер ≈70 км/год, вітер до 20 м/с (за виробником), 12 м/с — робочі умови | https://en.wikipedia.org/wiki/DeViRo_Leleka-100 , https://www.army-technology.com/projects/leleka-100-unmanned-aerial-vehicle-uav-ukraine/ | вторинні джерела | 2026-11-27; джерела розходяться (вітер 12 чи 20 м/с, час 2–3.5 год) — звірити з DeViRo |
| agro (клас Agras T40): −20…50 °C; зависання 18 хв @ 50 кг, 7 хв @ 90 кг, 6 хв @ 101 кг | DJI, https://www.dji.com/t40/specs і https://dji.com/t40/faq | сторінка виробника | 2026-11-27; вітер 6 м/с — лише з даних продавців, не з DJI |
| heavy: ліміт вітру 7 м/с, 8 — забагато | оператор, дзвінок 26.11 (SPEC §7.3) | — | слова оператора; маса, час, °C — assumption |
| fpv7, fpv10, wingF | — | — | паспорта немає (класи, а не моделі): усе `assumption`, звірити з операторами (Максим, #4) |
| Коефіцієнти енергії: холод 1 → 0.7 при −20 °C, вантаж (m/(m+вантаж))^1.5, резерв 20% | SPEC §7.3a | — | `assumption`, на екрані підписано |
| Нижня межа хмар ≈ 125 × (t − td) | SPEC §7.2, емпіричне правило | — | `assumption` |

**Розбіжності з каталогом SPEC §7.3 — рішення Олі 27.11: ліміти лишаємо як у SPEC (agro 0 °C, wingE 15 м/с), джерела показуємо на екрані.** agro — DJI T40 працює від −20 °C, а в каталозі мінімум 0 °C; wingE — виробник заявляє вітер до 20 м/с, в інших джерелах 12 м/с як робочі умови, у каталозі 15 м/с.
