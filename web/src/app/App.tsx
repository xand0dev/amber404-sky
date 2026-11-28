import { useCallback, useEffect, useMemo, useState } from 'react';
import { loadBundle, type Bundle } from './data';
import { AppCtx, type AppState, type Ctx } from './state';
import { StatusBar } from './StatusBar';
import { registerSW } from './pwa';
import { ThemeProvider } from './theme';
import { LangProvider, useT } from './lang';
import { Overlay } from './overlay/Overlay';
import { ZoneLayer } from './zone/ZoneLayer';
import { Draw } from './draw/Draw';
import { ViewCtx, type ViewState } from './view/view';
import { ViewControls } from './view/ViewControls';
import { FULL_VIEW, type View } from '../core';
import { MapView } from '../features/map/MapView';
import { LayerPicker } from '../features/layers/LayerPicker';
import { Timeline } from '../features/timeline/Timeline';
import { Panel } from '../features/panel/Panel';
import { MapFrame } from '../ui/MapFrame';
import { Splash } from './splash/Splash';
import { Onboarding } from './onboarding/Onboarding';
import { About } from '../features/about/About';
import './app.css';

// Слоти фіч (SPEC §9): map/layers/timeline — F3, panel/route — F4. Каркас лише розкладає їх.
// Overlay (F0, §7.14) — власна карта-підкладка під полем погоди; ZoneLayer (F0, §7.5b) — зона польоту над ним;
// Draw (F0, §7.13) — малюнки над ними.
// ViewCtx (issue #64) — спільний вигляд карти (центр, масштаб) для всіх шарів; ViewControls — жести й кнопки масштабу.
// MapFrame (issue #85) — ряд інструментів над картою й меню «⋯»; смуга шарів — під картою.
// Splash (issue #166) — заставка, поки вантажаться дані; Onboarding — 3 картки при першому відкритті й «⋯» → «Як це працює».
// About (issue #173, F4) — «⋯» → «Про AMBER Sky»: для кого, космічні дані ЄС, приватність, джерела.
export function App() {
  return <LangProvider><Shell /></LangProvider>;
}

function Shell() {
  const { t } = useT();
  const [data, setData] = useState<Bundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [s, setS] = useState<AppState>({ lat: 50.45, lon: 30.52, altM: 50, hour: 0, droneId: 'fpv7', layer: 'wind' });
  const [view, setView] = useState<View>(FULL_VIEW);
  const vctx = useMemo(() => ({ view, setView }), [view]);
  useEffect(() => { loadBundle().then(setData).catch((e: Error) => setErr(e.message)); }, []);
  // Офлайн (SPEC §7.11): у dev SW не реєструємо, щоб кеш не ховав зміни коду.
  useEffect(() => { if (import.meta.env.PROD) void registerSW(); }, []);
  // Стабільна функція: «свій дрон» (F4-AC6) додає профіль у список без перезавантаження даних.
  const setProfiles = useCallback((f: (l: Bundle['profiles']) => Bundle['profiles']) => setData((d) => (d ? { ...d, profiles: f(d.profiles) } : d)), []);
  const ctx = useMemo(() => (data ? { data, s, set: (p: Partial<AppState>) => setS((o) => ({ ...o, ...p })), setProfiles } : null), [data, s, setProfiles]);
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
        <MapFrame><Overlay /><MapView /><ZoneLayer /><Draw /><ViewControls /><Onboarding /><About /></MapFrame>
        <LayerPicker />
        <Timeline />
        <Panel />
      </div>
    </ViewCtx.Provider>
    </AppCtx.Provider>
    </ThemeProvider>
  );
}
