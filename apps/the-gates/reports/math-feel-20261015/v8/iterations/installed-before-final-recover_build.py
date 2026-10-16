"""Recover an unfinished independent-mode build; never regenerate completed modes.

Old runners saved no initial manifest. Seed/count must be supplied explicitly;
compare deterministic sample paths, then require full artifact validation after
recovery. Original generation provenance cannot be reconstructed completely.
No upload and no changes to existing completed books/weights.
"""
from __future__ import annotations
import argparse
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from fractions import Fraction
import hashlib
from itertools import zip_longest
import json
from pathlib import Path
import sys
import zstandard

from experience import experience
from artifacts import dump_json, event_digest, mode_report, sha256_file, write_configs
from book_storage import jsonl_reader, pool_path
from gates_math import generate_candidate, seed_for
from math_targets import (GAME_ID, MODEL_VERSION, MODE_COSTS, MODE_GROUP_WEIGHTS,
    TIERS, TIER_TARGET_MEANS, HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY)
from run import mode_pool_counts, parse_mode_books, generate_pool, build_mode_weights, publish_mode

HERE = Path(__file__).resolve().parent


def ensure(condition, message):
    if not condition:
        raise ValueError(message)


def check_sample(book, mode, pool_id, seed):
    expected = generate_candidate(book['criteria'], pool_id, seed_for(seed, 'mode', mode))
    ensure(event_digest(book['events']) == event_digest(expected['events']),
           f'{mode}/{book["criteria"]}/{pool_id}: seed/source sample mismatch; do not recover with this seed/source')


def scan_completed(stage, mode, count, seed):
    """Rebuild lost reports, without changing published events or lookup weights.

    This is a structural/math scan, NOT full event replay validation.
    """
    expected = mode_pool_counts(mode, count)
    counts, masses, moments, hidden = Counter(), Counter(), Counter(), Counter()
    rows, digest = [], hashlib.sha256()
    book_path = stage/'publish_files'/f'books_{mode}.jsonl.zst'
    lookup = stage/'publish_files'/f'lookUpTable_{mode}_0.csv'
    ensure(sha256_file(lookup) == sha256_file(stage/'lookup_tables'/f'lookUpTable_{mode}.csv'),
           f'{mode}: published/local lookup mismatch')
    with jsonl_reader(book_path) as books, lookup.open() as weights:
        for index, (line, row) in enumerate(zip_longest(books, weights)):
            ensure(line is not None and row is not None, f'{mode}: book/lookup length mismatch')
            digest.update(line.encode())
            book = json.loads(line)
            identity, weight, payout = map(int, row.strip().split(','))
            ensure(identity == index == book['id'] and weight > 0 and payout == book['payoutMultiplier'],
                   f'{mode}: ID/weight/payout mismatch at {index}')
            group = book['criteria']
            # SDK-shaped published Books deliberately omit private poolId and
            # triggerTier.  publish_mode writes each group in ascending pool
            # order, so the per-group count is the original deterministic ID.
            pool_id = counts[group]
            ensure(group in expected and pool_id < expected[group], f'{mode}: pool allocation mismatch')
            if pool_id in {0, expected[group]//2, expected[group]-1}:
                check_sample(book, mode, pool_id, seed)
            counts[group] += 1
            masses[group] += weight
            moments[group] += weight*payout
            if group == 'hidden': hidden[payout] += weight
            events = book['events']
            trigger = next((event['tier'] for event in events if event['type']=='freeSpinTrigger'), None)
            record = {k:book[k] for k in ('payoutMultiplier','baseGameWins','freeGameWins')}
            record['triggerTier'] = trigger
            record['experience'] = experience(events)
            record.update(gates=sum(e['type']=='gateOpen' for e in events),
                          cascades=sum(e['type']=='cascadeWin' for e in events),
                          has1000Reward=any(e['type']=='gateReward' and e['reward']['kind']=='addMultiplier'
                                           and e['reward']['value']==1000 for e in events))
            rows.append((record,weight))
            if (index+1)%25000 == 0: print(f'{mode}: recovered report {index+1:,}/{count:,}',flush=True)
    ensure(dict(counts)==expected and len(rows)==count, f'{mode}: wrong exact book counts')
    ensure(dict(masses)==MODE_GROUP_WEIGHTS[mode], f'{mode}: group probabilities changed')
    for tier in TIERS:
        if tier in masses:
            ensure(abs(Fraction(moments[tier],masses[tier]*100)-TIER_TARGET_MEANS[tier])<=Fraction(1,100000000),
                   f'{mode}/{tier}: wrong tier mean')
    if hidden:
        ensure(Fraction(max(hidden.values()),sum(hidden.values()))<=HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY,
               f'{mode}: Hidden payout concentration')
    report=mode_report(mode,rows)
    report['uncompressedSha256']=digest.hexdigest()
    return report


def mode_hashes(stage, mode):
    names=(f'publish_files/books_{mode}.jsonl.zst', f'publish_files/lookUpTable_{mode}_0.csv',
           f'lookup_tables/lookUpTable_{mode}.csv')
    return {name:sha256_file(stage/name) for name in names}


def save_checkpoint(path, data):
    temporary=path.with_suffix('.tmp')
    dump_json(temporary,data)
    temporary.replace(path)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--stage',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    counts = parser.add_mutually_exclusive_group(required=True)
    counts.add_argument('--books-per-mode',type=int,help='same exact count in every mode')
    counts.add_argument('--mode-books',nargs='+',metavar='MODE=COUNT',help='exact count per mode; specify all six')
    parser.add_argument('--seed',type=int,required=True)
    parser.add_argument('--workers',type=int,default=4)
    parser.add_argument('--batch',type=int,default=128)
    parser.add_argument('--execute',action='store_true',help='without this flag: print recovery plan only')
    args=parser.parse_args()
    stage,output=args.stage.expanduser().resolve(),args.output.expanduser().resolve()
    ensure(stage.is_dir() and stage.parent==output.parent and stage.name.startswith(f'.{output.name}-build-'),
           'Expected the matching unfinished sibling staging directory')
    ensure(not output.exists(),'Final output already exists; refusing overwrite')
    ensure(args.workers>0 and args.batch>0,'Workers/batch must be positive')
    mode_books = parse_mode_books(args.mode_books) if args.mode_books else {mode:args.books_per_mode for mode in MODE_COSTS}
    ensure(all(count is not None and count >= 500 for count in mode_books.values()),'Book count must be >=500')
    counts={mode:mode_pool_counts(mode,mode_books[mode]) for mode in MODE_COSTS}
    completed=[]
    for mode in MODE_COSTS:
        book=stage/'publish_files'/f'books_{mode}.jsonl.zst'
        csv=stage/'publish_files'/f'lookUpTable_{mode}_0.csv'
        ensure(book.exists()==csv.exists(),f'{mode}: incomplete publish pair; inspect before recovery')
        if book.exists(): completed.append(mode)
    print(json.dumps({'completedModesToKeep':completed,'remainingModes':[m for m in MODE_COSTS if m not in completed],
                      'booksPerModeByMode':mode_books,'seedToVerify':args.seed,'output':str(output),
                      'retainedPools':True,'execute':args.execute},indent=2),flush=True)
    if not args.execute:return
    lock=output.with_name(f'.{output.name}.generation.lock')
    lock.mkdir()  # Same lock as run.py; never remove another active run's lock.
    try:
        checkpoint=stage/'configs/recovery_checkpoint.json'
        inputs={'booksPerModeByMode':mode_books,'seed':args.seed,'output':str(output)}
        hashes={p.name:sha256_file(p) for p in sorted(HERE.glob('*.py'))}
        if checkpoint.exists():
            saved=json.loads(checkpoint.read_text())
            ensure(saved['inputs']==inputs,'Recovery inputs changed since checkpoint')
            # A failed recovery can create an empty checkpoint before reaching
            # its first mode.  Let a corrected recovery script restart that
            # empty checkpoint; never mix source revisions after any mode was
            # checkpointed.
            if saved['sourceHashes'] != hashes:
                ensure(not saved['reports'], 'Recovery source changed after a completed checkpointed mode')
                saved={'inputs':inputs,'sourceHashes':hashes,'reports':{},'fits':{},'fileHashes':{}}
                save_checkpoint(checkpoint,saved)
        else:
            saved={'inputs':inputs,'sourceHashes':hashes,'reports':{},'fits':{},'fileHashes':{}}
            save_checkpoint(checkpoint,saved)
        for mode in MODE_COSTS:
            if mode in saved['reports']:
                ensure(mode_hashes(stage,mode)==saved['fileHashes'][mode],f'{mode}: checkpoint files changed')
                print(f'{mode}: reusing verified recovery checkpoint',flush=True)
                continue
            if mode in completed:
                saved['reports'][mode]=scan_completed(stage,mode,mode_books[mode],args.seed)
                saved['fits'][mode]={'reusedPublishedWeights':True,'originalFitDiagnosticsUnavailable':True}
            else:
                root=stage/'mode_pools'/mode
                pools={}
                with ProcessPoolExecutor(max_workers=args.workers) as executor:
                    for group,n in counts[mode].items():
                        metadata=root/'pools'/f'{group}.metadata.json'
                        compressed=root/'pools'/f'{group}.jsonl.zst'
                        if metadata.exists() or compressed.exists():
                            ensure(metadata.exists() and compressed.exists(),f'{mode}/{group}: partial candidate pool; inspect before retry')
                            records=json.loads(metadata.read_text())
                            ensure(len(records)==n and all(r['poolId']==i for i,r in enumerate(records)),f'{mode}/{group}: pool metadata count/IDs')
                            # Sparse deterministic provenance check. Full pool event replay remains mandatory.
                            for i in {0,n//2,n-1}:
                                candidate=generate_candidate(group,i,seed_for(args.seed,'mode',mode))
                                ensure(event_digest(candidate['events'])==records[i]['eventDigest'],f'{mode}/{group}: seed/source metadata mismatch')
                            pools[group]=records
                            print(f'{mode}/{group}: reusing {n:,} candidates',flush=True)
                        else:
                            pools[group]=generate_pool(root,group,n,seed_for(args.seed,'mode',mode),executor,args.batch)
                weights,saved['fits'][mode]=build_mode_weights(mode,pools)
                saved['reports'][mode]=publish_mode(stage,mode,pools,weights,root)
                ensure(saved['reports'][mode]['books']==mode_books[mode],f'{mode}: wrong published count')
                del pools,weights
            saved['fileHashes'][mode]=mode_hashes(stage,mode)
            save_checkpoint(checkpoint,saved)
        info={'gameId':GAME_ID,'modelVersion':MODEL_VERSION,'seed':args.seed,'samplesPerPool':None,
              'booksPerMode':None,'booksPerModeByMode':mode_books,'samplingScheme':'independent-per-mode-v1',
              'poolCountsByMode':counts,'poolStorageRetained':True,'storageFormat':'sdk-book-zstd-v1',
              'workers':args.workers,'pythonVersion':sys.version,'zstandardVersion':zstandard.__version__,
              'status':'recovered_not_validated','sourceHashes':hashes,
              'recovery':{'originalSourceManifestUnavailable':True,'seedCheckedBy':'first/middle/last path per group',
                          'keptPublishedModes':completed,'fullEventReplayValidationRequired':True,
                          'sourceHashesDescribe':'recovery source; not certified original generation source'}}
        dump_json(stage/'configs/weighting_report.json',saved['fits'])
        write_configs(stage,saved['reports'],info)
        ensure(not output.exists(),'Output appeared during recovery; refusing overwrite')
        stage.rename(output)
        print(f'Recovered (NOT validated): {output}',flush=True)
    finally:
        lock.rmdir()


if __name__=='__main__':main()
