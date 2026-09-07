// Hand-traced from AUBE's 2017 master plan, published on ArchDaily.
// Coordinates are a normalized design reference, not surveyed GIS coordinates.
export type Point = [number, number];
export const fromPlan = (p: Point): Point => [(p[0] - 600) / 5, (p[1] - 420) / 5];
const trace = (points: Point[]) => points.map(fromPlan);
export const boundary = trace([[374,688],[374,486],[388,453],[428,439],[467,423],[490,392],[502,346],[519,284],[548,254],[569,223],[591,130],[665,143],[824,163],[812,281],[799,390],[772,494],[752,603],[732,690]]);
export const lake = trace([[565,270],[613,273],[650,278],[673,294],[701,307],[716,329],[719,351],[735,377],[751,385],[777,394],[761,480],[732,482],[712,494],[698,514],[689,537],[686,562],[677,579],[661,583],[638,574],[617,565],[599,568],[583,580],[575,589],[555,591],[540,588],[527,589],[510,595],[490,591],[478,587],[461,586],[446,577],[435,560],[430,541],[433,518],[444,500],[465,492],[477,460],[492,437],[505,413],[511,400],[532,391],[545,378],[548,365],[543,351],[535,341],[539,311],[549,289]]);
export const northWater = trace([[665,270],[668,245],[684,221],[697,194],[709,178],[727,169],[746,170],[763,178],[782,198],[799,207],[820,211],[816,250],[797,249],[778,243],[764,232],[755,211],[748,196],[735,190],[723,198],[717,220],[707,238],[687,254],[678,275]]);
export const starBridge = trace([[750,382],[730,484]]);
export const piBridge = trace([[420,551],[436,579],[458,596],[486,602],[518,605],[549,603],[574,593],[596,579],[617,578],[638,588],[659,593],[681,581],[692,562]]);
export const northBridge = trace([[645,267],[684,279]]);
export const shoreWalk = trace([[557,262],[611,265],[650,268],[680,290],[709,303],[727,325],[730,350],[746,376],[750,382],[730,484],[708,489],[694,508],[681,536],[677,560],[667,572],[648,567],[618,557],[595,560],[577,572],[566,582],[548,580],[529,580],[510,585],[490,581],[467,577],[451,568],[443,545],[446,521],[456,510],[475,502],[488,472],[503,449],[518,426],[524,406],[546,394],[560,376],[560,359],[550,342],[551,313],[560,291]]);
export const northWalk = trace([[650,264],[637,238],[650,198],[670,169],[708,156],[749,159],[788,182],[807,194],[816,203]]);
export const southWalk = trace([[390,645],[433,626],[477,636],[523,625],[566,634],[610,614],[659,630],[704,636],[738,608]]);
export const tideCenter=fromPlan([518,369]);
export const spawn=fromPlan([520,350]);
export const places = [
 {id:'bamboo',name:'春笋天际线',description:'从西北岸望向中国华润大厦。收分的塔身、顶部斜交网格和基座支柱，共同形成熟悉的春笋轮廓。',...xy([561,282])},
 {id:'bridge',name:'人才星光桥',description:'公园东侧的直线跨水桥。沿星光柱向前走，回望西岸的城市天际线。',...xy([741,432])},
 {id:'pi',name:'π 桥',description:'南岸的弧形步行桥。圆周率数字沿栏杆延伸，桥下是曲折的湖岸与湿地小岛。',...xy([550,602])},
 {id:'lake',name:'潮汐广场',description:'西岸醒目的圆形草坪，外侧环绕石阶和铺装。这里是观湖、散步和停留的城市客厅。',...xy([518,369])},
];
function xy(p:Point){const [x,z]=fromPlan(p);return{x,z}}
export function inside(x:number,z:number,polygon:Point[]){let yes=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){const a=polygon[i],b=polygon[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])yes=!yes}return yes}
export function distanceToPath(x:number,z:number,points:Point[],closed=false){let nearest=Infinity;for(let i=0;i<points.length-(closed?0:1);i++){const a=points[i],b=points[(i+1)%points.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));nearest=Math.min(nearest,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz))}return nearest}
export const isWater=(x:number,z:number)=>inside(x,z,lake)||inside(x,z,northWater);
export function bridgeHeight(x:number,z:number){if(distanceToPath(x,z,starBridge)<1.1)return .94;if(distanceToPath(x,z,piBridge)<.9)return .94;if(distanceToPath(x,z,northBridge)<.8)return .94;return null}
export function groundHeight(x:number,z:number){
 // Keep the entire shoreline grid cell below water, including interpolated triangles.
 if(isWater(x,z))return .55;
 const shoreDistance=Math.min(distanceToPath(x,z,lake,true),distanceToPath(x,z,northWater,true));
 const shoreRelief=Math.min(1,Math.max(0,(shoreDistance-2)/3));
 const hill=(cx:number,cz:number,sx:number,sz:number,h:number)=>h*Math.exp(-((x-cx)**2/sx**2+(z-cz)**2/sz**2));const relief=hill(28,-29,9,13,2.2)+hill(15,45,13,5,.7);const pathDistance=Math.min(distanceToPath(x,z,shoreWalk,true),distanceToPath(x,z,northWalk),distanceToPath(x,z,southWalk));return .6+relief*shoreRelief*Math.min(1,Math.max(0,(pathDistance-1.5)/3))}
export function walkable(x:number,z:number){return inside(x,z,boundary)&&(!isWater(x,z)||bridgeHeight(x,z)!==null)}
