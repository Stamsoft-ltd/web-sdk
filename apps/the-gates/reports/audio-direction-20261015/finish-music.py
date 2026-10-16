"""Extract warm cyclic render, preserve loop timing, and measure it. Preview only."""
import pathlib, subprocess, json, re, sys, wave, array, math, hashlib
out=pathlib.Path(__file__).resolve().parent
raw=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/gates-audio-v1')
def run(*args):return subprocess.run(['ffmpeg','-y','-v','error',*map(str,args)],check=True)
def stats(path):
 s=subprocess.run(['ffmpeg','-hide_banner','-i',str(path),'-af','loudnorm=I=-22:TP=-4:LRA=7:print_format=json','-f','null','-'],capture_output=True,text=True,check=True).stderr
 return json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}',s,re.S)[-1])
report={}
for name,bpm,seconds in [('base-music',96,20),('bonus-music',120,16),('super-music',128,15),('hidden-music',100,19.2)]:
 source=raw/(name+'-raw.wav');trim=raw/(name+'-loop.wav');dest=out/(name+'-preview.wav')
 run('-i',source,'-af',f'atrim=start={seconds}:end={seconds*2},asetpts=PTS-STARTPTS','-c:a','pcm_f32le',trim)
 before=stats(trim);gain=min(-22-float(before['input_i']),-4-float(before['input_tp']))
 run('-i',trim,'-af',f'volume={gain}dB','-ar','44100','-c:a','pcm_s16le',dest)
 run('-i',dest,'-codec:a','libmp3lame','-q:a',4,'-write_xing',1,out/(name+'-preview.mp3'))
 with wave.open(str(dest)) as f:
  assert f.getnframes()==seconds*44100 and f.getnchannels()==2
  samples=array.array('h',f.readframes(f.getnframes()))
  peak=max(abs(x) for x in samples);assert 0<peak<32767
  boundary=max(abs(samples[-2+c]-samples[c]) for c in (0,1))
  rms=math.sqrt(sum(x*x for x in samples)/len(samples))
  jumps=sorted(abs(samples[i]-samples[i-2]) for i in range(2,len(samples)))
  # Loop seam must be quieter than ordinary 99th percentile adjacent-sample changes.
  p99=jumps[int(len(jumps)*.99)]
  assert boundary<=p99,(name,boundary,p99)
 final=stats(dest)
 report[name]={'bpm':bpm,'bars':8,'seconds':seconds,'integratedLUFS':final['input_i'],'truePeakDbTP':final['input_tp'],'boundaryDeltaPcm16':boundary,'internalDeltaP99Pcm16':p99,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'status':'approved and locally integrated; licensing review before publishing'}
(out/'music-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
