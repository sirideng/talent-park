export type MemoryLocation = {
 id:string;
 name:string;
 shortName:string;
 chapter:string;
 status:'ready'|'planned';
 description:string;
 planet:{x:number;z:number};
};

// A single registry keeps the planet independent from the detailed scene files.
// New memories can be added here first, then connected to their own scene later.
export const MEMORY_LOCATIONS:MemoryLocation[]=[
 {id:'talent-park',name:'深圳人才公园',shortName:'人才公园',chapter:'01',status:'ready',description:'第一段已经可以进入的记忆：沿湖散步，在草坪等日落，也在星光桥停下来看看后海。',planet:{x:-2.8,z:3.2}},
 {id:'shenzhen-bay',name:'深圳湾沿岸',shortName:'深圳湾',chapter:'02',status:'planned',description:'从人才公园向西延伸的滨海散步与骑行路线。',planet:{x:-5.6,z:5.2}},
 {id:'sea-world',name:'海上世界 · K11',shortName:'海上世界',chapter:'03',status:'planned',description:'海风、港湾与夜色中的城市灯光。',planet:{x:-9.7,z:6.4}},
 {id:'ping-an',name:'平安金融中心',shortName:'平安中心',chapter:'04',status:'planned',description:'从城市中心登高，看深圳向四周展开。',planet:{x:4.2,z:1.4}},
 {id:'happy-harbor',name:'欢乐港湾',shortName:'欢乐港湾',chapter:'05',status:'planned',description:'摩天轮、滨海广场和慢慢亮起的夜景。',planet:{x:-12.1,z:1.7}},
 {id:'wutong',name:'梧桐山',shortName:'梧桐山',chapter:'06',status:'planned',description:'穿过树林和薄雾，在山顶俯瞰生活过的城市。',planet:{x:12.0,z:-5.0}},
 {id:'school',name:'北京师范大学南山附属学校',shortName:'我的中学',chapter:'07',status:'planned',description:'校门、操场、走廊，以及只有你知道意义的位置。',planet:{x:-5.3,z:1.1}},
 {id:'szu',name:'深圳大学',shortName:'深圳大学',chapter:'08',status:'planned',description:'校园、林荫路与成长中的城市日常。',planet:{x:-7.0,z:-.4}},
 {id:'tech-park',name:'深圳科技园',shortName:'科技园',chapter:'09',status:'planned',description:'高楼之间的工作、学习与城市速度。',planet:{x:-2.8,z:-1.1}},
];

export const TALENT_PARK=MEMORY_LOCATIONS[0];
