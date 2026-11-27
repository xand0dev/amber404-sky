# F2 — Galileo, Kp, клімат ERA5

Роль: C — космос · власник: Настя (@Bulka0801) · гілка `feat/F2` · згенеровано з `docs/SPEC.md` §9.
**За розбіжності перемагає `docs/SPEC.md`.** Власник уточнює план, задачі й відкриті питання тут, не суперечачи SPEC.

## Дозволені шляхи
`pipeline/sky/galileo/`, `pipeline/sky/climate/`, `pipeline/sky/space/`; плюс `specs/F2/**`, розділ `## F2` у `docs/AI_LOG.md` і `docs/SOURCES.md`. Тести поруч із кодом.

## Дані
- Читає: Celestrak Galileo TLE, NOAA Kp, Copernicus ERA5 (§8)
- Пише: `galileo.json`, `kp.json`, `climate.json`

## Acceptance criteria
Повний текст — `docs/SPEC.md` §9 F2: F2-AC1, F2-AC2, F2-AC3, F2-AC4. Не копіюй сюди, щоб не розійшлись.

## Правила, на які спирається
`docs/SPEC.md` §6.3–6.5, §7.7–7.8, §8.

## Задачі
- [ ] T1. До п'ятниці: акаунт Copernicus CDS (це не код)
- [ ] T2. Galileo: TLE з Celestrak → skyfield/sgp4 → видимі > 10° і PDOP для 16 міст по годинах
- [ ] T3. Kp: парсер NOAA forecast, інтервали по 3 год
- [ ] T4. ERA5: 5 міст × 2025 рік → % льотних годин за §7.8 для 4 профілів (CDS, план Б — Open-Meteo Archive)
- [ ] T5. Фікстури для кожного джерела

## План від агента (plan mode)
<!-- Агент вставляє сюди план T1…Tn з посиланнями на AC. Людина пише «затверджено, дата». -->

## Відкриті питання
| Питання | Хто | Коли | План Б |
|---|---|---|---|
