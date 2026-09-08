import * as THREE from 'three';

// Approximate placement beside Spring Bamboo; the supplied night photograph
// guides the stairs, luminous fins and i-heart-sz sign, not surveyed dimensions.
// The plaza sits on the park-facing side of China Resources Tower. From the
// park, the pavilion reads to the tower's left and the sunken circle in front.
export const wavePlaza = { x: -26, z: -36, radius: 6.1, floor: -1.65, top: .51 };

export function createWavePlaza(scene: THREE.Scene) {
 const {x,z,radius,floor,top}=wavePlaza;
 const stone=new THREE.MeshStandardMaterial({color:'#d3cbbb',roughness:.85});
 const glass=new THREE.MeshStandardMaterial({color:'#496768',roughness:.3,metalness:.3});
 const light=new THREE.MeshStandardMaterial({color:'#fff3cf',emissive:'#ffdf9e',emissiveIntensity:.15});
 const group=new THREE.Group();group.position.set(x,0,z);scene.add(group);
 const add=(g:THREE.BufferGeometry,m:THREE.Material,px=0,py=0,pz=0)=>{const o=new THREE.Mesh(g,m);o.position.set(px,py,pz);o.receiveShadow=true;o.castShadow=true;group.add(o);return o};
 const disc=add(new THREE.CircleGeometry(radius,96),stone,0,floor,0);disc.rotation.x=-Math.PI/2;
 function arc(inner:number,outer:number,y:number,start:number,length:number,material:THREE.Material){const s=new THREE.Shape();s.absarc(0,0,outer,start,start+length,false);s.absarc(0,0,inner,start+length,start,true);s.closePath();const g=new THREE.ShapeGeometry(s,64);g.rotateX(-Math.PI/2);return add(g,material,0,y,0)}
 const count=12;
 for(let i=0;i<count;i++){
  const r=3.7+i*.2,y=floor+(i+1)*(top-floor)/count;
  arc(r,r+.205,y,-2.7,Math.PI*1.42,stone);
  const wall=add(new THREE.CylinderGeometry(r,r,(top-floor)/count,96,1,true,-2.7+Math.PI/2,Math.PI*1.42),stone,0,y-(top-floor)/count/2,0);wall.material.side=THREE.DoubleSide;
  arc(r,r+.025,y+.008,-2.7,Math.PI*1.42,light);
 }
 // Retaining wall behind the water curtain closes the excavation.
 const retaining=add(new THREE.CylinderGeometry(radius,radius,top-floor,96,1,true),stone,0,(top+floor)/2,0);retaining.material.side=THREE.DoubleSide;
 const water=new THREE.ShaderMaterial({transparent:true,side:THREE.DoubleSide,depthWrite:false,uniforms:{time:{value:0},night:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float time;uniform float night;void main(){float streak=.5+.5*sin(vUv.x*280.+sin(vUv.x*41.)*3.);float flow=.5+.5*sin(vUv.y*55.+time*2.4+vUv.x*20.);vec3 c=mix(vec3(.38,.68,.70),vec3(.48,.75,.88),night);gl_FragColor=vec4(c+streak*.16,.3+streak*.25+flow*.1);}`});
 add(new THREE.CylinderGeometry(5.65,5.65,2.65,96,1,true,2.45,1.6),water,0,-.25,0).castShadow=false;
 arc(5.5,5.95,floor+.04,-2.5,1.6,glass);
 for(const a of [-2.7,1.76]){
  const pts:THREE.Vector3[]=[];
  for(let i=0;i<=count;i++){const r=3.7+i*.2,y=floor+i*(top-floor)/count+.85;pts.push(new THREE.Vector3(Math.cos(a)*r,y,-Math.sin(a)*r));if(i%3===0)add(new THREE.CylinderGeometry(.025,.025,.85,6),glass,Math.cos(a)*r,y-.425,-Math.sin(a)*r)}
  add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),24,.035,6,false),glass);
 }
 // Luminous square pavilion, raised above a dark glazed ground floor.
 const cubeX=1.3,cubeZ=-8.0;
 add(new THREE.BoxGeometry(4.8,1.35,4.8),glass,cubeX,1.18,cubeZ);
 const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
 const ctx=canvas.getContext('2d')!;ctx.fillStyle='#fff4e4';ctx.fillRect(0,0,1024,512);
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='600 190px Arial';ctx.fillStyle='#dd3151';ctx.fillText('i  ♥  sz',512,266);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
 const sign=new THREE.MeshStandardMaterial({map:texture,emissiveMap:texture,emissive:'#ffffff',emissiveIntensity:.15,roughness:.5});
 add(new THREE.BoxGeometry(4.8,4.8,4.8),sign,cubeX,4.25,cubeZ);
 const fin=new THREE.BoxGeometry(.025,4.8,.065);
 for(let i=0;i<=32;i++){const d=-2.4+i*.15;for(const side of [-1,1]){add(fin,light,cubeX+d,4.25,cubeZ+side*2.43);const f=add(fin,light,cubeX+side*2.43,4.25,cubeZ+d);f.rotation.y=Math.PI/2}}
 return {texture,update:(time:number,night:number)=>{water.uniforms.time.value=time;water.uniforms.night.value=night;light.emissiveIntensity=.15+night*2.3;sign.emissiveIntensity=.15+night*1.1}};
}
