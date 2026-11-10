import { WIN_ENTER_MS } from './winMotion.ts';
export const CAP_GEM_LAYOUT = [
 [-365,25,115], [365,25,115], [-275,40,62], [275,40,62], [-263,160,100], [287,160,100],
] as const;
export const GEM_FLIGHT_MS=560;
export const GEM_STAGGER_MS=90;
export const GEM_START_MS=WIN_ENTER_MS+80;
export function winGemFrame(age:number,index:number,distance:number,reduced=false){
 const start=GEM_START_MS+index*GEM_STAGGER_MS;
 const p=reduced?1:Math.max(0,Math.min(1,(age-start)/GEM_FLIGHT_MS));
 const side=CAP_GEM_LAYOUT[index][0]<0?-1:1;
 return { visible:reduced||age>=start, x:p===1?0:side*distance*(1-p)**3,
  y:reduced||p===1?0:-18*Math.sin(p*Math.PI), rotation:reduced||p===1?0:-side*.18*(1-p),
  scale:reduced?1:1+.055*Math.sin(p*Math.PI),landed:p===1 };
}
/** Screen-pixel impulse: bounded, damped, cosmetic, with an exact neutral end. */
export function winGemBoardShake(age:number,reduced=false){
 const p=Math.max(0,Math.min(1,age/220));
 if(reduced||age<0||p===1)return {x:0,y:0,done:true};
 const envelope=(1-p)**2;
 return {x:Math.sin(p*Math.PI*6)*2*envelope,y:Math.sin(p*Math.PI*8)*1.5*envelope,done:false};
}
