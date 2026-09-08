import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createWavePlaza, wavePlaza } from './wave-plaza';
import { boundary, lake, northWater, starBridge, piBridge, northBridge, shoreWalk, northWalk, southWalk, tideCenter, spawn, places, inside, isWater, distanceToPath, groundHeight, bridgeHeight, walkable, type Point } from './geography';

export const PLACES = places;

export type MemoryMoment={
 id:string;
 name:string;
 prompt:string;
 action:string;
 description:string;
 position:THREE.Vector2;
 radius:number;
 pose:'sit'|'stand';
 cameraOffset:THREE.Vector3;
 targetOffset:THREE.Vector3;
};

export function createPark(host:HTMLElement,onSelect:(p:typeof PLACES[number])=>void,onVisit:(id:string)=>void,onNearby:(p:typeof PLACES[number]|null)=>void,onMomentAvailable:(moment:MemoryMoment|null)=>void,onResting:(value:boolean,moment:MemoryMoment|null)=>void){
 const scene=new THREE.Scene(); scene.background=new THREE.Color('#d8e7e5');scene.fog=new THREE.Fog('#d8e7e5',160,300);
 const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(host.clientWidth,host.clientHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;host.appendChild(renderer.domElement);
 const camera=new THREE.PerspectiveCamera(42,host.clientWidth/host.clientHeight,.5,650);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;controls.maxPolarAngle=Math.PI*.47;controls.minPolarAngle=.18;controls.enablePan=false;controls.minDistance=40;controls.maxDistance=210;controls.target.set(0,1,0);
 const hemi=new THREE.HemisphereLight('#d5f8ff','#57684a',2.6);scene.add(hemi);
 const sun=new THREE.DirectionalLight('#ffe0ab',3.1);sun.position.set(-45,65,30);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-75,right:75,top:65,bottom:-65,near:1,far:180});sun.shadow.normalBias=.08;sun.shadow.bias=-.0002;scene.add(sun);
 const fill=new THREE.DirectionalLight('#8ed4e6',.6);fill.position.set(45,20,-40);scene.add(fill);
 const mat=(color:string,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness,flatShading:true});
 const textures:THREE.Texture[]=[],contextLabels:THREE.Sprite[]=[];
 const grass=mat('#83ae63'),grassLight=mat('#a5bd75'),earth=mat('#879984'),sand=mat('#d6d4b0'),pathmat=mat('#f1dfb8'),white=mat('#f2f0d9'),wood=mat('#a57c50'),bark=mat('#7d7250'),metal=mat('#385c61');
 const boxG=new THREE.BoxGeometry(1,1,1),cylG=new THREE.CylinderGeometry(1,1,1,12);
 function mesh(g:THREE.BufferGeometry,m:THREE.Material,x=0,y=0,z=0,parent:THREE.Object3D=scene){const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 function box(x:number,y:number,z:number,w:number,h:number,d:number,m:THREE.Material,p:THREE.Object3D=scene){const o=mesh(boxG,m,x,y,z,p);o.scale.set(w,h,d);return o}
 function cyl(x:number,y:number,z:number,r:number,h:number,m:THREE.Material,p:THREE.Object3D=scene){const o=mesh(cylG,m,x,y,z,p);o.scale.set(r,h,r);return o}
 function ellipse(rx:number,rz:number,y:number,m:THREE.Material,x=0,z=0,depth=.1){const o=mesh(new THREE.CylinderGeometry(1,1,depth,100),m,x,y,z);o.scale.set(rx,1,rz);return o}
 function line(points:THREE.Vector3[],radius:number,m:THREE.Material){return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points),Math.max(12,points.length*3),radius,6,false),m)}
 function ring(rx:number,rz:number,width:number,y:number,m:THREE.Material,cx=0,cz=0){const vertices:number[]=[],indices:number[]=[];for(let i=0;i<=160;i++){const t=i/160*Math.PI*2;vertices.push(cx+(rx-width/2)*Math.cos(t),y,cz+(rz-width/2)*Math.sin(t),cx+(rx+width/2)*Math.cos(t),y,cz+(rz+width/2)*Math.sin(t));if(i<160){const a=i*2;indices.push(a,a+2,a+1,a+1,a+2,a+3)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();const o=mesh(g,m);o.material.side=THREE.DoubleSide;return o}

 // A dusk sky is part of the place: the sun remains visible while the city lights wake up.
 const skyMaterial=new THREE.ShaderMaterial({uniforms:{night:{value:0}},side:THREE.BackSide,depthWrite:false,fog:false,toneMapped:false,vertexShader:`varying vec3 vDirection;void main(){vDirection=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec3 vDirection;uniform float night;void main(){float h=clamp(normalize(vDirection).y*.72+.28,0.,1.);vec3 duskTop=vec3(.46,.69,.77),duskLow=vec3(1.,.57,.34);vec3 nightTop=vec3(.025,.07,.13),nightLow=vec3(.20,.20,.29);vec3 c=mix(mix(duskLow,duskTop,smoothstep(.08,.72,h)),mix(nightLow,nightTop,smoothstep(.04,.78,h)),night);float horizon=exp(-pow((h-.24)*5.5,2.));c+=mix(vec3(.21,.045,.008),vec3(.035,.015,.06),night)*horizon;gl_FragColor=vec4(c,1.);}`});
 const sky=mesh(new THREE.SphereGeometry(340,32,18),skyMaterial);sky.castShadow=false;sky.receiveShadow=false;sky.renderOrder=-10;
 function radialTexture(stops:[number,string][],size=256){const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d')!,g=ctx.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);stops.forEach(([p,color])=>g.addColorStop(p,color));ctx.fillStyle=g;ctx.fillRect(0,0,size,size);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);return t}
 const sunTexture=radialTexture([[0,'#fffdf0'],[.25,'#fff3b0'],[.54,'#ffb24d'],[.72,'#f37b2855'],[1,'#f37b2800']]);
 const sunMaterial=new THREE.SpriteMaterial({map:sunTexture,color:'#ffd17a',transparent:true,depthWrite:false,fog:false,toneMapped:false,blending:THREE.AdditiveBlending});
 const sunDisc=new THREE.Sprite(sunMaterial);sunDisc.position.set(-88,18,-116);sunDisc.scale.set(18,18,1);sunDisc.renderOrder=-2;scene.add(sunDisc);
 function cloudTexture(){const c=document.createElement('canvas');c.width=512;c.height=180;const ctx=c.getContext('2d')!;ctx.clearRect(0,0,c.width,c.height);for(const [x,y,r] of [[72,104,50],[132,78,64],[205,94,75],[286,68,72],[365,91,68],[435,108,45]] as [number,number,number][]){const g=ctx.createRadialGradient(x,y,3,x,y,r);g.addColorStop(0,'#fff');g.addColorStop(.62,'#fff9');g.addColorStop(1,'#fff0');ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2)}const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);return t}
 const cloudMap=cloudTexture(),cloudMaterials:THREE.SpriteMaterial[]=[];
 const cloudLayout=[[-103,38,-137,44,13],[-61,45,-148,57,15],[-12,31,-139,49,12],[38,42,-146,55,14],[78,27,-128,38,10],[-88,18,-112,35,9],[19,20,-118,42,10]];
 cloudLayout.forEach(([x,y,z,w,h],i)=>{const cm=new THREE.SpriteMaterial({map:cloudMap,color:i%2?'#ff9a68':'#ffc08f',transparent:true,opacity:.72,depthWrite:false,fog:false,toneMapped:false});cloudMaterials.push(cm);const cloud=new THREE.Sprite(cm);cloud.position.set(x,y,z);cloud.scale.set(w,h,1);cloud.renderOrder=-1;scene.add(cloud)});
 function contextLabel(text:string,x:number,y:number,z:number){const c=document.createElement('canvas');c.width=512;c.height=112;const ctx=c.getContext('2d')!;ctx.fillStyle='#f8f5e9e6';ctx.beginPath();ctx.roundRect(3,3,506,106,53);ctx.fill();ctx.fillStyle='#28595a';ctx.font='600 34px Arial, Microsoft YaHei';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,57);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:t,transparent:true,depthTest:false,depthWrite:false,toneMapped:false}));label.position.set(x,y,z);label.scale.set(11.5,2.5,1);label.renderOrder=6;scene.add(label);contextLabels.push(label)}

 function shape(points:Point[],y:number,m:THREE.Material,depth=0,excavate=false){const sh=new THREE.Shape();points.forEach((p,i)=>i?sh.lineTo(p[0],-p[1]):sh.moveTo(p[0],-p[1]));sh.closePath();if(excavate){const hole=new THREE.Path();hole.absarc(wavePlaza.x,-wavePlaza.z,wavePlaza.radius,0,Math.PI*2,true);sh.holes.push(hole)}const g=depth?new THREE.ExtrudeGeometry(sh,{depth,bevelEnabled:false,curveSegments:64}):new THREE.ShapeGeometry(sh,64);g.rotateX(-Math.PI/2);return mesh(g,m,0,y,0)}
 function ribbon(points:Point[],width:number,m:THREE.Material,y=.66,closed=false){const v:number[]=[],ix:number[]=[];const n=points.length;for(let i=0;i<n;i++){const p=points[i],a=points[i===0?(closed?n-1:0):i-1],b=points[i===n-1?(closed?0:n-1):i+1];const len=Math.hypot(b[0]-a[0],b[1]-a[1])||1,nx=-(b[1]-a[1])/len,nz=(b[0]-a[0])/len;v.push(p[0]+nx*width/2,y,p[1]+nz*width/2,p[0]-nx*width/2,y,p[1]-nz*width/2);if(i<n-1||closed){const j=(i+1)%n;ix.push(i*2,j*2,i*2+1,i*2+1,j*2,j*2+1)}}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(ix);g.computeVertexNormals();m.side=THREE.DoubleSide;const surface=mesh(g,m);surface.castShadow=false;return surface}
 // Fade the miniature's backdrop into the sky before the far clip plane.
 // A solid 2000-unit plane previously cut the sun and sky with a horizontal edge.
 const backdropMaterial=new THREE.ShaderMaterial({uniforms:{night:{value:0}},transparent:true,depthWrite:false,vertexShader:`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`varying vec3 vWorld;uniform float night;void main(){float a=1.-smoothstep(90.,210.,length(vWorld.xz));vec3 c=mix(vec3(.72,.80,.77),vec3(.045,.10,.13),night);gl_FragColor=vec4(c,a);}`});
 const ground=mesh(new THREE.PlaneGeometry(440,440),backdropMaterial,0,-3.5,0);ground.rotation.x=-Math.PI/2;ground.castShadow=false;ground.receiveShadow=false;
 const block:Point[]=[[-58,-69],[51,-69],[53,59],[-58,59]];
 shape(block,-3,earth,3.5,true);shape(block,.51,mat('#c7d0c6'),0,true);
 const waveScene=createWavePlaza(scene);
 textures.push(waveScene.texture);
 shape(boundary,.53,grass);
 // Terrain triangles and walking height share the same modest relief model.
 const tv:number[]=[];for(let x=-47;x<46;x+=1.1)for(let z=-59;z<55;z+=1.1){for(const tri of [[[x,z],[x+1.1,z],[x,z+1.1]],[[x+1.1,z],[x+1.1,z+1.1],[x,z+1.1]]]){if(tri.every(p=>inside(p[0],p[1],boundary))){for(const p of tri)tv.push(p[0],groundHeight(p[0],p[1]),p[1])}}}const tg=new THREE.BufferGeometry();tg.setAttribute('position',new THREE.Float32BufferAttribute(tv,3));tg.computeVertexNormals();const terrainMat=mat('#779a58');terrainMat.side=THREE.DoubleSide;mesh(tg,terrainMat);
 const watermat=new THREE.ShaderMaterial({uniforms:{time:{value:0},night:{value:0}},vertexShader:`varying vec3 vWorld;void main(){vec4 w=modelMatrix*vec4(position,1.);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,fragmentShader:`varying vec3 vWorld;uniform float time;uniform float night;
// Fade subpixel waves instead of allowing high-frequency highlights to alias.
float wave(float phase){return sin(phase)*(1.-smoothstep(.45,2.5,fwidth(phase)));}
void main(){float ripple=wave(vWorld.x*3.+vWorld.z*1.6+time*.6)*wave(vWorld.z*3.4-vWorld.x*.9-time*.4);float phase=vWorld.x*2.8+vWorld.z*4.1+time*.6;float glint=pow(max(0.,sin(phase)),12.)*.025*(1.-smoothstep(.15,1.,fwidth(phase)));vec3 c=vec3(.19,.39,.38)+ripple*.012+glint;float band=exp(-pow((vWorld.x+14.+wave(vWorld.z*8.+time)*.22)/2.8,2.))*exp(-abs(vWorld.z+8.)*.025);c=mix(c,vec3(.055,.13,.18)+band*vec3(.23,.21,.11)*(0.45+0.15*wave(vWorld.z*9.+time)),night);gl_FragColor=vec4(c,1.); }`});
 for(const contour of [lake,northWater]){shape(contour,.72,watermat).castShadow=false;ribbon(contour,.4,mat('#bbc2ad'),.77,true)}
 ribbon(shoreWalk,2.4,pathmat,.79,true);ribbon(northWalk,2,pathmat,.79);ribbon(southWalk,1.8,pathmat,.8);
 const running:Point[]=shoreWalk.map(p=>[p[0]-.7,p[1]+.7]);ribbon(running,.45,mat('#62b3c6'),.81,true);
 // Public roads are outside the park rather than a ring of towers on its grass.
 const asphalt=mat('#81918f');asphalt.polygonOffset=true;asphalt.polygonOffsetFactor=-1;asphalt.polygonOffsetUnits=-1;ribbon([[-47,56],[28,56],[33,35],[41,0],[44,-30],[46,-58]],3.2,asphalt,.67);ribbon([[-34,-61],[46,-54]],3.3,asphalt,.67);ribbon([[-46,33],[-38,24],[-30,6],[-20,-30],[-9,-37],[-2,-57]],3.1,asphalt,.67);
 for(let i=0;i<35;i++)box(44-i*.44,.70,-45+i*2.8,.1,.02,.75,white);
 // Tidal square: concentric stone terraces around the circular lawn.
 const [tx,tz]=tideCenter;ellipse(5.9,5.9,.65,mat('#cbd0bc'),tx,tz,.2);for(let i=0;i<4;i++)ring(4.2+i*.44,4.2+i*.44,.35,.79+i*.04,i%2?white:sand,tx,tz);ellipse(3.85,3.85,.79,grassLight,tx,tz,.13);box(tx,.99,tz-1.7,2.2,.33,.55,white);
 const sitSpot=new THREE.Vector2(tx+2.25,tz+.85);
 const starMid=new THREE.Vector2((starBridge[0][0]+starBridge[1][0])/2,(starBridge[0][1]+starBridge[1][1])/2);
 const moments:MemoryMoment[]=[
  {id:'moment-lawn-sunset',name:'草坪上的日落',prompt:'在草坪坐一会儿',action:'看日落',description:'风从湖面吹过来，城市正慢慢亮起。',position:sitSpot,radius:2.15,pose:'sit',cameraOffset:new THREE.Vector3(6.8,3.6,7.6),targetOffset:new THREE.Vector3(0,1,-4.2)},
  {id:'moment-star-bridge',name:'星光桥 · 后海天际线',prompt:'在星光桥停一会儿',action:'静看天际线',description:'靠着桥边，让灯光越过湖面。对岸是后海，也是这段记忆的背景。',position:starMid,radius:3.2,pose:'stand',cameraOffset:new THREE.Vector3(5.5,3.4,7.2),targetOffset:new THREE.Vector3(-12,2.2,-12)},
 ];
 const restMarkerMat=new THREE.MeshBasicMaterial({color:'#fff1aa',transparent:true,opacity:.62,side:THREE.DoubleSide,depthWrite:false});
 moments.forEach(moment=>{const marker=mesh(new THREE.RingGeometry(.38,.52,32),restMarkerMat,moment.position.x,.99,moment.position.y);marker.rotation.x=-Math.PI/2;marker.castShadow=false;marker.receiveShadow=false});
 const tuftGeometry=new THREE.ConeGeometry(.055,.32,3),tuftMaterial=mat('#6f9f55');const tufts=new THREE.InstancedMesh(tuftGeometry,tuftMaterial,42);const tuftMatrix=new THREE.Matrix4();
 for(let i=0;i<42;i++){const a=i/42*Math.PI*2+.2*Math.sin(i*2.1),r=2.35+(i%7)/7*1.15,x=tx+Math.cos(a)*r,z=tz+Math.sin(a)*r;tuftMatrix.makeRotationY(i*.73);tuftMatrix.setPosition(x,.98,z);tufts.setMatrixAt(i,tuftMatrix)}tufts.castShadow=true;scene.add(tufts);
 // A flat roof pavilion near the western shore.
 const pavilionGlass=mat('#668986',.3);box(-37,1.35,20,2.4,1.5,7,pavilionGlass);box(-37,2.2,20,3.4,.2,7.8,white);for(let j=0;j<8;j++)box(-35.75,1.35,17+j*.9,.07,1.6,.06,white);
 const obstacles:{x:number,z:number,r:number}[]=[{x:-37,z:20,r:1.5}];
 let seed=129;function rand(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
 const trunks:THREE.Matrix4[]=[],crowns:THREE.Matrix4[]=[],colors:THREE.Color[]=[];const temp=new THREE.Object3D();
 function tree(x:number,z:number,scale=1){const y=groundHeight(x,z);trunks.push(new THREE.Matrix4().compose(new THREE.Vector3(x,y+scale,z),new THREE.Quaternion(),new THREE.Vector3(.10*scale,2*scale,.1*scale)));for(let j=0;j<3;j++){temp.position.set(x+(j-1)*.36*scale,y+(2.1+(j%2)*.45)*scale,z+(j%2)*.35*scale);temp.rotation.set(0,rand()*6,0);temp.scale.set(.9*scale,1.0*scale,.9*scale);temp.updateMatrix();crowns.push(temp.matrix.clone());colors.push(new THREE.Color().setHSL(.26+rand()*.05,.25+rand()*.13,.28+rand()*.12))}}
 function clearPath(x:number,z:number){return Math.min(distanceToPath(x,z,shoreWalk,true),distanceToPath(x,z,piBridge),distanceToPath(x,z,starBridge),distanceToPath(x,z,northWalk),distanceToPath(x,z,southWalk),distanceToPath(x,z,northBridge))>2.0}
 for(let i=0;i<1800;i++){const x=-44+rand()*88,z=-57+rand()*109;if(!inside(x,z,boundary)||isWater(x,z)||distanceToPath(x,z,lake,true)<1.7||distanceToPath(x,z,northWater,true)<1.4||!clearPath(x,z)||Math.hypot(x-tx,z-tz)<7||Math.hypot(x+37,z-20)<5)continue;tree(x,z,.55+rand()*.55)}
 const ti=new THREE.InstancedMesh(cylG,bark,trunks.length),ci=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),mat('#6b8c4d'),crowns.length);trunks.forEach((m,i)=>ti.setMatrixAt(i,m));crowns.forEach((m,i)=>{ci.setMatrixAt(i,m);ci.setColorAt(i,colors[i])});ti.castShadow=true;ci.castShadow=true;ci.receiveShadow=true;scene.add(ti,ci);
 // Small offshore wetlands articulate the south edge.
 for(const [x,z,rx,rz] of [[-23,33,2,1],[-16,34,1.8,.8],[-8,32,2.2,1.3],[0,29.7,2.2,1.1],[12,31,1.7,.8]]){ellipse(rx,rz,.86,grassLight,x,z,.25);for(let i=0;i<8;i++){const a=rand()*6.28;cyl(x+Math.cos(a)*rx*.65,1.25,z+Math.sin(a)*rz*.6,.035,.8,mat('#a5aa71'))}}
 // Spring Bamboo: curved profile, 56 facade ribs, 28-column diagrid at both ends.
 const tower=new THREE.Group();tower.position.set(-18,.6,-46);scene.add(tower);const height=39.2;
 function radius(t:number){return 3.05*(1-.19*t-.81*Math.pow(t,5.0))+.04}
 const profile:THREE.Vector2[]=[];for(let i=0;i<=64;i++)profile.push(new THREE.Vector2(radius(i/64),i/64*height));
 const glass=mat('#78959e',.24);glass.metalness=.65;glass.flatShading=false;mesh(new THREE.LatheGeometry(profile,56),glass,0,0,0,tower);
 const ribMat=mat('#d1d7d1',.42);for(let j=0;j<56;j++){const a=j/56*Math.PI*2,pts:THREE.Vector3[]=[];for(let k=0;k<=32;k++){const t=.13+k/32*.73;pts.push(new THREE.Vector3(Math.cos(a)*(radius(t)+.025),t*height,Math.sin(a)*(radius(t)+.025)))}const rib=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),32,.028,3,false),ribMat,0,0,0,tower);rib.castShadow=false;rib.receiveShadow=false}
 for(let j=0;j<28;j++){const angle=j/28*Math.PI*2;for(const direction of [-1,1])for(const top of [false,true]){const pts:THREE.Vector3[]=[];for(let k=0;k<=12;k++){const f=k/12,t=top?.86+f*.14:f*.13,a=angle+direction*(top?(1-f):f)*Math.PI/56;pts.push(new THREE.Vector3(Math.cos(a)*(radius(t)+.035),t*height,Math.sin(a)*(radius(t)+.035)))}mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),12,.045,4,false),ribMat,0,0,0,tower)}}
 for(let i=1;i<68;i++){const t=i/68;const hoop=mesh(new THREE.TorusGeometry(radius(t)+.02,.015,3,56),ribMat,0,t*height,0,tower);hoop.rotation.x=Math.PI/2;hoop.castShadow=false;hoop.receiveShadow=false}box(-18,.75,-46,9,.3,8,white);obstacles.push({x:-18,z:-46,r:4});
 const windowmat=new THREE.MeshStandardMaterial({color:'#bfd3d5',emissive:'#ffdaa0',emissiveIntensity:0,roughness:.35});
 // Simplified contextual volumes, with explicit footprints rather than a random skyline.
 for(const [x,z,w,d,h] of [[-28,-43,4,5,24],[-38,-45,5,5,19],[-49,-41,4,5,13]]){box(x,.6+h/2,z,w,h,d,mat('#91a8ac',.35));box(x,h+.8,z,w*.95,.3,d*.95,white);for(let j=0;j<Math.floor(h/.65);j++)box(x,1+j*.65,z+d/2+.02,w*.85,.06,.04,windowmat)}
 // Northern sports-centre context: broad low roof, far lower than the tower.
 const roof=ellipse(15,7,2.0,white,14,-64,.7);roof.rotation.y=.12;ellipse(10,4.7,2.4,mat('#9bbaaf'),14,-64,.2);ring(13.5,6.1,.18,2.42,metal,14,-64);
 // West of the lake, south of Spring Bamboo: north tall pebble and south broad pebble.
 // Relative siting / silhouettes checked against Nanshan's published aerial (references.md).
 const cultureStone=mat('#e7e6df',.58);cultureStone.flatShading=false;const cultureGlass=mat('#3d565b',.22);cultureGlass.flatShading=false;cultureGlass.metalness=.28;
 shape([[-49,-34],[-26,-34],[-25,-25],[-29,-10],[-36,7],[-48,14]],.72,grassLight);
 ribbon([[-45,-31],[-34,-29],[-28,-24],[-31,-13],[-38,-7],[-47,-3],[-47,8]],1.25,pathmat,.86);
 function culturePod(x:number,z:number,rx:number,rz:number,height:number,turn:number){
  const group=new THREE.Group();group.position.set(x,.82,z);group.rotation.y=turn;scene.add(group);
  const profile=[new THREE.Vector2(0,0),new THREE.Vector2(.68,0),new THREE.Vector2(.86,height*.07),new THREE.Vector2(.99,height*.32),new THREE.Vector2(1,height*.62),new THREE.Vector2(.91,height*.83),new THREE.Vector2(.69,height*.96),new THREE.Vector2(.30,height),new THREE.Vector2(0,height*.99)];
  const curve=new THREE.SplineCurve(profile),geometry=new THREE.LatheGeometry(curve.getPoints(64),64);
  const shell=mesh(geometry,cultureStone,0,0,0,group);shell.scale.set(rx,1,rz);
  // Dark diagonal window cuts wrap across the closed stone volume, not an open doughnut.
  for(const [start,end,y] of [[.1,1.75,.43],[2.4,4.35,.67]]){const pts:THREE.Vector3[]=[];for(let i=0;i<=36;i++){const t=i/36,a=start+(end-start)*t;pts.push(new THREE.Vector3(Math.cos(a)*rx*1.002,height*(y+.09*Math.sin(t*Math.PI)),Math.sin(a)*rz*1.002))}const slit=mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),36,.09,5,false),cultureGlass,0,0,0,group);slit.castShadow=false}
  const skylight=mesh(new THREE.CircleGeometry(1,40),cultureGlass,-rx*.14,height*1.002,-rz*.12,group);skylight.rotation.x=-Math.PI/2;skylight.scale.set(rx*.21,rz*.18,1);
 }
 culturePod(-34,-22,5.7,5.0,9.5,-.22);culturePod(-42,2,6.9,5.5,5.3,.3);
 for(const [x,z,rx,rz,h] of [[-43,-22,3.2,2.6,1.6],[-42,-31,2.4,2,2],[-47,-9,2.4,2.1,1.4],[-43,10,2.5,2,2],[-35,-6,2.1,1.8,1.2]])culturePod(x,z,rx,rz,h,.4);
 ellipse(3.4,2.3,.86,cultureGlass,-36,-11,.05);ring(3.5,2.4,.35,.94,white,-36,-11);
 // A recognisable slice of Shenzhen Bay MixC beside Spring Bamboo: glazed podium, terraces and WAVE roof.
 const mixc=new THREE.Group();mixc.position.set(-34,.65,-53);scene.add(mixc);const mallGlass=mat('#779ca0',.2);mallGlass.flatShading=false;mallGlass.metalness=.28;
 box(0,1.45,0,17,2.9,6,mallGlass,mixc);box(-1,3.15,-.25,15.5,.55,5.4,white,mixc);box(-2.1,3.65,-.55,11.2,.5,4.1,grassLight,mixc);box(-3.2,4.07,-.8,7.5,.35,3.1,white,mixc);
 for(let i=0;i<8;i++)box(-7.2+i*2.05,1.45,3.03,.07,2.4,.06,white,mixc);
 const waveA=mesh(new THREE.TorusGeometry(2.2,.24,8,32,Math.PI*1.18),white,3.1,3.55,1.25,mixc);waveA.rotation.set(Math.PI/2,0,-.2);waveA.scale.set(1.7,1,.7);
 const waveB=mesh(new THREE.TorusGeometry(1.7,.2,8,32,Math.PI*1.12),white,5.4,3.35,.85,mixc);waveB.rotation.set(Math.PI/2,0,.45);waveB.scale.set(1.45,1,.65);
 const signCanvas=document.createElement('canvas');signCanvas.width=512;signCanvas.height=128;const signContext=signCanvas.getContext('2d')!;signContext.fillStyle='#f2f0de';signContext.fillRect(0,0,512,128);signContext.fillStyle='#244b4d';signContext.font='600 54px Arial';signContext.textAlign='center';signContext.textBaseline='middle';signContext.fillText('MIXC · 深圳湾',256,66);const signTexture=new THREE.CanvasTexture(signCanvas);signTexture.colorSpace=THREE.SRGBColorSpace;textures.push(signTexture);const sign=mesh(new THREE.PlaneGeometry(5.8,1.45),new THREE.MeshBasicMaterial({map:signTexture}),0,1.55,3.08,mixc);sign.castShadow=false;
 contextLabel('深圳湾文化广场',-37,12,-13);contextLabel('深圳湾万象城',-34,6.2,-53);
 const lampMat=new THREE.MeshStandardMaterial({color:'#fff2c9',emissive:'#ffce7a',emissiveIntensity:.25});
 const fireflyPositions=new Float32Array(28*3);for(let i=0;i<28;i++){const a=i/28*Math.PI*2+.45*Math.sin(i*1.7),r=3.2+(i%6)*.7;fireflyPositions[i*3]=tx+Math.cos(a)*r;fireflyPositions[i*3+1]=1.2+(i%5)*.36;fireflyPositions[i*3+2]=tz+Math.sin(a)*r}const fireflyGeometry=new THREE.BufferGeometry();fireflyGeometry.setAttribute('position',new THREE.BufferAttribute(fireflyPositions,3));const fireflyMaterial=new THREE.PointsMaterial({color:'#ffe39b',size:.16,transparent:true,opacity:0,depthWrite:false,sizeAttenuation:true});const fireflies=new THREE.Points(fireflyGeometry,fireflyMaterial);scene.add(fireflies);const restLight=new THREE.PointLight('#ffd991',0,16,2);restLight.position.set(sitSpot.x-2.5,3.1,sitSpot.y+1.8);scene.add(restLight);
 function footbridge(points:Point[],width:number,stars=false){ribbon(points,width,white,.94);const pts=points.map(p=>new THREE.Vector3(p[0],1.8,p[1]));for(const side of [-1,1]){const offset=pts.map((p,i)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],v=b.clone().sub(a).normalize();return p.clone().add(new THREE.Vector3(-v.z,0,v.x).multiplyScalar(side*width*.46))});line(offset,.035,metal);for(let i=0;i<points.length-1;i++){const a=offset[i],b=offset[i+1],n=Math.ceil(a.distanceTo(b)/1.2);for(let j=0;j<n;j++){const p=a.clone().lerp(b,j/n);box(p.x,1.35,p.z,.04,.82,.04,metal)}}}if(stars){for(let i=0;i<30;i++){const t=(i+.5)/30,x=points[0][0]*(1-t)+points[1][0]*t,z=points[0][1]*(1-t)+points[1][1]*t;cyl(x+(i%2?.85:-.85),2.1,z,.075,2.3,white);box(x+(i%2?.85:-.85),3.3,z,.14,.15,.14,lampMat)}}}
 footbridge(starBridge,2.3,true);footbridge(piBridge,1.9);footbridge(northBridge,1.7);
 // Numerical railing panels, rather than an invented giant pi-shaped sculpture.
 const digitsCanvas=document.createElement('canvas');digitsCanvas.width=1024;digitsCanvas.height=64;const dc=digitsCanvas.getContext('2d')!;dc.fillStyle='#d1d7d0';dc.fillRect(0,0,1024,64);dc.fillStyle='#425f5d';dc.font='36px monospace';dc.fillText('π 3.14159265358979323846264338327950288419716939937510',8,45);const digitsTexture=new THREE.CanvasTexture(digitsCanvas);digitsTexture.colorSpace=THREE.SRGBColorSpace;const digitsMaterial=new THREE.MeshStandardMaterial({map:digitsTexture,side:THREE.DoubleSide});
 for(let i=0;i<piBridge.length-1;i++){const a=piBridge[i],b=piBridge[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]);const panel=mesh(new THREE.PlaneGeometry(l,.37),digitsMaterial,(a[0]+b[0])/2,1.45,(a[1]+b[1])/2+.9);panel.rotation.y=-Math.atan2(b[1]-a[1],b[0]-a[0])}
 for(let i=0;i<shoreWalk.length;i+=2){const [x,z]=shoreWalk[i];cyl(x+.7,1.65,z,.04,1.9,metal);mesh(new THREE.SphereGeometry(.12,8,6),lampMat,x+.7,2.65,z);if(i%6===0){const bench=new THREE.Group();bench.position.set(x-1.3,.8,z);scene.add(bench);box(0,.45,0,1.4,.1,.48,wood,bench);box(0,.75,.22,1.4,.35,.08,wood,bench);for(const a of [-.48,.48])box(a,.22,0,.08,.45,.4,metal,bench)}}
 const duck=new THREE.Group();scene.add(duck);mesh(new THREE.SphereGeometry(.25,10,8),white,0,.9,0,duck).scale.set(1.4,.7,1);mesh(new THREE.SphereGeometry(.14,8,6),white,.25,1.08,0,duck);box(.4,1.07,0,.18,.06,.08,mat('#dcaa51'),duck);
 // Clickable place labels are functional map markers.
 const pickables:THREE.Object3D[]=[],markerGroups:THREE.Group[]=[];textures.push(digitsTexture);
 PLACES.forEach((p,index)=>{const g=new THREE.Group();g.position.set(p.x,4.5,p.z);scene.add(g);markerGroups.push(g);const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d')!;ctx.fillStyle='#f7fbef';ctx.beginPath();ctx.roundRect(3,5,506,112,56);ctx.fill();ctx.fillStyle='#28595a';ctx.font='600 42px Arial, Microsoft YaHei';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(`0${index+1}  ${p.name}`,256,64);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;textures.push(t);const s=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,depthWrite:false,transparent:true}));s.scale.set(8.5,2.12,1);s.userData.place=p;s.renderOrder=5;g.add(s);pickables.push(s);const pin=mesh(new THREE.OctahedronGeometry(.32),mat('#edb468'),p.x,1.9,p.z);pin.userData.place=p;pickables.push(pin)});
 // A small explorer with a backpack, articulated legs and a sun hat.
 const player=new THREE.Group();player.position.set(spawn[0],.83,spawn[1]);scene.add(player);const shirt=mat('#df8856'),skin=mat('#efd1a4'),pants=mat('#3b6267');
 const body=box(0,.85,0,.5,.62,.32,shirt,player),head=mesh(new THREE.SphereGeometry(.23,12,8),skin,0,1.4,0,player),hatBrim=cyl(0,1.58,0,.32,.07,sand,player),hatTop=cyl(0,1.64,0,.23,.15,sand,player),backpack=box(0,.89,.23,.37,.45,.17,mat('#ddc28a'),player);
 const legs=[box(-.14,.3,0,.17,.55,.2,pants,player),box(.14,.3,0,.17,.55,.2,pants,player)],arms=[box(-.34,.85,0,.14,.53,.15,skin,player),box(.34,.85,0,.14,.53,.15,skin,player)];
 const upperParts=[body,head,hatBrim,hatTop,backpack],upperBaseY=upperParts.map(o=>o.position.y);
 const halo=mesh(new THREE.RingGeometry(.6,.7,36),new THREE.MeshBasicMaterial({color:'#fff0ad',side:THREE.DoubleSide}),0,.02,0,player);halo.rotation.x=-Math.PI/2;player.visible=false;
 let walking=false,sitting=false,sitBlend=0,availableMoment:MemoryMoment|null=null,activeMoment:MemoryMoment|null=null,soundOn=true,night=false,frame=0,last=performance.now(),elapsed=0,nearbyId='',dead=false;
 const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
 let nightBlend=0,transitioning=false;
 const cameraGoal=new THREE.Vector3(),targetGoal=new THREE.Vector3();
 const daySky=new THREE.Color('#d8e7e5'),nightSky=new THREE.Color('#102b38'),daySun=new THREE.Color('#ffe0ab'),nightSun=new THREE.Color('#94b8e2');
 let audio:{context:AudioContext;gain:GainNode;sources:AudioBufferSourceNode[]}|null=null;
 function ensureAmbient(){if(audio)return audio;const context=new AudioContext(),gain=context.createGain();gain.gain.value=0;gain.connect(context.destination);const sources:AudioBufferSourceNode[]=[];for(const [cutoff,volume] of [[520,.55],[1450,.12]]){const buffer=context.createBuffer(1,context.sampleRate*4,context.sampleRate),data=buffer.getChannelData(0);let brown=0;for(let i=0;i<data.length;i++){brown=(brown+(Math.random()*2-1)*.035)/1.025;data[i]=brown*3.2}const source=context.createBufferSource(),filter=context.createBiquadFilter(),layer=context.createGain();source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=cutoff;layer.gain.value=volume;source.connect(filter).connect(layer).connect(gain);source.start();sources.push(source)}audio={context,gain,sources};return audio}
 function setSound(value:boolean){soundOn=value;const ambience=value&&sitting?ensureAmbient():audio;if(!ambience)return;if(value&&sitting)void ambience.context.resume();ambience.gain.gain.setTargetAtTime(value&&sitting?.075:0,ambience.context.currentTime,.45)}
 function fadeAmbient(){if(audio)audio.gain.gain.setTargetAtTime(0,audio.context.currentTime,.45)}
 function nearbyPlace(){return PLACES.find(p=>Math.hypot(player.position.x-p.x,player.position.z-p.z)<4)??null}
 function nearMoment(){return moments.find(moment=>Math.hypot(player.position.x-moment.position.x,player.position.z-moment.position.y)<moment.radius)??null}
 function interact(){if(!walking||transitioning)return;const p=nearbyPlace();if(!p)return;if(!visited.has(p.id)){visited.add(p.id);onVisit(p.id)}onSelect(p)}let jumpVelocity=0,airborne=false;const keys=new Set<string>(),visited=new Set<string>();
 const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();let downX=0,downY=0;
 const pointerDown=(e:PointerEvent)=>{downX=e.clientX;downY=e.clientY};
 const pointerUp=(e:PointerEvent)=>{if(Math.hypot(e.clientX-downX,e.clientY-downY)>6)return;const r=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects(pickables.filter(o=>o.visible&&o.parent?.visible));if(hits.length){if(walking)interact();else onSelect(hits[0].object.userData.place)}};
 renderer.domElement.addEventListener('pointerdown',pointerDown);renderer.domElement.addEventListener('pointerup',pointerUp);
 const keyDown=(e:KeyboardEvent)=>{if(e.target instanceof HTMLElement&&(['INPUT','TEXTAREA'].includes(e.target.tagName)||e.target.isContentEditable))return;if(walking&&e.code==='KeyE'&&!e.repeat){if(sitting)setSitting(false);else if(nearMoment())setSitting(true);else interact();return}if(sitting&&e.code==='Escape'){setSitting(false);return}if(walking&&!sitting&&!transitioning&&e.code==='Space'){e.preventDefault();if(!e.repeat&&!airborne){jumpVelocity=6;airborne=true}return}if(walking&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key))e.preventDefault();keys.add(e.key.toLowerCase())};const keyUp=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());const blur=()=>keys.clear();window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);window.addEventListener('blur',blur);
 function canWalk(x:number,z:number){return walkable(x,z)&&!obstacles.some(o=>(x-o.x)**2+(z-o.z)**2<(o.r+.25)**2)}
 function floorHeight(x:number,z:number){const bridge=bridgeHeight(x,z);if(bridge!=null)return bridge;if(Math.hypot(x-tx,z-tz)<3.82)return .855;if(distanceToPath(x,z,shoreWalk,true)<1.15||distanceToPath(x,z,northWalk)<1)return .79;if(distanceToPath(x,z,southWalk)<.9)return .8;return groundHeight(x,z)}
 function beginTransition(){controls.minDistance=.5;controls.maxDistance=300;controls.enabled=false;transitioning=true}
 function setSitting(value:boolean,withSound=soundOn){const moment=value?nearMoment():activeMoment;if(value===sitting||!walking||value&&!moment)return;sitting=value;keys.clear();jumpVelocity=0;airborne=false;if(value&&moment){activeMoment=moment;if(!visited.has(moment.id)){visited.add(moment.id);onVisit(moment.id)}onResting(true,moment);player.position.set(moment.position.x,floorHeight(moment.position.x,moment.position.y)+.05,moment.position.y);player.rotation.y=moment.pose==='sit'?0:-Math.PI*.75;night=true;targetGoal.copy(player.position).add(moment.targetOffset);cameraGoal.copy(player.position).add(moment.cameraOffset);beginTransition();setSound(withSound)}else{onResting(false,activeMoment);activeMoment=null;fadeAmbient();reset()}}
 function setWalking(value:boolean){if(sitting){sitting=false;onResting(false,activeMoment);activeMoment=null;fadeAmbient()}walking=value;player.visible=value;keys.clear();jumpVelocity=0;airborne=false;player.position.y=floorHeight(player.position.x,player.position.z)+.05;nearbyId='';availableMoment=null;onNearby(null);onMomentAvailable(null);reset()}
 function reset(immediate=false){
  keys.clear();controls.enableDamping=false;controls.update();controls.enableDamping=true;
  if(walking){targetGoal.copy(player.position).add(new THREE.Vector3(0,1,0));cameraGoal.copy(targetGoal).add(new THREE.Vector3(6,4.5,9))}
  else{targetGoal.set(0,1,0);const mobile=host.clientWidth<650;cameraGoal.set(mobile?121:92,mobile?136:101,mobile?145:114)}
  beginTransition();
  if(immediate||reducedMotion.matches){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);finishTransition()}
 }
 function finishTransition(){transitioning=false;controls.minDistance=sitting?6:walking?5:40;controls.maxDistance=sitting?18:walking?25:210;controls.enabled=true;controls.update()}
 function setNight(value:boolean){night=value}
 function updateAtmosphere(dt:number){
  nightBlend=reducedMotion.matches?Number(night):THREE.MathUtils.damp(nightBlend,Number(night),sitting?.18:.85,dt);
  (scene.background as THREE.Color).copy(daySky).lerp(nightSky,nightBlend);
  (scene.fog as THREE.Fog).color.copy(scene.background as THREE.Color);
  backdropMaterial.uniforms.night.value=nightBlend;
  hemi.intensity=THREE.MathUtils.lerp(2.6,.85,nightBlend);sun.intensity=THREE.MathUtils.lerp(3.1,.5,nightBlend);
  sun.color.copy(daySun).lerp(nightSun,nightBlend);sun.position.y=THREE.MathUtils.lerp(65,22,nightBlend);
  skyMaterial.uniforms.night.value=nightBlend;
  sunDisc.position.y=THREE.MathUtils.lerp(18,-7,THREE.MathUtils.smoothstep(nightBlend,.06,.94));
  sunMaterial.opacity=1-THREE.MathUtils.smoothstep(nightBlend,.52,.96);
  sunMaterial.color.set('#ffd17a').lerp(new THREE.Color('#e78358'),nightBlend);
  cloudMaterials.forEach((material,index)=>{material.color.set(index%2?'#ff9a68':'#ffc08f').lerp(new THREE.Color(index%2?'#665b7e':'#786780'),nightBlend);material.opacity=THREE.MathUtils.lerp(.72,.20,nightBlend)});
  lampMat.emissiveIntensity=THREE.MathUtils.lerp(.25,4,nightBlend);
  waveScene.update(elapsed,nightBlend);
  windowmat.emissiveIntensity=THREE.MathUtils.smoothstep(nightBlend,.25,.85)*1.6;
  watermat.uniforms.night.value=nightBlend;restMarkerMat.opacity=walking&&!sitting?.38+.18*Math.sin(elapsed*2):0;fireflyMaterial.opacity=THREE.MathUtils.smoothstep(nightBlend,.38,.9)*(.58+.24*Math.sin(elapsed*1.8));fireflies.rotation.y=elapsed*.012;restLight.intensity=THREE.MathUtils.smoothstep(nightBlend,.3,1)*1.8;
 }
 const resize=()=>{camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();renderer.setSize(host.clientWidth,host.clientHeight)};const observer=new ResizeObserver(resize);observer.observe(host);reset(true);
 function animate(now:number){if(dead)return;frame=requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;elapsed+=dt;updateAtmosphere(dt);if(transitioning){const a=reducedMotion.matches?1:THREE.MathUtils.damp(0,1,5,dt);camera.position.lerp(cameraGoal,a);controls.target.lerp(targetGoal,a);if(camera.position.distanceTo(cameraGoal)<.03&&controls.target.distanceTo(targetGoal)<.03){camera.position.copy(cameraGoal);controls.target.copy(targetGoal);finishTransition()}}watermat.uniforms.time.value=elapsed;duck.position.set(-2+Math.cos(elapsed*.09)*4,0,8+Math.sin(elapsed*.09)*3);duck.rotation.y=-elapsed*.09;
 if(walking&&!sitting&&!transitioning){const dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft')),dz=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));if(dx||dz){const forward=camera.position.clone().sub(controls.target);forward.y=0;forward.normalize();const right=new THREE.Vector3(forward.z,0,-forward.x);const move=forward.multiplyScalar(dz).add(right.multiplyScalar(dx)).normalize().multiplyScalar(dt*(keys.has('shift')?7:3.8));const before=player.position.clone();if(canWalk(player.position.x+move.x,player.position.z))player.position.x+=move.x;if(canWalk(player.position.x,player.position.z+move.z))player.position.z+=move.z;player.rotation.y=Math.atan2(move.x,move.z)+Math.PI;const delta=player.position.clone().sub(before);camera.position.add(delta);controls.target.add(delta);legs[0].rotation.x=Math.sin(elapsed*12)*.5;legs[1].rotation.x=-legs[0].rotation.x;body.position.y=.85+Math.abs(Math.sin(elapsed*12))*.035}else{legs.forEach(l=>l.rotation.x=0)}
 const oldY=player.position.y;const floorY=floorHeight(player.position.x,player.position.z)+.05;if(airborne){player.position.y+=jumpVelocity*dt-9*dt*dt;jumpVelocity-=18*dt;if(player.position.y<=floorY){player.position.y=floorY;jumpVelocity=0;airborne=false}}else player.position.y=floorY;halo.position.y=floorY-player.position.y+.02;if(airborne){legs[0].rotation.x=-.35;legs[1].rotation.x=.25;body.position.y=.85}camera.position.y+=player.position.y-oldY;controls.target.y+=player.position.y-oldY;
 const sittingPose=sitting&&activeMoment?.pose==='sit';sitBlend=reducedMotion.matches?Number(sittingPose):THREE.MathUtils.damp(sitBlend,Number(sittingPose),5,dt);upperParts.forEach((part,i)=>part.position.y=upperBaseY[i]-.22*sitBlend);arms.forEach((arm,i)=>{arm.position.y=.85-.2*sitBlend;arm.position.z=.12*sitBlend;arm.rotation.x=-.5*sitBlend*(i?.8:1)});if(sitBlend>.01){legs.forEach((leg,i)=>{leg.position.y=.3-.07*sitBlend;leg.position.z=.24*sitBlend;leg.rotation.x=THREE.MathUtils.lerp(leg.rotation.x,-1.25+(i?-.08:.08),sitBlend)})}
 const nearby=sitting?null:nearbyPlace();if((nearby?.id??'')!==nearbyId){nearbyId=nearby?.id??'';onNearby(nearby)}const moment=walking&&!sitting?nearMoment():null;if(moment?.id!==availableMoment?.id){availableMoment=moment;onMomentAvailable(moment)}}
 markerGroups.forEach(g=>{g.position.y=walking?3.2:4.5;g.visible=!walking;});contextLabels.forEach(label=>label.visible=!walking);if(!transitioning)controls.update();else camera.lookAt(controls.target);renderer.render(scene,camera)}frame=requestAnimationFrame(animate);
 return {setWalking,setNight,setSitting,setSound,interact,reset:()=>reset(),zoom:(f:number)=>{if(transitioning)return;const v=camera.position.clone().sub(controls.target);v.multiplyScalar(f).clampLength(controls.minDistance,controls.maxDistance);camera.position.copy(controls.target).add(v);controls.update()},key:(k:string,pressed:boolean)=>pressed?keys.add(k.toLowerCase()):keys.delete(k.toLowerCase()),getState:()=>({walking,sitting,soundOn,night,nightBlend,transitioning,visited:[...visited],moment:activeMoment?.id??null,position:{x:player.position.x,z:player.position.z}}),dispose:()=>{dead=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();audio?.sources.forEach(source=>source.stop());void audio?.context.close();window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);window.removeEventListener('blur',blur);renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);const geometries=new Set<THREE.BufferGeometry>(),materials=new Set<THREE.Material>();scene.traverse(o=>{if(o instanceof THREE.Sprite){materials.add(o.material)}if(o instanceof THREE.Mesh||o instanceof THREE.Points){geometries.add(o.geometry);(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>materials.add(m))}});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());renderer.dispose();renderer.domElement.remove()}}
}
