import { preparePhysics } from '../physics/player-controller';
import { createBay } from '../bay/bay-scene';
import { adaptScene } from './adapter';
import type { SceneContext } from './types';
export const prepare = preparePhysics;
export const create = (context: SceneContext) =>
  adaptScene(context, () => createBay(context));
