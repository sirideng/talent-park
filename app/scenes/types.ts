import type {MemoryLocation} from '../locations';
import type {MemoryMoment} from '../park';
import type {SceneResources} from './resources';

export type SceneId = 'planet' | 'talent-park' | 'happy-harbor' | 'shenzhen-bay'
 | 'wutong' | 'school' | 'sea-world' | 'ping-an' | 'szu' | 'tech-park';
export type Place = {id: string; name: string; description: string};

/** Optional capabilities: a scene only implements interactions it supports. */
export interface SceneApi {
 zoom?: (factor: number) => void;
 reset?: () => void;
 enterLocation?: (location: MemoryLocation) => void;
 focusLocation?: (location: MemoryLocation) => void;
 previewLocation?: (location: MemoryLocation | null) => void;
 setWalking?: (value: boolean) => void;
 setNight?: (value: boolean) => void;
 setSitting?: (value: boolean, withSound?: boolean) => void;
 setSound?: (value: boolean) => void;
 interact?: () => void;
 key?: (key: string, pressed: boolean) => void;
 getState?: () => unknown;
}

export interface SceneEvents {
 resetView: () => void;
 selectLocation: (location: MemoryLocation) => void;
 selectPlace: (place: Place | null) => void;
 visit: (id: string) => void;
 nearby: (place: Place | null) => void;
 momentAvailable: (moment: MemoryMoment | null) => void;
 resting: (value: boolean, moment: MemoryMoment | null) => void;
}

export interface SceneContext {
 host: HTMLElement;
 resources: SceneResources;
 events: SceneEvents;
 navigate: (id: SceneId) => void;
}

/** create allocates a handle; enter mounts it once; exit releases it permanently. */
export interface SceneInstance {
 readonly api: SceneApi | null;
 enter: () => void;
 exit: () => void;
 dispose: () => void;
}

export interface SceneModule {create: (context: SceneContext) => SceneInstance}
export interface SceneDefinition {
 id: SceneId;
 name: string;
 layout: 'globe' | 'explore';
 ui?: {className:string;eyebrow:string;ownHud:boolean};
 loadingMessage: string;
 errorMessage: string;
 ariaLabel: string;
 status: 'ready' | 'planned';
 load?: () => Promise<SceneModule>;
}
