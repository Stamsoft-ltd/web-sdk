"""Stream-check books, payouts, event replay, shared tiers and exact probabilities.

Allows integer hundredths intentionally. --strict-sdk-increments additionally
enforces the untouched upstream SDK's tentative 0.10x compatibility restriction.
"""

from __future__ import annotations

import argparse
from collections import Counter
from copy import deepcopy
from fractions import Fraction
import hashlib
from itertools import zip_longest
import json
from pathlib import Path

from artifacts import event_digest, sha256_file
from experience import experience, check_experience, POSITIVE_PAYOUT_LIMIT
from gates_math import evaluate_board, removed_cells, tier_for_keys, tumble, key_positions, win_level
from math_targets import (
    HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY, TIER_TARGET_MEANS,
    COLS, ROWS, PAYTABLE, PAY_SYMBOLS, KEY, WILD, TIERS, STARTING_FREE_SPINS,
    MAX_WIN_AMOUNT, SCATTER_PAYS, MODE_COSTS, MODE_GROUP_WEIGHTS, LOOKUP_SCALE,
    TARGET_RTP, RTP_TOLERANCE, MODEL_VERSION, GATE_VALUES, MULTIPLY_VALUES,
    EXTRA_SPIN_VALUES, RETRIGGER_VALUES, MAX_STICKY_WILDS,
    TAIL_LIMITS, MYSTERY_CVAR_001_LIMIT_X,
)


def require(condition, message: str) -> None:
    if not condition:
        raise ValueError(message)


def weighted_cvar_001_x(payouts: Counter, total_weight: int) -> Fraction:
    """Mean base-bet x of the highest weighted 0.1% payout tail."""
    require(total_weight > 0 and total_weight % 1000 == 0, "Invalid CVaR weight total")
    remaining = total_weight // 1000
    payout_sum = 0
    for payout in sorted(payouts, reverse=True):
        taken = min(remaining, payouts[payout])
        payout_sum += payout * taken
        remaining -= taken
        if not remaining:
            return Fraction(payout_sum, (total_weight // 1000) * 100)
    raise ValueError("CVaR tail exceeds payout distribution")


def cells(items: list[dict]) -> set[tuple[int, int]]:
    result = {(p["reel"], p["row"]) for p in items}
    require(len(result) == len(items), "Duplicate positions")
    require(all(type(c) is int and type(r) is int and 0 <= c < COLS and 0 <= r < ROWS for c, r in result), "Position outside board")
    return result


def check_board(board: list) -> None:
    require(len(board) == COLS and all(len(col) == ROWS for col in board), "Expected 6x5 board")
    require(all(cell == {"name": cell.get("name")} and cell["name"] in (*PAY_SYMBOLS, KEY, WILD) for col in board for cell in col), "Unknown symbol or unexpected cell properties")


def validate_book(book: dict, mode: str | None = None) -> None:
    events = book["events"]
    require(bool(events), "Empty book")
    require(type(book["id"]) is int and book["id"] >= 0, "Invalid book ID")
    require(type(book["payoutMultiplier"]) is int and 0 <= book["payoutMultiplier"] <= MAX_WIN_AMOUNT, "Invalid book payout")
    phase = "start"
    spin_id, raw, cascade, total = -1, 0, 0, 0
    scatter_count, scatter_amount = 0, 0
    multiplier, active = 1, False
    sticky, removed = set(), set()
    board, wins = None, []
    tier = None
    played, total_fs = 0, STARTING_FREE_SPINS
    base_win, bonus_win = 0, 0
    pending_rewards, gate, reward_order, entry_gates = 0, 0, 0, 0
    feature, mystery_tier, bonus_ended, max_event = False, None, False, False

    def after_wins():
        return "spinWin" if total + raw * multiplier + scatter_amount >= MAX_WIN_AMOUNT else "tumbleRemove"

    for index, event in enumerate(events):
        require(event["index"] == index, f"Non-contiguous event index {index}")
        kind = event["type"]
        if kind == "featureSpinStart":
            require(phase == "start" and not feature and event["cost"] == 20, "Invalid feature start")
            feature = True
            phase = "spinStart"
        elif kind == "spinStart":
            require(phase in ("start", "spinStart"), f"spinStart after {phase}")
            spin_id += 1
            raw, cascade = 0, 0
            scatter_count, scatter_amount = 0, 0
            require(event["spinId"] == spin_id, "Spin ID discontinuity")
            require(event["freeSpin"] == played and event["tier"] == tier, "Wrong free-spin identity")
            require(event["gameType"] == ("freegame" if played else "basegame"), "Wrong spin game type")
            require(event["multiplier"] == multiplier and event["multiplierActive"] == active, "Multiplier reset/persistence mismatch")
            require(cells(event["stickyPositions"]) == sticky, "Sticky reset/persistence mismatch")
            phase = "initialReveal"
        elif kind == "reveal":
            require(phase in ("initialReveal", "refillReveal"), f"reveal after {phase}")
            new_board = event["board"]
            check_board(new_board)
            require(event["spinId"] == spin_id and event["cascadeIndex"] == cascade, "Reveal counters")
            require(event["numReels"] == COLS and event["numRows"] == ROWS, "Reveal dimensions")
            require(event["gameType"] == ("freegame" if played else "basegame"), "Reveal game type")
            require({(c, r) for c in range(COLS) for r in range(ROWS) if new_board[c][r]["name"] == WILD} == sticky, "Wild moved, disappeared or appeared without reward")
            if played:
                require(not key_positions(new_board), "Keys cannot appear during bonus")
            if phase == "refillReveal":
                expected, moves = tumble(board, removed, lambda c, r: new_board[c][r]["name"])
                require(expected == new_board and event["movements"] == moves, "Gravity or movement mismatch")
                require(len(key_positions(board)) == len(key_positions(new_board)), "Key created or removed during tumble")
            else:
                require(event["movements"] == [], "Initial board cannot have tumble movements")
                scatter_count = len(key_positions(new_board)) if not played else 0
                scatter_amount = SCATTER_PAYS.get(min(scatter_count, 5), 0)
            board = deepcopy(new_board)
            phase = "cascadeWin" if evaluate_board(board) else "spinWin"
        elif kind == "cascadeWin":
            require(phase == "cascadeWin", f"cascadeWin after {phase}")
            cascade += 1
            wins = evaluate_board(board)
            amount = sum(win["rawAmount"] for win in wins)
            raw += amount
            require(event["wins"] == wins, "Wrong symbols, positions, pay band or simultaneous wins")
            require(event["spinId"] == spin_id and event["cascadeIndex"] == cascade, "Cascade counters")
            require(event["rawAmount"] == amount and event["rawSpinWin"] == raw, "Raw cascade total")
            phase = "gateProgress"
        elif kind == "gateProgress":
            require(phase == "gateProgress", f"gateProgress after {phase}")
            require(event["spinId"] == spin_id and event["cascadeIndex"] == cascade and event["progress"] == (cascade - 1) % 3 + 1, "Gate meter")
            phase = "gateOpen" if cascade % 3 == 0 else after_wins()
        elif kind == "gateOpen":
            require(phase == "gateOpen", "Gate without three wins")
            gate, reward_order = cascade // 3, 0
            pending_rewards = 2 if tier == "hidden" else 1
            require(event["spinId"] == spin_id and event["gate"] == gate and event["cascadeIndex"] == cascade and event["rewardCount"] == pending_rewards, "Gate identity or reward count")
            if spin_id == 0:
                entry_gates += 1
            phase = "gateReward"
        elif kind == "gateReward":
            require(phase == "gateReward" and pending_rewards > 0, "Unexpected gate reward")
            reward_order += 1
            reward = event["reward"]
            reward_kind = reward["kind"]
            require(event["spinId"] == spin_id and event["gate"] == gate and event["order"] == reward_order, "Reward order")
            require(event["previousMultiplier"] == multiplier, "Reward previous multiplier")
            if tier not in ("super", "hidden"):
                require(reward_kind == "addMultiplier", "Non-additive reward outside Super/Hidden")
            if reward_kind == "addMultiplier":
                require(reward["value"] in GATE_VALUES, "Unknown additive multiplier")
                multiplier = multiplier + reward["value"] if active else reward["value"]
                active = True
            elif reward_kind == "multiplyMultiplier":
                require(reward["value"] in MULTIPLY_VALUES, "Unknown multiplier factor")
                multiplier *= reward["value"]
                active = True
            elif reward_kind == "stickyWild":
                added = cells(reward["positions"])
                require(1 <= len(added) <= MAX_STICKY_WILDS and not (sticky & added) and len(sticky | added) <= MAX_STICKY_WILDS, "Invalid Wild placement")
                for c, r in added:
                    require(board[c][r]["name"] != KEY, "Wild replaced Key")
                    board[c][r] = {"name": WILD}
                sticky |= added
            elif reward_kind in ("extraSpin", "retrigger"):
                require(reward["spinsAdded"] in (EXTRA_SPIN_VALUES if reward_kind == "extraSpin" else RETRIGGER_VALUES), "Invalid spin extension")
                total_fs += reward["spinsAdded"]
            else:
                raise ValueError(f"Unknown gate reward {reward_kind}")
            require(event["multiplier"] == multiplier and event["multiplierActive"] == active, "Reward arithmetic")
            require(event["totalFs"] == total_fs and cells(event["stickyPositions"]) == sticky, "Reward persistence state")
            pending_rewards -= 1
            phase = "gateReward" if pending_rewards else after_wins()
        elif kind == "tumbleRemove":
            require(phase == "tumbleRemove", f"tumbleRemove after {phase}")
            removed = removed_cells(wins, sticky)
            require(bool(removed) and cells(event["positions"]) == removed, "Tumble removal set")
            require(event["spinId"] == spin_id and event["cascadeIndex"] == cascade, "Removal counters")
            phase = "refillReveal"
        elif kind == "spinWin":
            require(phase == "spinWin", f"spinWin after {phase}")
            uncapped = raw * multiplier + scatter_amount
            require(type(event.get("scatterCount")) is int and event["scatterCount"] == scatter_count, "Wrong scatter count")
            require(type(event.get("scatterAmount")) is int and event["scatterAmount"] == scatter_amount, "Wrong scatter award")
            amount = min(MAX_WIN_AMOUNT - total, uncapped)
            total += amount
            if played:
                bonus_win += amount
            else:
                base_win += amount
            require(event["spinId"] == spin_id and event["cascades"] == cascade, "Settlement counters")
            require(event["rawAmount"] == raw and event["multiplier"] == multiplier and event["uncappedAmount"] == uncapped, "Whole-spin multiplier arithmetic")
            require(event["amount"] == amount and event["capped"] == (total == MAX_WIN_AMOUNT), "Settlement/cap amount")
            phase = "setTotalWin"
        elif kind == "setTotalWin":
            require(phase == "setTotalWin" and event["amount"] == total, "Wrong cumulative win or duplicate credit")
            phase = "freeSpinDone" if played else "entryDone"
        elif kind == "mysterySelect":
            require(mode in (None, "MYSTERY") and phase == "entryDone" and mystery_tier is None, "Mystery reveal placement")
            mystery_tier = tier_for_keys(len(key_positions(board)))
            require(event["tier"] == mystery_tier and event["positions"] == key_positions(board) and event["scatterCount"] == len(key_positions(board)), "Mystery does not match landed Keys")
        elif kind == "freeSpinTrigger":
            require(phase == "entryDone" and tier is None and total < MAX_WIN_AMOUNT, "Bonus entry without a completed entry spin")
            tier = tier_for_keys(len(key_positions(board)))
            require(tier is not None and event["tier"] == tier, "Key count/tier mismatch")
            require(event["positions"] == key_positions(board) and event["scatterCount"] == len(event["positions"]), "Trigger Key positions/count")
            require(event["totalFs"] == STARTING_FREE_SPINS, "Wrong starting free-spin count")
            if mode:
                expected_source = "mystery" if mode == "MYSTERY" else "buy" if mode in ("BONUS", "SUPER") else "natural"
                require(event["source"] == expected_source, "Wrong trigger source")
                if mode == "MYSTERY":
                    require(mystery_tier == tier, "Missing Mystery reveal")
            multiplier, active, sticky, total_fs = 1, False, set(), STARTING_FREE_SPINS
            phase = "bonusReady"
        elif kind == "updateFreeSpin":
            require(phase in ("bonusReady", "freeSpinDone") and total < MAX_WIN_AMOUNT and played < total_fs, "Unexpected extra free spin")
            played += 1
            require(event["amount"] == played and event["total"] == total_fs and event["remaining"] == total_fs - played and event["tier"] == tier, "Free-spin counters")
            phase = "spinStart"
        elif kind == "freeSpinEnd":
            require(phase == "freeSpinDone" and (played == total_fs or total == MAX_WIN_AMOUNT), "Bonus ended before all awarded spins")
            require(event["tier"] == tier and event["amount"] == bonus_win and event["spinsPlayed"] == played and event["totalSpinsAwarded"] == total_fs and event["capped"] == (total == MAX_WIN_AMOUNT), "Bonus summary")
            bonus_ended = True
            phase = "roundDone"
        elif kind == "maxWin":
            require(phase in ("entryDone", "roundDone") and total == MAX_WIN_AMOUNT and not max_event and event["amount"] == MAX_WIN_AMOUNT, "Invalid max-win event")
            max_event = True
        elif kind == "setWin":
            require(phase in ("entryDone", "roundDone") and event["amount"] == total, "Wrong final presentation total")
            require(event["winLevel"] == win_level(total), "Wrong presentation win level")
            require(tier is None or bonus_ended, "Missing bonus end")
            require(max_event == (total == MAX_WIN_AMOUNT), "Missing or spurious cap celebration")
            if tier is None and total < MAX_WIN_AMOUNT:
                require(tier_for_keys(len(key_positions(board))) is None, "Bonus trigger skipped")
            phase = "finalWin"
        elif kind == "finalWin":
            require(phase == "finalWin" and event["amount"] == total == book["payoutMultiplier"] and index == len(events) - 1, "Final/book mismatch")
            phase = "end"
        else:
            raise ValueError(f"Unknown event: {kind}")
    require(phase == "end", "Incomplete round")
    require(Fraction(str(book["baseGameWins"])) * 100 == base_win and Fraction(str(book["freeGameWins"])) * 100 == bonus_win, "Component totals differ from replay")
    if "triggerTier" in book:  # Candidate pools retain it; SDK Books derive it from events.
        require(book["triggerTier"] == tier, "Book trigger tier differs from events")
    group = book["criteria"]
    if group in TIERS:
        require(tier == group, "Bonus pool tier mismatch")
    elif group == "zero":
        require(total == 0 and tier is None, "Zero pool mismatch")
    elif group == "base":
        require(total > 0 and tier is None, "Paying base pool mismatch")
    else:
        require(group == "feature" and feature and entry_gates >= 1, "Feature must earn a gate on entry spin")
    require(feature == (group == "feature"), "Unexpected feature marker")
    if mode:
        require(group in MODE_GROUP_WEIGHTS[mode], "Pool not allowed in selected mode")


def validate_library(library: Path, strict_sdk: bool = False) -> dict:
    import zstandard as zstd
    import io

    index = json.loads((library / "publish_files" / "index.json").read_text())
    require([m["name"] for m in index["modes"]] == list(MODE_COSTS), "Wrong mode manifest")
    config = json.loads((library / "configs" / "config.json").read_text())
    generation = json.loads((library / "configs" / "generation.json").read_text())
    require(generation.get("modelVersion") == MODEL_VERSION, "Wrong model version; regenerate v7 books")
    independent = generation.get("samplingScheme") == "independent-per-mode-v1"
    require(generation.get("samplingScheme") in (None, "shared-pools-v1", "independent-per-mode-v1"),
            "Unsupported sampling scheme")
    if independent:
        mode_counts = generation.get("booksPerModeByMode")
        if mode_counts is None:
            require(type(generation.get("booksPerMode")) is int and generation["booksPerMode"] >= 500,
                    "Invalid per-mode book count")
            mode_counts = {mode: generation["booksPerMode"] for mode in MODE_COSTS}
        require(set(mode_counts) == set(MODE_COSTS) and all(type(count) is int and count >= 500 for count in mode_counts.values()),
                "Invalid per-mode count map")
    config_modes = {m["name"]: m for m in config["bookShelfConfig"]}
    require(set(config_modes) == set(MODE_COSTS), "Backend mode list differs")
    fe_path = library / "configs" / config["frontendConfig"]["file"]
    require(fe_path.parent == library / "configs", "Unexpected frontend config path")
    require(sha256_file(fe_path) == config["frontendConfig"]["sha256"], "Frontend config hash mismatch")
    frontend = json.loads(fe_path.read_text())
    require(frontend["theGates"].get("keyPayouts") == {str(n): amount / 100 for n, amount in SCATTER_PAYS.items()}, "Frontend scatter payouts mismatch")
    require(frontend["theGates"].get("keyPayoutScope") == "entry-spin-once-not-gate-multiplied", "Frontend scatter scope mismatch")
    fe = json.loads(fe_path.read_text())
    require(fe["numReels"] == COLS and fe["numRows"] == [ROWS] * COLS, "Frontend geometry mismatch")
    require(fe["bookScale"] == 100 and fe["walletScale"] == 1_000_000, "Frontend scaling mismatch")
    symbols = {name: definition for row in fe["symbols"] for name, definition in row.items()}
    for symbol, values in PAYTABLE.items():
        require(symbols[symbol]["paytable"] == {str(n): values[0 if n < 10 else 1 if n < 12 else 2] / 100 for n in range(8, 31)}, "Frontend paytable mismatch")
    require(symbols[KEY].get("paytable") == {str(n): SCATTER_PAYS[min(n, 5)] / 100 for n in range(3, COLS * ROWS + 1)}, "Scatter symbol paytable mismatch")
    require("paytable" not in symbols[WILD], "Wilds must not have direct pays")
    for name, cost in MODE_COSTS.items():
        require(fe["betModes"][name]["cost"] == config_modes[name]["cost"] == cost, "Frontend/backend cost mismatch")
        require(fe["betModes"][name]["rtp"] == config_modes[name]["rtp"] == float(TARGET_RTP), "Configured RTP mismatch")
        require(fe["betModes"][name]["max_win"] * 100 == config_modes[name]["maxWin"] * 100 == MAX_WIN_AMOUNT, "Configured cap mismatch")
    shared, results = {}, {}
    for mode in index["modes"]:
        name = mode["name"]
        require(mode == {"name": name, "cost": MODE_COSTS[name], "events": f"books_{name}.jsonl.zst", "weights": f"lookUpTable_{name}_0.csv"}, "Wrong manifest paths/cost")
        compressed = library / "publish_files" / mode["events"]
        lookup = library / "publish_files" / mode["weights"]
        require(sha256_file(compressed) == config_modes[name]["booksFile"]["sha256"], "Compressed hash mismatch")
        require(sha256_file(lookup) == config_modes[name]["tables"][0]["sha256"], "Lookup hash mismatch")
        total_weight, moment, count, quarters, max_weight = 0, 0, 0, 0, 0
        tail_weights = dict.fromkeys(TAIL_LIMITS, 0)
        groups = {group: 0 for group in MODE_GROUP_WEIGHTS[name]}
        shared_seen = set()
        unique_events = set()
        group_moments = Counter()
        group_counts = Counter()
        digest = hashlib.sha256()
        feel_rows = []
        hidden_payouts = Counter()
        payout_distribution = Counter()
        with compressed.open("rb") as source, lookup.open(encoding="utf-8") as csv:
            with zstd.ZstdDecompressor().stream_reader(source) as reader:
                for expected_id, (line, row) in enumerate(zip_longest(io.TextIOWrapper(reader, encoding="utf-8"), csv)):
                    require(line is not None and row is not None, f"{name}: book/lookup length mismatch")
                    digest.update(line.encode())
                    book = json.loads(line)
                    book_id, weight, payout = map(int, row.strip().split(","))
                    require(book_id == expected_id == book["id"], f"{name}: duplicate, missing or unordered ID")
                    require(weight > 0 and payout == book["payoutMultiplier"], f"{name}/{book_id}: weight/payout mismatch")
                    try:
                        validate_book(book, name)
                    except (ValueError, KeyError, TypeError, IndexError) as error:
                        raise ValueError(f"{name}/{book_id}: {error}") from error
                    if payout % 10:
                        quarters += 1
                    if strict_sdk:
                        require(payout % 10 == 0, f"{name}/{book_id}: upstream SDK requires 0.10x steps, actual {payout / 100}x")
                    group = book["criteria"]
                    groups[group] += weight
                    group_moments[group] += weight * payout
                    group_counts[group] += 1
                    if independent:
                        path_digest = event_digest(book["events"])
                        require(path_digest not in unique_events, f"{name}: duplicate event path (padding is forbidden)")
                        unique_events.add(path_digest)
                    if group == "hidden":
                        hidden_payouts[payout] += weight
                    feel_rows.append(({"payoutMultiplier": payout, "triggerTier": next((e["tier"] for e in book["events"] if e["type"] == "freeSpinTrigger"), None),
                                       "experience": experience(book["events"])}, weight))
                    payout_distribution[payout] += weight
                    if group in TIERS and not independent:
                        key = (group, book["poolId"])
                        require(key not in shared_seen, "Duplicated shared pool ID")
                        shared_seen.add(key)
                        item = (event_digest(book["events"]), payout, Fraction(weight, MODE_GROUP_WEIGHTS[name][group]))
                        if key in shared:
                            require(item == shared[key], "Bonus conditional behavior/weights differ between modes")
                        else:
                            shared[key] = item
                    total_weight += weight
                    for threshold in tail_weights:
                        if payout >= threshold:
                            tail_weights[threshold] += weight
                    moment += weight * payout
                    max_weight += weight if payout == MAX_WIN_AMOUNT else 0
                    count += 1
        check_experience(feel_rows, name)
        for tier in TIERS:
            tier_rows = [(r,w) for r,w in feel_rows if r['triggerTier']==tier]
            if tier_rows:
                check_experience(tier_rows, f'{name}/{tier}',
                    payout_cap=(Fraction(1,100) if tier=='hidden' else POSITIVE_PAYOUT_LIMIT) if name != 'FEATURE' else None)
        if hidden_payouts:
            require(Fraction(max(hidden_payouts.values()), sum(hidden_payouts.values()))
                    <= HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY,
                    f"{name}: Hidden exact payout concentration exceeds "
                    f"{float(HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY):.2%}; regenerate diverse paths and fit new weights")
        if independent:
            expected_counts = generation["poolCountsByMode"][name]
            require(dict(group_counts) == expected_counts, "Per-mode candidate allocation mismatch")
            require(count == mode_counts[name], "Wrong exact per-mode book count")
            for tier in TIERS:
                if tier in groups:
                    mean = Fraction(group_moments[tier], groups[tier]*100)
                    require(abs(mean - TIER_TARGET_MEANS[tier]) <= Fraction(1, 100_000_000),
                            f"{name}/{tier}: conditional tier mean mismatch")
        for group in groups:
            if group in TIERS and not independent:
                require({key for key in shared_seen if key[0] == group} == {key for key in shared if key[0] == group}, "Shared tier book coverage differs")
        plain = library / "books" / f"books_{name}.jsonl"
        expected_plain_hash = config_modes[name]["booksFile"].get("uncompressedSha256")
        if generation.get("storageFormat") in ("zstd-stream-v1", "sdk-book-zstd-v1"):
            # Standard SDK config omits an uncompressed book hash.  The stream
            # is still fully parsed above; custom legacy configs may retain it.
            if expected_plain_hash is not None:
                require(isinstance(expected_plain_hash, str) and len(expected_plain_hash) == 64,
                        "Invalid uncompressed stream hash")
                require(digest.hexdigest() == expected_plain_hash, "Uncompressed stream hash mismatch")
        else:
            require(plain.exists(), "Legacy package is missing plain books")
        if plain.exists():
            require(digest.hexdigest() == sha256_file(plain), "Compressed/plain books differ")
        require(sha256_file(lookup) == sha256_file(library / "lookup_tables" / f"lookUpTable_{name}.csv"), "Local/published lookups differ")
        require(groups == MODE_GROUP_WEIGHTS[name] and total_weight == LOOKUP_SCALE, "Mode group probabilities changed")
        require(max_weight > 0, "Advertised maximum win is unreachable")
        for threshold, weight in tail_weights.items():
            require(Fraction(weight, total_weight) <= TAIL_LIMITS[threshold],
                    f"{name}: tail probability at {threshold / 100:g}x exceeds limit")
        rtp = Fraction(moment, total_weight * 100 * MODE_COSTS[name])
        require(abs(float(rtp - TARGET_RTP)) <= RTP_TOLERANCE, f"{name}: RTP mismatch {float(rtp)}")
        cvar_001_x = weighted_cvar_001_x(payout_distribution, total_weight)
        if name == "MYSTERY":
            require(cvar_001_x <= MYSTERY_CVAR_001_LIMIT_X,
                    f"MYSTERY: CVaR(0.1%) {float(cvar_001_x):.4f}x exceeds "
                    f"{float(MYSTERY_CVAR_001_LIMIT_X):.4f}x")
        require(config_modes[name]["bookLength"] == count, "Configured book count mismatch")
        results[name] = {"books": count, "rtp": float(rtp), "cvar001x": float(cvar_001_x),
                         "nonTenthPayoutBooks": quarters}
        print(f"{name}: event/weight/package checks PASS; {count:,} books; RTP {float(rtp):.10%}; non-tenth books {quarters:,}")
    return results


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--library", type=Path, default=Path(__file__).resolve().parent / "library")
    parser.add_argument("--strict-sdk-increments", action="store_true")
    args = parser.parse_args()
    validate_library(args.library, args.strict_sdk_increments)
    print("The Gates local artifact checks: PASS. Live RGS acceptance and platform risk review remain separate.")
