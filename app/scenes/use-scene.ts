'use client';

import {useCallback, useEffect, useRef, useState, type RefObject} from 'react';
import {SceneManager, type SceneState} from './manager';
import {SCENES} from './registry';
import type {SceneApi, SceneEvents, SceneId} from './types';

/** events must be memoized by the caller so UI updates never remount a scene. */
export function useScene(host: RefObject<HTMLDivElement | null>, events: SceneEvents, api: RefObject<SceneApi | null>) {
 const manager = useRef<SceneManager | null>(null);
 const [state, setState] = useState<SceneState>({sceneId: 'planet', status: 'loading', error: ''});
 useEffect(() => {
  if (!host.current) return;
  const instance = new SceneManager(host.current, SCENES, events, (next, controls) => {
   api.current = controls; setState(next);
  });
  manager.current = instance;
  void instance.switchTo('planet');
  return () => {api.current = null; manager.current = null; instance.dispose();};
 }, [host, events, api]);
 const navigate = useCallback((id: SceneId) => {void manager.current?.switchTo(id);}, []);
 return {...state, ready: state.status === 'ready', definition: SCENES[state.sceneId], navigate};
}
