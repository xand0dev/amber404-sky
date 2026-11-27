# AMBER Sky — demo, video and jury answers

Presenters: Nastia and Maksym. English script for Challenge 2: Space-enabled crisis response and civil resilience.

## Recording notes

Use only the functions and values visible in the build being presented. Keep the forecast source, timestamp, MOCK badge and any stale-data or missing-data warning visible. If a panel is unavailable, say so; do not replace it with invented results. Use a public, non-operational demonstration point, with no crew locations or routes.

The timings below are editorial allocations, not measured product performance. Rehearse to the marked cuts. The interface may remain Ukrainian; the spoken script is English. GO means "within profile", never "safe": this is a demonstration model, not an official weather forecast or flight clearance.

SPEC §3's "Saturday 10:00–14:59" window and "46% in December" are an illustration of the intended display, not verified results for this recording. Read the actual window, city, month, profile and climate percentage shown, or state that the data is unavailable. Do not claim a front is passing unless the forecast actually shows it.

## 30-second demo

Follow the five actions in [SPEC §3](../SPEC.md#3-демо--30-секунд). Maksym operates the screen and speaks; Nastia takes the Galileo and ERA5 closing line.

| Time | Step | What is on screen | What we say |
|---|---|---|---|
| 00:00–00:05 | Open the site. | Ukraine wind map at 120 m; particles show direction, colour shows speed; source and forecast time remain visible. | "Wind over Ukraine at one hundred and twenty metres; colour shows speed." |
| 00:05–00:11 | Select FPV 7-inch, 50 m and the Can fly layer. | GO / CAUTION / NO-GO map for the selected profile and height. | "Choose a drone and height: conditions within profile, caution, or no-go." |
| 00:11–00:18 | Click a public demonstration field near Poltava. | Point verdict, reasons and next flight window, or the actual no-window/no-data message. | "Select a point: reasons and the next weather window appear here." |
| 00:18–00:23 | Press play on the 48-hour timeline. | Hour and conditions change; show the front only if present in this forecast. | "Play the next forty-eight hours to see conditions change." |
| 00:23–00:30 | Open Galileo, then ERA5 climate. | Visible Galileo satellite count and PDOP; ERA5 monthly share of hours within the selected profile, with city and month. | "Galileo shows satellite geometry; Copernicus ERA5 shows historical hours within profile." |

## 2-minute video

Nastia narrates the opening, EU data and business; Maksym narrates the weather demonstration and limitations. Keep the audience order from [submission.md](submission.md): emergency services (DSNS), demining, agriculture, defence. Use title cards and the public demonstration map, without operational imagery.

| Time | Shot | What is on screen | Voiceover |
|---|---|---|---|
| 00:00–00:15 | Audience and problem title card. | AMBER Sky; audience labels appear in the spoken order. | "Emergency services, DSNS; demining teams; agricultural operators; and defence crews all need weather information. AMBER Sky is a dual-use weather map for drone operators over Ukraine." |
| 00:15–00:30 | Map overview. | Wind layer at 120 m; altitude control, legend, source and timestamp. | "Our requirements come from an experienced drone operator: wind by altitude, cloud conditions, and weather at any point. Here, moving particles show wind direction, while colour shows speed at the selected height." |
| 00:30–00:45 | Profile and point demonstration. | Select the SPEC §3 demo profile at 50 m, switch to Can fly, open the public Poltava point. | "Select a drone profile and height, then a point. The map brings together weather and a profile-based verdict, with reasons. GO means conditions within profile. It is not a guarantee of safety." |
| 00:45–01:00 | Time and window. | Next weather window and 48-hour timeline; preserve actual warnings. | "The timeline covers forty-eight hours. The next window is the first period with at least two consecutive GO hours. Read the forecast time and warnings: missing data must remain missing data, never a green result." |
| 01:00–01:15 | EU space data. | Galileo count and PDOP panel, then ERA5 climate with city, month and profile. | "Galileo orbital data gives visible satellite counts and Galileo-only PDOP, describing satellite geometry. Copernicus ERA5 provides historical monthly hours within a drone profile. Climate statistics add context; they do not predict tomorrow's weather." |
| 01:15–01:30 | Phone and privacy. | Phone-sized app view; static-file architecture card; show offline view only if verified in the recorded build. | "The design is a static Progressive Web App. Everyone downloads the same forecast files; selected coordinates are not sent to an application server. Saved points stay in the browser. Offline use retains the forecast age." |
| 01:30–01:45 | Business hypothesis. | Free: DSNS, demining, defence. Paid hypothesis: agriculture and service companies. Commercial data-source transition labelled planned. | "Our business hypothesis keeps access free for emergency services, demining teams and defence crews. Agricultural operators and service companies would pay a subscription. Commercial use requires a suitable forecast licence; ECMWF Open Data is the planned path." |
| 01:45–02:00 | Limitations and close. | Drone limits marked assumption; weather-only scope; project name and repository link from submission. | "Drone limits and simplified rules still need validation with manufacturers and operators. This is weather decision support, not an official forecast. Our next step is to validate those assumptions and demonstrate the working build with its sources visible." |

## Jury questions

### 1. What essential function comes from EU space data?

Copernicus ERA5 supplies historical monthly hours within a drone profile; Galileo orbits supply visible satellite counts and Galileo-only PDOP. These add climate context and navigation-geometry information. The weather forecast is a separate input; SPEC also notes that ECMWF models assimilate satellite observations. [SPEC §7.7–7.8 and §8](../SPEC.md#8-джерела-даних)

### 2. Does Galileo PDOP guarantee navigation will work?

No. It describes satellite geometry, not a measurement of local interference or a guarantee of reception. The calculation uses Celestrak Galileo orbits. SPEC treats geometry thresholds as an assumption and allows unusable-satellite filtering to remain an assumption if unfinished; disclose that limitation. [SPEC §7.4 and §7.7](../SPEC.md#77-galileo-f2)

### 3. Who pays, and can these data be used commercially?

The submission proposes free access for DSNS, demining and defence, with a paid subscription for agricultural operators and service companies. This is a business hypothesis, with no validated price or revenue claim here. SPEC restricts the current Open-Meteo use to non-commercial use; the planned ECMWF Open Data path still needs its licence checked. [Submission, Business](submission.md#description); [SPEC §8 and §12](../SPEC.md#12-ризики-й-план-б)

### 4. How do you handle OPSEC and sensitive locations?

The architecture serves identical static forecast files to everyone, without coordinate-bearing application requests. Saved points and routes stay in browser storage. That does not make a user's device or shared screenshots anonymous. The product's scope excludes targets, guidance, attack planning, front lines and tracking. [Constitution §8](../../CONSTITUTION.md); [SPEC §7.11](../SPEC.md#711-телефон-і-офлайн-pwa)

### 5. Why use this instead of Windy or UAV Forecast?

SPEC frames the operator's problem as combining Windy's map with UAV Forecast's point verdict. Our intended value is one country-wide altitude-aware map with profile verdicts, reasons and weather windows. This is the repository's product rationale, not a verified current feature comparison or a forecast-accuracy claim. [SPEC §2–3](../SPEC.md#2-користувач)

### 6. What is different from 17 METEO?

SPEC recognises 17 METEO as a free Ukrainian mobile competitor with drone profiles and a point-of-no-return feature. Our proposed distinction is the country-wide altitude wind map and browser access without installation. SPEC requires hands-on comparison before pitching; until then, we do not claim proven superiority. [SPEC §12](../SPEC.md#12-ризики-й-план-б)

### 7. Can operators trust a green verdict or missing data?

GO means only "within profile". Drone limits, cloud-base estimation and simplified icing rules include assumptions requiring validation. Missing wind produces NO-DATA, not GO. Sources and forecast time remain visible, with a stale warning beyond six hours. This is a demonstration model, not official flight clearance. [Constitution §1 and §7](../../CONSTITUTION.md); [SPEC §7.2–7.4 and §7.9](../SPEC.md#79-чесність-даних)

### 8. What evidence of user demand and readiness do you have?

SPEC records a call with an experienced operator on 26 November about altitude wind, clouds, saving and sharing weather. More interviews and manufacturer checks are planned; we do not claim paying customers or measured accuracy. The submission's status is a draft: present only what works in the recorded build, and label MOCK or unavailable data. [SPEC §1 and §9](../SPEC.md#1-мета); [Submission, Status](submission.md#status)

## Source boundary

All product facts above come from [CONSTITUTION.md](../../CONSTITUTION.md), [docs/SPEC.md](../SPEC.md) and [docs/pitch/submission.md](submission.md). SPEC takes precedence where drafts differ. Shot timings and speaker assignments are production choices. No market-size, price, revenue, accuracy or performance figures have been invented; displayed weather values must come from the demonstrated build.
