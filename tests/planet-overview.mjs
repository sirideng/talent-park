import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';

const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH?pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href:'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.TEST_BROWSER_CHANNEL||'msedge'});
const report={desktop:{},mobile:{}};
await mkdir('work',{recursive:true});
async function instrument(page) {
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text());});
 await page.addInitScript(()=>{
  const names=new WeakMap();
  // Unbound originals are deliberately called against the actual WebGL context.
  // oxlint-disable-next-line typescript/unbound-method
  const lookup=WebGL2RenderingContext.prototype.getUniformLocation;
  // oxlint-disable-next-line typescript/unbound-method
  const matrix=WebGL2RenderingContext.prototype.uniformMatrix4fv;
  window.planetProbe={matrix:null,cameras:[]};
  WebGL2RenderingContext.prototype.getUniformLocation=function(program,name){const location=lookup.call(this,program,name);if(location)names.set(location,name);return location;};
  WebGL2RenderingContext.prototype.uniformMatrix4fv=function(location,transpose,values,...rest){
   if(names.get(location)==='viewMatrix'&&document.querySelector('.scene')?.dataset.sceneId==='planet'){
    const m=Array.from(values),p=window.planetProbe;p.matrix=m;
    const camera=[-(m[0]*m[12]+m[1]*m[13]+m[2]*m[14]),-(m[4]*m[12]+m[5]*m[13]+m[6]*m[14]),-(m[8]*m[12]+m[9]*m[13]+m[10]*m[14])];
    if(!p.cameras.length||Math.hypot(...camera.map((v,i)=>v-p.cameras[p.cameras.length-1][i]))>.0001)p.cameras.push(camera);
   }
   return matrix.call(this,location,transpose,values,...rest);
  };
 });
 return errors;
}
const ready=(page,id='planet')=>page.locator(`.scene[data-scene-id="${id}"][data-scene-status="ready"]`).waitFor({timeout:60000});
const camera=page=>page.evaluate(()=>window.planetProbe.cameras.at(-1));
async function settle(page) {await page.waitForTimeout(1700);}
const locations=[['02 深圳湾','shenzhen-bay','深圳湾沿岸'],['05 欢乐港湾','happy-harbor','欢乐港湾'],['06 梧桐山','wutong','梧桐山'],['07 我的中学','school','北京师范大学南山附属中学']];
try {
 const desktop=await browser.newPage({viewport:{width:1440,height:1000}}),errors=await instrument(desktop);
 const response=await desktop.goto(process.env.TEST_URL||'http://localhost:3000/');assert.equal(response.status(),200);await ready(desktop);
 await desktop.waitForFunction(()=>window.planetProbe.matrix?.length===16);
 assert.equal(await desktop.locator('.memory-route button').count(),5);
 assert.equal(await desktop.locator('.planet-hover-label:visible').count(),0);
 await desktop.screenshot({path:'work/planet-overview-home.png'});
 const initial=await camera(desktop);await desktop.waitForTimeout(4800);const rotated=await camera(desktop);
 assert(Math.hypot(...initial.map((v,i)=>v-rotated[i]))>.08,'Gentle auto rotation did not start');
 await desktop.locator('.scene canvas').focus();
 const start=await camera(desktop);let lastAngle=Math.atan2(start[0],start[2]),total=0;
 for(let i=0;i<49;i++) {
  await desktop.keyboard.press('ArrowLeft');await desktop.waitForTimeout(20);
  const p=await camera(desktop),angle=Math.atan2(p[0],p[2]);let delta=angle-lastAngle;while(delta>Math.PI)delta-=2*Math.PI;while(delta< -Math.PI)delta+=2*Math.PI;total+=delta;lastAngle=angle;
  if(i%8===0)await desktop.screenshot({path:`work/planet-overview-rotation-${i}.png`});
 }
 assert(total>Math.PI*2,'Keyboard did not rotate through 360 degrees');
 await desktop.getByRole('button',{name:'重置星球视角'}).click();await settle(desktop);
 const beforeDrag=await camera(desktop);await desktop.mouse.move(780,430);await desktop.mouse.down();await desktop.mouse.move(930,455,{steps:14});await desktop.mouse.up();await desktop.waitForTimeout(300);
 const afterDrag=await camera(desktop);assert(Math.hypot(...beforeDrag.map((v,i)=>v-afterDrag[i]))>1);
 const beforeWheel=Math.hypot(...afterDrag);await desktop.mouse.wheel(0,160);await desktop.waitForTimeout(300);assert(Math.abs(Math.hypot(...await camera(desktop))-beforeWheel)>1);
 for(const [name,id,title] of locations) {
  await desktop.getByRole('button',{name}).focus();await settle(desktop);
  assert.equal(await desktop.locator('.location-card h3').textContent(),title);
  assert.equal(await desktop.locator(`.planet-hover-label[data-location-id="${id}"]:visible`).count(),1);
  assert((await desktop.locator('.location-card').textContent()).includes('正在生长'));
  assert.equal(await desktop.locator('.location-card button').count(),0);
  await desktop.getByRole('button',{name}).press('Enter');await settle(desktop);await ready(desktop);
  await desktop.screenshot({path:`work/planet-overview-${id}.png`});
 }
 // Inspect the actual generated spherical mesh from every azimuth and both poles.
 const geometry=await desktop.evaluate(async()=>{
  const {createTerrain,sampleTerrain,ISLANDS,PLANET_RADIUS}=await import('/app/planet-terrain.ts');
  const mesh=createTerrain(),positions=mesh.geometry.getAttribute('position');
  const secondMesh=createTerrain(),second=secondMesh.geometry,again=second.getAttribute('position');
  const vertices=[];let min=Infinity,max=-Infinity,deterministic=true;
  for(let i=0;i<positions.count;i+=3){const x=positions.getX(i),y=positions.getY(i),z=positions.getZ(i),r=Math.hypot(x,y,z);min=Math.min(min,r);max=Math.max(max,r);vertices.push({x:x/r,y:y/r,z:z/r,land:r>PLANET_RADIUS+.02});if(x!==again.getX(i)||y!==again.getY(i)||z!==again.getZ(i))deterministic=false;}
  const coverage=[];
  for(const latitude of [-90,-60,0,60,90])for(let degree=0;degree<360;degree+=30){const lat=latitude*Math.PI/180,lon=degree*Math.PI/180,d=[Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)];const visible=vertices.filter(v=>v.x*d[0]+v.y*d[1]+v.z*d[2]>.35);coverage.push(visible.filter(v=>v.land).length/visible.length);}
  mesh.geometry.dispose();mesh.material.dispose();second.dispose();secondMesh.material.dispose();
  return {minRadius:min,maxRadius:max,minimumLandCoverage:Math.min(...coverage),views:coverage.length,deterministic,islands:ISLANDS.length,sampler:typeof sampleTerrain};
 });
 assert.equal(geometry.islands,5);assert(geometry.maxRadius-geometry.minRadius>4);assert(geometry.minimumLandCoverage>.10);assert(geometry.deterministic);
 // Hover the visible island itself; the label disappears when leaving the canvas.
 await desktop.getByRole('button',{name:'重置星球视角'}).click();await settle(desktop);
 await desktop.mouse.move(575,330);await desktop.waitForTimeout(100);
 assert.equal(await desktop.locator('.planet-hover-label:visible').count(),1);
 await desktop.mouse.move(10,10);await desktop.waitForTimeout(100);assert.equal(await desktop.locator('.planet-hover-label:visible').count(),0);
 await desktop.evaluate(()=>{window.planetProbe.cameras=[];});
 await desktop.mouse.click(575,330);await ready(desktop,'talent-park');
 const flight=await desktop.evaluate(()=>window.planetProbe.cameras);
 const maxStep=Math.max(...flight.slice(1).map((p,i)=>Math.hypot(...p.map((v,j)=>v-flight[i][j]))));assert(maxStep<8,'Abrupt entry camera jump');
 assert.equal(await desktop.locator('.scene canvas').count(),1);await desktop.screenshot({path:'work/planet-overview-park-entry.png'});
 assert.equal(errors.length,0,JSON.stringify(errors));report.desktop={passed:true,rotationDegrees:total*180/Math.PI,geometry,maxFlightStep:maxStep,errors};
 await desktop.close();

 const mobile=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1}),mobileErrors=await instrument(mobile);
 await mobile.goto(process.env.TEST_URL||'http://localhost:3000/');await ready(mobile);await mobile.waitForFunction(()=>window.planetProbe.matrix);
 const cdp=await mobile.context().newCDPSession(mobile),beforePinch=Math.hypot(...await camera(mobile));
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:145,y:360,id:1},{x:245,y:360,id:2}]});
 for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:145-i*4,y:360,id:1},{x:245+i*4,y:360,id:2}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await mobile.waitForTimeout(200);await ready(mobile);
 assert(Math.abs(Math.hypot(...await camera(mobile))-beforePinch)>2,'Pinch did not zoom');
 for(const [name,id,title] of locations){await mobile.getByRole('button',{name}).tap();await settle(mobile);assert.equal(await mobile.locator('.location-card h3').textContent(),title);await ready(mobile);assert.equal(await mobile.locator('.location-card button').count(),0);await mobile.screenshot({path:`work/planet-overview-mobile-${id}.png`});}
 assert(await mobile.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await mobile.getByRole('button',{name:'重置星球视角'}).tap();await settle(mobile);await mobile.screenshot({path:'work/planet-overview-mobile.png'});
 await mobile.getByRole('button',{name:'走进这段记忆'}).tap();await ready(mobile,'talent-park');assert.equal(await mobile.locator('.scene canvas').count(),1);assert.equal(mobileErrors.length,0,JSON.stringify(mobileErrors));
 report.mobile={passed:true,width:390,pinch:true,fiveLocationsSelectable:true,parkEntry:true,errors:mobileErrors};await mobile.close();
 await writeFile('work/planet-overview-results.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
