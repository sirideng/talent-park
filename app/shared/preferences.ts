export type Quality = 'auto' | 'low' | 'medium' | 'high';
export type Settings = {
  quality: Quality;
  volume: number;
  motion: 'system' | 'reduce' | 'full';
};
type Memory = {
  version: 1;
  settings: Settings;
  visits: Record<string, number>;
  completed: string[];
  chapters: Record<string, unknown>;
};
export const MEMORY_KEY = 'shenzhen-memory:unified:v1';
export const memorySnapshot = () => {
  try {
    return localStorage.getItem(MEMORY_KEY) ?? '';
  } catch {
    return '';
  }
};
export function onMemory(fn: () => void) {
  window.addEventListener('memory-change', fn);
  window.addEventListener('storage', fn);
  return () => {
    window.removeEventListener('memory-change', fn);
    window.removeEventListener('storage', fn);
  };
}
const empty = (): Memory => ({
  version: 1,
  settings: { quality: 'auto', volume: 0.65, motion: 'system' },
  visits: {},
  completed: [],
  chapters: {},
});
export function readMemory(): Memory {
  try {
    const p = JSON.parse(localStorage.getItem(MEMORY_KEY) ?? 'null'),
      base = empty();
    if (!p || p.version !== 1) return base;
    const s = p.settings ?? {};
    base.settings = {
      quality: ['auto', 'low', 'medium', 'high'].includes(s.quality)
        ? s.quality
        : 'auto',
      volume:
        typeof s.volume === 'number' && Number.isFinite(s.volume)
          ? Math.max(0, Math.min(1, s.volume))
          : 0.65,
      motion: ['system', 'reduce', 'full'].includes(s.motion)
        ? s.motion
        : 'system',
    };
    base.visits = Object.fromEntries(
      Object.entries(p.visits ?? {}).filter(
        ([k, v]) =>
          k.length < 80 && typeof v === 'number' && Number.isFinite(v),
      ) as [string, number][],
    );
    base.completed = Array.isArray(p.completed)
      ? p.completed.filter((v: unknown) => typeof v === 'string').slice(0, 100)
      : [];
    if (
      p.chapters &&
      typeof p.chapters === 'object' &&
      !Array.isArray(p.chapters)
    )
      base.chapters = p.chapters;
    return base;
  } catch {
    return empty();
  }
}
function write(change: (m: Memory) => void) {
  const m = readMemory();
  change(m);
  try {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(m));
    window.dispatchEvent(new Event('memory-change'));
    return true;
  } catch {
    return false;
  }
}
let cachedSettings: Settings | undefined, media: MediaQueryList | undefined;
export const settings = () =>
  cachedSettings ?? (cachedSettings = readMemory().settings);
export function updateSettings(value: Partial<Settings>) {
  const ok = write((m) => Object.assign(m.settings, value));
  cachedSettings = undefined;
  window.dispatchEvent(new Event('memory-settings'));
  return ok;
}
export function onSettings(fn: () => void) {
  const update = () => {
    cachedSettings = undefined;
    fn();
  };
  window.addEventListener('memory-settings', update);
  window.addEventListener('storage', update);
  return () => {
    window.removeEventListener('memory-settings', update);
    window.removeEventListener('storage', update);
  };
}
export function reducedMotion() {
  const s = settings().motion;
  return (
    s === 'reduce' ||
    (s === 'system' &&
      (media ??= matchMedia('(prefers-reduced-motion: reduce)')).matches)
  );
}
export function recordVisit(id: string) {
  return write((m) => {
    m.visits[id] = Date.now();
  });
}
export function completeMemory(id: string) {
  if (readMemory().completed.includes(id)) return true;
  return write((m) => {
    m.completed.push(id);
  });
}
export function readChapter(id: string, legacy: string): unknown {
  const m = readMemory();
  if (id in m.chapters) return m.chapters[id];
  try {
    const p = JSON.parse(localStorage.getItem(legacy) ?? 'null');
    if (p && p.version === 1)
      saveChapter(id, p, p.complete === true || p.chapterComplete === true);
    return p;
  } catch {
    return null;
  }
}
export function saveChapter(id: string, value: unknown, complete = false) {
  return write((m) => {
    m.chapters[id] = value;
    if (complete && !m.completed.includes(id)) m.completed.push(id);
  });
}
const outputs = new WeakMap<
  AudioContext,
  { gain: GainNode; remove: () => void }
>();
export function audioOutput(c: AudioContext) {
  let output = outputs.get(c);
  if (!output) {
    const gain = c.createGain();
    gain.gain.value = settings().volume;
    gain.connect(c.destination);
    const remove = onSettings(() => {
      if (c.state !== 'closed')
        gain.gain.setTargetAtTime(settings().volume, c.currentTime, 0.08);
    });
    output = { gain, remove };
    outputs.set(c, output);
  }
  return output.gain;
}
export function releaseAudio(c: AudioContext) {
  const o = outputs.get(c);
  o?.remove();
  o?.gain.disconnect();
  outputs.delete(c);
}
