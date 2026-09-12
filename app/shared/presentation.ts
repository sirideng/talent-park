import {
  reducedMotion,
  onSettings,
  completeMemory,
  readMemory,
} from './preferences';
import type { SceneApi, SceneId } from '../scenes/types';
import type { SceneResources } from '../scenes/resources';
export function ownPresentation(
  host: HTMLElement,
  id: SceneId,
  api: SceneApi,
  resources: SceneResources,
) {
  const root = host.closest<HTMLElement>('main') ?? host;
  let activity = performance.now();
  // React updates main.className when modes change; this attribute survives those updates.
  const motion = () => {
    const reduce = reducedMotion();
    root.dataset.reducedMotion = String(reduce);
    root.classList.toggle('reduce-motion', reduce);
  };
  motion();
  resources.defer(onSettings(motion));
  const media = matchMedia('(prefers-reduced-motion: reduce)');
  resources.listen(media, 'change', motion);
  const awake = () => {
    activity = performance.now();
    root.classList.remove('hud-idle');
  };
  resources.listen(root, 'pointerdown', awake);
  resources.listen(root, 'keydown', awake);
  resources.listen(root, 'focusin', awake);
  resources.listen<KeyboardEvent>(root, 'keydown', (e) => {
    if (
      e.target instanceof HTMLElement &&
      (e.target.closest('input,select,textarea,[contenteditable="true"]') ||
        (e.target.closest('button,summary') &&
          [
            ' ',
            'Enter',
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight',
          ].includes(e.key)))
    )
      e.stopPropagation();
  });
  const check = () => {
    const s = api.getState?.() as Record<string, unknown> | undefined;
    const near = Array.from(
      root.querySelectorAll<HTMLButtonElement>(
        '[data-action="interact"],[data-action="enter"],.nearby-prompt',
      ),
    ).some((b) => !b.hidden && !b.disabled && b.getClientRects().length > 0);
    const engaged =
      s &&
      (s.sitting ||
        s.watching ||
        s.resting ||
        s.moonActive ||
        s.step === 'practice' ||
        (s.phase && s.phase !== 'walking'));
    root.classList.toggle(
      'hud-idle',
      id !== 'planet' &&
        !near &&
        !engaged &&
        performance.now() - activity > 3200 &&
        !root.querySelector('.memory-settings[open]'),
    );
    if (s?.rides && Number(s.rides) > 0) completeMemory('happy-harbor');
    if (Array.isArray(s?.visited) && s.visited.includes('summit'))
      completeMemory('wutong');
    if (typeof s?.moment === 'string')
      completeMemory('talent-park:' + s.moment);
  };
  // Completion checks are UI-rate, never per-frame; writes are idempotent.
  const timer = setInterval(check, 300);
  resources.defer(() => {
    check();
    clearInterval(timer);
    root.classList.remove('hud-idle');
  });
  if (process.env.NODE_ENV !== 'production') {
    Object.assign(host, { integrationApi: api, memoryState: readMemory });
    resources.defer(() => {
      Reflect.deleteProperty(host, 'integrationApi');
      Reflect.deleteProperty(host, 'memoryState');
    });
  }
}
