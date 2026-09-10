import { preparePhysics } from '../physics/player-controller';
import { createHarbor } from '../harbor/harbor-scene';
import { adaptScene } from './adapter';
import type { SceneContext } from './types';
export const prepare = preparePhysics;
export const create = (context: SceneContext) =>
  adaptScene(context, () => createHarbor(context));
