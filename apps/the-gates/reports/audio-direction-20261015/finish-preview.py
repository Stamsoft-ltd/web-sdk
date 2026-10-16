import subprocess,json,re,pathlib,hashlib,sys
out=pathlib.Path(__file__).resolve().parent; raw=pathlib.Path(sys.argv[1] if len(sys.argv)>1 else '/tmp/gates-audio-v1')
def stats(p):
 s=subprocess.run(['ffmpeg','-hide_banner','-i',str(p),'-af','loudnorm=I=-16:TP=-2:LRA=7:print_format=json','-f','null','-'],capture_output=True,text=True,check=True).stderr
 return json.loads(re.findall(r'\{[^{}]*"input_i"[^{}]*\}',s,re.S)[-1])
report={}; reelgain=None
for name,duration,target in [('01-reel-landings',2.1,-18),('02-cascade',1.6,-17),('03-gate-portal',2.5,-16),('04-win-fanfare',3.2,-16)]:
 p=raw/(name+'-raw.wav'); a=stats(p);gain=min(target-float(a['input_i']),-2-float(a['input_tp']))
 if name.startswith('01'):reelgain=gain
 dest=out/(name+'.wav')
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(p),'-af',f'volume={gain}dB,afade=t=in:d=0.003,afade=t=out:st={duration-.08}:d=0.08','-ar','44100','-c:a','pcm_s16le',str(dest)],check=True)
 final=stats(dest)
 report[name]={'seconds':duration,'gainDb':round(gain,3),'integratedLUFS':final['input_i'],'truePeakDbTP':final['input_tp'],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
for r in range(1,7):
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(raw/f'reel-land-{r}-raw.wav'),'-af',f'volume={reelgain}dB,afade=t=in:d=0.003,afade=t=out:st=0.62:d=0.08','-ar','44100','-c:a','pcm_s16le',str(out/f'reel-land-{r}.wav')],check=True)
for p in sorted(raw.glob('*-raw.wav')):
 name=p.name.removesuffix('-raw.wav')
 if name in report or not re.match(r'^\d{2}-', name):continue
 duration=float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',str(p)],text=True))
 target=-18 if name.startswith(('05-','06-')) else -17 if name.startswith(('07-','17-')) else -16
 a=stats(p);gain=min(target-float(a['input_i']),-2-float(a['input_tp']))
 dest=out/(name+'.wav')
 subprocess.run(['ffmpeg','-y','-v','error','-i',str(p),'-af',f'volume={gain}dB,afade=t=in:d=0.003,afade=t=out:st={duration-.08}:d=0.08','-ar','44100','-c:a','pcm_s16le',str(dest)],check=True)
 final=stats(dest)
 report[name]={'seconds':duration,'gainDb':round(gain,3),'integratedLUFS':final['input_i'],'truePeakDbTP':final['input_tp'],'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
(out/'validation.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps(report,indent=2))
