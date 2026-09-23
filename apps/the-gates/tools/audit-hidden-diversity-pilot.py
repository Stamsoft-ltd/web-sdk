"""Read-only 10k-pool Hidden pilot. Regenerate changed tails in memory, refit all modes.
Requires an existing library of shared candidates and Python zstandard.
Does not package, upload or replace books/weights. Not production sign-off.
"""
import argparse, sys, json, hashlib
from pathlib import Path
from collections import Counter
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('math_game', type=Path)
parser.add_argument('output', type=Path)
args=parser.parse_args()
root=args.math_game.resolve()
sys.path.insert(0,str(root))
from run import build_weights, POOLS
from math_targets import MODE_GROUP_WEIGHTS, MODE_COSTS
from artifacts import mode_report, summarize_book
from gates_math import generate_candidate
from validate_gates_artifacts import validate_book
manifest=json.loads((root/'library/configs/generation.json').read_text())
seed=manifest['seed']
pools={p:json.loads((root/'library/pools'/f'{p}.metadata.json').read_text()) for p in POOLS}
metrics={}
for i,record in enumerate(pools['hidden']):
    if record['generation']['witness'] != 'tail': continue
    book=generate_candidate('hidden',record['poolId'],seed)
    validate_book(book)
    pools['hidden'][i]=summarize_book(book)
    ids={e['spinId'] for e in book['events'] if e['type']=='spinStart' and e.get('freeSpin',0)>0}
    metrics[str(record['poolId'])]={
        'gates':sum(e['type']=='gateOpen' and e['spinId'] in ids for e in book['events']),
        'winSpins':sum(e['type']=='spinWin' and e['spinId'] in ids and e['amount']>0 for e in book['events']),
        'payout':book['payoutMultiplier']}
probe={'metrics':metrics}
weights,fits=build_weights(pools)
reports={m:mode_report(m,[(r,w) for g in MODE_GROUP_WEIGHTS[m] for r,w in zip(pools[g],weights[m][g])]) for m in MODE_COSTS}
hist=Counter(); gates=Counter(); hits=Counter(); mass=sum(weights['MYSTERY']['hidden'])
for line in (root/'library/pools/hidden.jsonl').open():
 b=json.loads(line);i=b['poolId'];w=weights['MYSTERY']['hidden'][i]
 if str(i) in probe['metrics']:
  metric=probe['metrics'][str(i)];g=metric['gates'];n=metric['winSpins'];p=metric['payout']
 else:
  ids={e['spinId'] for e in b['events'] if e['type']=='spinStart' and e.get('freeSpin',0)>0}
  g=sum(e['type']=='gateOpen' and e['spinId'] in ids for e in b['events'])
  n=sum(e['type']=='spinWin' and e['spinId'] in ids and e['amount']>0 for e in b['events'])
  p=b['payoutMultiplier']
 hist[p]+=w;gates[g]+=w;hits[n]+=w

def med(h):
 acc=0
 for value,w in sorted(h.items()):
  acc+=w
  if acc*2>=mass:return value
out={'status':'pilot_metadata_refit_not_published_not_500k_validation',
 'basis':f"{len(pools['hidden']):,} candidates per shared pool, seed {seed}. All {len(metrics)} changed Hidden tail paths regenerated and event-validated; unchanged candidate metadata reused. All six mode fits checked via mode_report. Not a Monte Carlo estimate or live deployment.",
 'originalGenerationManifest':manifest,
 'sourceSha256':{p.name:hashlib.sha256(p.read_bytes()).hexdigest() for p in root.glob('*.py')},
 'hidden':{'meanX':sum(p*w for p,w in hist.items())/mass/100,'medianX':med(hist)/100,
  'exact3750Probability':hist[375000]/mass,'largestExactPayoutProbability':max(hist.values())/mass,
  'distinctPayouts':len(hist),'topPayouts':[(p/100,w/mass) for p,w in hist.most_common(15)],
  'meanGates':sum(g*w for g,w in gates.items())/mass,'medianGates':med(gates),'gateDistribution':{g:w/mass for g,w in sorted(gates.items())},
  'meanWinningSpins':sum(n*w for n,w in hits.items())/mass,'medianWinningSpins':med(hits),
  'payoutBands':{f'{lo}..<{hi}':sum(w for p,w in hist.items() if lo*100<=p<hi*100)/mass for lo,hi in [(0,1000),(1000,2500),(2500,5000),(5000,10000),(10000,25000),(25000,25001)]}},
 'fits':fits,'modeReports':reports}
path=args.output
path.parent.mkdir(parents=True,exist_ok=True)
path.write_text(json.dumps(out,indent=2)+'\n')
print(json.dumps(out['hidden'],indent=2));print('All six mode_report checks passed. Report:',path)
