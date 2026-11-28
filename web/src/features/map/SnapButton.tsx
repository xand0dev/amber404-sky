// F3-AC7: кнопка 📷 — знімок карти зі штампом; телефон → «Поділитися», ноутбук → завантаження.
import { useRef, useState } from 'react';
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import { useVerdicts } from '../../app/useVerdict';
import { useView } from '../../app/view/view';
import { InBar, useMapWrap } from '../../ui/MapFrame';
import { composeSnapshot } from './compose';
import { attribution } from './basemaps';
import { useBasemap } from './basemapStore';
import { browserDownload, deliver, fileName, stampLines, type Delivered } from './snapshot';
import './snap.css';

const TXT = {
  uk: { label: 'Знімок карти', shared: 'Надіслано', downloaded: 'Знімок збережено', cancelled: '', fail: 'Не вдалося зробити знімок' },
  en: { label: 'Map snapshot', shared: 'Shared', downloaded: 'Snapshot saved', cancelled: '', fail: 'Snapshot failed' },
};

export function SnapButton({ reduce }: { reduce: boolean }) {
  const { data, s } = useApp();
  const { lang } = useT();
  const { now, prof } = useVerdicts();
  const { view } = useView();
  const frame = useMapWrap();
  const { base } = useBasemap();
  const ref = useRef<HTMLButtonElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const tx = TXT[lang];

  const snap = async () => {
    const wrap = frame ?? ref.current?.closest<HTMLElement>('.mapwrap');
    if (!wrap || busy) return;
    setBusy(true); setMsg('');
    try {
      const blob = await composeSnapshot(wrap, data, s, reduce, stampLines(data, s, now, prof, lang), view, attribution(base, lang));
      const r: Delivered = await deliver(blob, fileName(data.meta.times[s.hour] ?? data.meta.generatedAt), { nav: navigator, download: browserDownload });
      setMsg(tx[r]);
      setTimeout(() => setMsg(''), 3000);
    } catch { setMsg(tx.fail); } finally { setBusy(false); }
  };

  return (
    <>
      <InBar>
        <button ref={ref} type="button" className="snapbtn" aria-label={tx.label} title={tx.label} disabled={busy} onClick={() => void snap()}>
          <span aria-hidden="true">📷</span>
        </button>
      </InBar>
      <p role="status" className="snapmsg" hidden={!msg}>{msg}</p>
    </>
  );
}
