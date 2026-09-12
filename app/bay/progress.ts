import { BAY } from './chapter-data';
import { readChapter, saveChapter } from '../shared/preferences';
export type BayProgress = {
  version: 1;
  ride: number;
  gulls: number;
  sunrise: number;
  parked: boolean;
  complete: boolean;
  checkpoint: 0 | 1 | 2;
};
export function readProgress(): BayProgress {
  const empty: BayProgress = {
    version: 1,
    ride: 0,
    gulls: 0,
    sunrise: 0,
    parked: false,
    complete: false,
    checkpoint: 0,
  };
  try {
    const p = readChapter(
      'shenzhen-bay',
      BAY.storageKey,
    ) as Partial<BayProgress> | null;
    if (!p || p.version !== 1) return empty;
    const number = (v: unknown, max: number) =>
      typeof v === 'number' && Number.isFinite(v)
        ? Math.min(max, Math.max(0, v))
        : 0;
    return {
      version: 1,
      ride: number(p.ride, 20000),
      gulls: number(p.gulls, BAY.gullSeconds),
      sunrise: number(p.sunrise, BAY.sunriseSeconds),
      parked: p.parked === true,
      complete: p.complete === true,
      checkpoint: p.checkpoint === 2 ? 2 : p.checkpoint === 1 ? 1 : 0,
    };
  } catch {
    return empty;
  }
}
export function saveProgress(p: BayProgress) {
  try {
    return saveChapter('shenzhen-bay', p, p.complete);
  } catch {
    return false;
  }
}
