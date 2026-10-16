"""Seeded finite-library payout sampling, not fresh candidate simulation or release approval."""
import argparse
import csv
import json
from pathlib import Path
import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('library')
parser.add_argument('--output', required=True)
parser.add_argument('--draws', type=int, default=1_000_000)
parser.add_argument('--seed', type=int, default=20261015)
args = parser.parse_args()
if args.draws < 2:
    parser.error('--draws must be at least 2')
root = Path(args.library)
rng = np.random.default_rng(args.seed)
result = {}
for mode, cost in [('BASE',1),('CHANCE',2),('FEATURE',20),('BONUS',100),('SUPER',300),('MYSTERY',400)]:
    with (root/'publish_files'/f'lookUpTable_{mode}_0.csv').open() as source:
        rows = np.array([tuple(map(int,row)) for row in csv.reader(source)], dtype=np.int64)
    probabilities = rows[:,1].astype(float)
    probabilities /= probabilities.sum()
    payouts = rows[:,2].astype(float)/100/cost
    count = 0
    total = squares = 0.0
    # Bounded memory even for 20M+ draws.
    while count < args.draws:
        batch = min(1_000_000, args.draws-count)
        values = payouts[rng.choice(len(rows),size=batch,p=probabilities)]
        total += float(values.sum())
        squares += float(np.dot(values,values))
        count += batch
    mean = total/count
    variance = max(0.0, (squares-total*total/count)/(count-1))
    se = float(np.sqrt(variance/count))
    result[mode] = {'sampledRounds':count, 'exactLookupRtp':float(np.dot(probabilities,payouts)),
                    'sampledRtp':mean, 'standardError':se,
                    'normalApprox95PctCI':[mean-1.96*se,mean+1.96*se]}
report = {'method':f'{args.draws:,} weighted finite-library draws per mode, NumPy PCG64 seed {args.seed}; bounded 1M batches. Approximate normal CI; not fresh candidate simulation, live RGS verification or release sign-off.',
          'modes':result}
Path(args.output).write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(result,indent=2))
