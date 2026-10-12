"""Export real math outcomes for visual tests, never a weighted RTP simulation."""
import hashlib,io,json,sys
from pathlib import Path
import zstandard as zstd
root=Path(sys.argv[1]) if len(sys.argv)>1 else Path(__file__).resolve().parents[4]/'math-sdk/games/split_party/library/publish_files'
out=Path(__file__).resolve().parents[1]/'public/fixtures'
for mode in ('base','feature','normal','super','mystery'):
 path=root/f'books_{mode}.jsonl.zst'; chosen={}
 with path.open('rb') as raw,zstd.ZstdDecompressor().stream_reader(raw) as reader,io.TextIOWrapper(reader) as text:
  for line in text:
   b=json.loads(line); p=b['payoutMultiplier']; tiers=[e['tier'] for e in b['events'] if e['type']=='bonusStart']
   key=(tiers[0] if tiers else 'base') if mode=='mystery' else ('zero' if p==0 else 'max' if p==2000000 else 'bonus' if mode=='base' and tiers else 'win')
   if key not in chosen and (key in ('max','zero') or len(b['events'])<450):chosen[key]=b
   if len(chosen)>=(3 if mode=='mystery' else 4 if mode=='base' else 2):break
 order=sorted(chosen,key=lambda k:(k!='win',k=='max',k))
 payload={'source':'math-sdk/games/split_party/library/publish_files/'+path.name,'mode':mode,'note':'Deterministic visual fixtures, NOT weighted game sampling','books':[chosen[k] for k in order]}
 (out/f'{mode}.json').write_text(json.dumps(payload,separators=(',',':')))
 print(mode,[(k,chosen[k]['payoutMultiplier']) for k in order])
