import type { SceneApi } from '../scenes/types';
import type { SceneResources } from '../scenes/resources';
/** Pointer capture keeps movement and a second finger's camera drag independent. */
export function mountJoystick(
  host: HTMLElement,
  api: SceneApi,
  resources: SceneResources,
) {
  if (!api.move) return;
  const wrap = document.createElement('div');
  wrap.className = 'memory-controls';
  wrap.innerHTML =
    '<div class="memory-joystick" role="group" aria-label="移动摇杆：拖动控制方向和速度"><span></span></div><div class="memory-mobile-actions"><button aria-label="跳跃" data-key=" ">跃</button><button aria-label="按住加速" data-key="shift">快</button><button aria-label="按住刹车" data-key="s">刹</button></div>';
  host.appendChild(wrap);
  resources.defer(() => wrap.remove());
  const pad = wrap.querySelector<HTMLElement>('.memory-joystick')!,
    thumb = pad.firstElementChild as HTMLElement;
  let pointer = -1,
    cx = 0,
    cy = 0;
  const stop = () => {
    pointer = -1;
    thumb.style.transform = 'translate(0,0)';
    api.move?.(0, 0);
    for (const k of ['shift', 's', ' ']) api.key?.(k, false);
  };
  const move = (e: PointerEvent) => {
    if (e.pointerId !== pointer) return;
    let x = (e.clientX - cx) / 42,
      y = (e.clientY - cy) / 42;
    const length = Math.hypot(x, y);
    if (length > 1) {
      x /= length;
      y /= length;
    }
    thumb.style.transform = `translate(${x * 36}px,${y * 36}px)`;
    const force = Math.max(0, (Math.min(1, length) - 0.12) / 0.88);
    api.move?.(
      length ? (x / Math.min(1, length)) * force : 0,
      length ? (y / Math.min(1, length)) * force : 0,
    );
  };
  resources.listen<PointerEvent>(pad, 'pointerdown', (e) => {
    if (pointer !== -1) return;
    e.preventDefault();
    const r = pad.getBoundingClientRect();
    cx = r.x + r.width / 2;
    cy = r.y + r.height / 2;
    pointer = e.pointerId;
    pad.setPointerCapture(pointer);
    move(e);
  });
  resources.listen<PointerEvent>(pad, 'pointermove', move);
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
    resources.listen<PointerEvent>(pad, name, (e) => {
      if (e.pointerId === pointer) stop();
    });
  for (const b of wrap.querySelectorAll<HTMLButtonElement>('button')) {
    resources.listen<PointerEvent>(b, 'pointerdown', (e) => {
      e.preventDefault();
      b.setPointerCapture(e.pointerId);
      api.key?.(b.dataset.key!, true);
    });
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
      resources.listen(b, name, () => api.key?.(b.dataset.key!, false));
  }
  resources.listen(window, 'blur', stop);
  resources.listen(document, 'visibilitychange', () => {
    if (document.hidden) stop();
  });
  resources.defer(stop);
  const update = () => {
    const s = api.getState?.() as Record<string, unknown> | undefined;
    const active =
      s &&
      !s.sitting &&
      !s.watching &&
      !s.resting &&
      !s.moonActive &&
      !s.returning &&
      (s.phase === undefined || s.phase === 'walking') &&
      (s.walking === undefined || s.walking) &&
      s.step !== 'practice';
    wrap.hidden = !active;
    const brake = wrap.querySelector<HTMLElement>('[data-key="s"]')!;
    brake.hidden = !s?.mounted;
    if (!active && pointer !== -1) stop();
  };
  const timer = setInterval(update, 150);
  resources.defer(() => clearInterval(timer));
  update();
}
