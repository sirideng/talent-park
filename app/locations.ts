import {SCENES} from './scenes/registry';
import type {SceneId} from './scenes/types';

export type MemoryLocation = {
 id:Exclude<SceneId, 'planet'>;
 name:string;
 shortName:string;
 chapter:string;
 status:'ready'|'planned';
 description:string;
 planet:{x:number;z:number};
};

// A single registry keeps the planet independent from the detailed scene files.
// New memories can be added here first, then connected to their own scene later.
const LOCATION_DETAILS:Omit<MemoryLocation, 'status'>[]=[
 {id:'talent-park',name:'深圳人才公园',shortName:'人才公园',chapter:'01',description:'第一段已经可以进入的记忆：沿湖散步，在草坪等日落，也在星光桥停下来看看后海。',planet:{x:-2.8,z:3.2}},
 {id:'shenzhen-bay',name:'深圳湾沿岸',shortName:'深圳湾',chapter:'02',description:'从人才公园向西延伸的滨海散步与骑行路线。',planet:{x:-5.6,z:5.2}},
 {id:'sea-world',name:'海上世界 · K11',shortName:'海上世界',chapter:'03',description:'海风、港湾与夜色中的城市灯光。',planet:{x:-9.7,z:6.4}},
 {id:'ping-an',name:'平安金融中心',shortName:'平安中心',chapter:'04',description:'从城市中心登高，看深圳向四周展开。',planet:{x:4.2,z:1.4}},
 {id:'happy-harbor',name:'欢乐港湾',shortName:'欢乐港湾',chapter:'05',description:'摩天轮、滨海广场和慢慢亮起的夜景。',planet:{x:-12.1,z:1.7}},
 {id:'wutong',name:'梧桐山',shortName:'梧桐山',chapter:'06',description:'穿过树林和薄雾，在山顶俯瞰生活过的城市。',planet:{x:12.0,z:-5.0}},
 {id:'school',name:'北京师范大学南山附属中学',shortName:'我的中学',chapter:'07',description:'校门、操场、走廊，以及只有你知道意义的位置。',planet:{x:-5.3,z:1.1}},
 {id:'szu',name:'深圳大学',shortName:'深圳大学',chapter:'08',description:'校园、林荫路与成长中的城市日常。',planet:{x:-7.0,z:-.4}},
 {id:'tech-park',name:'深圳科技园',shortName:'科技园',chapter:'09',description:'高楼之间的工作、学习与城市速度。',planet:{x:-2.8,z:-1.1}},
];

export const MEMORY_LOCATIONS:MemoryLocation[]=LOCATION_DETAILS.map(location=>({...location,status:SCENES[location.id].status}));
export const TALENT_PARK=MEMORY_LOCATIONS[0];
// Only these five memories have overview silhouettes in this stage.
export const PLANET_LOCATIONS=MEMORY_LOCATIONS.filter(location=>['talent-park','shenzhen-bay','happy-harbor','wutong','school'].includes(location.id));
