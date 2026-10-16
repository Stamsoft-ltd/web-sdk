"""Deterministic pay-anywhere cascades and ordered gate rewards.

No wallet math, payout rounding, client-side random choices or lookup tuning.
Candidate sampling is separate from the published distribution in run.py.
"""

from __future__ import annotations

from collections import Counter
from copy import deepcopy
from dataclasses import dataclass, field
import hashlib
import random

from math_targets import (
    CASCADES_PER_GATE, COLS, ROWS, PAYTABLE, PAY_SYMBOLS, KEY, WILD,
    SYMBOL_WEIGHTS, HOT_PROBABILITIES, PROFILE_WEIGHTS, GATE_VALUES,
    GATE_VALUE_WEIGHTS, SUPER_REWARD_WEIGHTS, MULTIPLY_VALUES, MULTIPLY_WEIGHTS,
    EXTRA_SPIN_VALUES, EXTRA_SPIN_WEIGHTS, RETRIGGER_VALUES, RETRIGGER_WEIGHTS,
    STICKY_WILD_COUNTS, STICKY_WILD_WEIGHTS,
    MAX_STICKY_WILDS, MAX_WIN_AMOUNT, MAX_CASCADES_PER_SPIN,
    MAX_SPINS_PER_BONUS, MAX_GENERATION_ATTEMPTS, STARTING_FREE_SPINS,
    TRIGGER_KEYS, SCATTER_PAYS, TIERS, FEATURE_KEY_COUNTS, FEATURE_KEY_WEIGHTS,
)

Board = list[list[dict]]
Cell = tuple[int, int]


class CandidateRejected(RuntimeError):
    """A complete candidate is rejected, never silently shortened."""


def seed_for(*parts: object) -> int:
    return int.from_bytes(hashlib.sha256("|".join(map(str, parts)).encode()).digest()[:8], "big")


def positions(cells) -> list[dict]:
    return [{"reel": c, "row": r} for c, r in sorted(cells)]


def key_positions(board: Board) -> list[dict]:
    return positions((c, r) for c in range(COLS) for r in range(ROWS) if board[c][r]["name"] == KEY)


def tier_for_keys(count: int) -> str | None:
    return "hidden" if count >= 5 else {3: "normal", 4: "super"}.get(count)


def symbol_pay(symbol: str, count: int) -> int:
    if symbol not in PAYTABLE or count < 8:
        return 0
    return PAYTABLE[symbol][0 if count < 10 else 1 if count < 12 else 2]


def win_level(amount: int) -> int:
    thresholds = (10, 100, 200, 500, 1500, 3000, 5000, 10000, MAX_WIN_AMOUNT)
    return 1 + sum(amount >= threshold for threshold in thresholds)


def evaluate_board(board: Board) -> list[dict]:
    """Wilds assist each symbol independently; Keys never pay or substitute."""
    wilds = {(c, r) for c in range(COLS) for r in range(ROWS) if board[c][r]["name"] == WILD}
    wins = []
    for symbol in PAY_SYMBOLS:
        regular = {(c, r) for c in range(COLS) for r in range(ROWS) if board[c][r]["name"] == symbol}
        matched = regular | wilds
        if regular and (amount := symbol_pay(symbol, len(matched))):
            wins.append({"symbol": symbol, "size": len(matched), "positions": positions(matched), "rawAmount": amount})
    return wins


def removed_cells(wins: list[dict], sticky: set[Cell]) -> set[Cell]:
    return {(p["reel"], p["row"]) for w in wins for p in w["positions"]} - sticky


def tumble(board: Board, removed: set[Cell], draw) -> tuple[Board, list[dict]]:
    """Gravity within column segments separated by anchored Wilds.

    Survivors keep vertical order. draw(column, row) only supplies new cells.
    Returned movement data lets animation replay without inferring gravity.
    """
    result = deepcopy(board)
    movements = []
    for c in range(COLS):
        barriers = [-1] + [r for r in range(ROWS) if board[c][r]["name"] == WILD] + [ROWS]
        for lower, upper in zip(barriers, barriers[1:]):
            rows = list(range(lower + 1, upper))
            survivors = [(r, board[c][r]) for r in rows if (c, r) not in removed]
            missing = len(rows) - len(survivors)
            for dest, (origin, cell) in zip(rows[missing:], survivors):
                result[c][dest] = deepcopy(cell)
                if dest != origin:
                    movements.append({"reel": c, "fromRow": origin, "toRow": dest, "name": cell["name"]})
            for dest in rows[:missing]:
                result[c][dest] = {"name": draw(c, dest)}
    return result, movements


@dataclass
class BonusState:
    multiplier: int = 1
    multiplier_active: bool = False
    sticky: set[Cell] = field(default_factory=set)
    total_spins: int = STARTING_FREE_SPINS

    def add(self, value: int) -> None:
        self.multiplier = self.multiplier + value if self.multiplier_active else value
        self.multiplier_active = True

    def multiply(self, value: int) -> None:
        self.multiplier *= value
        self.multiplier_active = True


class RandomSource:
    """Biased candidate proposal, not the live distribution/RNG."""

    def __init__(self, rng: random.Random):
        self.rng = rng
        self.hot = PAY_SYMBOLS[-1]
        self.probability = 0.0
        self.stage = "base"
        self.palette = list(PAY_SYMBOLS)

    def start_board(self, stage: str, spin: int, keys: int, sticky: set[Cell]) -> Board:
        self.stage = stage
        self.palette = self.rng.sample(list(PAY_SYMBOLS), self.rng.choice((4, 5, 6, 7)))
        self.hot = self.rng.choice(self.palette)
        self.probability = self.rng.choices(HOT_PROBABILITIES, weights=PROFILE_WEIGHTS[stage])[0]
        board = [[{"name": self.draw(c, r)} for r in range(ROWS)] for c in range(COLS)]
        available = [(c, r) for c in range(COLS) for r in range(ROWS) if (c, r) not in sticky]
        for c, r in self.rng.sample(available, keys):
            board[c][r] = {"name": KEY}
        for c, r in sticky:
            board[c][r] = {"name": WILD}
        return board

    def draw(self, c: int, r: int) -> str:
        if self.rng.random() < self.probability:
            return self.hot
        return self.rng.choices(self.palette, weights=[SYMBOL_WEIGHTS[PAY_SYMBOLS.index(s)] for s in self.palette])[0]

    def refill(self, board: Board, removed: set[Cell], cascade: int) -> tuple[Board, list[dict]]:
        # Candidate family chosen offline: usually feed surviving secondary groups,
        # sometimes repeat. Nothing is changed after a book is selected by the RGS.
        paid = {win['symbol'] for win in evaluate_board(board)}
        candidates = [s for s in PAY_SYMBOLS if s not in paid]
        if self.rng.random() < 0.90:
            self.palette = self.rng.sample(candidates, min(len(candidates), self.rng.choice((4,5,6))))
        else:
            self.palette = self.rng.sample(list(PAY_SYMBOLS), self.rng.choice((4,5,6)))
        survivors = Counter(board[c][r]['name'] for c in range(COLS) for r in range(ROWS) if (c,r) not in removed)
        self.hot = self.rng.choices(self.palette, weights=[1+survivors[s] for s in self.palette])[0]
        return tumble(board, removed, self.draw)

    def reward(self, stage: str, state: BonusState, board: Board) -> dict:
        if stage in ("base", "feature", "normal"):
            kind = "addMultiplier"
        else:
            kinds = [k for k in SUPER_REWARD_WEIGHTS if k != "stickyWild" or len(state.sticky) < MAX_STICKY_WILDS]
            kind = self.rng.choices(kinds, weights=[SUPER_REWARD_WEIGHTS[k] for k in kinds])[0]
        if kind == "addMultiplier":
            return {"kind": kind, "value": self.rng.choices(GATE_VALUES, weights=GATE_VALUE_WEIGHTS)[0]}
        if kind == "multiplyMultiplier":
            return {"kind": kind, "value": self.rng.choices(MULTIPLY_VALUES, weights=MULTIPLY_WEIGHTS)[0]}
        if kind == "stickyWild":
            cells = [(c, r) for c in range(COLS) for r in range(ROWS) if (c, r) not in state.sticky and board[c][r]["name"] != KEY]
            count = min(self.rng.choices(STICKY_WILD_COUNTS, weights=STICKY_WILD_WEIGHTS)[0], MAX_STICKY_WILDS - len(state.sticky), len(cells))
            return {"kind": kind, "positions": positions(self.rng.sample(cells, count))}
        values, weights = (EXTRA_SPIN_VALUES, EXTRA_SPIN_WEIGHTS) if kind == "extraSpin" else (RETRIGGER_VALUES, RETRIGGER_WEIGHTS)
        return {"kind": kind, "spinsAdded": self.rng.choices(values, weights=weights)[0]}


def balanced_board(rng: random.Random, keys: int = 0, winning: str | None = None, count: int = 8) -> Board:
    """Diverse, known low or tail witnesses; no post-reveal symbol editing."""
    available = [s for s in PAY_SYMBOLS if s != winning]
    names = [KEY] * keys + ([winning] * count if winning else [])
    for i in range(COLS * ROWS - len(names)):
        names.append(available[i % len(available)])
    rng.shuffle(names)
    return [[{"name": names[c * ROWS + r]} for r in range(ROWS)] for c in range(COLS)]


class WitnessSource(RandomSource):
    """Legal deterministic coverage paths used to bracket optimization targets.

    Max/1,000x witnesses get fixed minimum lookup weights. Other tail paths can
    be optimized; the report exposes their weight and candidate concentration.
    """

    def __init__(self, rng: random.Random, group: str, witness: str):
        super().__init__(rng)
        self.group, self.witness = group, witness
        self.live = False
        self.symbol = "PURPLE_GEM" if witness == "quarter" else "AMBER_GEM"
        if witness in ("tail", "max", "rare1000"):
            self.symbol = "GUARDIAN_MASK"
        self.count = rng.choice((8, 9, 10, 11, 12, 13)) if witness == "tail" else 12 if witness in ("max", "rare1000") else 8
        self.gate_value = rng.choice((25, 50, 100)) if witness == "tail" else 200 if witness == "max" else 1000 if witness == "rare1000" else 2

    def start_board(self, stage: str, spin: int, keys: int, sticky: set[Cell]) -> Board:
        # Tier pools show a full losing entry spin, then the witness on FS 1.
        self.live = self.witness != "zero" and (spin == 1 if self.group in TIERS else spin == 0)
        return balanced_board(self.rng, keys, self.symbol if self.live else None, self.count)

    def refill(self, board: Board, removed: set[Cell], cascade: int) -> tuple[Board, list[dict]]:
        chain = self.witness in ("tail", "max", "rare1000") or self.group == "feature"
        if self.live and chain and cascade < CASCADES_PER_GATE:
            return tumble(board, removed, lambda c, r: self.symbol)
        counts = Counter(board[c][r]["name"] for c in range(COLS) for r in range(ROWS) if (c, r) not in removed)

        def draw(c, r):
            symbol = min(PAY_SYMBOLS, key=lambda s: (counts[s], PAY_SYMBOLS.index(s)))
            counts[symbol] += 1
            return symbol

        return tumble(board, removed, draw)

    def reward(self, stage: str, state: BonusState, board: Board) -> dict:
        return {"kind": "addMultiplier", "value": self.gate_value}


class SpreadBonusSource(WitnessSource):
    """Varied legal multi-spin proposal support; pays are evaluated, never assigned.
    Switching chains use real gravity and refill only removed positions.
    """
    def __init__(self, rng, group, witness):
        super().__init__(rng, group, witness)
        count = rng.randint(5 if group == "hidden" else 4, 8)
        paid = [rng.randint(i*15//count+1,(i+1)*15//count) for i in range(count)]
        gates = rng.randint(1, min(3, count)) if group != 'hidden' else rng.randint(3,min(5,count))
        self.gate_spins = set(rng.sample(paid,gates))
        self.schedule = {spin: (rng.choice(PAY_SYMBOLS),rng.choice((8,9,10,11))) for spin in paid}
        self.current_spin = 0
        self.reward_values = rng.choices(((2,3,4,5),(3,5,8,10,12),(10,15,20,25,50),(25,50,100)), weights=(45,35,18,2))[0]
        if group == 'hidden':
            self.reward_values = rng.choices(((3,5,8,10),(8,10,15,20,25),(20,25,50,100),(50,100,200)), weights=(5,15,60,20))[0]

    def start_board(self, stage, spin, keys, sticky):
        self.current_spin = spin
        self.live = spin in self.gate_spins
        pay = self.schedule.get(spin)
        if pay: self.symbol,self.count=pay
        palette = self.rng.sample(list(PAY_SYMBOLS), self.rng.choice((5,6,7)))
        if pay and self.symbol not in palette: palette[0] = self.symbol
        names = [KEY]*keys + ([self.symbol]*self.count if pay else [])
        paying = {self.symbol} if pay else set()
        # A second legal independent group is one proposal family, not every board.
        if pay and self.rng.random() < .20:
            second = self.rng.choice([s for s in palette if s not in paying])
            names += [second]*8
            paying.add(second)
        counts = Counter(names)
        while len(names) < COLS*ROWS:
            available = [s for s in palette if s not in paying and counts[s]<7]
            if not available:
                # Two simultaneous groups can leave too few filler palette slots.
                available = [s for s in PAY_SYMBOLS if s not in paying and counts[s]<7]
            symbol = self.rng.choice(available)
            names.append(symbol); counts[symbol]+=1
        self.rng.shuffle(names)
        return [[{'name':names[c*ROWS+r]} for r in range(ROWS)] for c in range(COLS)]

    def refill(self, board, removed, cascade):
        if self.live and cascade < CASCADES_PER_GATE:
            paid={w['symbol'] for w in evaluate_board(board)}
            counts=Counter(board[c][r]['name'] for c in range(COLS) for r in range(ROWS) if (c,r) not in removed)
            choices=[s for s in PAY_SYMBOLS if s not in paid and counts[s]+len(removed)>=8]
            chosen=self.rng.choices(choices, weights=[1+counts[s]*counts[s] for s in choices])[0]
            needed=max(0,8-counts[chosen])
            def draw(c,r):
                nonlocal needed
                if needed: needed-=1;counts[chosen]+=1;return chosen
                available=[s for s in PAY_SYMBOLS if counts[s]<7]
                symbol=self.rng.choice(available);counts[symbol]+=1;return symbol
            return tumble(board,removed,draw)
        # WitnessSource's balanced exit does not use its fixed-symbol chain here.
        live=self.live;self.live=False
        result=super().refill(board,removed,cascade)
        self.live=live
        return result

    def reward(self, stage, state, board):
        return {'kind':'addMultiplier','value':self.rng.choice(self.reward_values)}


def scatter_pay(count: int) -> int:
    return SCATTER_PAYS.get(min(count, 5), 0)


class Round:
    def __init__(self, source: RandomSource):
        self.source = source
        self.events = []
        self.total = 0
        self.base_win = 0
        self.bonus_win = 0
        self.spin_id = -1
        self.entry_gates = 0
        self.trigger_tier = None

    def emit(self, kind: str, **payload) -> None:
        self.events.append({"index": len(self.events), "type": kind, **deepcopy(payload)})

    def apply_reward(self, stage: str, state: BonusState, board: Board, gate: int, order: int) -> None:
        reward = self.source.reward(stage, state, board)
        previous = state.multiplier
        kind = reward["kind"]
        if kind == "addMultiplier":
            state.add(reward["value"])
        elif kind == "multiplyMultiplier":
            state.multiply(reward["value"])
        elif kind == "stickyWild":
            for p in reward["positions"]:
                cell = (p["reel"], p["row"])
                state.sticky.add(cell)
                board[cell[0]][cell[1]] = {"name": WILD}
        else:
            state.total_spins += reward["spinsAdded"]
        self.emit("gateReward", spinId=self.spin_id, gate=gate, order=order,
                  reward=reward, previousMultiplier=previous, multiplier=state.multiplier,
                  multiplierActive=state.multiplier_active, totalFs=state.total_spins,
                  stickyPositions=positions(state.sticky))

    def spin(self, stage: str, state: BonusState, keys: int, fs: int = 0) -> Board:
        self.spin_id += 1
        cascade, raw_spin = 0, 0
        board = self.source.start_board(stage, self.spin_id, keys, state.sticky)
        scatter_count = len(key_positions(board)) if not fs else 0
        scatter_amount = scatter_pay(scatter_count)
        self.emit("spinStart", spinId=self.spin_id, gameType="freegame" if fs else "basegame",
                  tier=stage if stage in TIERS else None, freeSpin=fs, multiplier=state.multiplier,
                  multiplierActive=state.multiplier_active, stickyPositions=positions(state.sticky))
        self.emit("reveal", board=board, spinId=self.spin_id, cascadeIndex=0,
                  gameType="freegame" if fs else "basegame", numReels=COLS, numRows=ROWS,
                  paddingPositions=[0] * COLS, anticipation=[0] * COLS, movements=[])
        while wins := evaluate_board(board):
            cascade += 1
            if cascade > MAX_CASCADES_PER_SPIN:
                raise CandidateRejected("cascade_guard")
            raw = sum(w["rawAmount"] for w in wins)
            raw_spin += raw
            self.emit("cascadeWin", spinId=self.spin_id, cascadeIndex=cascade, wins=wins,
                      rawAmount=raw, rawSpinWin=raw_spin)
            self.emit("gateProgress", spinId=self.spin_id, cascadeIndex=cascade,
                      progress=((cascade - 1) % CASCADES_PER_GATE) + 1)
            if cascade % CASCADES_PER_GATE == 0:
                gate = cascade // CASCADES_PER_GATE
                count = 2 if stage == "hidden" else 1
                self.emit("gateOpen", spinId=self.spin_id, gate=gate, cascadeIndex=cascade, rewardCount=count)
                for order in range(1, count + 1):
                    self.apply_reward(stage, state, board, gate, order)
                if not fs:
                    self.entry_gates += 1
            # Final multiplier applies retroactively to the ENTIRE active spin.
            # Check cap only after all ordered rewards of the current gate.
            if self.total + raw_spin * state.multiplier + scatter_amount >= MAX_WIN_AMOUNT:
                break
            removed = removed_cells(wins, state.sticky)
            if not removed:
                raise CandidateRejected("no_removable_winning_symbols")
            self.emit("tumbleRemove", spinId=self.spin_id, cascadeIndex=cascade, positions=positions(removed))
            board, movements = self.source.refill(board, removed, cascade)
            self.emit("reveal", board=board, spinId=self.spin_id, cascadeIndex=cascade,
                      gameType="freegame" if fs else "basegame", numReels=COLS, numRows=ROWS,
                      paddingPositions=[0] * COLS, anticipation=[0] * COLS, movements=movements)
        uncapped = raw_spin * state.multiplier + scatter_amount
        amount = min(MAX_WIN_AMOUNT - self.total, uncapped)
        self.total += amount
        if fs:
            self.bonus_win += amount
        else:
            self.base_win += amount
        self.emit("spinWin", spinId=self.spin_id, rawAmount=raw_spin, multiplier=state.multiplier,
                  uncappedAmount=uncapped, amount=amount, cascades=cascade,
                  scatterCount=scatter_count, scatterAmount=scatter_amount,
                  capped=self.total == MAX_WIN_AMOUNT)
        self.emit("setTotalWin", amount=self.total)
        return board

    def play(self, group: str, rng: random.Random) -> dict:
        if group == "feature":
            self.emit("featureSpinStart", cost=20)
            keys = rng.choices(FEATURE_KEY_COUNTS, weights=FEATURE_KEY_WEIGHTS)[0]
        else:
            keys = TRIGGER_KEYS[group] if group in TIERS else rng.choices((0, 1, 2), weights=(85, 12, 3))[0]
        entry_board = self.spin("feature" if group == "feature" else "base", BonusState(), keys)
        if group == "feature" and not self.entry_gates:
            raise CandidateRejected("feature_without_entry_gate")
        tier = tier_for_keys(len(key_positions(entry_board)))
        if group in TIERS and self.total == MAX_WIN_AMOUNT:
            raise CandidateRejected("cap_before_bonus_entry")
        if tier and self.total < MAX_WIN_AMOUNT:
            self.trigger_tier = tier
            self.emit("freeSpinTrigger", tier=tier, source="natural", scatterCount=keys,
                      positions=key_positions(entry_board), totalFs=STARTING_FREE_SPINS)
            state = BonusState()  # Entry-spin gate multiplier never carries into bonus.
            played = 0
            while played < state.total_spins and self.total < MAX_WIN_AMOUNT:
                played += 1
                if played > MAX_SPINS_PER_BONUS:
                    raise CandidateRejected("free_spin_guard")
                self.emit("updateFreeSpin", amount=played, total=state.total_spins, tier=tier,
                          remaining=state.total_spins - played)
                self.spin(tier, state, keys=0, fs=played)
            self.emit("freeSpinEnd", tier=tier, amount=self.bonus_win, spinsPlayed=played,
                      totalSpinsAwarded=state.total_spins, capped=self.total == MAX_WIN_AMOUNT)
        if self.total == MAX_WIN_AMOUNT:
            self.emit("maxWin", amount=MAX_WIN_AMOUNT)
        self.emit("setWin", amount=self.total, winLevel=win_level(self.total))
        self.emit("finalWin", amount=self.total)
        return {"events": self.events, "payoutMultiplier": self.total,
                "baseGameWins": self.base_win / 100, "freeGameWins": self.bonus_win / 100,
                "triggerTier": self.trigger_tier}


def generate_candidate(group: str, index: int, master_seed: int = 20260921) -> dict:
    if group not in ("zero", "base", "feature", *TIERS):
        raise ValueError(f"Unknown pool: {group}")
    # Positive anchors bracket optimization. Tail variants use varied real
    # boards and valid rewards; no payouts are assigned independently of play.
    witness = ("zero", "minimum", "quarter", "max", "rare1000")[index] if index < 5 else "tail" if index % 10 == 0 else None
    if group == "zero":
        witness = "zero"
    elif group in ("base", "feature") and witness == "zero":
        witness = "minimum"
    failures: Counter = Counter()
    for attempt in range(MAX_GENERATION_ATTEMPTS):
        seed = seed_for(master_seed, group, index, attempt)
        rng = random.Random(seed)
        source = (SpreadBonusSource(rng, group, witness)
                  if group in TIERS and (witness == "tail" or (index >= 5 and index % 5 in (1,2,3)))
                  else WitnessSource(rng, group, witness) if witness else RandomSource(rng))
        try:
            result = Round(source).play(group, rng)
            if group == "base" and not result["payoutMultiplier"]:
                raise CandidateRejected("base_without_win")
            if group == "zero" and result["payoutMultiplier"]:
                raise CandidateRejected("zero_with_win")
        except CandidateRejected as error:
            failures[str(error)] += 1
            continue
        return {"id": index, "criteria": group, "poolId": index, "seed": str(seed),
                "generation": {"witness": witness, "attempts": attempt + 1, "rejections": dict(failures)}, **result}
    raise RuntimeError(f"{group}/{index}: exhausted {MAX_GENERATION_ATTEMPTS} attempts: {dict(failures)}")
