# AMBER Sky — Taikai submission (draft)

> **Чернетка** (F0, Олександр + Настя @Bulka0801) — готова до сб 01:00. Настя переносить у Taikai як чернетку, о 14:00 у неділю оновлює розділ «Status» і вставляє відео, **подає в нд о 15:00 CET** (запасний — Максим). Дедлайн — 16:00 Київ (14:00 UTC).
> Джерело правди — `docs/SPEC.md`. Чисел, яких немає в SPEC або на живому сайті, сюди не додаємо.

## Taikai fields

| Field | Value |
|---|---|
| Project name | AMBER Sky |
| Team | AMBER//404 |
| Challenge | Challenge 2 — Space-enabled crisis response and civil resilience |
| Tagline | Wind at every altitude and a GO / CAUTION / NO-GO verdict for your drone, hour by hour, over all of Ukraine. |
| Live demo | https://xand0dev.github.io/amber404-sky/ |
| Repository | https://github.com/xand0dev/amber404-sky (MIT) |
| Video | TODO (Настя, нд 14:00) |
| Pitch | Nastia and Maksym |

## Description

**AMBER Sky** is a weather map for drone crews over Ukraine. In 30 seconds a crew sees wind direction and speed at any altitude from 10 to 1000 m, the cloud base, gusts and icing, and gets a GO / CAUTION / NO-GO verdict with reasons for a specific drone class, for every hour of the next 48 hours.

**Problem.** Before every shift, drone crews of the Defence Forces of Ukraine decide whether to fly, at what altitude, and whether the battery will last the way back. The requirements come from a call with an experienced drone operator on 26 November: crews look at wind by altitude (the "small sky" up to about 90 m, layers up to 500 m) and the dew point (clouds), for any point on the map, and want to save and share the weather. Today they combine tools: Windy gives a map without a verdict; UAV Forecast gives a verdict without a map, for one point, often one subscription shared by five people. Wind that is fine at 10 m can ground a heavy multicopter at 120 m.

**Users.** Commanders and operators of FPV (7-10 inch), heavy multicopter and fixed-wing VTOL crews. The same engine serves a second, civilian market: agricultural drone operators in the field, and also emergency services (DSNS) and demining teams. Weather is dual-use; the product is weather only.

**What it does.**
- A live wind map of Ukraine: particles flow with the wind at the chosen altitude, colour shows speed. Layers: wind, cloud base, gusts, "Can fly" verdict, icing, temperature, visibility.
- Click any point: verdict with up to four reasons and numbers, the next flight window of at least 2 GO hours, and an hourly table of altitudes by hours.
- A 48-hour timeline with play: watch a front pass and see when the window opens.
- Seven drone classes (FPV 7 and 10 inch, recon quadcopter, heavy multicopter, electric and fuel fixed wing, agro drone) plus "my drone": mass, payload, battery or fuel. Flight time accounts for cold and payload, with a 20% reserve.
- Flight range: from a launch point, the area the drone can reach and return from in the current wind. A to B route: headwind and crosswind profile, time there and back, and the best altitude.
- Galileo panel: visible Galileo satellites above 10 degrees and Galileo-only PDOP for 16 regional centres; geomagnetic Kp index.
- Climate from Copernicus ERA5: for 5 cities, the share of hours per month in 2025 when each drone class would have been within its profile.

**How the verdict works.** NO-GO if wind or gusts exceed the drone limits, the drone would be inside cloud, temperature is below the minimum, precipitation exceeds the limit, or icing conditions apply. CAUTION near the limits, with visibility under 1 km, Kp of 5 or more, or weak Galileo geometry (fewer than 6 satellites or PDOP above 4). Otherwise GO, shown as "within profile", never as "safe". No data is shown as "no data", never as GO. Drone limits and the icing rule are marked as assumptions until checked against manufacturer data and operators.

**Phone first and OPSEC.** AMBER Sky is a static Progressive Web App on GitHub Pages: no backend, no accounts, no keys in the browser. The phone downloads the same forecast file as everyone else and never sends coordinates; saved points, routes and custom drones stay in the browser. After one visit it works offline with a banner showing the forecast age. The product answers one question only: can we fly, at what altitude, and where can we reach. No targets, no guidance, no front line, no tracking.

**How it is built.** A Python pipeline runs every 3 hours in GitHub Actions: it collects a 48-hour forecast on a 0.5 degree grid over Ukraine (684 points), interpolates wind (u, v) from model levels to 16 altitudes, computes Galileo visibility and PDOP from Celestrak orbits, reads Kp from NOAA, validates every file against JSON schemas and deploys static JSON. The web app is React and TypeScript with Canvas 2D and SVG; the verdict, flight range, route and energy logic is pure TypeScript, ready for a native app via Capacitor. Borders are the Natural Earth Ukraine point-of-view version (Crimea is Ukraine). The code was written during the hackathon by Claude Code and Codex agents from a specification; humans wrote the specification and check acceptance criteria. Every AI session is logged in the repository.

**Business.** Free for Defence Forces crews. Paid subscription for agricultural drone operators and service companies; the commercial version moves the forecast from Open-Meteo (non-commercial licence) to ECMWF Open Data. Details: `docs/pitch/business.md`.

**What is next.** Verify drone limits with manufacturers and crews; exclude Galileo satellites flagged unusable by the GSC; native app from the same code; offline map overlays from the crew's own map files.

## EU space data

- **Copernicus ERA5** (climate reanalysis): hourly wind at 10 m and 100 m, gusts, temperature, precipitation and humidity for 2025 in 5 cities. It gives the statistics forecast apps do not have: how many hours per month each drone class could fly. Accessed through the Copernicus Climate Data Store, with the Open-Meteo ERA5 archive as fallback.
- **Galileo**: orbits of the Galileo constellation, propagated with SGP4 every hour for 16 regional centres: number of satellites above a 10 degree mask and Galileo-only PDOP. It shows navigation quality independent of GPS, and weak geometry lowers the verdict to CAUTION.
- **ECMWF**: the forecast models behind the map assimilate satellite observations; ECMWF Open Data is the path for the commercial version.

## Team and roles

| Who | Role | Feature |
|---|---|---|
| Oleksandr @xand0dev | Architect, team lead: specification, data contracts, verdict engine, CI and the agent pipeline, PWA | F0 |
| Maksym @kingsneverdie17 | Weather: wind profile pipeline, interviews with drone operators; pitches; backup submitter | F1 |
| Nastia @Bulka0801 | Space and business: Galileo, Kp, ERA5 climate, business model; pitches and submits on Taikai | F2 |
| Ivan @gonivanko | Map: layers, wind particles, altitude slider, timeline; on site with organisers and mentors, tests the demo on a phone | F3 |
| Olia @oljyaaa | Point panel and data: panel, route, drone catalogue; F0 on duty at the weekend | F4 |

## APIs and data sources

| Source | Endpoint | What we use | Licence / access |
|---|---|---|---|
| Open-Meteo Forecast API | `https://api.open-meteo.com/v1/forecast` | 48-hour wind at 10/80/120/180 m and pressure levels 1000–850 hPa, gusts, temperature, precipitation, humidity, visibility; batches of up to 120 points | CC BY 4.0, non-commercial |
| ECMWF Open Data (IFS) | `https://data.ecmwf.int` | Plan B and commercial version | Licence to be checked |
| Copernicus ERA5 (CDS API) | `https://cds.climate.copernicus.eu` | Hourly climate 2025, 5 cities | Copernicus licence, account |
| Open-Meteo Historical (ERA5) | `https://archive-api.open-meteo.com/v1/archive` (`models=era5`) | ERA5 fallback | CC BY 4.0 |
| Celestrak GP, Galileo | `https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle` | Galileo orbits (TLE) | Open |
| NOAA SWPC Kp forecast | `https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json` | Kp, 3-hour intervals | Open |
| Natural Earth | `ne_10m_admin_0_countries_ukr` | Borders, Ukraine point of view | Public domain |

The app itself has no API server: it reads static JSON files (`meta.json`, `profile.json`, `galileo.json`, `kp.json`, `climate.json`) described by JSON schemas in `contracts/`.

## Status

Оновлює Настя в нд о 14:00 за живим сайтом; у Taikai — лише те, що реально працює (на момент чернетки, сб 28.11):

| Part | Draft | Sunday 14:00 |
|---|---|---|
| Verdict, flight window, flight range, route, energy (core) | merged | |
| Map, layers, 48-hour timeline, PWA offline | merged / in progress | |
| A to B route panel | merged | |
| Galileo visibility and PDOP | merged | |
| Real forecast pipeline (Open-Meteo) | in progress, site runs on MOCK data | |
| Kp, ERA5 climate | in progress | |

## Before submitting (checklist)
- [ ] Сайт показує справжній прогноз, не старший за 6 год, без бейджа MOCK.
- [ ] Розділ Description: прибрати пункти, яких немає на живому сайті.
- [ ] Відео й посилання на пітч у Taikai.
- [ ] Усі 5 учасників у проєкті на Taikai, проєкт позначено «completed».
