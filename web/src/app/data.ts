// Завантаження даних (SPEC §5.2): web читає лише web/public/data через contracts.
import type { City, Climate, DroneProfile, Galileo, Kp, Meta, Profile } from '../contracts';

export interface Bundle {
  meta: Meta; profile: Profile; galileo: Galileo | null; kp: Kp | null; climate: Climate | null;
  profiles: DroneProfile[]; cities: City[]; borders: { features: { iso: string; name: string; rings: number[][][] }[] };
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`./data/${path}`);
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json() as Promise<T>;
}
const opt = <T,>(p: Promise<T>) => p.catch(() => null);

export async function loadBundle(): Promise<Bundle> {
  const [meta, profile, galileo, kp, climate, profiles, cities, borders] = await Promise.all([
    get<Meta>('meta.json'), get<Profile>('profile.json'), opt(get<Galileo>('galileo.json')), opt(get<Kp>('kp.json')),
    opt(get<Climate>('climate.json')), get<DroneProfile[]>('static/profiles.json'), get<City[]>('static/cities.json'),
    get<Bundle['borders']>('static/borders.json'),
  ]);
  return { meta, profile, galileo, kp, climate, profiles, cities, borders };
}
