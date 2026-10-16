"""Constrained offline lookup fitting. No outcome mutation.
Minimize largest book probability while preserving EV, gates, reward variety,
small wins, concentration and tail budgets. Integer repair revalidated independently.
"""
from collections import defaultdict
from fractions import Fraction
import math
import numpy as np
from scipy.optimize import linprog
from scipy.sparse import csr_matrix,hstack,vstack,eye
from experience import regular_candidate
from reward_contract import constraints,check_reward_contract
from math_targets import MAX_WIN_AMOUNT
from weight_lookups import correct_moment

def fit_gate_weights(records,total,target_mean_x,*,atom_cap=None,starting_weights=None,threshold=None,tail_cap=None,preserve_from=None):
    n=len(records);values=[r['payoutMultiplier'] for r in records]
    fixed={i for i,r in enumerate(records) if values[i]==MAX_WIN_AMOUNT or r['has1000Reward'] or not regular_candidate(r)}
    floors=np.full(n,1/total)
    bounds=[(1/total,1/total if i in fixed else None) for i in range(n)]+[(0,None)]
    ub=[];rhs=[];names=[]
    def add(name,coef,limit):
        coef=np.array(coef,dtype=float);scale=max(1.,float(np.abs(coef).max()))
        ub.append(csr_matrix(coef.reshape(1,-1)/scale));rhs.append(limit/scale);names.append(name)
    for name,coef,limit in constraints(records):add(name,coef,limit)
    # FEATURE has a single mixed candidate pool. Without a conditional floor,
    # a floating solver can put every book of a tier below feasibility tolerance,
    # then integerization leaves an unbalanced handful of mandatory anchors.
    # This is an explicit proposal/publication guard, not a claimed old frequency.
    if any(r.get('rewardMetrics') for r in records) and not records[0].get('triggerTier'):
        for tier in ('normal','super','hidden'):
            row=[-int(r.get('rewardMetrics',{}).get('tier')==tier) for r in records]
            if any(row):add('feature conditional support '+tier,row,-1e-5)
    atoms=defaultdict(list)
    for i,v in enumerate(values):atoms[v].append(i)
    if atom_cap is not None:
        for value,ids in atoms.items():
            if value>0 or atom_cap==Fraction(1,100):
                row=np.zeros(n);row[ids]=1;add('atom',row,float(atom_cap)*.98)
    if threshold is not None:
        add('tail',[int(v>=threshold) for v in values],float(tail_cap)*.999)
        # Previous higher-threshold budgets remain no larger; do not freeze bad-fit individuals.
        add('preserved upper tail',[int(v>=preserve_from) for v in values],sum(w for v,w in zip(values,starting_weights) if v>=preserve_from)/total)
    eq=[np.ones(n),np.array(values,dtype=float)/MAX_WIN_AMOUNT]
    eqrhs=[1,float(target_mean_x)*100/MAX_WIN_AMOUNT]
    A=hstack([vstack(ub,format='csr'),csr_matrix((len(ub),1))],format='csr') if ub else csr_matrix((0,n+1))
    # One shared ceiling variable spreads fitted mass rather than selecting a few jackpots.
    ceiling=hstack([eye(n,format='csr'),csr_matrix(-np.ones((n,1)))],format='csr')
    A=vstack([A,ceiling],format='csr');rhs+= [0]*n
    E=hstack([csr_matrix(np.array(eq)),csr_matrix((2,1))],format='csr')
    objective=np.zeros(n+1);objective[-1]=1
    solution=linprog(objective,A_ub=A,b_ub=np.array(rhs),A_eq=E,b_eq=eqrhs,bounds=bounds,method='highs',options={'dual_feasibility_tolerance':1e-9,'primal_feasibility_tolerance':1e-9})
    if not solution.success:raise RuntimeError('V8 constrained weighting infeasible: '+solution.message)
    floats=solution.x[:n]*total
    weights=[max(1,math.floor(float(x))) for x in floats]
    for i in fixed:weights[i]=1
    rest=total-sum(weights)
    candidates=sorted((i for i in range(n) if i not in fixed),key=lambda i:floats[i]-weights[i],reverse=True)
    if rest<0:
        for i in reversed(candidates):
            take=min(weights[i]-1,-rest);weights[i]-=take;rest+=take
            if not rest:break
    else:
        q,rem=divmod(rest,len(candidates))
        for j,i in enumerate(candidates):weights[i]+=q+(j<rem)
        rest=0
    if rest:raise RuntimeError('V8 integer allocation failed')
    target=round(target_mean_x*100*total)
    bands=[0 if threshold is None or v<threshold else 1 if v<preserve_from else 2 for v in values]
    residual=correct_moment(values,weights,fixed,target,bands)
    if residual or min(weights)<1 or sum(weights)!=total:raise RuntimeError(f'V8 exact integer repair failed: {residual}')
    counts=defaultdict(int)
    for v,w in zip(values,weights):counts[v]+=w
    if atom_cap is not None and any(Fraction(w,total)>atom_cap for v,w in counts.items() if v>0 or atom_cap==Fraction(1,100)):
        raise RuntimeError('V8 integer repair exceeded atom cap')
    if threshold is not None and Fraction(sum(w for v,w in zip(values,weights) if v>=threshold),total)>tail_cap:
        raise RuntimeError('V8 integer repair exceeded tail cap')
    report=check_reward_contract(list(zip(records,weights)))
    return weights,{'targetMeanX':float(target_mean_x),'actualMeanX':sum(v*w for v,w in zip(values,weights))/(100*total),'momentResidual':residual,
                    'minimumWeightOnlyBooks':len(fixed),'atomCap':float(atom_cap) if atom_cap else None,'maxBookProbability':max(weights)/total,'v8':report}
