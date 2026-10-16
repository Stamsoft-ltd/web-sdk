"""Streaming book packaging, replay adaptation and weighted reporting helpers."""

from __future__ import annotations

from copy import deepcopy
from fractions import Fraction
import hashlib
import json
import math
from pathlib import Path

from experience import experience, check_experience, POSITIVE_PAYOUT_LIMIT

from math_targets import (
    GAME_ID, MODEL_VERSION, TARGET_RTP, MODE_COSTS, MYSTERY_MIX, MAX_WIN_X,
    MAX_WIN_AMOUNT, SCATTER_PAYS, PAYTABLE, COLS, ROWS, LOOKUP_SCALE, RTP_TOLERANCE,
    STARTING_FREE_SPINS, MAX_STICKY_WILDS, GATE_VALUES, TRIGGER_KEYS,
    TAIL_LIMITS, MYSTERY_CVAR_001_LIMIT_X,
)

SDK_BOOK_KEYS = ("id", "payoutMultiplier", "events", "criteria", "baseGameWins", "freeGameWins")


def weighted_cvar_001_x(rows: list[tuple[dict, int]]) -> Fraction:
    """Mean base-bet x of the worst weighted 0.1% of outcomes."""
    total = sum(weight for _, weight in rows)
    if total <= 0 or total % 1000:
        raise ValueError("CVaR requires positive total weight divisible by 1,000")
    remaining = total // 1000
    payout_sum = 0
    for book, weight in sorted(rows, key=lambda item: item[0]["payoutMultiplier"], reverse=True):
        taken = min(remaining, weight)
        payout_sum += book["payoutMultiplier"] * taken
        remaining -= taken
        if not remaining:
            return Fraction(payout_sum, (total // 1000) * 100)
    raise RuntimeError("CVaR tail exceeds available outcome weight")


def dump_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_events(events: list[dict]) -> list[dict]:
    result = []
    for original in events:
        if original["type"] == "mysterySelect":
            continue
        event = deepcopy(original)
        event["index"] = len(result)
        if event["type"] == "freeSpinTrigger":
            event["source"] = "natural"
        result.append(event)
    return result


def event_digest(events: list[dict]) -> str:
    encoded = json.dumps(canonical_events(events), sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def summarize_book(book: dict) -> dict:
    rewards = [e["reward"] for e in book["events"] if e["type"] == "gateReward"]
    return {
        "poolId": book["poolId"], "payoutMultiplier": book["payoutMultiplier"],
        "baseGameWins": book["baseGameWins"], "freeGameWins": book["freeGameWins"],
        "triggerTier": book["triggerTier"], "eventCount": len(book["events"]),
        "has1000Reward": any(r["kind"] == "addMultiplier" and r["value"] == 1000 for r in rewards),
        "gates": sum(e["type"] == "gateOpen" for e in book["events"]),
        "cascades": sum(e["type"] == "cascadeWin" for e in book["events"]),
        "generation": book["generation"], "eventDigest": event_digest(book["events"]),
        "experience": experience(book["events"]),
    }


def for_mode(book: dict, mode: str, book_id: int, *, copy_book: bool = True) -> dict:
    output = deepcopy(book) if copy_book else book
    output["id"] = book_id
    events = []
    for event in output["events"]:
        if event["type"] == "freeSpinTrigger":
            if mode == "MYSTERY":
                events.append({"type": "mysterySelect", "tier": event["tier"],
                               "scatterCount": event["scatterCount"], "positions": deepcopy(event["positions"])})
            event["source"] = "mystery" if mode == "MYSTERY" else "buy" if mode in ("BONUS", "SUPER") else "natural"
        events.append(event)
    for index, event in enumerate(events):
        event["index"] = index
    output["events"] = events
    return output


def sdk_book_json(book: dict) -> str:
    """Exact SDK Book field set/order; internal generation metadata never ships."""
    if any(key not in book for key in SDK_BOOK_KEYS):
        raise ValueError("Book missing standard SDK fields")
    output = {key: book[key] for key in SDK_BOOK_KEYS}
    if type(output["id"]) is not int or type(output["payoutMultiplier"]) is not int:
        raise ValueError("SDK Book id/payout must be integers")
    return json.dumps(output, allow_nan=False) + "\n"


def mode_report(mode: str, rows: list[tuple[dict, int]]) -> dict:
    total = sum(weight for _, weight in rows)
    payout_sum = sum(r["payoutMultiplier"] * w for r, w in rows)
    mean_x = Fraction(payout_sum, total * 100)
    rtp = mean_x / MODE_COSTS[mode]
    if total != LOOKUP_SCALE or abs(float(rtp - TARGET_RTP)) > RTP_TOLERANCE:
        raise RuntimeError(f"{mode}: weighting failed, total={total}, actual RTP={float(rtp):.12f}")
    tail_probabilities = {threshold: Fraction(sum(w for r, w in rows
        if r["payoutMultiplier"] >= threshold), total) for threshold in TAIL_LIMITS}
    for threshold, probability in tail_probabilities.items():
        if probability > TAIL_LIMITS[threshold]:
            raise RuntimeError(f"{mode}: P(payout >= {threshold / 100:g}x)={float(probability):.8%} exceeds {float(TAIL_LIMITS[threshold]):.4%}")
    cvar_001_x = weighted_cvar_001_x(rows)
    if mode == "MYSTERY" and cvar_001_x > MYSTERY_CVAR_001_LIMIT_X:
        raise RuntimeError(f"{mode}: CVaR(0.1%)={float(cvar_001_x):.4f}x exceeds "
                           f"{float(MYSTERY_CVAR_001_LIMIT_X):.4f}x")
    second = sum((r["payoutMultiplier"] / 100) ** 2 * w for r, w in rows) / total
    tier_weight = {t: sum(w for r, w in rows if r["triggerTier"] == t) for t in TRIGGER_KEYS}
    trigger_total = sum(tier_weight.values())
    maximum_probability = max(w for _, w in rows) / total
    ess = total * total / sum(w * w for _, w in rows)
    warnings = []
    if maximum_probability > 0.01:
        warnings.append("A single book exceeds 1% probability; increase outcome diversity and review weighting.")
    if ess < 1000:
        warnings.append("Effective outcome count below 1,000; prototype is not release-ready.")
    experience_report = check_experience(rows, mode)
    tier_experience = {tier: check_experience([(r,w) for r,w in rows if r['triggerTier']==tier],
        f'{mode}/{tier}', payout_cap=(Fraction(1,100) if tier=='hidden' else POSITIVE_PAYOUT_LIMIT) if mode != 'FEATURE' else None)
        for tier in TRIGGER_KEYS if any(r['triggerTier']==tier for r,w in rows)}
    return {
        "experience": experience_report, "tierExperience": tier_experience,
        "books": len(rows), "cost": MODE_COSTS[mode], "totalWeight": total,
        "meanBaseBetX": float(mean_x), "weightedRtp": float(rtp),
        "rtpDelta": float(rtp - TARGET_RTP),
        "tailRiskChecks": {str(threshold // 100): {"probability": float(probability),
            "limit": float(TAIL_LIMITS[threshold]), "passed": True}
            for threshold, probability in tail_probabilities.items()},
        "baseGameMeanX": sum(r["baseGameWins"] * w for r, w in rows) / total,
        "freeGameMeanX": sum(r["freeGameWins"] * w for r, w in rows) / total,
        "stdDevBaseBetX": math.sqrt(max(0, second - float(mean_x) ** 2)),
        "hitRate": sum(w for r, w in rows if r["payoutMultiplier"] > 0) / total,
        "bonusTriggerRate": trigger_total / total,
        "bonusTierMix": {t: w / trigger_total if trigger_total else 0 for t, w in tier_weight.items()},
        "maxWinRate": sum(w for r, w in rows if r["payoutMultiplier"] == MAX_WIN_AMOUNT) / total,
        "payoutAtLeast5000xBaseBet": sum(w for r, w in rows if r["payoutMultiplier"] >= 500_000) / total,
        "payoutAtLeast10000xBaseBet": sum(w for r, w in rows if r["payoutMultiplier"] >= 1_000_000) / total,
        "cvar001x": float(cvar_001_x),
        "roundWith1000xGateRate": sum(w for r, w in rows if r["has1000Reward"]) / total,
        "averageGates": sum(r["gates"] * w for r, w in rows) / total,
        "averageWinningCascades": sum(r["cascades"] * w for r, w in rows) / total,
        "nonTenthPayoutRate": sum(w for r, w in rows if r["payoutMultiplier"] % 10) / total,
        "maxSingleBookProbability": maximum_probability, "effectiveBookCount": ess,
        "warnings": warnings,
    }


def write_configs(library: Path, reports: dict, run_info: dict) -> None:
    modes = []
    shelves = []
    forces = library / "forces"
    forces.mkdir(parents=True, exist_ok=True)
    standard_force = forces / "force.json"
    dump_json(standard_force, {mode: {} for mode in MODE_COSTS})
    for mode, cost in MODE_COSTS.items():
        books = f"books_{mode}.jsonl.zst"
        weights = f"lookUpTable_{mode}_0.csv"
        force = forces / f"force_record_{mode}.json"
        dump_json(force, [])
        modes.append({"name": mode, "cost": cost, "events": books, "weights": weights})
        shelves.append({
            "name": mode, "cost": cost, "rtp": float(TARGET_RTP),
            "feature": mode in ("BASE", "CHANCE"), "buyBonus": mode not in ("BASE", "CHANCE"),
            "autoEndRoundDisabled": False, "maxWin": MAX_WIN_X,
            "bookLength": reports[mode]["books"], "std": reports[mode]["stdDevBaseBetX"] / cost,
            "booksFile": {"file": books, "sha256": sha256_file(library / "publish_files" / books)},
            "tables": [{"file": weights, "sha256": sha256_file(library / "publish_files" / weights)}],
            "forceFile": {"file": force.name, "sha256": sha256_file(force)},
        })
    frontend = {
        "providerName": "sample_provider", "gameName": "the_gates", "gameID": GAME_ID,
        "rtp": float(TARGET_RTP), "numReels": COLS, "numRows": [ROWS] * COLS,
        "betModes": {mode: {"cost": cost, "rtp": float(TARGET_RTP), "max_win": MAX_WIN_X,
                            "feature": mode in ("BASE", "CHANCE"), "buyBonus": mode not in ("BASE", "CHANCE")}
                     for mode, cost in MODE_COSTS.items()},
        "symbols": [{name: {"paytable": {str(n): values[0 if n < 10 else 1 if n < 12 else 2] / 100 for n in range(8, 31)}}}
                    for name, values in PAYTABLE.items()] + [{"KEY": {"special_properties": ["scatter"], "paytable": {str(n): SCATTER_PAYS[min(n, 5)] / 100 for n in range(3, COLS * ROWS + 1)}}}, {"WILD": {"special_properties": ["wild"]}}],
        "paddingReels": {}, "bookScale": 100, "walletScale": 1_000_000,
        "theGates": {"startingFreeSpins": STARTING_FREE_SPINS, "triggerKeys": TRIGGER_KEYS,
                     "mysteryMix": {k: float(v) for k, v in MYSTERY_MIX.items()},
                     "gateEveryCascades": 3, "gateValues": GATE_VALUES, "maxStickyWilds": MAX_STICKY_WILDS,
                     "keyPayouts": {str(n): amount / 100 for n, amount in SCATTER_PAYS.items()},
                     "keyPayoutScope": "entry-spin-once-not-gate-multiplied", "modelVersion": MODEL_VERSION},
    }
    fe_name = f"config_fe_{GAME_ID}.json"
    dump_json(library / "configs" / fe_name, frontend)
    dump_json(library / "configs" / "config.json", {
        "workingName": "The Gates", "gameID": GAME_ID, "providerNumber": 0,
        "rtp": float(TARGET_RTP * 100), "minDenomination": 10, "betDenomination": 1000,
        "standardForceFile": {"file": standard_force.name, "sha256": sha256_file(standard_force)},
        "frontendConfig": {"file": fe_name, "sha256": sha256_file(library / "configs" / fe_name)},
        "bookShelfConfig": shelves,
    })
    dump_json(library / "configs" / "generation.json", run_info)
    dump_json(library / "configs" / "simulation_report.json", {
        "status": "generated_not_validated", "targetRtp": float(TARGET_RTP),
        "method": "Exact weighted finite-book enumeration; not an independent Monte Carlo validation.",
        "rgsCompatibility": "Quarter-unit pays preserved. Upstream SDK rejects non-0.10x final payouts; live RGS acceptance unconfirmed.",
        "modes": reports,
    })
    # Write manifest last. A failed build never acquires a publishable index.
    dump_json(library / "publish_files" / "index.json", {"modes": modes})
