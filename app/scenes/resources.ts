/** One lifetime for listeners, animation, observers, audio and GPU resources. */
export class SceneResources {
 private controller = new AbortController();
 private cleanups: (() => void)[] = [];
 get signal() {return this.controller.signal;}

 defer(cleanup: () => void) {
  if (this.signal.aborted) cleanup();
  else this.cleanups.push(cleanup);
 }

 listen<T extends Event>(target: EventTarget, type: string, listener: (event: T) => void, options?: boolean | AddEventListenerOptions) {
  target.addEventListener(type, listener as EventListener, options);
  this.defer(() => target.removeEventListener(type, listener as EventListener, options));
 }

 guard<T extends unknown[]>(callback: (...args: T) => void) {
  return (...args: T) => {if (!this.signal.aborted) callback(...args);};
 }

 dispose() {
  if (this.signal.aborted) return;
  this.controller.abort();
  const errors: unknown[] = [];
  for (const cleanup of this.cleanups.splice(0).reverse()) {
   try {cleanup();} catch (error) {errors.push(error);}
  }
  if (errors.length) throw new AggregateError(errors, '场景资源清理失败');
 }
}
