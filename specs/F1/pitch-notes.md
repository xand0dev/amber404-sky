# F1 — шпаргалка для пітчу (Максим)

Говоримо англійською; тут — що казати про погодну частину і як відповідати журі. Усі числа — з коду й живих прогонів 27.11 (`pipeline/sky/forecast/fetch.py`, PR #59, #66, #82, #96). Не обіцяємо більше, ніж є на сайті.

## 30 секунд про F1 (англійською)
> "Every three hours — and on every release — our pipeline pulls an hourly 48-hour forecast from Open-Meteo for 684 grid points covering Ukraine, every half a degree. For each point we take wind at 10, 80, 120 and 180 metres plus six pressure levels, convert pressure levels to height above the ground, and interpolate the wind vector to 16 flight altitudes from 10 to 1,000 metres. That is what lets a crew slide the altitude and see the wind at 50 or 300 metres, not just at the surface. If a request fails, those points stay *no data* — we never copy a neighbour's numbers — and if the whole source is down, the site keeps the last good forecast with its real age and a 'forecast is stale' banner."

## Факти (якщо питають деталі)
| Що | Значення | Звідки |
|---|---|---|
| Джерело | Open-Meteo Forecast API, CC BY 4.0, **лише некомерційно** | SPEC §8, `docs/SOURCES.md` |
| Сітка | lat 44–52.5, lon 22–40.5, крок 0.5° → 18 × 38 = **684 точки** (≈ 55 × 35 км на 50° пн. ш.) | SPEC §7.1 |
| Час | щогодини, **48 год** від поточної | `forecast_hours=48` |
| Висоти | 10, 50, 100 … 500 (кожні 50 м), 600 … 1000 (кожні 100 м) — **16 рівнів** | SPEC §6.2 |
| З чого висоти | вітер 10/80/120/180 м + рівні 1000…850 гПа; висота рівня = геопотенціал − висота місцевості, лише > 200 м | SPEC §6.2 |
| Інтерполяція | лінійно по **u, v** (вектор), а не по швидкості й куту — інакше «північ + схід» дає хибний напрям | тест `test_interpolates_u_v_not_speed_and_angle` |
| Запити | 6 пакетів по 114 точок, пауза 1.5 с; 429 / таймаут → повтор 2, 4, 8, 16, 32 с | F1-AC1 |
| Якість живого прогону | **100 % значень не null**, статус `ok` (27.11, кожен деплой) | лог `make data`, F1-AC4 |
| Оновлення | cron кожні 3 год + кожен реліз; плашка «прогноз застарів» > 6 год | SPEC §5, §7.9 |
| Збій джерела | пакет впав → його точки «немає даних»; усе джерело впало → цілий попередній прогноз ≤ 12 год з чесним віком | F1-AC2, SPEC §12, PR #96 |
| Розмір даних | `profile.json` 3.9 МБ, по мережі 1.3 МБ (gzip) — один файл для всіх, без координат користувача | OPSEC, Конституція п. 8 |

## Питання журі → відповідь
**1. "Where does the wind at 300 metres come from — is it measured?"**
> "It's model forecast, not measurement. Open-Meteo gives wind on fixed heights and on pressure levels; we turn pressure levels into height above the local ground and interpolate. It's a forecast model, clearly labelled as a demonstration, not an official forecast."

**2. "How accurate is it?"**
> "We haven't validated accuracy ourselves, and we don't claim a number. What we guarantee is honesty: the source and forecast time are always on screen, missing data is shown as *no data* and never as GO, and every drone limit is marked as an assumption until operators and manufacturers confirm it."
*(Не вигадувати відсотків точності.)*

**3. "Half a degree is ~50 km. Is that enough?"**
> "For planning a shift over a region — yes, that's the scale of the weather fronts we show. In mountains it isn't: terrain changes the local wind, so the point panel warns about that (relief work in progress). Finer grids are a paid-tier option."

**4. "What happens if your weather source goes down during an operation?"**
> "Requests retry with growing pauses. If a block of points still fails, those points show *no data* — we learned the hard way that copying neighbouring data corrupts the map. If the whole source is down, the site keeps the last good forecast, up to 12 hours old, with its real age and a stale banner after six hours."

**5. "Can you use Open-Meteo commercially?"**
> "Not on the free tier — it's non-commercial, which fits the hackathon. For the commercial version we checked ECMWF Open Data: CC BY 4.0, commercial use allowed with attribution. Switching needs a GRIB decoder, interpolation from 3-hourly to hourly steps, and a separate visibility source."

**6. "Where's the EU space data in the forecast?"**
> "The forecast models assimilate satellite observations; directly in our product, Copernicus ERA5 gives the climate statistics and Galileo the navigation geometry." *(Не казати, що ми самі обробляємо супутникові знімки для прогнозу.)*

**7. "Does it work offline / leak positions?"**
> "Everyone downloads the same static forecast file; no coordinates go to a server. Saved points stay in the browser."

**8. "Who told you crews need this?"**
> "An experienced drone operator on 26 November: wind by altitude — the 'small sky' up to about 90 metres and layers up to 500 — dew point for clouds, any point on the map, and saving and sharing the weather." *(+ цитати з нових розмов #4, коли будуть.)*

## Чого НЕ казати
- «Безпечно летіти» — лише «в межах профілю» (Конституція п. 1).
- Будь-які відсотки точності, кількість користувачів чи клієнтів.
- Що ліміти дронів перевірені — вони `assumption` (SPEC §7.3).
- Що ми «бачимо фронт», якщо в поточному прогнозі його нема.
