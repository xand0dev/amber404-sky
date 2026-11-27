import { useEffect, useMemo, useState } from 'react';
import { loadBundle, type Bundle } from './data';
import { AppCtx, type AppState } from './state';
import { StatusBar } from './StatusBar';
import { registerSW } from './pwa';
import { MapView } from '../features/map/MapView';
import { LayerPicker } from '../features/layers/LayerPicker';
import { Timeline } from '../features/timeline/Timeline';
import { Panel } from '../features/panel/Panel';
import './app.css';

// Слоти фіч (SPEC §9): map/layers/timeline — F3, panel/route — F4. Каркас лише розкладає їх.
export function App() {
  const [data, setData] = useState<Bundle | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [s, setS] = useState<AppState>({ lat: 50.45, lon: 30.52, altM: 50, hour: 0, droneId: 'fpv7', layer: 'wind' });
  useEffect(() => { loadBundle().then(setData).catch((e: Error) => setErr(e.message)); }, []);
  // Офлайн (SPEC §7.11): у dev SW не реєструємо, щоб кеш не ховав зміни коду.
  useEffect(() => { if (import.meta.env.PROD) void registerSW(); }, []);
  const ctx = useMemo(() => (data ? { data, s, set: (p: Partial<AppState>) => setS((o) => ({ ...o, ...p })) } : null), [data, s]);
  if (err) return <div className="boot err">Не вдалося завантажити дані: {err}</div>;
  if (!ctx) return <div className="boot">Завантаження…</div>;
  return (
    <AppCtx.Provider value={ctx}>
      <div className="shell">
        <StatusBar />
        <main className="mapwrap"><MapView /><LayerPicker /></main>
        <Timeline />
        <Panel />
      </div>
    </AppCtx.Provider>
  );
}
