# F0 — Каркас, контракти, вердикт

Роль: A — архітектор · власник: Олександр (@xand0dev) · гілка `feat/F0` · згенеровано з `docs/SPEC.md` §9.
**За розбіжності перемагає `docs/SPEC.md`.** Власник уточнює план, задачі й відкриті питання тут, не суперечачи SPEC.

## Дозволені шляхи
спільні файли SPEC §5.3; плюс `specs/F0/**`, розділ `## F0` у `docs/AI_LOG.md` і `docs/SOURCES.md`. Тести поруч із кодом.

## Дані
- Читає: —
- Пише: `meta.json`, `data/static/{profiles,borders,cities}.json`, `web/src/core/verdict.ts`

## Acceptance criteria
Повний текст — `docs/SPEC.md` §9 F0: F0-AC1, F0-AC2, F0-AC3, F0-AC4, F0-AC5. Не копіюй сюди, щоб не розійшлись.

## Правила, на які спирається
`docs/SPEC.md` §5, §6, §7.3–7.5, §7.9.

## Задачі
- [ ] T1. Репо, `make check` (ruff, pytest, eslint, tsc, vitest, build, перевірка схем)
- [ ] T2. `contracts/*.schema.json` і `contracts/mocks/*.json` за SPEC §6
- [ ] T3. `pipeline/sky/contracts.py`, `build.py`; `web/src/contracts`, `web/src/app` зі слотами фіч, бейдж MOCK
- [ ] T4. Статичні файли §6.6: профілі §7.3, кордони Natural Earth **Ukraine POV**, 16 міст
- [ ] T5. `verdict.ts`: `evaluate`, `nextWindow` за §7.4–7.5, таблиця прикладів у тестах
- [ ] T6. CI, `deploy.yml` (Pages), `data.yml` (cron кожні 3 год)
  - #138: повний `make data` у `deploy.yml` — лише за розкладом або коли дані на Pages старші за 3 год, MOCK чи не всі джерела `ok`; push і ручний запуск беруть `data/*.json` з Pages (`web/src/core/datasync.ts`, `.github/scripts/pages-data.mjs`). `data/static/*` — з репо.

- [x] T7. #165: швидкий перший екран — профіль за годинами (`data/profile/index.json` + `h00…h47.json`, §6.2): pipeline (`split_profile` у `contracts.py`), сайт (`core/profileHours.ts`, `app/profileLoader.ts` — поточна година, решта в idle, смуга чекає на свою годину), SW кешує всі години, `pages-data.mjs` бере теку цілою.

## План від агента (plan mode)
<!-- Агент вставляє сюди план T1…Tn з посиланнями на AC. Людина пише «затверджено, дата». -->

## Відкриті питання
| Питання | Хто | Коли | План Б |
|---|---|---|---|
