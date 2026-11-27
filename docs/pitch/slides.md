# AMBER Sky — five-slide pitch

Presenter notes: Nastia and Maksym present in English. This outline describes the product specified in the repository; show only features available in the demonstrated build. Keep source, forecast time, MOCK labels and missing-data or stale-data warnings visible. Use public demonstration imagery without crew locations or operational routes.

## Slide 1: Problem — shared weather needs across dual-use missions

- Emergency services (DSNS), demining teams, agricultural operators and defence crews all need weather information for drone operations over Ukraine.
- An experienced operator's requirements highlight wind by altitude, cloud conditions, and the ability to save and share weather for a selected point.
- The product rationale in SPEC identifies a gap between a weather map and a drone-profile verdict: crews need both in one view.

**What to show:** Four audience labels in that order, beside wind and cloud symbols; a simple “weather map + profile verdict” diagram. Treat the gap as the repository's user-research rationale, without claiming a verified comparison with current competitors.

**Sources:** [SPEC, user and requirements](../SPEC.md#2-користувач); [Submission, problem and users](submission.md#description); [Demo, jury answer 5](demo.md#5-why-use-this-instead-of-windy-or-uav-forecast).

## Slide 2: Solution — weather and profile verdicts on one map

- AMBER Sky brings altitude-aware wind, cloud base, gusts and icing together on a weather map of Ukraine.
- A selected point and drone profile provide GO / CAUTION / NO-GO with reasons and the next weather window; the timeline covers 48 hours.
- GO means “within profile”, never “safe”; missing data stays missing data. This is a demonstration model, not an official forecast or flight clearance.

**What to show:** [SCREENSHOT PLACEHOLDER — replace with the demonstrated build.] Capture a public demonstration point with the wind map, selected profile and altitude, point panel and timeline. Preserve source, forecast time and warnings. If a feature is unavailable, label it unavailable rather than supplying an invented result.

**Sources:** [Submission, product description](submission.md#description); [Demo, recording notes](demo.md#recording-notes); [Demo, screen sequence](demo.md#30-second-demo).

## Slide 3: EU space data — Copernicus ERA5 and Galileo

- Copernicus ERA5 supplies historical monthly shares of hours within a drone profile, adding climate context rather than predicting tomorrow's weather.
- Galileo orbital data supplies visible satellite counts and Galileo-only PDOP, describing satellite geometry rather than guaranteeing reception or measuring local interference.
- These complement the weather forecast: SPEC notes that ECMWF forecast models assimilate satellite observations.

**What to show:** Two labelled panels: “Copernicus ERA5 — historical hours within profile” and “Galileo — satellite count and PDOP”. Use actual build values with city, month and profile, or label the panel unavailable. Do not reuse SPEC's illustrative climate percentage as a measured result.

**Sources:** [Submission, EU space data](submission.md#eu-space-data); [Demo, EU data answer](demo.md#1-what-essential-function-comes-from-eu-space-data); [Demo, Galileo limitations](demo.md#2-does-galileo-pdop-guarantee-navigation-will-work).

## Slide 4: Business — free public-service access, paid agriculture hypothesis

- The proposed model keeps access free for emergency services, demining teams and defence crews.
- Agricultural drone operators and service companies would pay a subscription; this remains a business hypothesis without a validated price or revenue claim.
- The free Open-Meteo API we use today is non-commercial. For the commercial version, ECMWF Open Data (IFS) is licensed CC BY 4.0 and allows commercial use with attribution; switching needs a GRIB decoder, 3-hour → hourly interpolation and a separate visibility source.

**What to show:** A two-column model: “Free — DSNS, demining, defence” and “Paid hypothesis — agriculture and service companies”. Add “Planned commercial data transition — licence review required”; omit market-size, price and revenue figures.

**Sources:** [Submission, business proposal](submission.md#description); [Demo, business and licence answer](demo.md#3-who-pays-and-can-these-data-be-used-commercially); [F1, plan B: ECMWF Open Data](../../specs/F1/spec.md#план-б-ecmwf-open-data-t6-перевірено-2026-11-27).

## Slide 5: Team — AMBER//404

- Oleksandr leads architecture, specification, contracts, the verdict engine and CI; Maksym owns the weather pipeline and operator interviews.
- Nastia owns Galileo, Kp, ERA5 climate and the business model; Ivan owns the map, wind layers and timeline and tests the demo on a phone at the venue.
- Olia owns the point panel, route and drone catalogue, and covers F0 duties during the weekend.

**What to show:** Five name-and-role cards using the submission's handles: Oleksandr @xand0dev; Maksym @kingsneverdie17; Nastia @Bulka0801; Ivan @gonivanko; Olia @oljyaaa. Mark Nastia and Maksym as presenters and Ivan as the on-site contact.

**Sources:** [Submission, team and roles](submission.md#team-and-roles); [Demo, presenters](demo.md).
