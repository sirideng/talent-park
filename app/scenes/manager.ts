import { SceneResources } from './resources';
import { recordVisit } from '../shared/preferences';
import { mountJoystick } from '../shared/joystick';
import { ownPresentation } from '../shared/presentation';
import type {
  SceneApi,
  SceneDefinition,
  SceneEvents,
  SceneId,
  SceneInstance,
} from './types';

export type SceneState = {
  sceneId: SceneId;
  status: 'loading' | 'ready' | 'error';
  error: string;
};

/** A request owns its scope even before import resolves. Stale imports cannot mount. */
export class SceneManager {
  private request = 0;
  private closed = false;
  private current: {
    resources: SceneResources;
    instance?: SceneInstance;
  } | null = null;
  private state: SceneState = {
    sceneId: 'planet',
    status: 'loading',
    error: '',
  };

  constructor(
    private host: HTMLElement,
    private registry: Readonly<Record<SceneId, SceneDefinition>>,
    private events: SceneEvents,
    private onChange: (state: SceneState, api: SceneApi | null) => void,
  ) {}

  private release() {
    const current = this.current;
    this.current = null;
    if (!current) return;
    try {
      current.instance?.exit();
    } finally {
      try {
        current.instance?.dispose();
      } finally {
        current.resources.dispose();
      }
    }
  }

  async switchTo(sceneId: SceneId) {
    if (this.closed) return;
    if (this.state.sceneId === sceneId && this.state.status === 'ready') return;
    const request = ++this.request;
    const definition = this.registry[sceneId];
    this.state = { sceneId, status: 'loading', error: '' };
    this.onChange(this.state, null);
    try {
      this.release();
      this.events.resetView();
      if (!definition || definition.status !== 'ready' || !definition.load)
        throw new Error('场景尚未开放');
      const resources = new SceneResources();
      this.current = { resources };
      const sceneModule = await definition.load();
      if (this.closed || request !== this.request || resources.signal.aborted)
        return;
      const host = document.createElement('div');
      host.style.width = '100%';
      host.style.height = '100%';
      host.dataset.sceneId = sceneId;
      this.host.appendChild(host);
      resources.defer(() => host.remove());
      const events: SceneEvents = {
        resetView: resources.guard(this.events.resetView),
        selectLocation: resources.guard(this.events.selectLocation),
        selectPlace: resources.guard(this.events.selectPlace),
        visit: resources.guard(this.events.visit),
        nearby: resources.guard(this.events.nearby),
        momentAvailable: resources.guard(this.events.momentAvailable),
        resting: resources.guard(this.events.resting),
      };
      const instance = sceneModule.create({
        host,
        resources,
        events,
        navigate: resources.guard((id) => {
          void this.switchTo(id);
        }),
      });
      this.current.instance = instance;
      instance.enter();
      if (instance.api) {
        mountJoystick(host, instance.api, resources);
        ownPresentation(host, sceneId, instance.api, resources);
      }
      if (sceneId !== 'planet') recordVisit(sceneId);
      this.state = { sceneId, status: 'ready', error: '' };
      this.onChange(this.state, instance.api);
    } catch (cause) {
      if (this.closed || request !== this.request) return;
      let failure = cause;
      try {
        this.release();
      } catch (cleanupError) {
        failure = new AggregateError(
          [cause, cleanupError],
          '场景加载与清理失败',
        );
      }
      console.error(`Scene ${sceneId} failed`, failure);
      this.state = {
        sceneId,
        status: 'error',
        error: definition?.errorMessage ?? '场景不存在。',
      };
      this.onChange(this.state, null);
    }
  }

  dispose() {
    if (this.closed) return;
    this.closed = true;
    ++this.request;
    this.release();
  }
}
