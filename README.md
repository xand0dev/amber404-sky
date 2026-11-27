# AMBER//404 Sky

A dual-use weather map for drone crews over Ukraine, including agricultural operators, emergency responders and defence crews. It brings together wind by altitude, gusts, cloud base, icing, visibility and a GO / CAUTION / NO-GO assessment for a selected drone profile, using weather forecasts, Copernicus ERA5 climate data and Galileo satellite geometry.

This is a demonstration model, not an official weather forecast. GO means **conditions within the selected profile**, not a guarantee of safety. Unsourced drone limits and simplified calculations are labelled `assumption`; missing data is not GO. The scope is weather only: no targeting, strike planning or drone tracking.

**Live site:** [xand0dev.github.io/amber404-sky](https://xand0dev.github.io/amber404-sky/)

Built by team AMBER//404 for the 12th CASSINI Hackathon, challenge 2: “Space-enabled crisis response and civil resilience”.

## Run locally

Prerequisites: Git, Make, Python 3.12 or newer, uv, and Node.js with npm. CI uses Node.js 22.

From the repository root:

```bash
make setup   # install Python dependencies with uv and web dependencies with npm ci
make check   # generate mock data; run lint, types, tests, schema checks and build
make dev     # generate mock data and start Vite at http://localhost:5173
```

`make check` runs ruff, pytest, ESLint, TypeScript, Vitest, JSON schema validation and the production web build. Both `make check` and `make dev` generate synthetic data marked **MOCK**; no data-service credentials are needed for this local workflow.

`make data` runs the source collectors that are implemented. The current builder falls back to mock files when a collector is unavailable or fails, setting the source status to `nodata` and enabling the MOCK flag. Check the displayed source status and forecast timestamp before interpreting the map.

## Architecture

```text
Data sources (SPEC section 8)
    -> pipeline/ (Python collectors and builder)
    -> web/public/data/ (static JSON validated against contracts/)
    -> web/ (React + TypeScript PWA, Canvas 2D + SVG)
    -> GitHub Pages
```

There is no backend server and no API key in the browser. The web app reads static JSON through `web/src/contracts/`. Calculations live in `web/src/core/` as pure TypeScript without DOM dependencies. Canvas renders weather fields and wind particles; SVG renders boundaries and city labels.

The PWA caches the app and the latest data package for offline use. User points and routes stay in the browser; the client downloads the same static data files for everyone rather than sending user coordinates to a server.

[deploy.yml](.github/workflows/deploy.yml) collects data, validates schemas, builds the site and deploys to Pages on pushes to `main`, manual dispatch and a scheduled refresh. This repository currently combines those steps in that workflow; SPEC describes separate data and deployment workflows.

## Repository structure

```text
CONSTITUTION.md          Product principles and scope
AGENTS.md               Agent workflow and ownership rules
Makefile                Setup, data, checks and development commands
contracts/              JSON schemas shared by pipeline and web
pipeline/sky/           Python builder, mocks and source modules
pipeline/tests/         Pipeline and contract tests
web/src/app/            App shell, data loading and PWA integration
web/src/contracts/      Typed access to static JSON
web/src/core/           Weather and profile calculations
web/src/features/       Map, layers, timeline, panel and route UI
web/public/data/        Generated JSON; static/ holds profiles, borders and cities
web/e2e/                Browser smoke tests
specs/                  Feature specifications F0–F4
docs/                   Product SPEC, sources, agent pipeline and pitch
scripts/                Issue runner
.github/workflows/      CI, automerge and Pages deployment
```

The [product SPEC](docs/SPEC.md) is the source of truth. See the [F0 specification](specs/F0/spec.md), [constitution](CONSTITUTION.md) and [agent rules](AGENTS.md) for contracts, ownership and contribution constraints.

## Data sources and licences

The following records the sources and licence/access descriptions in [SPEC section 8](docs/SPEC.md). It is a source catalogue, not a claim that every collector is implemented or that a displayed value is live.

| Source ID | Provider and use | Licence / access recorded in SPEC |
|---|---|---|
| `openmeteo` | Open-Meteo Forecast API: weather forecast and wind profile | CC BY 4.0; free API access is non-commercial only. |
| `ecmwf-open` | ECMWF Open Data (IFS): fallback and proposed commercial forecast source | Licence still needs verification; do not assume commercial clearance. |
| `era5` | Copernicus ERA5 via CDS API or Open-Meteo Archive (`models=era5`): historical climate statistics | Copernicus licence / CC BY 4.0, depending on access route. CDS requires an account. |
| `celestrak-galileo` | CelesTrak Galileo TLEs: satellite orbits for visibility and PDOP calculations | Open access; SPEC does not identify a redistribution licence. |
| `noaa-kp` | NOAA SWPC planetary K-index forecast: geomagnetic conditions | Open access; SPEC does not identify a redistribution licence. |
| `ne-ukr` | Natural Earth `ne_10m_admin_0_countries_ukr`: boundaries with Crimea as Ukraine | Natural Earth public domain; Ukraine point of view. |

Source provenance belongs in [docs/SOURCES.md](docs/SOURCES.md). Source status and generation time accompany the data; mock data and assumptions must remain visible. Keep any Copernicus CDS credentials in `.env` or GitHub Secrets, never in code or browser assets.

**Code licence discrepancy:** [CONSTITUTION.md](CONSTITUTION.md) specifies Apache-2.0, while the current [LICENSE](LICENSE) file contains MIT. This discrepancy remains unresolved and needs reconciliation by the project owner. Data licences above are separate from the code licence.

## Agent conveyor

The [agent pipeline](docs/PIPELINE.md) describes how labelled GitHub issues become changes: a runner selects an unblocked issue, creates an isolated worktree and feature branch, and starts an agent without interactive questions. The agent reads the spec, writes failing tests, implements the change, runs `make check` and commits. The runner pushes and opens the PR.

CI checks the code, browser smoke tests and allowed paths. Eligible green PRs are squash-merged automatically; shared files require owner review. A merged change triggers Pages deployment. Each issue has one branch and one PR, with acceptance evidence, assumptions, contract requests and an AI log entry in the PR body.

## Team

| Feature | Owner | Responsibility |
|---|---|---|
| F0 | Oleksandr (@xand0dev) | Architecture, scaffold, contracts, assessment rules and submission |
| F1 | Maksym (@kingsneverdie17) | Wind profile and operator interviews |
| F2 | Nastia (@Bulka0801) | Galileo, Kp, ERA5 and business model |
| F3 | Ivan (@gonivanko) | Map, layers and timeline |
| F4 | Olia (@oljyaaa) | Point panel, routes and drone profiles |

Nastia and Maksym present the pitch; Ivan is the on-site contact. Roles follow [SPEC section 9](docs/SPEC.md).
