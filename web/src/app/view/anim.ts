// Плавний перехід вигляду (issue #174): кнопки й переходи — 350 мс ease-out через rAF, жести — миттєво й скасовують перехід.
// Вигляд міняється щонайбільше раз на кадр, тож поле погоди й шари перемальовуються не частіше. prefers-reduced-motion — без анімації.
import { easeOut, lerpView, type View } from '../../core';

export const ANIM_MS = 350;

export type ViewAction = View | ((v: View) => View);

export interface AnimatorEnv {
  get: () => View;
  set: (v: View) => void;
  raf: (f: (t: number) => void) => number;
  caf: (id: number) => void;
  now: () => number;
  reduced: () => boolean;
}

export interface ViewAnimator {
  /** Плавно до вигляду; функція-оновлювач рахується від цілі поточного переходу (+ + = ×4). */
  to(a: ViewAction): void;
  /** Миттєво (жест): скасовує перехід і рахується від того, що зараз на екрані. */
  jump(a: ViewAction): void;
  cancel(): void;
}

const apply = (a: ViewAction, v: View) => (typeof a === 'function' ? a(v) : a);

export function createViewAnimator(env: AnimatorEnv): ViewAnimator {
  let id: number | null = null, from: View | null = null, target: View | null = null, t0 = 0;
  const cancel = () => { if (id != null) env.caf(id); id = null; target = null; };
  const tick = () => {
    id = null;
    if (!from || !target) return;
    const k = (env.now() - t0) / ANIM_MS;
    env.set(lerpView(from, target, easeOut(k)));
    if (k < 1) id = env.raf(tick); else target = null;
  };
  return {
    to(a) {
      const next = apply(a, target ?? env.get());
      if (env.reduced()) { cancel(); env.set(next); return; }
      from = env.get(); target = next; t0 = env.now();
      if (id == null) id = env.raf(tick);
    },
    jump(a) { cancel(); env.set(apply(a, env.get())); },
    cancel,
  };
}
