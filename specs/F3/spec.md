# F3 — Карта, шари, повзунок висоти

Роль: D — карта · власник: Іван (@gonivanko) · гілка `feat/F3` · згенеровано з `docs/SPEC.md` §9.
**За розбіжності перемагає `docs/SPEC.md`.** Власник уточнює план, задачі й відкриті питання тут, не суперечачи SPEC.

## Дозволені шляхи
`web/src/features/map/`, `web/src/features/layers/`, `web/src/features/timeline/`, `web/src/ui/**`; плюс `specs/F3/**`, розділ `## F3` у `docs/AI_LOG.md` і `docs/SOURCES.md`. Тести поруч із кодом.

## Дані
- Читає: усі файли `web/public/data/` через `web/src/contracts`
- Пише: —

## Acceptance criteria
Повний текст — `docs/SPEC.md` §9 F3: F3-AC1, F3-AC2, F3-AC3, F3-AC4, F3-AC5, F3-AC6, F3-AC7, F3-AC8, F3-AC9. Не копіюй сюди, щоб не розійшлись.

## Правила, на які спирається
`docs/SPEC.md` §3, §6.7, §7.5–7.6, §7.9–7.10.

## Задачі
- [ ] T1. Карта: Canvas-поле шару з інтерполяцією + частинки вітру + SVG кордони й міста (референс — артефакт AMBER Sky)
- [ ] T2. Перемикачі: 6 шарів, 3 висоти, 4 профілі
- [ ] T3. Панель точки: вердикт, вікно, ліміти, таблиця 24 год, Galileo, клімат ERA5
- [ ] T4. Смуга 48 год з ▶ і позначками днів
- [ ] T5. Підказка при наведенні, легенда
- [ ] T6. 400 px, клавіатура, reduced motion → стрілки
- [ ] T7. Відео демо ≤ 2 хв

## План від агента (plan mode)
<!-- Агент вставляє сюди план T1…Tn з посиланнями на AC. Людина пише «затверджено, дата». -->
**#9 — плавне поле й легенда:**
- T1 (AC1) `layers/colors.ts`: шкали §7.6 (`SCALES`), неперервна рампа `layerRGBA`.
- T2 (AC1, AC2) `map/field.ts`: `sampleLayer` (лише core: windAt, bilinear, weatherAt, evaluate, isIcing), `fieldPixels`, `projection`.
- T3 (AC1) `MapView.tsx`: поле рахується кожні 3 px → ImageData → згладжений drawImage замість квадратів 0.25°.
- T4 (AC1) `layers/Legend.tsx`: градієнт + мін/середина/макс з одиницею; для «Можна летіти» й «Обмерзання» — колір + текст.
- T5 тести: `colors.test.ts`, `field.test.ts` (без квадратів, ≤ 300 мс на шар), `Legend.test.tsx`.

**#10 — частинки вітру; reduced motion → стрілки:**
- T1 (AC1) `map/particles.ts`: `windSampler` (core.windAt на `s.altM`, `s.hour`), `seed`, `step`, `particleCount`; екранна швидкість `K = 3 px/с на 1 м/с` (assumption), не залежить від масштабу.
- T2 (AC5) `map/useReducedMotion.ts`: matchMedia + подія `change`.
- T3 (AC1, AC5) `map/WindParticles.tsx` — окремий canvas зі слідами, колір з теми; `MapView.tsx`: reduce → стрілки замість частинок.
- T4 тести: `particles.test.ts`, `MapView.test.tsx`.

**#12 — підказка при наведенні:**
- T1 (AC6) `map/hover.ts`: `hoverInfo` (core.weatherAt + evaluate на `s.altM`, `s.hour`, дроні), `hoverRows` (uk/en, «немає даних» замість null).
- T2 (AC6) `map/HoverTip.tsx` + `hover.css`: `role=tooltip` біля курсора; у правій / нижній половині — з іншого боку, ширина обмежена місцем до краю.
- T3 (AC6) `MapView.tsx`: `pointermove` (миша/перо) → підказка, `pointerleave` → немає; дотик — без підказки.
- T4 тести: `hover.test.ts`, `MapView.test.tsx`.

**#13 — 📷 знімок карти зі штампом:**
- T1 `map/arrows.ts`: `drawWindArrows` — спільні стрілки для reduced motion і знімка.
- T2 (AC7) `map/snapshot.ts`: `stampLines` (AMBER Sky, час прогнозу, висота, дрон, шар, вердикт у точці, джерела, MOCK; uk/en), `fileName`, `deliver` (share → AbortError → завантаження).
- T3 (AC7) `map/compose.ts`: PNG з підкладки, поля, стрілок, зони й SVG-малюнків + штамп; лише локальні Canvas/SVG.
- T4 (AC7) `map/SnapButton.tsx` + `snap.css`: кнопка 📷 44×44, статус у `aria-live`.
- T5 тести: `snapshot.test.ts`, `SnapButton.test.tsx`.

**#86 — десктоп: дві колонки (карта + панель):**
- T1 (AC1–4) `web/e2e/desktop.spec.ts`: 1024×768, 1280×800, 1440×900, 1920×1080 — панель 360–420 px праворуч від шапки до низу з власною прокруткою, сторінка не прокручується; смуга 48 год під картою на ширину її колонки; шапка ≤ 72 px в один рядок; без горизонтальної прокрутки; 768×1024 — розкладка телефона на всю ширину.
- T2 (AC1, AC2) `app.css`: `@media (min-width:1024px)` — grid-areas шапка / ліва колонка (інструменти, карта `minmax(0,1fr)`, шари, смуга) / права колонка панелі `clamp(360px,30vw,420px)`; прибрано `max-width:900px` (порожнечі з боків на 900–1023 px).
- T3 (AC3) `app.css`: шапка — flex в один рядок (вердикт · причина · профіль і вікно з «…» · бейджі · «Ніч» · UK/EN), 68 px.
- T4 скріни до/після `specs/F3/img/86-*.png`.

**#100 — підкладки: рельєф, супутник, вода (§7.6a):**
- T1 (AC1, AC2, AC4) `map/basemaps.ts`: варіанти Без / Рельєф / Супутник / Своя карта, `parsePrefs` (localStorage), `imageAffine` (рамка 22–40.5 × 44–52.5 → спільна проєкція #64), `fieldAlpha`, `attribution`, `waterLines`, `drawWater`.
- T2 (AC1, AC5, AC6) `map/basemapStore.ts`: вибір у localStorage, зображення й water.json читаються раз (кеш SW, миттєве перемикання).
- T3 (AC1, AC2, AC4) `map/Basemap.tsx` + `basemap.css`: canvas.basemap під canvas.map, меню в «⋯», повзунок прозорості погоди, атрибуція в куті; «Своя карта» F0 — як є.
- T4 (AC2, AC3) `MapView.tsx`: над рельєфом/супутником — прозоре тло й поле з повзунком; ріки й озера над полем, під частинками.
- T5 (AC4) `compose.ts`, `SnapButton.tsx`: підкладка й атрибуція на знімку 📷.
- T6 тести: `basemaps.test.ts`, `Basemap.test.tsx`, `SnapButton.test.tsx`, `e2e/basemap.spec.ts`; скріни `img/100-*`.

## Відкриті питання
| Питання | Хто | Коли | План Б |
|---|---|---|---|
