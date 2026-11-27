# Журнал використання AI

Кожна AI-сесія — рядок у **своєму** розділі (так PR не конфліктують). Без секретів. Основа розділу про AI у сабміті (F4).

Формат: `| дата | хто | агент / модель | задача | файли | перевірка | PR |`

## F0

| Дата | Хто | Агент / модель | Задача | Файли | Перевірка | PR |
|---|---|---|---|---|---|---|
| 2026-11-27 19:30–20:00 Київ | Олександр | Claude Code / Claude Opus 5.5 | F0: каркас web і pipeline, core (вердикт, вікно, енергія, зона, маршрут, зсув), mocks, кордони NE Ukraine POV, схеми, CI, автомерж, deploy, runner | `web/`, `pipeline/`, `contracts/`, `.github/`, `scripts/`, `Makefile` | `make check`: ruff, 9 pytest, eslint, tsc, 50 vitest, схеми, build; екран на mocks у браузері 375 px | прямий коміт у main (початок) |

## F1

| Дата | Хто | Агент / модель | Задача | Файли | Перевірка | PR |
|---|---|---|---|---|---|---|
| 2026-11-27 21:00–21:50 Київ | Максим | Claude Code / Claude Opus 5.5 | #1 збір Open-Meteo пакетами ≤ 120, повтори на 429, пакет не завантажився → null | `pipeline/sky/forecast/fetch.py`, `pipeline/tests/forecast/` | 12 тестів F1 на справжній фікстурі; pytest 34 passed; ruff, eslint, tsc, vitest, схеми, build | #59 |
| 2026-11-27 22:00–22:40 Київ | Максим | Claude Code / Claude Opus 5.5 | #2 пакування у profile.json: u, v → 16 висот | `pipeline/sky/forecast/fetch.py`, `pipeline/tests/forecast/` | 26 тестів F1; `make check` зелений (62 pytest, 291 vitest); знайдено й передано F0 #62 | #66 |
| 2026-11-27 22:40–23:10 Київ | Максим | Claude Code / Claude Opus 5.5 | #3 живий `make data`, контроль Києва; план Б ECMWF | `pipeline/sky/forecast/fetch.py`, `pipeline/tests/forecast/test_control.py`, `specs/F1/spec.md` | 31 тест F1; живий `make data`: 100 % не null, `openmeteo ok`; на Pages — справжній прогноз | #82 |

## F2

| Дата | Хто | Агент / модель | Задача | Файли | Перевірка | PR |
|---|---|---|---|---|---|---|

## F3

| Дата | Хто | Агент / модель | Задача | Файли | Перевірка | PR |
|---|---|---|---|---|---|---|
| 2026-11-27 21:00–21:45 Київ | Іван | Claude Code / Claude Opus 5.5 | F3 #9: плавне поле шару, легенда зі шкалою §7.6 | `web/src/features/map/`, `web/src/features/layers/`, `specs/F3/` | `make check` зелений (219 vitest); Playwright 400 px і 1280 px: без гор. скролу, перемикання шару/години 17–55 мс, консоль чиста | #9 |
| 2026-11-27 22:10–22:50 Київ | Іван | Claude Code / Claude Opus 5.5 | F3 #10: частинки вітру обраної висоти, reduced motion → стрілки | `web/src/features/map/`, `specs/F3/` | `make check` зелений (230 vitest); Playwright 400/1280 px × motion/reduce: без гор. скролу, кнопки 44 px, частинки рухаються 60 fps, клік обирає точку, консоль чиста | #10 |
| 2026-11-27 23:00–23:30 Київ | Іван | Claude Code / Claude Opus 5.5 | F3 #12: підказка при наведенні (вітер, пориви, темп., видимість, вердикт) | `web/src/features/map/`, `specs/F3/` | `make check` зелений (300 vitest), `npm run e2e` 12 passed; Playwright 1280/400 px: підказка в межах карти, значення = панель, без гор. скролу, консоль чиста | #12 |
| 2026-11-27 23:40–00:30 Київ | Іван | Claude Code / Claude Opus 5.5 | F3 #13: 📷 знімок карти зі штампом, share / завантаження | `web/src/features/map/`, `specs/F3/` | `make check` зелений (312 vitest), `npm run e2e` 12 passed; Playwright: 1280 px завантаження PNG 900×356 за 81 мс; 400 px share з 1 image/png за 129 мс; консоль чиста | #13 |

## F4

| Дата | Хто | Агент / модель | Задача | Файли | Перевірка | PR |
|---|---|---|---|---|---|---|
| 2026-11-27 21:20–22:10 Київ | Оля | Claude Code / Claude Opus 5.5 | #14 панель точки, #15 зона, #16 висоти × години, #18 збережене й звіт, #19 свій дрон, #20 джерела дронів | `web/src/features/panel/`, `web/src/features/route/Route.tsx`, `web/src/app/{App.tsx,state.ts}` (shared), `web/public/data/static/profiles.json` (shared), `docs/SOURCES.md`, `specs/F4/spec.md` | `make check`: ruff, 35 pytest, eslint, tsc, 251 vitest, схеми, build; e2e 12/12 (400 px і 1280 px); скриншоти 400 і 1280 px без горизонтального скролу й помилок консолі | гілки feat/F4-14, -15, -16, -18, -19, -20 |
