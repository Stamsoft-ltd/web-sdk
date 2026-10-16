"""Read-only exact weighted-book audit; never generates, reweights or changes math."""
import argparse, csv, io, json, collections, pathlib, time
import zstandard
p=argparse.ArgumentParser();p.add_argument('library');p.add_argument('--mode',default='SUPER');p.add_argument('--output',required=True);a=p.parse_args()
lib=pathlib.Path(a.library); weights={}; atoms=collections.Counter()
with (lib/'publish_files'/f'lookUpTable_{a.mode}_0.csv').open() as f:
 for row in csv.reader(f):
  i,w,pay=map(int,row);weights[i]=(w,pay);atoms[pay]+=w
W=sum(w for w,_ in weights.values()); sums=collections.Counter(); winsdist=collections.Counter(); sym=collections.Counter(); examples=[]; seen=set();n=0;start=time.time()
with (lib/'publish_files'/f'books_{a.mode}.jsonl.zst').open('rb') as f,zstandard.ZstdDecompressor().stream_reader(f) as z:
 for line in io.TextIOWrapper(z):
  b=json.loads(line);i=b['id'];w,pay=weights[i];assert pay==b['payoutMultiplier'];assert i not in seen;seen.add(i);n+=1
  fs=False;prev=None;chains=[];chain=[];spins=[];initial=None;lastboard=None;count=0;winning=[]
  for e in b['events']:
   typ=e['type']
   if typ=='spinStart':
    if chain: chains.append(chain)
    chain=[];prev=None;fs=e.get('freeSpin',0)>0;lastboard=None;count=0
   elif typ=='reveal':
    counts=collections.Counter(c['name'] for col in e['board'] for c in col if c['name'] not in ('KEY','WILD'))
    if count==0:
     sums['initialBoards']+=w;sums['initialDistinctSum']+=w*len(counts);sums['initialNear5to7Sum']+=w*sum(5<=v<=7 for v in counts.values())
    lastboard=counts
   elif typ=='cascadeWin':
    ss=frozenset(x['symbol'] for x in e['wins']); chain.append(ss);count+=1
    sums['payingBoards']+=w;sums['simultaneousGroupsSum']+=w*len(ss);sums['multiSymbolBoards']+=w*(len(ss)>1)
    for s in ss:sym[s]+=w
    if prev is not None:
     sums['transitions']+=w;sums['identicalSetTransitions']+=w*(ss==prev);sums['overlapTransitions']+=w*bool(ss&prev);sums['newSymbolTransitions']+=w*bool(ss-prev);sums['disjointTransitions']+=w*(not bool(ss&prev))
    prev=ss
   elif typ=='spinWin' and fs:spins.append(e['amount'])
  if chain:chains.append(chain)
  for ch in chains:
   if len(ch)>1:
    sums['multiTumbleSpins']+=w;sums['monoSymbolChains']+=w*(len(set().union(*ch))==1)
  if spins:
   paid=sum(x>0 for x in spins);total=sum(spins);largest=max(spins);winsdist[paid]+=w
   sums['bonusRounds']+=w;sums['fsCountSum']+=w*len(spins);sums['payingFsSum']+=w*paid
   sums['onePayingFs']+=w*(paid==1);sums['oneWin14Blanks']+=w*(paid==1 and len(spins)==15)
   sums['oneSpin90Pct']+=w*(total>0 and largest*10>=total*9)
   sums['fs750x']+=w*sum(x==75000 for x in spins)
   sums['round750x']+=w*(pay==75000)
   sums['one750x14Blanks']+=w*(paid==1 and len(spins)==15 and largest==75000)
   if paid==1 and largest==75000 and len(examples)<6:examples.append({'id':i,'weight':w,'payoutX':pay/100,'freeSpinPaysX':[x/100 for x in spins]})
  if n%10000==0:print(f'{a.mode} {n} books {time.time()-start:.1f}s',flush=True)
assert len(seen)==len(weights)
def ratio(k,d):return sums[k]/sums[d] if sums[d] else None
out={'library':str(lib),'mode':a.mode,'basis':'Exact complete local lookup-weighted book census, not live telemetry or a fresh RNG simulation','books':n,'totalWeight':W,'rtp':sum(pay*w for pay,w in atoms.items())/W/100/{'SUPER':300,'BONUS':100,'BASE':1,'FEATURE':20}[a.mode], 'topPayoutAtoms':[{'x':pay/100,'probability':w/W} for pay,w in atoms.most_common(12)],'metrics':{'identicalWinningSetTransitionRate':ratio('identicalSetTransitions','transitions'),'overlapWinningSetTransitionRate':ratio('overlapTransitions','transitions'),'newSymbolTransitionRate':ratio('newSymbolTransitions','transitions'),'disjointWinningSetTransitionRate':ratio('disjointTransitions','transitions'),'monoSymbolMultiTumbleSpinRate':ratio('monoSymbolChains','multiTumbleSpins'),'multiSymbolPayingBoardRate':ratio('multiSymbolBoards','payingBoards'),'meanInitialDistinctSymbols':ratio('initialDistinctSum','initialBoards'),'meanInitial5to7CountSymbols':ratio('initialNear5to7Sum','initialBoards'),'meanPayingFreeSpins':ratio('payingFsSum','bonusRounds'),'meanFreeSpins':ratio('fsCountSum','bonusRounds'),'onePayingFreeSpinProbability':ratio('onePayingFs','bonusRounds'),'oneWin14BlanksProbability':ratio('oneWin14Blanks','bonusRounds'),'atLeast90PctOnOneFsProbability':ratio('oneSpin90Pct','bonusRounds'),'roundExactly750xProbability':sums['round750x']/W,'one750x14BlanksProbability':ratio('one750x14Blanks','bonusRounds')},'winningFreeSpinsDistribution':{str(k):v/W for k,v in sorted(winsdist.items())},'payingSymbolShare':{k:v/sum(sym.values()) for k,v in sym.items()},'rawWeightedCounts':dict(sums),'examples':examples}
pathlib.Path(a.output).write_text(json.dumps(out,indent=2)+'\n');print(json.dumps(out['metrics'],indent=2),flush=True)
