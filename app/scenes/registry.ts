import type {SceneDefinition, SceneId} from './types';

function planned(id: SceneId, name: string): SceneDefinition {
 return {id, name, status: 'planned', layout: 'explore', loadingMessage: `正在展开${name}…`,
  errorMessage: `${name}仍在等待建造。`, ariaLabel: name};
}

/** Only ready entries load code. Planned entries do not create placeholder worlds. */
export const SCENES: Readonly<Record<SceneId, SceneDefinition>> = {
 planet: {id: 'planet', name: '深圳成长记忆', status: 'ready', layout: 'globe',
  loadingMessage: '正在点亮深圳记忆星球…', errorMessage: '深圳记忆星球暂时无法启动，请刷新后再试。',
  ariaLabel: '可旋转探索的深圳记忆星球', load: () => import('./planet')},
 'talent-park': {id: 'talent-park', name: '人才公园', status: 'ready', layout: 'explore',
  loadingMessage: '正在展开你的小小公园…', errorMessage: '3D 场景暂时无法启动，请使用开启硬件加速的新版浏览器后刷新。',
  ariaLabel: '可拖动旋转、滚轮缩放的 3D 人才公园', load: async () => {const sceneModule=await import('./talent-park');await sceneModule.prepare();return sceneModule;}},
 'happy-harbor': {id:'happy-harbor',name:'欢乐港湾',status:'ready',layout:'explore',ui:{className:'harbor-mode',eyebrow:'SHENZHEN · ABOVE THE BAY',ownHud:true},loadingMessage:'湾区之光正在亮起…',errorMessage:'欢乐港湾暂时无法展开，请重试。',ariaLabel:'可乘坐湾区之光摩天轮的欢乐港湾',load:async()=>{const chapter=await import('./happy-harbor');await chapter.prepare();return chapter;}},
 'shenzhen-bay': {id:'shenzhen-bay',name:'深圳湾 · 海风抵达清晨',status:'ready',layout:'explore',ui:{className:'bay-mode',eyebrow:'SHENZHEN · FIRST LIGHT',ownHud:true},loadingMessage:'海风正在抵达…',errorMessage:'深圳湾暂时无法展开，请重试。',ariaLabel:'可骑行与漫游的深圳湾记忆章节',load:async()=>{const chapter=await import('./shenzhen-bay');await chapter.prepare();return chapter;}},
 wutong: planned('wutong', '梧桐山'),
 school: {id:'school',name:'北京师范大学南山附属中学',status:'ready',layout:'explore',ui:{className:'school-mode',eyebrow:'SHENZHEN · AFTER SCHOOL',ownHud:true},loadingMessage:'正在走进放学后的操场…',errorMessage:'校园暂时无法展开，请重试。',ariaLabel:'可漫游的学校记忆章节',load:async()=>{const chapter=await import('./school');await chapter.prepare();return chapter;}},
 'sea-world': planned('sea-world', '海上世界 · K11'),
 'ping-an': planned('ping-an', '平安金融中心'),
 szu: planned('szu', '深圳大学'),
 'tech-park': planned('tech-park', '深圳科技园'),
};
