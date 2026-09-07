import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const PLACES = [
 {id:'bamboo',name:'春笋天际线',description:'抬头看一眼城市。以中国华润大厦的春笋轮廓为灵感，收藏一片深圳湾的天际线。',x:-21,z:-23},
 {id:'bridge',name:'星光桥',description:'湖水从桥下经过。沿着白色桥面走到湖的另一边，看城市的倒影慢慢亮起。',x:28,z:0},
 {id:'pi',name:'π 桥',description:'用一个数学符号，连接湖岸的风景。在这座以 π 为灵感的小桥旁，留下一枚漫游印记。',x:-14,z:19},
 {id:'lake',name:'湖畔草坪',description:'坐进湖岸的晚风里。这里没有匆忙的任务，走近、停留，就算抵达。',x:4,z:25},
];

export function createPark(host:HTMLElement,onSelect:(p:typeof PLACES[number])=>void,onVisit:(id:string)=>void){
 const scene=new THREE.Scene(); scene.background=new THREE.Color('#d8e7e5');scene.fog=new THREE.Fog('#d8e7e5',160,300);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(host.clientWidth,host.clientHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;host.appendChild(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(42,host.clientWidth/host.clientHeight,.1,400);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.maxPolarAngle=Math.PI*.47;controls.minPolarAngle=.18;controls.enablePan=false;controls.minDistance=40;controls.maxDistance=165;controls.target.set(0,1,0);
 const hemi=new THREE.HemisphereLight('#d5f8ff','#57684a',2.6);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#ffe0ab',3.1);sun.position.set(-45,65,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-75,right:75,top:65,bottom:-65,near:1,far:180});sun.shadow.normalBias=.08;sun.shadow.bias=-.0002;scene.add(sun);
 const fill=new THREE.DirectionalLight('#8ed4e6',.6);fill.position.set(45,20,-40);scene.add(fill);
 const mat=(color:string,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true});
 const grass=mat('#83ae63'),grassLight=mat('#a5bd75'),earth=mat('#879984'),sand=mat('#d6d4b0'),pathmat=mat('#f1dfb8'),white=mat('#f2f0d9'),wood=mat('#a57c50'),bark=mat('#7d7250'),metal=mat('#385c61');
 const boxG=new THREE.BoxGeometry(1,1,1),cylG=new THREE.CylinderGeometry(1,1,1,12);
 function mesh(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0,parent:THREE.Object3D=scene){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,p:THREE.Object3D=scene){const o=mesh(boxG,m,x,y,z,p);o.scale.set(w,h,d);return o}
 function cyl(x:number,y:number,z:number,r:number,h:number,m:THREE.Material,p:THREE.Object3D=scene){const o=mesh(cylG,m,x,y,z,p);o.scale.set(r,h,r);return o}
 function ellipse(rx:number,rz:number,y:number,m:THREE.Material,x=0,z=0,depth=.1){const o=mesh(new THREE.CylinderGeometry(1,1,depth,100),m,x,y,z);o.scale.set(rx,1,rz);return o}
 function line(points:THREE.Vector3[],radius:number,m:THREE.Material){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(12,points.length*3),radius,6,false),m)}
 function ring(rx:number,rz:number,width:number,y:number,m:THREE.Material,cx=0,cz=0){const vertices:number[]=[],indices:number[]=[];for(let i=0;i<=160;i++){const t=i/160*Math.PI*2;vertices.push(cx+(rx-width/2)*Math.cos(t),y,cz+(rz-width/2)*Math.sin(t),cx+(rx+width/2)*Math.cos(t),y,cz+(rz+width/2)*Math.sin(t));if(i<160){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const o=mesh(g,m);o.material.side=THREE.DoubleSide;return o}
 const ground=mesh(new THREE.PlaneGeometry(2000,2000),mat('#d8e7e5'),0,-4.3,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;
 ellipse(51,36,-2,earth,0,0,4);ellipse(51.3,36.2,-.18,sand,0,0,.55);ellipse(50.7,35.7,.13,grass,0,0,.3);
 ellipse(27.2,18.3,.3,sand,3,0,.15);
 const watermat=new THREE.ShaderMaterial({uniforms:{time:{value:0},night:{value:0}},vertexShader:`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`varying vec3 vWorld;uniform float time;uniform float night;void main(){float wave=sin(vWorld.x*.85+vWorld.z*1.45+time*.8)*sin(vWorld.z*1.05-vWorld.x*.48-time*.45);float glint=pow(max(0.,sin(vWorld.x*1.1+vWorld.z*2.1+time)),24.)*.13;vec3 c=mix(vec3(.09,.48,.53),vec3(.28,.69,.66),.45+wave*.13);c+=vec3(.7,.84,.7)*glint; c=mix(c,c*vec3(.34,.48,.72),night);gl_FragColor=vec4(c,1.);}`});
 const water=mesh(new THREE.CircleGeometry(1,120),watermat,3,.4,0);water.rotation.x=-Math.PI/2;water.scale.set(26.6,17.7,1);water.castShadow=false;
 ring(29.3,20.8,2.0,.49,pathmat,3,0);ring(46.5,31.5,1.2,.35,pathmat);
 // A narrow red running ribbon follows the park perimeter.
 ring(47.9,32.5,.45,.36,mat('#c58c6a'));
 const obstacles:{x:number,z:number,r:number}[]=[];
 let seed=129;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
 const trunks:THREE.Matrix4[]=[],crowns:THREE.Matrix4[]=[],colors:THREE.Color[]=[];
 const temp=new THREE.Object3D();
 function tree(x:number,z:number,s=1){trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x,1.15*s,z),new THREE.Quaternion(),new THREE.Vector3(.14*s,1.9*s,.14*s)));temp.position.set(x,2.85*s,z);temp.rotation.set(0,rand()*6,0);temp.scale.set(1.15*s,1.55*s,1.05*s);temp.updateMatrix();crowns.push(temp.matrix.clone());colors.push(new THREE.Color().setHSL(.25+rand()*.07,.29+rand()*.13,.29+rand()*.18));obstacles.push({x,z,r:.4*s})}
 for(let i=0;i<650;i++){const x=(rand()-.5)*97,z=(rand()-.5)*66;const outer=x*x/(48*48)+z*z/(33*33);const inner=(x-3)**2/(32.5**2)+z*z/(23.7**2);if(outer>.96||inner<1||Math.abs(z+25)<2.2||Math.abs(x+20)<4&&z<-17||z>23&&x>-7&&x<17)continue;tree(x,z,.65+rand()*.75)}
 // A row of slender trees frames the promenade.
 for(let i=0;i<22;i++){const a=i/22*Math.PI*2;if(Math.abs(Math.cos(a))>.95)continue;tree(3+34.1*Math.cos(a),24.8*Math.sin(a),.72)}
 const ti=new THREE.InstancedMesh(cylG,bark,trunks.length),ci=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),mat('#598947'),crowns.length);trunks.forEach((m,i)=>ti.setMatrixAt(i,m));crowns.forEach((m,i)=>{ci.setMatrixAt(i,m);ci.setColorAt(i,colors[i])});ti.castShadow=true;ci.castShadow=true;ci.receiveShadow=true;scene.add(ti,ci);
 // Small flower drifts and warm stone clusters.
 const flowerMats=['#e9bdaf','#f3dba0','#ebd5db'].map(c=>mat(c));
 for(let i=0;i<120;i++){const x=-25+rand()*13,z=20+rand()*7;if(x*x/2401+z*z/1089>.93)continue;const o=mesh(new THREE.IcosahedronGeometry(.2+rand()*.18,0),flowerMats[i%3],x,.65,z);o.scale.y=.65}
 for(let i=0;i<25;i++){const a=rand()*6.28,x=3+27.4*Math.cos(a),z=18.8*Math.sin(a);const o=mesh(new THREE.DodecahedronGeometry(.35+rand()*.35),mat('#9da69a'),x,.5,z);o.scale.y=.5}
 // City edge: iconic tapered tower with curved structural ribs.
 const tower=new THREE.Group();tower.position.set(-20,.4,-25);scene.add(tower);
 const profile:THREE.Vector2[]=[];for(let i=0;i<=24;i++){const t=i/24;profile.push(new THREE.Vector2(.1+2.3*Math.pow(1-t,.42)*(1+.14*Math.sin(t*Math.PI)),t*27))}
 const glass=mat('#75a6ac',.28);glass.metalness=.35;mesh(new THREE.LatheGeometry(profile,40),glass,0,0,0,tower);
 for(let j=0;j<20;j++){const a=j/20*Math.PI*2,pts=profile.map(p=>new THREE.Vector3(Math.cos(a)*(p.x+.025),p.y,Math.sin(a)*(p.x+.025)));const rib=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),30,.045,4,false),white,0,0,0,tower);rib.castShadow=false}
 for(let i=1;i<22;i++){const p=profile[i];const hoop=mesh(new THREE.TorusGeometry(p.x,.025,4,40),white,0,p.y,0,tower);hoop.rotation.x=Math.PI/2;hoop.castShadow=false}
 box(-20,.6,-25,7,.5,6,white);obstacles.push({x:-20,z:-25,r:3.4});
 const citymat=mat('#87a6a3'),citylight=mat('#adc0b4');const windowmat=new THREE.MeshStandardMaterial({color:'#cfe8dc',emissive:'#ffe0a0',emissiveIntensity:0,roughness:.4});
 for(let i=0;i<9;i++){const x=-9+i*4.7,z=-27.5+Math.abs(i-4)*.28,h=3.5+rand()*8;box(x,h/2+.4,z,2.7,h,3.1,i%2?citymat:citylight);box(x,h+.5,z,2.3,.25,2.7,white);obstacles.push({x,z,r:2});for(let j=0;j<Math.floor(h/.8);j++)box(x,j*.8+1,z+1.57,2,.13,.035,windowmat)}
 // East-side arched footbridge follows the shore, with white rails.
 const bridgePts:THREE.Vector3[]=[];for(let i=0;i<=26;i++){const t=i/26;bridgePts.push(new THREE.Vector3(28+2.1*Math.sin(t*Math.PI),.8+1.1*Math.sin(t*Math.PI),-12+24*t))}
 for(let i=0;i<26;i++){const a=bridgePts[i],b=bridgePts[i+1],mid=a.clone().add(b).multiplyScalar(.5);const deck=box(mid.x,mid.y,mid.z,2,.2,a.distanceTo(b)+.05,white);deck.rotation.y=Math.atan2(b.x-a.x,b.z-a.z);for(const side of [-1,1]){box(a.x+side*.95,a.y+.5,a.z,.065,1,.065,white)}}
 for(const side of [-1,1])line(bridgePts.map(p=>new THREE.Vector3(p.x+side*.95,p.y+1,p.z)),.045,white);
 // Pi sculpture and a small timber outlook.
 box(-14,.65,19,7,.35,3.4,wood);for(const x of [-15.1,-12.9])box(x,2.0,19,.25,2.5,.3,white);box(-14,3.3,19,3.5,.35,.4,white);
 box(4,.5,23.8,13,.25,4.5,grassLight);box(4,.6,21.5,11,.3,2.4,wood);
 for(let i=0;i<14;i++)box(-1.4+i*.8,.78,21.5,.055,.045,2.4,sand);
 // Park furniture and pedestrian-scale lights.
 const lamps:THREE.Mesh[]=[];const lampMat=new THREE.MeshStandardMaterial({color:'#fff2ba',emissive:'#ffce7a',emissiveIntensity:.25});
 for(let i=0;i<30;i++){const a=i/30*Math.PI*2,x=3+31*Math.cos(a),z=22.5*Math.sin(a);cyl(x,1.65,z,.055,2.6,metal);const lamp=mesh(new THREE.SphereGeometry(.17,8,6),lampMat,x,3,z);lamps.push(lamp);if(i%3===0){const bench=new THREE.Group();bench.position.set(x,.48,z);bench.rotation.y=-a+Math.PI/2;scene.add(bench);box(0,.5,0,1.6,.12,.6,wood,bench);box(0,.9,.27,1.6,.5,.09,wood,bench);for(const b of [-.55,.55])box(b,.25,0,.12,.5,.45,metal,bench)}}
 // A few tiny visitors add scale without expensive character rigs.
 const visitorColors=['#e9a663','#f5e8c9','#89b6bd','#d78f87'];
 for(let i=0;i<17;i++){const a=rand()*6.28,x=3+29.2*Math.cos(a),z=20.7*Math.sin(a);cyl(x,1,z,.16,.6,mat(visitorColors[i%4]));mesh(new THREE.SphereGeometry(.18,8,6),sand,x,1.48,z)}
 const duck=new THREE.Group();scene.add(duck);mesh(new THREE.SphereGeometry(.3,10,8),white,0,.62,0,duck).scale.set(1.5,.7,1);mesh(new THREE.SphereGeometry(.18,8,6),white,.3,.85,0,duck);box(.5,.83,0,.23,.08,.1,mat('#dcaa51'),duck);
 // Clickable place labels are functional map markers.
 const pickables:THREE.Object3D[]=[],markerGroups:THREE.Group[]=[];const textures:THREE.Texture[]=[];
 PLACES.forEach((p,index)=>{const g=new THREE.Group();g.position.set(p.x,4.5,p.z);scene.add(g);markerGroups.push(g);const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#f7fbef';ctx.beginPath();ctx.roundRect(3,5,506,112,56);ctx.fill();ctx.fillStyle='#28595a';ctx.font='600 42px Arial, Microsoft YaHei';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`0${index+1}  ${p.name}`,256,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true}));s.scale.set(8.5,2.12,1);s.userData.place=p;s.renderOrder=5;g.add(s);pickables.push(s);const pin=mesh(new THREE.OctahedronGeometry(.32),mat('#edb468'),p.x,1.9,p.z);pin.userData.place=p;pickables.push(pin)});
 // A small explorer with a backpack, articulated legs and a sun hat.
 const player=new THREE.Group();player.position.set(4,.52,25);scene.add(player);const shirt=mat('#df8856'),skin=mat('#efd1a4'),pants=mat('#3b6267');
 const body=box(0,.85,0,.5,.62,.32,shirt,player);mesh(new THREE.SphereGeometry(.23,12,8),skin,0,1.4,0,player);cyl(0,1.58,0,.32,.07,sand,player);cyl(0,1.64,0,.23,.15,sand,player);box(0,.89,.23,.37,.45,.17,mat('#ddc28a'),player);
 const legs=[box(-.14,.3,0,.17,.55,.2,pants,player),box(.14,.3,0,.17,.55,.2,pants,player)];box(-.34,.85,0,.14,.53,.15,skin,player);box(.34,.85,0,.14,.53,.15,skin,player);
 const halo=mesh(new THREE.RingGeometry(.6,.7,36),new THREE.MeshBasicMaterial({color:'#fff0ad',side:THREE.DoubleSide}),0,.02,0,player);halo.rotation.x=-Math.PI/2;player.visible=false;
 let walking=false,night=false,frame=0,last=performance.now(),elapsed=0,selectedId='',dead=false;const keys=new Set<string>(),visited=new Set<string>();
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let downX=0,downY=0;
 const pointerDown=(e:PointerEvent)=>{downX=e.clientX;downY=e.clientY};
 const pointerUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-downX,e.clientY-downY)>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(pickables);if(hits.length)onSelect(hits[0].object.userData.place)};
 renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
 const keyDown=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&(['INPUT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable))return;if(walking&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase())};const keyUp=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());const blur=()=>keys.clear();window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',blur);
 function canWalk(x:number,z:number){if(x*x/(49.5**2)+z*z/(34.5**2)>1)return false;const lake=(x-3)**2/(27.7**2)+z*z/(18.8**2)<1;const bridge=Math.abs(x-(28+2.1*Math.sin((z+12)/24*Math.PI)))<.8&&Math.abs(z)<12.5;const lookout=x>-1.5&&x<9.5&&z>20.3&&z<23;return(!lake||bridge||lookout)&&!obstacles.some(o=>(x-o.x)**2+(z-o.z)**2<(o.r+.3)**2)}
 function setWalking(value:boolean){walking=value;player.visible=value;keys.clear();if(value){controls.minDistance=5;controls.maxDistance=25;controls.maxPolarAngle=Math.PI*.47;controls.target.copy(player.position).add(new THREE.Vector3(0,1,0));camera.position.copy(controls.target).add(new THREE.Vector3(8,9,13))}else reset();controls.update()}
 function reset(){if(walking){controls.target.copy(player.position).add(new THREE.Vector3(0,1,0));camera.position.copy(controls.target).add(new THREE.Vector3(8,9,13))}else{controls.minDistance=40;controls.maxDistance=165;controls.target.set(0,1,0);const mobile=host.clientWidth<650;camera.position.set(mobile?96:72,mobile?97:73,mobile?116:87)}controls.update()}
 function setNight(value:boolean){night=value;scene.background=new THREE.Color(value?'#102b38':'#d8e7e5');(scene.fog as THREE.Fog).color.copy(scene.background);(ground.material as THREE.MeshStandardMaterial).color.set(value?'#102b38':'#d8e7e5');hemi.intensity=value?.85:2.6;sun.intensity=value?.5:3.1;sun.color.set(value?'#94b8e2':'#ffe0ab');lampMat.emissiveIntensity=value?4:.25;windowmat.emissiveIntensity=value?1.6:0;watermat.uniforms.night.value=value?1:0}
 const resize=()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight)};const observer=new ResizeObserver(resize);observer.observe(host);reset();
 function animate(now:number){if(dead)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;watermat.uniforms.time.value=elapsed;duck.position.set(8+Math.cos(elapsed*.09)*4,0,5+Math.sin(elapsed*.09)*3);duck.rotation.y=-elapsed*.09;
 if(walking){let dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),dz=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));if(dx||dz){const forward=camera.position.clone().sub(controls.target);forward.y=0;forward.normalize();const right=new THREE.Vector3(forward.z,0,-forward.x);const move=forward.multiplyScalar(dz).add(right.multiplyScalar(dx)).normalize().multiplyScalar(dt*(keys.has('shift')?7:3.8));const before=player.position.clone();if(canWalk(player.position.x+move.x,player.position.z))player.position.x+=move.x;if(canWalk(player.position.x,player.position.z+move.z))player.position.z+=move.z;player.rotation.y=Math.atan2(move.x,move.z)+Math.PI;const delta=player.position.clone().sub(before);camera.position.add(delta);controls.target.add(delta);legs[0].rotation.x=Math.sin(elapsed*12)*.5;legs[1].rotation.x=-legs[0].rotation.x;body.position.y=.85+Math.abs(Math.sin(elapsed*12))*.035}else{legs.forEach(l=>l.rotation.x=0)}
 const onBridge=Math.abs(player.position.x-(28+2.1*Math.sin((player.position.z+12)/24*Math.PI)))<1&&Math.abs(player.position.z)<12.5;player.position.y=onBridge?.92+1.1*Math.sin((player.position.z+12)/24*Math.PI):.52;
 for(const p of PLACES){if(Math.hypot(player.position.x-p.x,player.position.z-p.z)<4&&!visited.has(p.id)){visited.add(p.id);onVisit(p.id);if(selectedId!==p.id){selectedId=p.id;onSelect(p)}}}}
 markerGroups.forEach((g,i)=>{g.position.y=4.5+Math.sin(elapsed*1.2+i)*.14;g.visible=!walking||player.position.distanceTo(g.position)<20});controls.update();renderer.render(scene,camera)}frame=requestAnimationFrame(animate);
 return {setWalking,setNight,reset,zoom:(f:number)=>{const v=camera.position.clone().sub(controls.target);v.multiplyScalar(f).clampLength(controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(v);controls.update()},key:(k:string,pressed:boolean)=>pressed?keys.add(k.toLowerCase()):keys.delete(k.toLowerCase()),getState:()=>({walking,night,visited:[...visited],position:{x:player.position.x,z:player.position.z}}),dispose:()=>{dead=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Mesh){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m))}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove()}}
}
