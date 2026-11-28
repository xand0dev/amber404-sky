// Issue #173: тексти вікна «Про AMBER Sky» uk/en. Лише факти з docs/SPEC.md (§1, §2, §7.4, §7.6a, §7.11, §8) і docs/SOURCES.md.
// Мову бере з useT() (app/lang.tsx), словник — свій, щоб не чіпати спільний core/i18n.ts.
import type { Lang } from '../../core';

export const REPO = 'https://github.com/xand0dev/amber404-sky';

export interface Link { name: string; text: string; href: string }
export interface Source { name: string; what: string; lic: string; href: string }
export interface AboutText {
  menu: string; title: string; close: string; what: string;
  who: [string, string]; verdict: [string, string]; privacy: [string, string];
  eu: { h: string; items: Link[] };
  src: { h: string; items: Source[] };
  team: { h: string; text: string; repo: string };
}

// Посилання на космічні дані ЄС: Galileo — European GNSS Service Centre; ERA5 — Copernicus CDS; DEM — програма Copernicus;
// Sentinel-2 — мозаїка s2cloudless від EOX, яку бере сайт.
const EU_HREF = ['https://www.gsc-europa.eu', 'https://cds.climate.copernicus.eu', 'https://www.copernicus.eu', 'https://s2maps.eu'];
const EU_NAME = ['Galileo', 'Copernicus ERA5', 'Copernicus DEM', 'Sentinel-2'];

// Джерела — docs/SOURCES.md і SPEC §8; назва й ліцензія однакові обома мовами.
const SRC: { name: string; lic: [string, string]; href: string; what: [string, string] }[] = [
  { name: 'Open-Meteo Forecast', href: 'https://open-meteo.com/en/terms',
    what: ['прогноз на 48 год', '48-hour forecast'], lic: ['CC BY 4.0, лише некомерційно', 'CC BY 4.0, non-commercial only'] },
  { name: 'Copernicus ERA5 (Open-Meteo Archive)', href: 'https://archive-api.open-meteo.com/v1/archive',
    what: ['клімат льотних умов', 'flying-weather climate'], lic: ['Copernicus licence / CC BY 4.0', 'Copernicus licence / CC BY 4.0'] },
  { name: 'CelesTrak — Galileo GP', href: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=galileo&FORMAT=tle',
    what: ['орбіти Galileo', 'Galileo orbits'], lic: ['відкрито', 'open'] },
  { name: 'NOAA SWPC — Kp', href: 'https://services.swpc.noaa.gov/products/noaa-planetary-k-index-forecast.json',
    what: ['магнітні бурі', 'geomagnetic storms'], lic: ['відкрито', 'open'] },
  { name: 'Copernicus DEM GLO-90 (Open-Meteo Elevation)', href: 'https://api.open-meteo.com/v1/elevation',
    what: ['рельєф', 'terrain'],
    lic: ['© DLR e.V. 2010–2014 та © Airbus Defence and Space GmbH 2014–2018, програма Copernicus ЄС; Open-Meteo CC BY 4.0, некомерційно',
      '© DLR e.V. 2010–2014 and © Airbus Defence and Space GmbH 2014–2018, EU Copernicus programme; Open-Meteo CC BY 4.0, non-commercial'] },
  { name: 'Sentinel-2 cloudless by EOX — Copernicus Sentinel data 2020', href: 'https://s2maps.eu',
    what: ['супутникова підкладка', 'satellite basemap'], lic: ['CC BY-NC-SA 4.0, некомерційно', 'CC BY-NC-SA 4.0, non-commercial'] },
  { name: 'Natural Earth', href: 'https://www.naturalearthdata.com',
    what: ['кордони (Крим — Україна), ріки й озера', 'borders (Crimea is Ukraine), rivers and lakes'], lic: ['public domain', 'public domain'] },
  { name: 'OpenStreetMap', href: 'https://operations.osmfoundation.org/policies/tiles/',
    what: ['онлайн-підкладка «Вулиці», лише за вибором', 'online “Streets” basemap, only by choice'],
    lic: ['ODbL, © OpenStreetMap contributors', 'ODbL, © OpenStreetMap contributors'] },
  { name: 'Roboto Condensed', href: 'https://fonts.google.com/specimen/Roboto+Condensed',
    what: ['шрифт слова вердикту', 'verdict font'], lic: ['SIL Open Font License 1.1', 'SIL Open Font License 1.1'] },
];

const uk = {
  menu: 'Про AMBER Sky', title: 'Про AMBER Sky', close: 'Закрити',
  what: 'Веб-карта погоди для екіпажів дронів над Україною: вітер на висотах 10–500 м, пориви, хмари, обмерзання, Galileo — і вердикт МОЖНА / ОБЕРЕЖНО / НЕ МОЖНА для обраного дрона на кожну годину на 48 год уперед.',
  who: ['Для кого', 'Екіпажі дронів Сил оборони — лише погода й готовність до вильоту, без цілей, наведення чи лінії фронту. Той самий рушій — для ДСНС, розмінування й агро (оператори агродронів на полях).'],
  verdict: ['Як рахується вердикт', 'Прогноз у точці й годині порівнюється з лімітами обраного дрона: вітер на висоті, пориви, хмари, температура, опади, обмерзання, видимість, магнітна буря (Kp) і Galileo. МОЖНА — усе в межах профілю; ОБЕРЕЖНО — щось понад 80% ліміту чи близько до хмар; НЕ МОЖНА — хоч одне за межею; немає даних — ніколи не МОЖНА. Демонстраційна модель, не офіційний прогноз і не гарантія безпеки.'],
  euH: 'Космічні дані ЄС',
  eu: ['супутники над точкою й PDOP — якість навігації, незалежна від GPS', 'клімат: частка льотних годин по місяцях', 'рельєф: відмивка й висота місцевості', 'супутникова підкладка (мозаїка cloudless 2020)'],
  privacy: ['Приватність', 'Сайт працює зі статичних файлів, однакових для всіх: акаунтів і сервера з вашими даними немає. Точки, маршрути, свій дрон і збережена погода лишаються в браузері. Позиція GPS («Де я») не йде на сервер — лише в пам\'яті сторінки. Онлайн-карти «Вулиці» й «Супутник 10 м» вантажаться лише за вашим вибором і не запам\'ятовуються: сервер карти бачить район.'],
  srcH: 'Джерела й ліцензії',
  teamH: 'Команда',
  team: 'AMBER//404 — 12-й CASSINI Hackathon, кейс 2 «Space-enabled crisis response and civil resilience». Код:',
};

const en: typeof uk = {
  menu: 'About AMBER Sky', title: 'About AMBER Sky', close: 'Close',
  what: 'A weather map for drone crews over Ukraine: wind at 10–500 m, gusts, clouds, icing, Galileo — and a GO / CAUTION / NO-GO verdict for the chosen drone for every hour, 48 hours ahead.',
  who: ['Who it is for', 'Drone crews of the Defence Forces — weather and flight readiness only, no targets, guidance or front line. The same engine serves the SES (State Emergency Service), demining and agriculture (crop-drone operators in the field).'],
  verdict: ['How the verdict works', 'The forecast at the point and hour is compared with the chosen drone’s limits: wind at altitude, gusts, clouds, temperature, precipitation, icing, visibility, geomagnetic storm (Kp) and Galileo. GO — everything within the profile; CAUTION — something above 80% of a limit or close to clouds; NO-GO — at least one beyond a limit; no data — never GO. A demonstration model, not an official forecast and not a safety guarantee.'],
  euH: 'EU space data',
  eu: ['satellites above the point and PDOP — navigation quality independent of GPS', 'climate: share of flyable hours by month', 'terrain: hillshade and ground elevation', 'satellite basemap (cloudless mosaic 2020)'],
  privacy: ['Privacy', 'The site runs on static files, the same for everyone: no accounts and no server with your data. Points, routes, your own drone and saved weather stay in the browser. Your GPS position (“Where am I”) never goes to a server — it lives only in page memory. Online maps “Streets” and “Satellite 10 m” load only if you choose them and are not remembered: the map server sees the area.'],
  srcH: 'Sources and licences',
  teamH: 'Team',
  team: 'AMBER//404 — 12th CASSINI Hackathon, challenge 2 “Space-enabled crisis response and civil resilience”. Code:',
};

const D = { uk, en };

/** Усі тексти вікна мовою lang (без змішування мов). */
export function aboutText(lang: Lang): AboutText {
  const s = D[lang];
  const i = lang === 'uk' ? 0 : 1;
  return {
    menu: s.menu, title: s.title, close: s.close, what: s.what,
    who: s.who as [string, string], verdict: s.verdict as [string, string], privacy: s.privacy as [string, string],
    eu: { h: s.euH, items: EU_NAME.map((name, k) => ({ name, text: s.eu[k], href: EU_HREF[k] })) },
    src: { h: s.srcH, items: SRC.map((x) => ({ name: x.name, what: x.what[i], lic: x.lic[i], href: x.href })) },
    team: { h: s.teamH, text: s.team, repo: REPO },
  };
}
