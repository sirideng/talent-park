import type {SceneApi, SceneContext, SceneInstance} from './types';

/** Keeps existing factories intact while giving them a common lifecycle. */
export function adaptScene(context: SceneContext, mount: () => SceneApi & {dispose: () => void}): SceneInstance {
 let api: (SceneApi & {dispose: () => void}) | null = null;
 const exit = () => {
  const mounted = api;
  api = null;
  try {mounted?.dispose();} finally {context.resources.dispose();}
 };
 return {
  get api() {return api;},
  enter() {
   if (context.resources.signal.aborted) throw new Error('不能重新进入已销毁的场景');
   if (!api) api = mount();
  },
  exit,
  dispose: exit,
 };
}
