/** Fixed frame/gems. Iris and blue shading move together; coordinates are in original 299px frame space. */
export const EYE_LOOK_MS=1800;
export const LOOK_KEYS=[
 [0,0,0],[.10,0,0],[.22,-44,-2],[.36,-44,-2],
 [.52,44,0],[.64,44,0],[.76,7,-13],[.84,7,-13],[1,0,0],
];
export function eyeLookFrame(ms,{speed=1,reduced=false}={}){
 if(reduced)return {x:0,y:0};
 const p=Math.max(0,Math.min(1,ms/(EYE_LOOK_MS/Math.max(.1,speed))));
 for(let i=1;i<LOOK_KEYS.length;i++)if(p<=LOOK_KEYS[i][0]){
  const a=LOOK_KEYS[i-1],b=LOOK_KEYS[i],t=(p-a[0])/(b[0]-a[0]),q=t*t*(3-2*t);
  return {x:a[1]+(b[1]-a[1])*q,y:a[2]+(b[2]-a[2])*q};
 }
 return {x:0,y:0};
}

/** A surface marking turns away with the eyeball instead of sliding as a flat disc. */
export function irisProjection({x,y}){
 return {width:131*(1-.16*Math.min(1,(x/44)**2)),height:131*(1-.06*Math.min(1,(y/13)**2))};
}
