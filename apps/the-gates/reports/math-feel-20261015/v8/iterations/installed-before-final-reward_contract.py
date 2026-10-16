"""State-aware, lookup-weighted V8 experience contract; fail closed on drift."""
from collections import Counter,defaultdict
from fractions import Fraction

GATE_TARGETS={'normal':4,'super':6,'hidden':8}
TYPE_TARGETS={'addMultiplier':.40,'multiplyMultiplier':.15,'stickyWild':.25,'extraSpin':.15,'retrigger':.05}
INNER_TARGETS={'boost2':('multiplyMultiplier',.80),'boost3':('multiplyMultiplier',.18),'boost5':('multiplyMultiplier',.02),
               'extra1':('extraSpin',.45),'extra2':('extraSpin',.30),'extra3':('extraSpin',.18),'extra5':('extraSpin',.07),
               'wild2':('wildSpaceTwo',.20)}

def reward_metrics(events):
    result={};inside=False;sticky=0;free=False
    for e in events:
        kind=e['type']
        if kind=='freeSpinTrigger':
            tier=e['tier'];inside=True;result={'tier':tier,'bonuses':1,'gates':0,'raw':0,'payout':0,'clusters':0,'small':0,'eligible':0,'full':0}
        elif kind=='freeSpinEnd':inside=False;result['payout']=e['amount']
        elif inside:
            if kind=='spinStart':sticky=len(e['stickyPositions'])
            elif kind=='gateOpen':result['gates']+=1
            elif kind=='cascadeWin':
                result['raw']+=e['rawAmount'];result['clusters']+=len(e['wins']);result['small']+=sum(w['size']<=9 for w in e['wins'])
            elif kind=='gateReward':
                r=e['reward'];k=r['kind'];state='eligible' if sticky<3 else 'full'
                result[state]+=1;result[state+'/'+k]=result.get(state+'/'+k,0)+1
                result[k]=result.get(k,0)+1
                value=r.get('value',r.get('spinsAdded',len(r.get('positions',[]))))
                inner=('boost'+str(value) if k=='multiplyMultiplier' else 'extra'+str(value) if k=='extraSpin' else None)
                if inner:result[inner]=result.get(inner,0)+1
                if k=='stickyWild' and sticky<=1:
                    result['wildSpaceTwo']=result.get('wildSpaceTwo',0)+1
                    if value==2:result['wild2']=result.get('wild2',0)+1
                sticky=len(e['stickyPositions'])
    return result

def constraints(records, *, tight=True):
    """Return (name, per-book linear residual, upper bound). p sums to one.
    Fitting uses tighter bounds than independent publication validation.
    """
    gate_tol=.01 if tight else .05
    type_tol=.005 if tight else .01
    inner_tol=.005 if tight else .01
    for tier,target in GATE_TARGETS.items():
        ms=[r.get('rewardMetrics',{}) if r.get('rewardMetrics',{}).get('tier')==tier else {} for r in records]
        if not any(ms):continue
        def row(key):return [m.get(key,0) for m in ms]
        def band(name,num,den,target,tol):
            yield name+' upper',[n-(target+tol)*d for n,d in zip(num,den)],0
            yield name+' lower',[(target-tol)*d-n for n,d in zip(num,den)],0
        yield from band(tier+' gates',row('gates'),row('bonuses'),target,target*gate_tol)
        # Gate rewards, not raw symbol pays, should supply at least 70% of bonus returns.
        yield tier+' gate payout share',[raw-.30*payout for raw,payout in zip(row('raw'),row('payout'))],0
        yield tier+' small clusters',[.80*c-s for c,s in zip(row('clusters'),row('small'))],0
        if tier=='normal':continue
        for state in ('eligible','full'):
            for k,targetp in TYPE_TARGETS.items():
                if state=='full' and k=='stickyWild':continue
                p=targetp if state=='eligible' else targetp/.75
                yield from band(tier+'/'+state+'/'+k,row(state+'/'+k),row(state),p,type_tol)
        for key,(den,p) in INNER_TARGETS.items():
            yield from band(tier+'/'+key,row(key),row(den),p,min(inner_tol,p*.10) if tight else min(inner_tol,p*.25))

def check_reward_contract(rows,label='pool'):
    records=[r for r,w in rows];weights=[w for r,w in rows];total=sum(weights)
    for name,coefs,limit in constraints(records,tight=False):
        # Coefficients are simple rational targets; decimal Fraction avoids binary drift.
        value=sum(Fraction(str(c))*w for c,w in zip(coefs,weights))
        if value>Fraction(str(limit))*total+Fraction(1,1000):
            raise RuntimeError(f'{label}: V8 reward contract failed: {name}: {float(value/total):.9g}')
    tiers={}
    for tier in GATE_TARGETS:
        counts=Counter()
        for r,w in rows:
            m=r.get('rewardMetrics',{})
            if m.get('tier')!=tier:continue
            counts.update({k:v*w for k,v in m.items() if k!='tier'})
        if not counts['bonuses']:continue
        types={state:{k:counts[state+'/'+k]/counts[state] if counts[state] else None for k in TYPE_TARGETS} for state in ('eligible','full')}
        tiers[tier]={'meanGates':counts['gates']/counts['bonuses'],'gatePayoutShare':1-counts['raw']/counts['payout'] if counts['payout'] else 0,
                     'smallClusterShare':counts['small']/counts['clusters'] if counts['clusters'] else 0,'rewardTypeByEligibility':types,
                     'inner':{key:counts[key]/counts[den] if counts[den] else None for key,(den,p) in INNER_TARGETS.items()},'weightedCounts':dict(counts)}
    return tiers
