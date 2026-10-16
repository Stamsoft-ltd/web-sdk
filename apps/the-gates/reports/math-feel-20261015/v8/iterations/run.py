"""Generate exact per-mode distinct books, compressed pools and an RGS package.

Does not upload, run validation or edit the upstream RGS verifier.
"""

from __future__ import annotations

import argparse
from collections import Counter
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from fractions import Fraction
from itertools import islice
import json
import hashlib
import os
import math
from pathlib import Path
import shutil
import sys

import zstandard as zstd

from book_storage import jsonl_writer, sdk_jsonl_writer, jsonl_reader, pool_path
from artifacts import dump_json, for_mode, sdk_book_json, mode_report, sha256_file, summarize_book, write_configs
from gates_math import generate_candidate, seed_for
from math_targets import (
    GAME_ID, MODEL_VERSION, LOOKUP_SCALE, TIER_POOL_SCALE, TIERS, MODE_COSTS,
    MODE_GROUP_WEIGHTS, MODE_TARGET_MEANS, TIER_TARGET_MEANS, check_targets,
    MYSTERY_MIX, MYSTERY_TAIL_5000_TARGET, MYSTERY_TAIL_10000_TARGET, MYSTERY_TAIL_20000_TARGET,
    HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY, MAX_WIN_AMOUNT,
)
from weight_lookups import fit_weights, fit_tail_capped_weights, uniform_weights, check_payout_diversity

from experience_weights import fit_experience_weights
from gate_weights import fit_gate_weights

def fit_weights(records, total, target):
    tier = records[0].get('triggerTier') if records else None
    cap = Fraction(1,100) if tier == 'hidden' else Fraction(3,100) if tier else None
    return (fit_gate_weights if any(r.get("rewardMetrics") for r in records) else fit_experience_weights)(records,total,target,atom_cap=cap)

def fit_tail_capped_weights(records,total,target,cap,*,threshold=500_000,preserve_from=1_000_000,starting_weights=None):
    return fit_gate_weights(records,total,target,atom_cap=Fraction(1,100),
        starting_weights=starting_weights,threshold=threshold,tail_cap=cap,preserve_from=preserve_from)

HERE = Path(__file__).resolve().parent
POOLS = ("zero", "base", "feature", *TIERS)


def parse_mode_books(values: list[str]) -> dict[str, int]:
    """Parse an exact per-mode count map without silently defaulting a mode."""
    result = {}
    for value in values:
        try:
            mode, count = value.split("=", 1)
            count = int(count)
        except ValueError as error:
            raise ValueError(f"Invalid --mode-books item {value!r}; use MODE=COUNT") from error
        if mode not in MODE_COSTS or mode in result:
            raise ValueError(f"Unknown or duplicate mode in --mode-books: {mode!r}")
        if not 500 <= count < TIER_POOL_SCALE:
            raise ValueError(f"{mode} count must be 500..99,999,999")
        result[mode] = count
    if set(result) != set(MODE_COSTS):
        missing = sorted(set(MODE_COSTS) - set(result))
        raise ValueError(f"--mode-books must specify every mode; missing {missing}")
    return result


def task(args):
    return generate_candidate(*args)


def generate_pool(stage: Path, pool: str, count: int, seed: int, executor, chunk: int) -> list[dict]:
    records, failures = [], Counter()
    seen = set()
    tasks = iter((pool, index, seed) for index in range(count))
    path = stage / "pools" / f"{pool}.jsonl.zst"
    path.parent.mkdir(parents=True, exist_ok=True)
    with jsonl_writer(path) as file:
        while batch := list(islice(tasks, chunk)):
            results = executor.map(task, batch, chunksize=8) if executor else map(task, batch)
            for book in results:
                file.write(json.dumps(book, separators=(",", ":")) + "\n")
                record = summarize_book(book)
                if record["eventDigest"] in seen:
                    raise RuntimeError(f"Duplicate round in {pool}/{book['poolId']}; choose another seed")
                seen.add(record["eventDigest"])
                records.append(record)
                failures.update(book["generation"]["rejections"])
            print(f"{pool}: {len(records):,}/{count:,} candidates", flush=True)
    print(f"{pool}: rejected candidate attempts {dict(failures)}", flush=True)
    dump_json(stage / "pools" / f"{pool}.metadata.json", records)
    return records


def build_weights(pools: dict) -> tuple[dict, dict]:
    tier_weights, fits = {}, {}
    for tier in TIERS:
        tier_weights[tier], fits[tier] = fit_weights(pools[tier], TIER_POOL_SCALE, TIER_TARGET_MEANS[tier])
    # Fit the upper tail first; the 5,000x pass preserves every >=10,000x weight.
    # Otherwise new candidate diversity can move the previously uncapped upper tail.
    upper_report = None
    for threshold, mixed_cap, preserve_from in (
        (2_000_000, MYSTERY_TAIL_20000_TARGET, MAX_WIN_AMOUNT),
        (1_000_000, MYSTERY_TAIL_10000_TARGET, 2_000_000),
        (500_000, MYSTERY_TAIL_5000_TARGET, 1_000_000),
    ):
        other_tail = sum(MYSTERY_MIX[tier] * Fraction(
            sum(w for r, w in zip(pools[tier], tier_weights[tier]) if r["payoutMultiplier"] >= threshold),
            TIER_POOL_SCALE) for tier in ("normal", "super"))
        hidden_cap = (mixed_cap - other_tail) / MYSTERY_MIX["hidden"]
        if not 0 < hidden_cap < 1:
            raise RuntimeError(f"Normal/Super exhaust the Mystery {threshold / 100:g}x tail budget")
        tier_weights["hidden"], fits["hidden"] = fit_tail_capped_weights(
            pools["hidden"], TIER_POOL_SCALE, TIER_TARGET_MEANS["hidden"], hidden_cap,
            threshold=threshold, preserve_from=preserve_from,
            starting_weights=tier_weights["hidden"])
        if threshold == 1_000_000:
            upper_report = fits["hidden"]
    fits["hidden"]["upperTailFit"] = upper_report
    fits["hidden"]["payoutDiversity"] = check_payout_diversity(
        pools["hidden"], tier_weights["hidden"], HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY)
    weights = {}
    for mode, groups in MODE_GROUP_WEIGHTS.items():
        weights[mode] = {}
        for tier in TIERS:
            if tier in groups:
                factor, remainder = divmod(groups[tier], TIER_POOL_SCALE)
                if remainder:
                    raise RuntimeError("Non-integer shared tier scaling")
                weights[mode][tier] = [w * factor for w in tier_weights[tier]]
        if "zero" in groups:
            weights[mode]["zero"] = uniform_weights(len(pools["zero"]), groups["zero"])
        if "base" in groups:
            # Use actual tier moments after integerization, not claimed means.
            bonus_moment = sum(r["payoutMultiplier"] * w for t in TIERS for r, w in zip(pools[t], weights[mode][t]))
            desired = MODE_TARGET_MEANS[mode] * LOOKUP_SCALE * 100 - bonus_moment
            mean = Fraction(desired, groups["base"] * 100)
            weights[mode]["base"], fits[f"{mode}/base"] = fit_weights(pools["base"], groups["base"], mean)
        if "feature" in groups:
            weights[mode]["feature"], fits["feature"] = fit_weights(pools["feature"], groups["feature"], MODE_TARGET_MEANS[mode])
    return weights, fits


def publish_mode(stage: Path, mode: str, pools: dict, weights: dict, pool_root: Path | None = None) -> dict:
    rows, book_id = [], 0
    for group in MODE_GROUP_WEIGHTS[mode]:
        if len(pools[group]) != len(weights[mode][group]):
            raise RuntimeError(f"{mode}/{group}: metadata/weight count mismatch")
        rows.extend(zip(pools[group], weights[mode][group]))
    # Reject RTP/tail failure before spending disk/CPU on the final compressed book.
    report = mode_report(mode, rows)
    pool_root = pool_root or stage
    seen = set()
    digest = hashlib.sha256()
    csv = stage / "publish_files" / f"lookUpTable_{mode}_0.csv"
    compressed = stage / "publish_files" / f"books_{mode}.jsonl.zst"
    # Publish via the standard SDK Book schema. Candidate pools retain private
    # audit fields, but uploaded books contain only Book.to_json fields.
    with sdk_jsonl_writer(compressed) as output, csv.open("w", encoding="utf-8") as lookup:
        for group in MODE_GROUP_WEIGHTS[mode]:
            group_weights = weights[mode][group]
            with jsonl_reader(pool_path(pool_root, group)) as source:
                for i, line in enumerate(source):
                    book = for_mode(json.loads(line), mode, book_id, copy_book=False)
                    record = pools[group][i]
                    if (book["poolId"] != record["poolId"] or
                            book["payoutMultiplier"] != record["payoutMultiplier"]):
                        raise RuntimeError(f"{mode}/{group}: pool/metadata mismatch")
                    if record["eventDigest"] in seen:
                        raise RuntimeError(f"{mode}: duplicate event path; no padding allowed")
                    seen.add(record["eventDigest"])
                    weight = group_weights[i]
                    line = sdk_book_json(book)
                    digest.update(line.encode())
                    output.write(line)
                    lookup.write(f"{book_id},{weight},{book['payoutMultiplier']}\n")
                    book_id += 1
    shutil.copyfile(csv, stage / "lookup_tables" / f"lookUpTable_{mode}.csv")
    if book_id != len(rows):
        raise RuntimeError(f"{mode}: source pool coverage mismatch")
    report["uncompressedSha256"] = digest.hexdigest()
    print(f"{mode}: {book_id:,} books; weighted RTP {report['weightedRtp']:.10%}; non-tenth payout mass {report['nonTenthPayoutRate']:.6%}", flush=True)
    return report



def mode_pool_counts(mode: str, count: int) -> dict[str, int]:
    """Equal candidate coverage, NOT outcome probability. Lookup weights set odds.

    Natural modes: five pools; Mystery: three; direct buys/Feature: one.
    Remainder assigned in canonical group order. Every final mode has count rows.
    """
    groups = list(MODE_GROUP_WEIGHTS[mode])
    whole, rest = divmod(count, len(groups))
    if whole < 100:
        raise ValueError("Need at least 100 candidates per group (500 books per mode minimum)")
    return {group: whole + (i < rest) for i, group in enumerate(groups)}


def independent_tier_scale(mode: str, pools: dict) -> int:
    """Keep >=1e8 fitting units per 100k tier candidates, with exact scaling.

    The old fixed 1e8 denominator let mandatory one-unit rare anchors acquire
    excessive aggregate probability as candidate count increased. Select the
    smallest sufficient multiple that divides every actual tier group mass.
    Legacy shared pools keep their existing weighting scheme.
    """
    masses = [mass for tier, mass in MODE_GROUP_WEIGHTS[mode].items() if tier in TIERS]
    if not masses:
        return TIER_POOL_SCALE
    common = math.gcd(*masses)
    capacity, remainder = divmod(common, TIER_POOL_SCALE)
    if remainder:
        raise RuntimeError('Tier groups cannot scale exactly')
    # A 100k Mystery package has ~33k books/tier.  1e8 units made every
    # mandatory 25,000x anchor carry too much probability after scaling,
    # forcing CVaR above Studio's 20,000x limit.  Use 10x finer integer
    # precision only for Mystery; this preserves every positive book and its
    # payout, while allowing the lookup fit to give rare anchors truly rare
    # mass.  Natural modes do not share Mystery's absolute-CVaR requirement.
    minimum_multiplier = 10 if mode == "MYSTERY" else 1
    needed = max(minimum_multiplier,
                 (max(len(pools[t]) for t in TIERS if t in pools) + 99999)//100000)
    divisors = {d for i in range(1, math.isqrt(capacity)+1) if capacity%i==0
                for d in (i, capacity//i) if d>=needed}
    if not divisors:
        raise RuntimeError('Candidate count exceeds available positive-weight precision')
    return TIER_POOL_SCALE * min(divisors)


def build_mode_weights(mode: str, pools: dict) -> tuple[dict, dict]:
    """Independent samples, same per-tier means, probabilities and mechanics.

    Fit only this mode's pools. Never pad, truncate or reuse fitted weights from
    another mode. Mystery enforces its mixed tail budgets. Other mode tails are
    checked by mode_report before a package is finalized.
    """
    groups = MODE_GROUP_WEIGHTS[mode]
    # Scale precision with candidate count, not the fixed shared-pool lattice.
    tier_scale = independent_tier_scale(mode, pools)
    tier_weights, fits, output = {}, {}, {}
    for tier in TIERS:
        if tier in groups:
            tier_weights[tier], fits[tier] = fit_weights(
                pools[tier], tier_scale, TIER_TARGET_MEANS[tier])
    if "hidden" in groups:
        upper_report = None
        # 20,000x is Studio's *Mystery* absolute-CVaR control.  BASE/CHANCE
        # use a different natural tier mix, so applying Mystery's 65/30/5
        # allowance to them is invalid and can make their Normal/Super pools
        # appear to exhaust a cap they do not share.
        tail_constraints = [
            (1_000_000, MYSTERY_TAIL_10000_TARGET, 2_000_000),
            (500_000, MYSTERY_TAIL_5000_TARGET, 1_000_000),
        ]
        if mode == "MYSTERY":
            tail_constraints.insert(0, (2_000_000, MYSTERY_TAIL_20000_TARGET, MAX_WIN_AMOUNT))
        for threshold, mixed_cap, preserve_from in tail_constraints:
            # Same conservative Hidden conditional caps in all modes. Normal/
            # Super contribution measured from THIS mode's actual fitted pools.
            other_tail = sum(MYSTERY_MIX[tier] * Fraction(
                sum(w for r,w in zip(pools[tier],tier_weights[tier])
                    if r["payoutMultiplier"] >= threshold), tier_scale)
                for tier in ("normal", "super"))
            cap = (mixed_cap - other_tail) / MYSTERY_MIX["hidden"]
            if not 0 < cap < 1:
                raise RuntimeError(f"{mode}: Normal/Super exhaust the Hidden tail budget")
            tier_weights["hidden"], fits["hidden"] = fit_tail_capped_weights(
                pools["hidden"], tier_scale, TIER_TARGET_MEANS["hidden"], cap,
                threshold=threshold, preserve_from=preserve_from,
                starting_weights=tier_weights["hidden"])
            if threshold == 1_000_000:
                upper_report = fits["hidden"]
        fits["hidden"]["upperTailFit"] = upper_report
        fits["hidden"]["payoutDiversity"] = check_payout_diversity(
            pools["hidden"], tier_weights["hidden"], HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY)
    for tier, fitted in tier_weights.items():
        factor, remainder = divmod(groups[tier], tier_scale)
        if remainder:
            raise RuntimeError("Noninteger tier weight scaling")
        output[tier] = [w*factor for w in fitted]
    if "zero" in groups:
        output["zero"] = uniform_weights(len(pools["zero"]), groups["zero"])
    if "base" in groups:
        moment = sum(r["payoutMultiplier"]*w for tier in tier_weights
                     for r,w in zip(pools[tier],output[tier]))
        mean = (MODE_TARGET_MEANS[mode]*LOOKUP_SCALE*100 - moment) / (groups["base"]*100)
        output["base"], fits["base"] = fit_weights(pools["base"], groups["base"], mean)
    if "feature" in groups:
        output["feature"], fits["feature"] = fit_weights(
            pools["feature"], groups["feature"], MODE_TARGET_MEANS[mode])
    fits["tierFittingScale"] = tier_scale
    return {mode: output}, fits


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    counts = parser.add_mutually_exclusive_group()
    counts.add_argument("--books-per-mode", type=int, help="EXACT distinct book count in EACH mode; independent mode pools")
    counts.add_argument("--samples", type=int, help="legacy candidate count per SHARED pool, not per mode")
    parser.add_argument("--mode-books", nargs="+", metavar="MODE=COUNT",
                        help="EXACT distinct counts per mode; specify all six modes")
    parser.add_argument("--plan", action="store_true", help="print exact counts/storage plan without generating or writing files")
    parser.add_argument("--keep-pools", action="store_true", help="retain compressed candidate pools/metadata; default removes per-mode scratch pools")
    parser.add_argument("--workers", type=int, default=int(os.getenv("GATES_THREADS", "1")))
    parser.add_argument("--batch", type=int, default=256, help="bounded candidate batch size")
    parser.add_argument("--seed", type=int, default=20260921)
    parser.add_argument("--output", type=Path, default=HERE / "library")
    parser.add_argument("--replace", action="store_true", help="archive existing output beside it before installing the new complete build")
    args = parser.parse_args()
    if args.mode_books and (args.books_per_mode is not None or args.samples is not None):
        parser.error("--mode-books cannot be combined with --books-per-mode or --samples")
    try:
        mode_books = parse_mode_books(args.mode_books) if args.mode_books else None
    except ValueError as error:
        parser.error(str(error))
    if args.books_per_mode is None and args.samples is None and mode_books is None:
        args.books_per_mode = int(os.getenv("GATES_BOOKS_PER_MODE", "50000"))
    if args.books_per_mode is not None and not 500 <= args.books_per_mode < TIER_POOL_SCALE:
        parser.error("books-per-mode must be 500..99,999,999; small pools may fail distribution guards")
    if (args.samples is not None and not 100 <= args.samples < TIER_POOL_SCALE) or args.workers < 1 or args.batch < 1:
        parser.error("samples must be 100..99,999,999; workers and batch must be positive")
    check_targets()
    if args.plan:
        plan = ({mode: mode_pool_counts(mode, mode_books[mode] if mode_books else args.books_per_mode) for mode in MODE_COSTS}
                if (args.books_per_mode is not None or mode_books is not None) else
                {mode: {group: args.samples for group in MODE_GROUP_WEIGHTS[mode]} for mode in MODE_COSTS})
        print(json.dumps({"modePoolCounts": plan,
                          "booksPerMode": {mode: sum(counts.values()) for mode,counts in plan.items()},
                          "totalPublishedBooks": sum(sum(counts.values()) for counts in plan.values()),
                          "storage": "compressed streaming; no uncompressed copies",
                          "keepPools": bool(args.keep_pools or args.samples)}, indent=2))
        return
    output = args.output.expanduser().resolve()
    if output.exists() and not args.replace:
        parser.error(f"{output} exists; use a new --output or --replace (old output is archived)")
    output.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S%fZ")
    stage = output.with_name(f".{output.name}-build-{stamp}")
    lock = output.with_name(f".{output.name}.generation.lock")
    try:
        lock.mkdir()
    except FileExistsError:
        parser.error(f"Generation lock exists: {lock}. Check for an active run before removing it.")
    try:
        stage.mkdir()
        for name in ("publish_files", "lookup_tables", "configs"):
            (stage / name).mkdir()
        run_info = {"gameId": GAME_ID, "modelVersion": MODEL_VERSION, "seed": args.seed,
                    "samplesPerPool": args.samples, "booksPerMode": args.books_per_mode,
                    "booksPerModeByMode": mode_books,
                    "samplingScheme": "independent-per-mode-v1" if (args.books_per_mode is not None or mode_books is not None) else "shared-pools-v1",
                    "poolStorageRetained": bool(args.keep_pools or args.samples),
                    "workers": args.workers,
                    "storageFormat": "sdk-book-zstd-v1",
                    "pythonVersion": sys.version, "zstandardVersion": zstd.__version__,
                    "pythonHashSeedIndependent": True, "status": "generated_not_validated",
                    "sourceHashes": {p.name: sha256_file(p) for p in sorted(HERE.glob("*.py"))}}
        if args.books_per_mode is not None or mode_books is not None:
            reports, fits = {}, {}
            run_info["poolCountsByMode"] = {}
            # Sequential modes bound candidate metadata and scratch disk usage.
            for mode in MODE_COSTS:
                mode_count = mode_books[mode] if mode_books else args.books_per_mode
                counts = mode_pool_counts(mode, mode_count)
                run_info["poolCountsByMode"][mode] = counts
                pool_root = stage / "mode_pools" / mode
                mode_seed = seed_for(args.seed, "mode", mode)
                def generate(executor):
                    return {p: generate_pool(pool_root, p, n, mode_seed, executor, args.batch)
                            for p,n in counts.items()}
                if args.workers == 1:
                    pools = generate(None)
                else:
                    with ProcessPoolExecutor(max_workers=args.workers) as executor:
                        pools = generate(executor)
                weights, fits[mode] = build_mode_weights(mode, pools)
                reports[mode] = publish_mode(stage, mode, pools, weights, pool_root)
                if reports[mode]["books"] != mode_count:
                    raise RuntimeError(f"{mode}: wrong published count")
                if not args.keep_pools:
                    shutil.rmtree(pool_root)  # Only this run's generated staging scratch.
                del pools, weights
            if not args.keep_pools:
                (stage / "mode_pools").rmdir()
        else:
            if args.workers == 1:
                pools = {p: generate_pool(stage, p, args.samples, args.seed, None, args.batch) for p in POOLS}
            else:
                with ProcessPoolExecutor(max_workers=args.workers) as executor:
                    pools = {p: generate_pool(stage, p, args.samples, args.seed, executor, args.batch) for p in POOLS}
            weights, fits = build_weights(pools)
            reports = {mode: publish_mode(stage, mode, pools, weights) for mode in MODE_COSTS}
        dump_json(stage / "configs" / "weighting_report.json", fits)
        write_configs(stage, reports, run_info)
        if output.exists():
            if not args.replace:
                raise RuntimeError(f"Output appeared during generation: {output}; refusing overwrite")
            backup = output.with_name(f"{output.name}-backup-{stamp}")
            output.rename(backup)
            print(f"Previous output archived: {backup}")
        stage.rename(output)
        print(f"Generated (NOT validated): {output}")
        print("Next: validate_gates_contract.py, then validate_gates_artifacts.py.")
        print("Known compatibility question: upstream RGS SDK rejects quarter-unit final payouts. Do not remove that check or silently round.")
    finally:
        lock.rmdir()


if __name__ == "__main__":
    main()
