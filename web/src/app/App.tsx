import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadBundle, type Bundle } from './data';
import { AppCtx, type AppState, type Ctx } from './state';
import { hourGate, type ProfileLoader } from './profileLoader';
import { StatusBar } from './StatusBar';
import { Install, registerSW, useReconnect, useShortcut } from './pwa';
import { ThemeProvider } from './theme';
import { LangProvider, useT } from './lang';
import { Overlay } from './overlay/Overlay';
import { ZoneLayer } from './zone/ZoneLayer';
import { Draw } from './draw/Draw';
import { ViewCtx, type ViewState } from './view/view';
import { ViewControls } from './view/ViewControls';
import { FULL_VIEW, shortcutAction, type View } from '../core';
import { MapView } from '../features/map/MapView';
import { LayerPicker } from '../features/layers/LayerPicker';
import { Timeline } from '../features/timeline/Timeline';
import { Panel } from '../features/panel/Panel';
import { MapFrame } from '../ui/MapFrame';
import { Splash } from './splash/Splash';
import { Onboarding } from './onboarding/Onboarding';
import './app.css';

// Слоти фіч (SPEC §9): map/layers/timeline — F3, panel/route — F4. Каркас лише розкладає їх.
// Overlay (F0, §7.14) — власна карта-підкладка під полем погоди; ZoneLayer (F0, §7.5b) — зона польоту над ним;
// Draw (F0, §7.13) — малюнки над ними.
// ViewCtx (issue #64) — спільний вигляд карти (центр, масштаб) для всіх шарів; ViewControls — жести й кнопки масштабу.
// MapFrame (issue #85) — ряд інструментів над картою й меню «⋯»; смуга шарів — під картою.
// Splash (issue #166) — заставка, поки вантажаться дані; Onboarding — 3 картки при першому відкритті й «⋯» → «Як це працює».
// Install (issue #170) — «Встановити застосунок» у «⋯», банер і підказка iOS над картою.
export function App() {
  return <LangProvider><Shell /></LangProvider>;
}

function Shell() {
  const { t } = useT();
  const [data, setData] = useState<Bundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Ярлик manifest (#170): «Можна летіти» відкриває шар go, «Де я» — кнопку позиції, щойно карта готова.
  const [shortcut] = useState(() => shortcutAction(window.location.search));
  const [s, setS] = useState<AppState>({ lat: 50.45, lon: 30.52, altM: 50, hour: 0, droneId: 'fpv7', layer: shortcut === 'go' ? 'go' : 'wind' });
  const [view, setView] = useState<View>(FULL_VIEW);
  const vctx = useMemo(() => ({ view, setView }), [view]);
  // Профіль за годинами (#165): спершу година першого екрана, решта — у фоні; смуга 48 год чекає на свою годину.
  const [loader, setLoader] = useState<ProfileLoader | null>(null);
  useEffect(() => {
    loadBundle(0, (profile) => setData((d) => (d ? { ...d, profile } : d)))
      .then(({ bundle, loader: L }) => { setLoader(L); setData(bundle); L.background(0); })
      .catch((e: Error) => setErr(e.message));
  }, []);
  const set = useMemo(() => hourGate<AppState>(() => loader, setS), [loader]);
  // Офлайн (SPEC §7.11): у dev SW не реєструємо, щоб кеш не ховав зміни коду.
  useEffect(() => { if (import.meta.env.PROD) void registerSW(); }, []);
  // Повернення мережі (#170 AC3): тихо перечитуємо пакет (SW бере мережу першою), без перезавантаження й без помилки на екрані.
  // Профілі лишаємо поточні — у них може бути «свій дрон» (F4-AC6).
  const refresh = useCallback(() => {
    loadBundle().then((nb) => setData((d) => (d ? { ...nb, profiles: d.profiles } : nb))).catch(() => { /* лишаємо що є */ });
  }, []);
  useReconnect(refresh);
  // Стабільна функція: «свій дрон» (F4-AC6) додає профіль у список без перезавантаження даних.
  const setProfiles = useCallback((f: (l: Bundle['profiles']) => Bundle['profiles']) => setData((d) => (d ? { ...d, profiles: f(d.profiles) } : d)), []);
  const ctx = useMemo(() => (data ? { data, s, set, setProfiles } : null), [data, s, set, setProfiles]);
  useShortcut(ctx ? shortcut : null);
  // Заставка — завжди другим дочірнім, щоб пережити заміну екрана й плавно згаснути над готовою картою.
  return <>{err ? <div className="boot err">{t('boot.error', { err })}</div> : ctx && <Main ctx={ctx} vctx={vctx} />}<Splash ready={!!ctx || !!err} /></>;
}

function Main({ ctx, vctx }: { ctx: Ctx; vctx: ViewState }) {
  return (
    <ThemeProvider>
    <AppCtx.Provider value={ctx}>
    <ViewCtx.Provider value={vctx}>
      <div className="shell">
        <StatusBar />
        <MapFrame><Overlay /><MapView /><ZoneLayer /><Draw /><ViewControls /><Install /><Onboarding /></MapFrame>
        <LayerPicker />
        <Timeline />
        <Panel />
      </div>
    </ViewCtx.Provider>
    </AppCtx.Provider>
    </ThemeProvider>
  );
}
