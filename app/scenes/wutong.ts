import { preparePhysics } from '../physics/player-controller';
import { createWutong } from '../wutong/wutong-scene';
import { adaptScene } from './adapter';
import type { SceneContext } from './types';
export const prepare = preparePhysics;
export const create = (context: SceneContext) =>
  adaptScene(context, () => createWutong(context));
