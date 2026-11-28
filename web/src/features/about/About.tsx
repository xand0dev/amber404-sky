// Issue #173 AC1: «⋯» → «Про AMBER Sky» — модальний діалог для журі й користувачів: що це, для кого, вердикт,
// космічні дані ЄС, приватність, джерела й ліцензії, команда. Тексти — strings.ts (лише SPEC / SOURCES).
// AC3: фокус на «Закрити» при відкритті, Tab по колу всередині, Esc і «Закрити» закривають і повертають фокус.
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useT } from '../../app/lang';
import { InBar } from '../../ui/MapFrame';
import { aboutText, type AboutText } from './strings';
import './about.css';

export function About() {
  const { lang } = useT();
  const s = aboutText(lang);
  const [open, setOpen] = useState(false);
  const back = useRef<HTMLElement | null>(null);
  const show = () => { back.current = document.activeElement as HTMLElement | null; setOpen(true); };
  // Пункт меню після закриття «⋯» схований — тоді фокус повертаємо на саму кнопку «⋯».
  const close = useCallback(() => {
    setOpen(false);
    const el = back.current?.closest?.('.mapmore') ? document.querySelector<HTMLElement>('.morebtn') : back.current;
    el?.focus?.();
  }, []);
  return (
    <>
      <InBar slot="more"><button type="button" className="aboutbtn" onClick={show}>{s.menu}</button></InBar>
      {open && createPortal(<Dialog s={s} close={close} />, document.body)}
    </>
  );
}

const ext = { target: '_blank', rel: 'noopener noreferrer' } as const;

function Dialog({ s, close }: { s: AboutText; close: () => void }) {
  const id = useId();
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus(); }, []);

  // Esc — закрити; Tab / Shift+Tab — по колу між кнопками й посиланнями діалогу.
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key !== 'Tab' || !box.current) return;
      const f = [...box.current.querySelectorAll<HTMLElement>('button, a[href]')];
      const i = f.indexOf(document.activeElement as HTMLElement);
      const n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i < 0 || i === f.length - 1 ? 0 : i + 1);
      e.preventDefault();
      f[n].focus();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [close]);

  return (
    <div className="about">
      <div className="about-back" onClick={close} />
      <div ref={box} className="about-card" role="dialog" aria-modal="true" aria-labelledby={`${id}-h`}>
        <header className="about-head">
          <h2 id={`${id}-h`}>{s.title}</h2>
          <button ref={first} type="button" onClick={close}>{s.close}</button>
        </header>
        <div className="about-body">
          <p className="about-what">{s.what}</p>
          <section><h3>{s.who[0]}</h3><p>{s.who[1]}</p></section>
          <section><h3>{s.verdict[0]}</h3><p>{s.verdict[1]}</p></section>
          <section>
            <h3 id={`${id}-eu`}>{s.eu.h}</h3>
            <ul className="about-eu" aria-labelledby={`${id}-eu`}>
              {s.eu.items.map((x) => (
                <li key={x.name}><a className="about-mark" href={x.href} {...ext}>{x.name}</a> <span>{x.text}</span></li>
              ))}
            </ul>
          </section>
          <section><h3>{s.privacy[0]}</h3><p>{s.privacy[1]}</p></section>
          <section>
            <h3>{s.src.h}</h3>
            <ul className="about-src">
              {s.src.items.map((x) => (
                <li key={x.name}><a href={x.href} {...ext}>{x.name}</a> — {x.what}. <span className="about-lic">{x.lic}</span></li>
              ))}
            </ul>
          </section>
          <section>
            <h3>{s.team.h}</h3>
            <p>{s.team.text} <a href={s.team.repo} {...ext}>{s.team.repo.replace('https://', '')}</a></p>
          </section>
        </div>
      </div>
    </div>
  );
}
