export const DURATION_MS=1800;
const clamp=x=>Math.min(1,Math.max(0,x));
const ease=x=>{x=clamp(x);return x*x*(3-2*x)};
const ramp=(p,a,b)=>ease((p-a)/(b-a));
const bump=(p,a,b,c,d)=>ramp(p,a,b)*(1-ramp(p,c,d));
/** One-shot paying gesture. Rest → anticipation → gesture → rest. No gameplay state. */
export function symbolMotion(ms,{speed=1,reduced=false}={}){
 const p=clamp(ms/(DURATION_MS/Math.max(.1,speed)));
 const active=reduced?0:bump(p,.06,.2,.76,.96);
 return {p,active,
  flap:reduced?0:bump(p,.14,.4,.61,.88),
  seal:reduced?0:bump(p,.06,.22,.7,.94),
  blink:reduced?0:bump(p,.12,.18,.2,.28),
  glance:reduced?0:(Math.sin(ramp(p,.25,.72)*Math.PI*2)*bump(p,.2,.32,.67,.9)||0),
  rayAngle:reduced?0:Math.PI*2*ramp(p,.1,.9),
  orbAngle:reduced?0:-Math.PI*6*ramp(p,.08,.82),
  sweep:ramp(p,.1,.83),
  petal:reduced?-1:Math.min(5,Math.floor(ramp(p,.12,.7)*6)),
 };
}

/** Sample the live game's original linear KEY paying tracks, not a new imitation. */
export function keyPayingFrame(rig,ms,{speed=1,reduced=false}={}){
 if(reduced)return {degrees:0,y:0};
 const bone=rig.animations.paying.bones.body,t=Math.max(0,ms)*Math.max(.1,speed)/1000;
 function sample(keys,field){
  if(keys.some(k=>k.curve!==undefined))throw Error('KEY preview requires a curve-aware sampler for this rig');
  if(t<=(keys[0].time??0))return keys[0][field]??0;
  for(let i=1;i<keys.length;i++)if(t<=keys[i].time){
   const a=keys[i-1],b=keys[i],p=(t-(a.time??0))/(b.time-(a.time??0));
   return (a[field]??0)+((b[field]??0)-(a[field]??0))*p;
  }
  return keys.at(-1)[field]??0;
 }
 return {degrees:sample(bone.rotate,'value'),y:sample(bone.translate,'y')};
}
