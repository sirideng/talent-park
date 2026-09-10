import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage();
 await page.goto('http://localhost:3000/');
 await page.getByRole('button',{name:'07 我的中学'}).click();
 const host='.scene > [data-scene-id="school"]';
 await page.waitForFunction(s=>!!document.querySelector(s)?.schoolDebug,host,{timeout:60000});
 const results=await page.evaluate(async s=>{
  const d=document.querySelector(s).schoolDebug;
  const T=await import('/node_modules/.vite/deps/three.js');
  const {ThirdPersonCamera}=await import('/app/physics/player-controller.ts');
  const rows=[];
  for(const [name,x,z] of [['building',0,-30],['stand',0,29],['bars',40,-8],['gate',3.7,45],['track',34,0]]){
   d.teleport(x,z);for(let i=0;i<30;i++)d.physics.update(1/60,new T.Vector3());
   const feet=d.physics.position.clone();
   for(let i=0;i<12;i++){
    const a=i*Math.PI/6,expected=feet.clone().add(new T.Vector3(Math.sin(a)*12,i%3===0?-3:4,Math.cos(a)*12));
    const boom=new ThirdPersonCamera(),actual=boom.resolve(d.physics,expected,feet,1/60);
    rows.push({name,angle:i,clear:d.physics.cameraClear(actual),distance:actual.distanceTo(feet),shortened:actual.distanceTo(expected)>.1});
   }
  }
  return rows;
 },host);
 assert.ok(results.every(r=>r.clear),'all camera sweeps clear school solids');
 assert.ok(results.some(r=>r.shortened),'camera retracts at obstacles');
 assert.ok(results.every(r=>r.distance>1),'camera stays outside head');
 await writeFile('work/school-camera-report.json',JSON.stringify(results,null,2));
 console.log('PASS school camera',results.length,'directions');
} finally {await browser.close();}
