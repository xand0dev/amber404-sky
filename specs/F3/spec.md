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

**#88 — єдина візуальна система:**
- T1 (AC1) `ui/tokens.ts`: усі CSS-змінні дня й ночі (поверхні, текст, вердикти, кнопки, `--scrim`, 4 розміри шрифту + `--fs-display`, відступи 4/8/16/24, радіуси); вставляються в `<head>` при імпорті (`ui/MapFrame.tsx`). `ui/base.css`: елементи, дві кнопки (`:where(button)` другорядна, `.btn-primary` / `aria-pressed` основна), поля, шрифт слова вердикту.
- T2 (AC2) `ui/tokens.test.ts`: контраст 27 пар «текст / тло» ≥ 4.5:1 удень і вночі; `e2e/design.spec.ts` — контраст кожної видимої кнопки в браузері (400 і 1280, день і ніч).
- T3 (AC3) `ui/no-hardcode.test.ts`: у всіх `*.css` і CSS у `night.ts` / `lang.tsx` — кольори, розміри шрифту й відступи лише з токенів (F4 — окремий PR `feat/F4-88-tokens`).
- T4 (AC3) токени в `ui/`, `features/{map,layers,timeline}/`, `app/*` (`shared`); смуга годин — клас рівня замість вбудованого `rgba`.
- T5 (AC2) ніч: текст `#ff6b5a` / `#f0402e`, без `brightness(.6)`; плашка й клітинки годин чорні, рівень — висотою смужки.
- T6 (AC2) день: червоний текст `--no-ink`; клітинки годин суцільних кольорів вердикту (контраст 8.5 / 8.6 / 4.8 замість 4.1 / 3.3 / 1.6).
- T7 вбудований Roboto Condensed 700 (OFL, кирилиця + латиниця, 24 КБ) — слово вердикту однакове на Android / Windows / Linux.
- T8 (AC4) `specs/F3/design.md`, `img/88-palette.png`; скріни до/після `img/88-*`.

**#89 — Lighthouse і прогін демо на телефоні, топ-5 правок:**
- T1 (AC1) Lighthouse mobile на живому сайті: Performance 52, Accessibility 100. Основне гальмо — `profile.json` (1.3 МБ gzip) → issue #136 (`contract`, F1).
- T2 (AC2) 320 px без горизонтальної прокрутки: `.mapbarwrap{min-width:0}`, «⋯» прилипає праворуч (`ui/mapframe.css`); e2e `phone89.spec.ts`.
- T3 (AC1, AC2) рельєф і супутник вантажаться, коли браузер вільний, а не на старті; обрана — одразу (`map/Basemap.tsx`).
- T4 (AC3) ніч: поле, легенда, кордони, ріки, підписи, маркер і стрілки — лише червоні (`layers/colors.ts` `nightRamp`, `map/MapView.tsx`, `basemaps.ts`, `arrows.ts`, `basemap.css`); e2e — пікселі canvas.
- T5 (AC2) «До зони» без зони — щонайменше ±20 км навколо точки (`app/view/ViewControls.tsx`, assumption).
- T6 (AC2) підписи міст без накладань і не під маркером (`map/labels.ts`).
- T7 скріни до/після `img/89-*` (емуляція Pixel 7 / iPhone SE, день / ніч / en), звіт `img/89-lighthouse-before.png`.

**#140 — чесно показувати місця без даних:**
- T1 (AC1) `map/nodata.ts`: `nodataCells` — вузли сітки без значення обраного шару (той самий `sampleLayer`, що й поле); `drawNodata` — косі лінії кольором теми поверх поля (уночі червоні).
- T2 (AC2) `layers/Legend.tsx`: пункт «▨ немає даних» / «no data», лише коли такі вузли є.
- T3 (AC3) `e2e/nodata.spec.ts`: `profile.json` з `null` на півдні (як після 429, #139) — штрихування (~40 % смуг) і пункт у легенді; з повними даними — немає.
- T4 скріни `img/140-{before,after}[-night]-{400x800,1280x800}`.

**#143 — на телефоні карта під висоту України:**
- T1 (AC1–3) `ui/mapframe.css`: книжковий екран < 1024 px — висота `.mapwrap` = 70.2 % ширини (рамка 18.7° × 8.7° у проєкції cos 48.5°) + 104 px під атрибуцію, легенду й підпис зони. Альбомний телефон і десктоп (#86) — без змін. Змінює #85 AC1 (≥ 55 % екрана) за рішенням Івана.
- T2 (AC4) `e2e/mobile.spec.ts` AC1: уся рамка України видна, смуги ≤ 60 px, легенда й підпис зони нижче Криму, вибір дрона на першому екрані (375×812, 400×800).
- T3 скріни `img/143-{before,after}-*`.

**#145 — «Деталі» в підписі зони завжди видно; ім'я кнопки «Джерела»:**
- T1 (AC1) `app/zone/ZoneLayer.tsx` + `zone.css`: «Деталі ▾» — окремий елемент праворуч від обрізаного тексту; e2e `zonecap.spec.ts` (412 px, вітер понад ліміт, uk/en).
- T2 (AC2) `app/StatusBar.tsx` + `statusbar.css`: значок ⓘ / ⚠ — CSS `::before` з порожнім альтернативним текстом, тож видимий текст міститься в імені. Lighthouse локально: кнопка «Джерела» більше не в `label-content-name-mismatch`; клітинки таблиці висоти F4 — #146.

**#161 — кнопка «Де я» (§7.11 OPSEC):**
- T1 (AC2, AC5) `core/locate.ts`: `GEO_OPTS` (висока точність, 10 с), `fixOf`, `inMapArea` (рамка кліку по карті), `cityView` (±10 км, assumption), `accuracyPx`.
- T2 (AC1–5, AC7) `map/Locate.tsx` + `locate.css`: кнопка ⌖ першою в ряду; 1-ше натискання — позиція → обрана точка й вигляд міста, синя точка й коло точності (уночі червоні); 2-ге — `watchPosition` (рухається лише точка); 3-тє — вимкнено. Помилки — `role=status`.
- T3 (AC1) `map/SnapButton.tsx`: на екрані < 420 px 📷 — у «⋯» (9 кнопок по 44 px не вміщуються); `ui/MapFrame.tsx`: торкання поза «⋯» закриває меню.
- T4 (AC6, AC8) `Locate.test.tsx`: мок `navigator.geolocation` — успіх, відмова, таймаут, без API, поза рамкою, стеження вмик/вимик; жодного fetch / XHR / sendBeacon / localStorage / console. e2e `locate.spec.ts` (Playwright `geolocation`), `mobile.spec.ts` AC2.

**#168 — частинки вітру: колір за швидкістю, шлейфи, 60 fps:**
- T1 (AC1) `map/particles.ts`: `speedBucket` (12 кошиків на `SCALES.wind`), `bucketColors` — рампа легенди (`layerRGBA('wind')`), непрозора, +30 % до `--ink` (assumption: щоб читалась над полем того ж кольору); уночі `nightRamp`; `LINE_PX = 1.75` CSS px, `FADE = 0.06` (assumption).
- T2 (AC2) `particleCount(W, H, zoom)`: телефон (вужча сторона < 600 px) — 1 частинка на 1400 px² замість 900, при наближенні × 1/√zoom (не менше 0,4), стеля 1500 (assumption). Бенчмарк `performance.now()` у `particles.test.ts`: крок + малювання на 1280×800 ≤ 8 мс (медіана).
- T3 (AC1, AC3, AC5) `map/WindParticles.tsx`: `drawTrails` — один stroke на кошик; зміна вигляду → `clearRect` і нові частинки; `visibilitychange` → пауза; семплер бере актуальні дані й годину через ref.
- T4 (AC6) `particles.test.ts`, `WindParticles.test.tsx`; знімки `img/168-{before,after}-{400x800,1280x800}.png`.

## Відкриті питання
| Питання | Хто | Коли | План Б |
|---|---|---|---|
