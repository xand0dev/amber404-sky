// Довантаження годин профілю (SPEC §6.2, #165): поточна година — одразу, решта — у фоні в idle-час,
// година, на яку перемкнули смугу 48 год, — без черги. Чиста логіка злиття — core/profileHours.
import type { Profile, ProfileHour, ProfileIndex } from '../contracts';
import { backgroundOrder, emptyProfile, hourPath, withHours } from '../core';

export type GetHour = (path: string) => Promise<ProfileHour>;
export type Schedule = (cb: () => void) => void;
export type OnUpdate = (p: Profile, loaded: ReadonlySet<number>) => void;

/** Годин за один фоновий крок: менше комітів у React — менше перемальовувань карти. */
const BATCH = 16;

export const idle: Schedule = (cb) => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(() => cb(), { timeout: 2000 });
  else setTimeout(cb, 50);
};

export class ProfileLoader {
  profile: Profile;
  private loaded = new Set<number>();
  private pending = new Map<number, Promise<ProfileHour | null>>();
  private started = false;
  private index: ProfileIndex;
  private get: GetHour;
  private onUpdate: OnUpdate;
  private schedule: Schedule;

  constructor(index: ProfileIndex, get: GetHour, onUpdate: OnUpdate = () => {}, schedule: Schedule = idle) {
    this.index = index; this.get = get; this.onUpdate = onUpdate; this.schedule = schedule;
    this.profile = emptyProfile(index);
  }

  has(h: number): boolean { return this.loaded.has(h); }

  /** Година зараз (поточна чи обрана на смузі). true — година є в профілі. */
  async load(h: number): Promise<boolean> {
    if (this.loaded.has(h)) return true;
    const hf = await this.fetch(h);
    return hf ? this.merge([hf]) : this.loaded.has(h);
  }

  /** Решта годин — пачками в idle-колбеках, від наступної за `from`. Повторний виклик нічого не робить. */
  background(from = 0): void {
    if (this.started) return;
    this.started = true;
    const queue = backgroundOrder(from, this.index.hours.length);
    const step = () => {
      const batch: number[] = [];
      while (queue.length && batch.length < BATCH) {
        const h = queue.shift()!;
        if (!this.loaded.has(h) && !this.pending.has(h)) batch.push(h);
      }
      if (!batch.length) return;
      void Promise.all(batch.map((h) => this.fetch(h))).then((hs) => {
        this.merge(hs.filter((x): x is ProfileHour => x != null));
        if (queue.length) this.schedule(step);
      });
    };
    this.schedule(step);
  }

  private fetch(h: number): Promise<ProfileHour | null> {
    let p = this.pending.get(h);
    if (!p) {
      p = this.get(hourPath(this.index, h)).catch(() => null).finally(() => this.pending.delete(h));
      this.pending.set(h, p);
    }
    return p;
  }

  private merge(hs: ProfileHour[]): boolean {
    const fresh = hs.filter((hf) => hf.generatedAt === this.index.generatedAt && !this.loaded.has(hf.hour));
    if (!fresh.length) return hs.some((hf) => this.loaded.has(hf.hour));
    this.profile = withHours(this.profile, this.index, fresh);
    for (const hf of fresh) this.loaded.add(hf.hour);
    this.onUpdate(this.profile, this.loaded);
    return true;
  }
}

/** set для стану екрана: година, якої ще немає, застосовується лише після завантаження — до того карта й вердикт
 *  показують попередню (без мигання «немає даних»). Інші поля — одразу. Швидке перемикання — перемагає остання. */
export function hourGate<S extends { hour: number }>(
  loader: () => ProfileLoader | null, apply: (f: (o: S) => S) => void,
): (p: Partial<S>) => void {
  let want: number | null = null;
  return (p) => {
    const L = loader();
    const h = p.hour;
    if (h == null || !L || L.has(h)) {
      if (h != null) want = null;
      apply((o) => ({ ...o, ...p }));
      return;
    }
    want = h;
    const rest: Partial<S> = { ...p };
    delete rest.hour;
    if (Object.keys(rest).length) apply((o) => ({ ...o, ...rest }));
    void L.load(h).then(() => {
      if (want !== h) return;
      want = null;
      apply((o) => ({ ...o, hour: h }));
    });
  };
}
