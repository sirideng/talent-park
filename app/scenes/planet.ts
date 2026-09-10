import {createPlanet} from '../planet';
import {adaptScene} from './adapter';
import type {SceneContext} from './types';

export function create(context: SceneContext) {
 return adaptScene(context, () => createPlanet(
  context.host, location => context.navigate(location.id), context.events.selectLocation, context.resources,
 ));
}
