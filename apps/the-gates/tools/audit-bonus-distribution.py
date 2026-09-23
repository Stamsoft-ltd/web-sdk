"""Read-only audit of published weighted books; requires Python + zstandard.
Usage: python3 audit-bonus-distribution.py PUBLISH_FILES OUTPUT_JSON
Does not generate/reweight books or modify the math SDK.
"""
import argparse, csv, hashlib, io, json, time
from collections import Counter, defaultdict
from pathlib import Path
import zstandard
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('publish_files', type=Path)
parser.add_argument('output_json', type=Path)
args=parser.parse_args()
root=args.publish_files.resolve(); out=args.output_json
out.parent.mkdir(parents=True, exist_ok=True)
index=json.loads((root/'index.json').read_text())
def quant(hist, frac):
    mass=sum(hist.values()); acc=0
    for val,weight in sorted(hist.items()):
        acc+=weight
        if acc >= mass*frac: return val

def stats(rows):
    mass=sum(r['weight'] for r in rows)
    if not mass: return None
    result={'records':len(rows),'weight':mass}
    for key in ('payout','bonusPayout','entryPayout','gates','entryGates','winningSpins','spins','longestBlank'):
        hist=Counter()
        for r in rows: hist[r[key]]+=r['weight']
        scale=100 if key.endswith('Payout') or key=='payout' else 1
        result[key]={'mean':sum(k*v for k,v in hist.items())/mass/scale,
          'quantiles':{str(q):quant(hist,q)/scale for q in (.05,.1,.25,.5,.75,.9,.95,.99)},
          'min':min(hist)/scale,'max':max(hist)/scale}
        if key in ('gates','winningSpins','longestBlank'):
            result[key]['distribution']={str(k):v/mass for k,v in sorted(hist.items())}
    boundaries=[(0,1),(1,10000),(10000,50000),(50000,100000),(100000,250000),(250000,500000),(500000,1000000),(1000000,2500000),(2500000,2500001)]
    result['payoutBands']=[{'fromX':lo/100,'toExclusiveX':hi/100,'probability':sum(r['weight'] for r in rows if lo<=r['payout']<hi)/mass} for lo,hi in boundaries]
    common=Counter()
    for r in rows:common[r['payout']]+=r['weight']
    result['topPayouts']=[{'payoutX':v/100,'probability':w/mass} for v,w in common.most_common(10)]
    result['oneWinProbability']=sum(r['weight'] for r in rows if r['winningSpins']==1)/mass
    result['dominantSpin90Probability']=sum(r['weight'] for r in rows if r['bonusPayout'] and r['maxSpin']*10>=r['bonusPayout']*9)/mass
    result['oneGateProbability']=sum(r['weight'] for r in rows if r['gates']==1)/mass
    result['threePlusGateProbability']=sum(r['weight'] for r in rows if r['gates']>=3)/mass
    result['fiveToEightWinsProbability']=sum(r['weight'] for r in rows if 5<=r['winningSpins']<=8)/mass
    witnesses=Counter()
    for r in rows:witnesses[r['witness']]+=r['weight']
    result['witnessMass']={k:v/mass for k,v in witnesses.items()}
    return result
allrows={}; evidence={}
for mode in index['modes']:
    name=mode['name']; start=time.time()
    lookup=root/mode['weights']; books=root/mode['events']
    weights={int(a):(int(b),int(c)) for a,b,c in csv.reader(lookup.open())}
    assert all(w>0 for w,p in weights.values())
    evidence[name]={'books':str(books),'modifiedNs':books.stat().st_mtime_ns,
      'lookupSha256':hashlib.sha256(lookup.read_bytes()).hexdigest(),'bookSha256':hashlib.file_digest(books.open('rb'),'sha256').hexdigest()}
    rows=[]
    with books.open('rb') as f, zstandard.ZstdDecompressor().stream_reader(f) as z, io.TextIOWrapper(z) as lines:
        for line in lines:
            book=json.loads(line); weight,payout=weights.pop(book['id'])
            assert payout==book['payoutMultiplier']
            events=book['events']; trigger=[e for e in events if e['type']=='freeSpinTrigger']
            tier=trigger[0]['tier'] if trigger else None
            ids={e['spinId'] for e in events if e['type']=='spinStart' and e.get('freeSpin',0)>0}
            wins=[e['amount'] for e in events if e['type']=='spinWin' and e['spinId'] in ids]
            entry=sum(e['amount'] for e in events if e['type']=='spinWin' and e['spinId'] not in ids)
            assert entry+sum(wins)==payout, (name,book['id'],'mismatched spin total')
            streak=longest=0
            for w in wins:
                streak=0 if w else streak+1; longest=max(longest,streak)
            rows.append({'id':book['id'],'poolId':book.get('poolId'),'tier':tier,'weight':weight,'payout':payout,
              'bonusPayout':sum(wins),'entryPayout':entry,'spins':len(wins),'winningSpins':sum(w>0 for w in wins),
              'maxSpin':max(wins,default=0),'longestBlank':longest,
              'gates':sum(e['type']=='gateOpen' and e['spinId'] in ids for e in events),
              'entryGates':sum(e['type']=='gateOpen' and e['spinId'] not in ids for e in events),
              'witness':book.get('generation',{}).get('witness') or 'random'})
    assert not weights
    assert books.stat().st_mtime_ns == evidence[name]['modifiedNs'], 'Book changed during audit'
    allrows[name]=rows
    print(name,len(rows),round(time.time()-start,1),'seconds',flush=True)
report={'basis':'Exact weighted distribution of all local published books; not simulation, not confirmed live deployment. Payouts in base-bet x; gross, entry included unless bonusPayout specified. Median is smallest payout with CDF >= 50%.', 'evidence':evidence,'modes':{},'hidden':{}}
for mode in index['modes']:
    name=mode['name']; rows=allrows[name]; total=sum(r['weight'] for r in rows)
    report['modes'][name]={'cost':mode['cost'],'allRounds':stats(rows),'bonusTriggered':stats([r for r in rows if r['tier']]),
       'tiers':{tier:stats([r for r in rows if r['tier']==tier]) for tier in ('normal','super','hidden')},
       'tierProbability':{tier:sum(r['weight'] for r in rows if r['tier']==tier)/total for tier in ('normal','super','hidden')}}
    report['modes'][name]['rtp']=report['modes'][name]['allRounds']['payout']['mean']/mode['cost']
for name in ('BASE','CHANCE','MYSTERY'):
    rows=[r for r in allrows[name] if r['tier']=='hidden'];report['hidden'][name]=stats(rows)
    report['hidden'][name]['tailWitness']=stats([r for r in rows if r['witness']=='tail'])
# Verify tier-conditioned weight distributions match exactly across bought/natural pools.
comparisons={}
for tier,buy in [('normal','BONUS'),('super','SUPER'),('hidden','MYSTERY')]:
    a={r['poolId']:r for r in allrows['BASE'] if r['tier']==tier}; b={r['poolId']:r for r in allrows[buy] if r['tier']==tier}
    am=sum(r['weight'] for r in a.values()); bm=sum(r['weight'] for r in b.values())
    keys=('payout','bonusPayout','entryPayout','gates','entryGates','spins','winningSpins','maxSpin','longestBlank')
    comparisons[tier]=set(a)==set(b) and all(a[i]['weight']*bm==b[i]['weight']*am and all(a[i][k]==b[i][k] for k in keys) for i in a)
report['identicalBoughtVsNaturalTierDistributions']=comparisons
out.write_text(json.dumps(report,indent=2)+'\n')
print('Saved',out,flush=True)
