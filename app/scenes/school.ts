import { preparePhysics } from '../physics/player-controller';
import { createSchool } from '../school/school-scene';
import { adaptScene } from './adapter';
import type { SceneContext } from './types';
export const prepare = preparePhysics;
export const create = (context: SceneContext) =>
  adaptScene(context, () => createSchool(context));
