import { useEffect, useMemo, useState } from 'react';
import { loadBundle, type Bundle } from './data';
import { AppCtx, type AppState } from './state';
import { StatusBar } from './StatusBar';
import { registerSW } from './pwa';
import { ThemeProvider } from './theme';
import { LangProvider, useT } from './lang';
import { Overlay } from './overlay/Overlay';
import { ZoneLayer } from './zone/ZoneLayer';
import { Draw } from './draw/Draw';
import { MapView } from '../features/map/MapView';
import { LayerPicker } from '../features/layers/LayerPicker';
import { Timeline } from '../features/timeline/Timeline';
import { Panel } from '../features/panel/Panel';
import './app.css';

// Слоти фіч (SPEC §9): map/layers/timeline — F3, panel/route — F4. Каркас лише розкладає їх.
// Overlay (F0, §7.14) — власна карта-підкладка під полем погоди; ZoneLayer (F0, §7.5b) — зона польоту над ним;
// Draw (F0, §7.13) — малюнки над ними.
export function App() {
  return <LangProvider><Shell /></LangProvider>;
}

function Shell() {
  const { t } = useT();
  const [data, setData] = useState<Bundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [s, setS] = useState<AppState>({ lat: 50.45, lon: 30.52, altM: 50, hour: 0, droneId: 'fpv7', layer: 'wind' });
  useEffect(() => { loadBundle().then(setData).catch((e: Error) => setErr(e.message)); }, []);
  // Офлайн (SPEC §7.11): у dev SW не реєструємо, щоб кеш не ховав зміни коду.
  useEffect(() => { if (import.meta.env.PROD) void registerSW(); }, []);
  const ctx = useMemo(() => (data ? { data, s, set: (p: Partial<AppState>) => setS((o) => ({ ...o, ...p })) } : null), [data, s]);
  if (err) return <div className="boot err">{t('boot.error', { err })}</div>;
  if (!ctx) return <div className="boot">{t('boot.loading')}</div>;
  return (
    <ThemeProvider>
    <AppCtx.Provider value={ctx}>
      <div className="shell">
        <StatusBar />
        <main className="mapwrap"><Overlay /><MapView /><ZoneLayer /><Draw /><LayerPicker /></main>
        <Timeline />
        <Panel />
      </div>
    </AppCtx.Provider>
    </ThemeProvider>
  );
}
