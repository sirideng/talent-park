import {createPark} from '../park';
import {adaptScene} from './adapter';
import type {SceneContext} from './types';
export {preparePhysics as prepare} from '../physics/player-controller';

export function create(context: SceneContext) {
 const events = context.events;
 return adaptScene(context, () => createPark(
  context.host, events.selectPlace, events.visit, events.nearby,
  events.momentAvailable, events.resting, context.resources,
 ));
}
