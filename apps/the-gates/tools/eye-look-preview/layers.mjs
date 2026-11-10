/** Split the original emblem in code; source artwork remains untouched. */
export function eyeSilhouette(){
 const p=new Path2D();p.moveTo(13,112);
 p.bezierCurveTo(59,52,112,32,149.5,32);
 p.bezierCurveTo(187,32,240,52,286,112);
 p.bezierCurveTo(240,172,187,192,149.5,192);
 p.bezierCurveTo(112,192,59,172,13,112);
 p.closePath();return p;
}
export function createEyeLayers(frame){
 const make=()=>{const c=document.createElement('canvas');c.width=299;c.height=224;return c};
 const background=make(),border=make();
 const back=background.getContext('2d'),front=border.getContext('2d');
 back.drawImage(frame,0,0,299,224);
 const blue=back.getImageData(0,0,299,224),rim=new ImageData(new Uint8ClampedArray(blue.data),299,224);
 // Use the source's blue/navy pigment as the aperture, not an approximate curve.
 // This preserves the gold edge exactly, including its original highlights.
 for(let y=0;y<224;y++)for(let x=0;x<299;x++){
  const i=(y*299+x)*4,r=blue.data[i],g=blue.data[i+1],b=blue.data[i+2];
  const inside=x>30&&x<270&&y>48&&y<177&&b>30&&b>r*1.15&&b>g*1.05;
  if(inside)rim.data[i+3]=0;else blue.data[i+3]=0;
 }
 back.putImageData(blue,0,0);front.putImageData(rim,0,0);
 return {background,border};
}

/** One shared 299px surface per frame, reused by every paying eye. */
export function createRollingBackground(background,{supplied=false}={}){
 const canvas=document.createElement('canvas');canvas.width=299;canvas.height=224;
 const c=canvas.getContext('2d');
 return (look)=>{
  c.clearRect(0,0,299,224);
  // One smooth blue volume. Never move the baked almond outline: doing so
  // creates a second eyelid inside the real one and makes the eye look split.
  c.save();c.translate(149.5,112);c.scale(1,.56);
  const cx=look.x*.48-10,cy=look.y*.55-15;
  const globe=c.createRadialGradient(cx,cy,8,cx,cy,137);
  globe.addColorStop(0,'#0875ff');globe.addColorStop(.45,'#0759f5');
  globe.addColorStop(.78,'#1233be');globe.addColorStop(1,'#08165f');
  c.fillStyle=globe;c.fillRect(-150,-200,300,400);c.restore();
  if(supplied){
   // Sample the broad interior only: supplied almond edge must never become
   // a second moving eyelid. Whole-surface mask stays fixed below the gold rim.
   c.save();c.globalAlpha=.5;c.translate(149.5+look.x*.2,112+look.y*.2);c.scale(2.3,2.3);
   c.drawImage(background,-149.5,-112);c.restore();
  }
  // Fixed lid occlusion, soft enough not to form a second contour.
  const lid=c.createLinearGradient(0,54,0,170);
  lid.addColorStop(0,'#020b5066');lid.addColorStop(.24,'#020b5000');
  lid.addColorStop(.76,'#020b5000');lid.addColorStop(1,'#020b5055');
  c.fillStyle=lid;c.fillRect(0,0,299,224);
  // Soft reflection follows the same gaze, without translating any hard edges.
  c.save();c.translate(108+look.x*.5,86+look.y*.4);c.rotate(-.45);c.scale(1,.28);
  const gloss=c.createRadialGradient(0,0,0,0,0,35);
  gloss.addColorStop(0,'#81dfff55');gloss.addColorStop(1,'#81dfff00');
  c.fillStyle=gloss;c.fillRect(-36,-36,72,72);c.restore();
  c.globalCompositeOperation='destination-in';c.drawImage(background,0,0);
  c.globalCompositeOperation='source-over';
  return canvas;
 };
}

/** True supplied layers; fit opaque art only, preserving original files on disk. */
export function suppliedLayer(image,width,height,cx=149.5,cy=112){
 const scan=document.createElement('canvas');scan.width=image.width;scan.height=image.height;
 const s=scan.getContext('2d');s.drawImage(image,0,0);const rgba=s.getImageData(0,0,image.width,image.height).data;
 let x0=image.width,y0=image.height,x1=0,y1=0;
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(rgba[(y*image.width+x)*4+3]>96){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
 const out=document.createElement('canvas');out.width=299;out.height=224;
 const w=x1-x0+1,h=y1-y0+1,scale=Math.min(width/w,height/h);
 out.getContext('2d').drawImage(image,x0,y0,w,h,cx-w*scale/2,cy-h*scale/2,w*scale,h*scale);
 return out;
}
export function createSuppliedEyeLayers(border,background,iris){
 return {border:suppliedLayer(border,299,200),background:suppliedLayer(background,251,123),iris:suppliedLayer(iris,131,131)};
}
