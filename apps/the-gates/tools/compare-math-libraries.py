"""Read-only exact lookup comparison. A hit is any positive round return, not net profit."""
import argparse,csv,json,math
from fractions import Fraction
from pathlib import Path

p=argparse.ArgumentParser(description=__doc__)
p.add_argument('before');p.add_argument('after');p.add_argument('--output',required=True)
a=p.parse_args()

def metrics(root):
    modes=json.loads((root/'publish_files/index.json').read_text())['modes']
    result={}
    for mode in modes:
        with (root/'publish_files'/mode['weights']).open() as f:
            rows=[tuple(map(int,row)) for row in csv.reader(f)]
        total=sum(w for _,w,_ in rows)
        assert total>0 and all(w>0 for _,w,_ in rows)
        cost=Fraction(str(mode['cost']))
        mean=Fraction(sum(w*pay for _,w,pay in rows),total*100)
        second=Fraction(sum(w*pay*pay for _,w,pay in rows),total*10000)
        variance=second-mean*mean
        probability=lambda predicate: float(Fraction(sum(w for _,w,pay in rows if predicate(pay)),total))
        result[mode['name']]={
            'books':len(rows),'cost':float(cost),'rtp':float(mean/cost),
            'deadSpinRate':probability(lambda pay:pay==0),
            'positiveReturnRate':probability(lambda pay:pay>0),
            'netProfitRate':probability(lambda pay:pay>cost*100),
            'stakeRefundRate':probability(lambda pay:pay==cost*100),
            'lossWithReturnRate':probability(lambda pay:0<pay<cost*100),
            'meanBaseBetX':float(mean),'varianceBaseBetX':float(variance),
            'stdDevBaseBetX':math.sqrt(float(variance)),
            'stdDevPaidStake':math.sqrt(float(variance))/float(cost),
            'payoutAtLeast5000xBaseBet':probability(lambda pay:pay>=500000),
            'payoutAtLeast10000xBaseBet':probability(lambda pay:pay>=1000000),
        }
    return result
before,after=metrics(Path(a.before)),metrics(Path(a.after))
report={'method':'Exact positive integer lookup enumeration; standard deviation normalized both to base bet and paid mode cost. Positive returns below the paid stake are losses, not profit.',
        'before':before,'after':after}
Path(a.output).write_text(json.dumps(report,indent=2)+'\n')
for mode in ['BASE','CHANCE']:
    b,n=before[mode],after[mode]
    print(f"{mode}: dead {b['deadSpinRate']:.2%} -> {n['deadSpinRate']:.2%}; RTP {n['rtp']:.10%}; SD/paid stake {b['stdDevPaidStake']:.6f} -> {n['stdDevPaidStake']:.6f}")
