'use client';

import {useEffect,useRef,useState} from 'react';
import {ArrowDown,ArrowLeft,ArrowRight,ArrowUp,Armchair,Compass,Footprints,Globe2,MapPin,Minus,Moon,Plus,RotateCcw,Sun,Volume2,VolumeX,X} from 'lucide-react';
import {MEMORY_LOCATIONS,TALENT_PARK,type MemoryLocation} from './locations';
import type {MemoryMoment} from './park';

type WorldView='planet'|'park';
type ParkPlace={id:string;name:string;description:string};
type SceneApi={dispose:()=>void;zoom:(factor:number)=>void;reset:()=>void;enterLocation?:(location:MemoryLocation)=>void;setWalking?:(value:boolean)=>void;setNight?:(value:boolean)=>void;setSitting?:(value:boolean,withSound?:boolean)=>void;setSound?:(value:boolean)=>void;interact?:()=>void;key?:(key:string,pressed:boolean)=>void;getState?:()=>unknown};
type ViewInput={mode:'overview'|'walk';night:boolean};
type ModelContext={registerTool:(definition:unknown,options:{signal:AbortSignal})=>unknown};
const TOUCH_KEYS=[["ArrowUp",ArrowUp],["ArrowLeft",ArrowLeft],["ArrowDown",ArrowDown],["ArrowRight",ArrowRight]] as const;
function isViewInput(input:unknown):input is ViewInput{return typeof input==='object'&&input!==null&&'mode'in input&&'night'in input&&((input as ViewInput).mode==='overview'||(input as ViewInput).mode==='walk')&&typeof (input as ViewInput).night==='boolean'&&Object.keys(input).every(key=>key==='mode'||key==='night')}

export default function Home(){
 const mount=useRef<HTMLDivElement>(null),api=useRef<SceneApi|null>(null);
 const [view,setView]=useState<WorldView>('planet'),[ready,setReady]=useState(false),[error,setError]=useState('');
 const [nearby,setNearby]=useState<ParkPlace|null>(null),[momentAvailable,setMomentAvailable]=useState<MemoryMoment|null>(null),[activeMoment,setActiveMoment]=useState<MemoryMoment|null>(null);
 const [resting,setResting]=useState(false),[soundOn,setSoundOn]=useState(true),[walking,setWalking]=useState(false),[night,setNight]=useState(false),[selected,setSelected]=useState<ParkPlace|null>(null),[selectedLocation,setSelectedLocation]=useState<MemoryLocation>(TALENT_PARK),[visited,setVisited]=useState<string[]>([]);

 useEffect(()=>{
  let cleanup:(()=>void)|undefined,disposed=false;
  if(view==='planet'){
   import('./planet').then(({createPlanet})=>{if(disposed||!mount.current)return;const planet=createPlanet(mount.current,()=>{setReady(false);setError('');setSelected(null);setView('park')},setSelectedLocation);api.current=planet;cleanup=planet.dispose;setReady(true)}).catch(()=>setError('深圳记忆星球暂时无法启动，请刷新后再试。'));
  }else{
   import('./park').then(({createPark})=>{if(disposed||!mount.current)return;const park=createPark(mount.current,setSelected,(id:string)=>setVisited(v=>v.includes(id)?v:[...v,id]),setNearby,setMomentAvailable,(value:boolean,moment:MemoryMoment|null)=>{setResting(value);setActiveMoment(value?moment:null);if(value)setNight(true)});api.current=park;cleanup=park.dispose;setReady(true)}).catch(()=>setError('3D 场景暂时无法启动，请使用开启硬件加速的新版浏览器后刷新。'));
  }
  return()=>{disposed=true;cleanup?.();api.current=null};
 },[view]);

 function mode(value:boolean){setWalking(value);api.current?.setWalking?.(value);setSelected(null)}
 function beginMoment(){setSelected(null);setNight(true);api.current?.setNight?.(true);api.current?.setSitting?.(true,soundOn)}
 function leaveMoment(){api.current?.setSitting?.(false)}
 function toggleSound(){const next=!soundOn;setSoundOn(next);api.current?.setSound?.(next)}
 function returnToPlanet(){setReady(false);setError('');setWalking(false);setNight(false);setSelected(null);setNearby(null);setMomentAvailable(null);setResting(false);setActiveMoment(null);setView('planet')}

 useEffect(()=>{if(!ready||view!=='park')return;const context=(document as Document&{modelContext?:ModelContext}).modelContext;if(!context?.registerTool)return;const lifecycle=new AbortController();const definitions=[{name:'read_park_state',description:'读取当前公园视角、日夜状态、人物位置和已抵达的景点。',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute:()=>api.current?.getState?.()},{name:'configure_park_view',description:'切换俯瞰或步行视角与日夜效果，与页面按钮同步。不会替玩家打卡。',inputSchema:{type:'object',properties:{mode:{type:'string',enum:['overview','walk']},night:{type:'boolean'}},required:['mode','night'],additionalProperties:false},annotations:{readOnlyHint:false},execute:async(input:unknown)=>{if(!isViewInput(input))throw new Error('请输入有效的 mode 和 night');mode(input.mode==='walk');setNight(input.night);api.current?.setNight?.(input.night);await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));return api.current?.getState?.()}}];definitions.forEach(tool=>{try{Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{})}catch{}});return()=>lifecycle.abort()},[ready,view]);

 const planet=view==='planet';
 return <main className={`park-app memory-world${planet?' planet-mode':''}${night?' night':''}${walking?' walking':''}${resting?' sitting':''}`}>
  <div ref={mount} className="scene" aria-label={planet?'可旋转探索的深圳记忆星球':'可拖动旋转、滚轮缩放的 3D 人才公园'}/>
  <header className="masthead"><div className="brand-mark">{planet?<Globe2 size={26}/>:<Compass size={26}/>}</div><div><div className="eyebrow">{planet?'MY SHENZHEN · MEMORY PLANET':'SHENZHEN · POCKET PARK'}</div><h1>{planet?'深圳成长记忆':'人才公园'}<span>{planet?'一颗慢慢长大的星球':'微缩漫游'}</span></h1></div></header>
  {!planet&&<button className="back-to-planet" onClick={returnToPlanet}><Globe2 size={16}/>返回记忆星球</button>}
  {planet?<>
   <section className="planet-intro"><span className="chapter">SHENZHEN · 22.54° N</span><h2>把走过的地方，<br/>放进一颗星球。</h2><p>第一束光已经落在人才公园。拖动星球，看看未来会长出的记忆。</p></section>
   <div className="planet-status"><span className="live-dot"/><span>1 个地点已经展开</span></div>
   <section className="location-card" aria-live="polite"><div className="eyebrow">MEMORY {selectedLocation.chapter} · {selectedLocation.status==='ready'?'可进入':'等待建造'}</div><h3>{selectedLocation.name}</h3><p>{selectedLocation.description}</p>{selectedLocation.status==='ready'?<button onClick={()=>api.current?.enterLocation?.(selectedLocation)}><Footprints size={17}/>走进这段记忆</button>:<span className="planned-note">先在星球上为它留一个位置</span>}</section>
   <div className="planet-tools"><button className="icon-button" aria-label="放大星球" onClick={()=>api.current?.zoom(.82)}><Plus size={19}/></button><button className="icon-button" aria-label="缩小星球" onClick={()=>api.current?.zoom(1.22)}><Minus size={19}/></button><button className="icon-button" aria-label="重置星球视角" onClick={()=>api.current?.reset()}><RotateCcw size={18}/></button></div>
   <nav className="memory-route" aria-label="深圳记忆地点">{MEMORY_LOCATIONS.map(location=><button key={location.id} className={`${location.status} ${selectedLocation.id===location.id?'selected':''}`} onClick={()=>{setSelectedLocation(location);if(location.status==='ready')api.current?.enterLocation?.(location)}}><span>{location.chapter}</span>{location.shortName}</button>)}</nav>
  </>:<>
   <div className="top-right"><span className="live-dot"/><span>{night?'灯火初上':'日落之前'}</span><button className="icon-button" aria-label={night?'切换日落':'切换夜景'} onClick={()=>{setNight(!night);api.current?.setNight?.(!night)}}>{night?<Sun size={19}/>:<Moon size={19}/>}</button></div>
   <section className="intro" aria-hidden={walking}><span className="chapter">01 / 城市里的小小绿洲</span><h2>把城市放慢一点。</h2><p>沿着湖岸，也可以走到更远的街区。</p><div className="coordinates">22.51° N &nbsp; 113.94° E</div></section>
   <div className="view-tools"><button className="icon-button" aria-label="放大" onClick={()=>api.current?.zoom(.8)}><Plus size={19}/></button><button className="icon-button" aria-label="缩小" onClick={()=>api.current?.zoom(1.25)}><Minus size={19}/></button><span/><button className="icon-button" aria-label="重置视角" onClick={()=>api.current?.reset()}><RotateCcw size={18}/></button></div>
   <div className="compass"><span>N</span><Compass size={32} strokeWidth={1}/></div>
   {walking&&momentAvailable&&!resting&&!selected&&<button className="nearby-prompt rest-prompt" onClick={beginMoment}><Armchair size={17}/><span>{momentAvailable.prompt}</span><span className="prompt-action">{momentAvailable.action} <kbd>E</kbd></span></button>}
   {walking&&!momentAvailable&&!resting&&nearby&&!selected&&<button className="nearby-prompt" onClick={()=>api.current?.interact?.()}><MapPin size={16}/><span>{nearby.name}</span><span className="prompt-action">停下来看看 <kbd>E</kbd></span></button>}
   {resting&&activeMoment&&<section className="resting-panel" aria-live="polite"><div className="resting-eyebrow">人才公园 · {activeMoment.name}</div><p>{activeMoment.description}</p><div><button className="sound-button" onClick={toggleSound} aria-label={soundOn?'关闭环境声':'开启环境声'}>{soundOn?<Volume2 size={18}/>:<VolumeX size={18}/>}<span>{soundOn?'风声与水声':'开启环境声'}</span></button><button className="stand-button" onClick={leaveMoment}><Footprints size={18}/>继续走</button></div></section>}
   {selected&&<section className="place-card"><button className="close" aria-label="关闭景点介绍" onClick={()=>setSelected(null)}><X size={18}/></button><div className="eyebrow">PARK DISCOVERY</div><h3>{selected.name}</h3><p>{selected.description}</p><span><MapPin size={14}/>{visited.includes(selected.id)?'已抵达 · 留下一段小小记忆':'进入漫游，走近后主动留下印记'}</span></section>}
   <footer className="bottom-bar"><div className="mode-controls"><button className={!walking?'active':''} onClick={()=>mode(false)}><Compass size={18}/>俯瞰公园</button><button className={walking?'active':''} onClick={()=>mode(true)}><Footprints size={18}/>进入漫游</button></div><div className="instruction">{walking?'W A S D / 方向键移动 · 上下拖动抬头或低头 · Shift 加速 · 空格跳跃':'拖动旋转 · 滚轮缩放 · 点击地标探索'}</div><div className="stamp-count"><MapPin size={17}/><strong>{visited.length}<span> / 6</span></strong><span>漫游印记</span></div></footer>
   {walking&&<div className="touch-pad">{TOUCH_KEYS.map(([key,Icon])=><button key={key} aria-label={key} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);api.current?.key?.(key,true)}} onPointerUp={()=>api.current?.key?.(key,false)} onPointerCancel={()=>api.current?.key?.(key,false)}><Icon size={24}/></button>)}</div>}
   <div className="map-note">依公开总平面与实景还原 · 非测绘模型</div>
  </>}
  {!ready&&<div className="loading"><Compass size={36}/><p>{error||(planet?'正在点亮深圳记忆星球…':'正在展开你的小小公园…')}</p>{error&&<button onClick={()=>location.reload()}>重新加载</button>}</div>}
 </main>;
}
