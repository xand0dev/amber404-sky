// Завантаження даних (SPEC §5.2): web читає лише web/public/data через contracts.
// Профіль (§6.2, #165) — index і лише година першого екрана; решту довантажує ProfileLoader.
import type { City, Climate, DroneProfile, Galileo, Kp, Meta, Profile, ProfileHour, ProfileIndex } from '../contracts';
import { ProfileLoader, type OnUpdate } from './profileLoader';

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

/** Перший екран: усе, крім годин профілю, + година `hour`. Решту годин запускає `loader.background(hour)`. */
export async function loadBundle(hour = 0, onUpdate?: OnUpdate): Promise<{ bundle: Bundle; loader: ProfileLoader }> {
  const [meta, index, galileo, kp, climate, profiles, cities, borders] = await Promise.all([
    get<Meta>('meta.json'), get<ProfileIndex>('profile/index.json'), opt(get<Galileo>('galileo.json')), opt(get<Kp>('kp.json')),
    opt(get<Climate>('climate.json')), get<DroneProfile[]>('static/profiles.json'), get<City[]>('static/cities.json'),
    get<Bundle['borders']>('static/borders.json'),
  ]);
  const loader = new ProfileLoader(index, (p) => get<ProfileHour>(p), onUpdate);
  await loader.load(hour); // не вдалося — година без даних («немає даних»), а не порожній екран
  return { bundle: { meta, profile: loader.profile, galileo, kp, climate, profiles, cities, borders }, loader };
}
