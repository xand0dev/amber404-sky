// F4 (Оля): «Свій дрон» (F4-AC6, issue #19, SPEC §7.3a). Зберігається лише в localStorage — нікуди не надсилається.
import { useEffect, useState } from 'react';
import { useApp } from '../../app/state';
import { useT } from '../../app/lang';
import type { Lang } from '../../core';
import { dropOwn, fromProfile, loadOwn, OWN_ID, removeOwn, saveOwn, toProfile, upsertOwn, validate, type OwnDrone as Own } from './ownDrone';
import { pt, type PKey } from './strings';
import type { AnyProfile } from './zoneLogic';

const LABEL: Record<keyof Own, PKey> = {
  kind: 'own.kind', massKg: 'own.mass', payloadKg: 'own.payload', cruiseMs: 'own.cruise', windMs: 'own.wind', gustMs: 'own.gust',
  tMinC: 'own.tmin', precipMmH: 'own.precip', band0: 'own.band0', band1: 'own.band1', energy: 'own.energy',
  enduranceMin: 'own.endurance', fuelL: 'own.fuelL', burnLh: 'own.burn',
};

export interface OwnDroneViewProps {
  value: Own; onChange: (v: Own) => void; onSave: () => void; onRemove: () => void;
  hasSaved: boolean; errors: (keyof Own)[]; ok: boolean; lang: Lang; open?: boolean;
}

export function OwnDroneView({ value: v, onChange, onSave, onRemove, hasSaved, errors, ok, lang, open }: OwnDroneViewProps) {
  const L = (k: PKey, p?: Record<string, string | number>) => pt(k, lang, p);
  const num = (k: keyof Own, step = 'any') => (
    <label key={k}>{L(LABEL[k])}
      <input type="number" inputMode="decimal" step={step} value={Number.isFinite(v[k] as number) ? String(v[k]) : ''}
        aria-invalid={errors.includes(k)} onChange={(e) => onChange({ ...v, [k]: e.target.value === '' ? NaN : Number(e.target.value) })} />
    </label>
  );
  return (
    <details className="psec own" open={open}>
      <summary>{L('own.open')}</summary>
      <form className="ownform" aria-label={L('own')} onSubmit={(e) => { e.preventDefault(); onSave(); }}>
        <fieldset>
          <legend>{L('own.kind')}</legend>
          <button type="button" aria-pressed={v.kind === 'multirotor'} onClick={() => onChange({ ...v, kind: 'multirotor' })}>{L('own.multi')}</button>
          <button type="button" aria-pressed={v.kind === 'wing'} onClick={() => onChange({ ...v, kind: 'wing' })}>{L('own.wing')}</button>
        </fieldset>
        {num('massKg')}{num('payloadKg')}{num('cruiseMs')}{num('windMs')}{num('gustMs')}{num('tMinC')}{num('precipMmH')}
        {num('band0', '10')}{num('band1', '10')}
        <fieldset>
          <legend>{L('own.energy')}</legend>
          <button type="button" aria-pressed={v.energy === 'battery'} onClick={() => onChange({ ...v, energy: 'battery' })}>{L('own.battery')}</button>
          <button type="button" aria-pressed={v.energy === 'fuel'} onClick={() => onChange({ ...v, energy: 'fuel' })}>{L('own.fuel')}</button>
        </fieldset>
        {v.energy === 'battery' ? num('enduranceMin') : <>{num('fuelL')}{num('burnLh')}</>}
        <div className="pbtns wide">
          <button type="submit">{L('own.save')}</button>
          {hasSaved && <button type="button" onClick={onRemove}>{L('own.remove')}</button>}
        </div>
      </form>
      {errors.length > 0 && <p className="perr" role="alert">{L('own.err', { f: errors.map((k) => L(LABEL[k])).join(', ') })}</p>}
      {ok && <p className="pok" role="status">{L('own.saved')}</p>}
      <p className="pnote">{L('own.note')}</p>
    </details>
  );
}

/** Підтягує збережений дрон у список профілів при старті й дає форму. */
export function OwnDrone({ base }: { base: AnyProfile }) {
  const { s, set, setProfiles } = useApp();
  const { lang } = useT();
  const name = pt('own', lang);
  const [saved, setSaved] = useState<Own | null>(() => loadOwn());
  const [value, setValue] = useState<Own>(() => saved ?? fromProfile(base));
  const [errors, setErrors] = useState<(keyof Own)[]>([]);
  const [ok, setOk] = useState(false);

  // Свій дрон з localStorage — у список профілів (і з назвою поточною мовою).
  useEffect(() => {
    if (saved) setProfiles?.((l) => upsertOwn(l, toProfile(saved, name)));
  }, [saved, name, setProfiles]);

  return (
    <OwnDroneView value={value} lang={lang} errors={errors} ok={ok} hasSaved={!!saved}
      onChange={(v) => { setValue(v); setOk(false); }}
      onSave={() => {
        const bad = validate(value);
        setErrors(bad);
        if (bad.length) { setOk(false); return; }
        saveOwn(value);
        setSaved(value);
        const p = toProfile(value, name);
        setProfiles?.((l) => upsertOwn(l, p));
        set({ droneId: OWN_ID, altM: s.droneId === OWN_ID ? s.altM : p.defaultAltM });
        setOk(true);
      }}
      onRemove={() => {
        removeOwn();
        setSaved(null);
        setProfiles?.(dropOwn);
        if (s.droneId === OWN_ID) set({ droneId: 'fpv7' });
        setOk(false);
      }} />
  );
}
