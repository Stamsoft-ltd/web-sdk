"""The Gates product locks and explicitly tunable generation parameters.

Amounts in books are integer hundredths of the selected BASE bet, not buy cost.
The source XLSX's quarter-unit pays are intentional; do not round to tenths.
"""

from fractions import Fraction

GAME_ID = "0_0_the_gates"
MODEL_VERSION = "the-gates-v7.2-fifty-percent-regular-hits"
TARGET_RTP = Fraction(961, 1000)
BOOK_SCALE = 100
MAX_WIN_X = 25_000
MAX_WIN_AMOUNT = MAX_WIN_X * BOOK_SCALE
COLS, ROWS = 6, 5
STARTING_FREE_SPINS = 15
CASCADES_PER_GATE = 3
MODE_COSTS = {"BASE": 1, "CHANCE": 2, "FEATURE": 20, "BONUS": 100, "SUPER": 300, "MYSTERY": 400}
TIERS = ("normal", "super", "hidden")
TRIGGER_KEYS = {"normal": 3, "super": 4, "hidden": 5}
# Once per entry spin; never multiplied by gates. Five or more uses the top band.
SCATTER_PAYS = {3: 200, 4: 1000, 5: 5000}
MYSTERY_MIX = {"normal": Fraction(65, 100), "super": Fraction(30, 100), "hidden": Fraction(5, 100)}
MODE_TARGET_MEANS = {mode: cost * TARGET_RTP for mode, cost in MODE_COSTS.items()}
TIER_TARGET_MEANS = {
    "normal": MODE_TARGET_MEANS["BONUS"],
    "super": MODE_TARGET_MEANS["SUPER"],
}
TIER_TARGET_MEANS["hidden"] = (
    MODE_TARGET_MEANS["MYSTERY"]
    - sum(MYSTERY_MIX[tier] * mean for tier, mean in TIER_TARGET_MEANS.items())
) / MYSTERY_MIX["hidden"]  # 4,708.9x, INCLUDING the full entry spin.

# Prototype targets. Published lookup weights, NOT candidate frequencies, define
# the live distribution. CHANCE triples every natural bonus tier exactly.
BASE_TRIGGER_RATE = Fraction(1, 400)
CHANCE_TRIGGER_RATE = 3 * BASE_TRIGGER_RATE
NATURAL_TIER_MIX = {"normal": Fraction(85, 100), "super": Fraction(14, 100), "hidden": Fraction(1, 100)}
BASE_PAYING_GROUP_RATE = Fraction(1, 2)
LOOKUP_SCALE = 4_000_000_000_000
TIER_POOL_SCALE = 100_000_000
RTP_TOLERANCE = 1e-8

# User-supplied Studio risk screen: raw base-bet payout, not purchase-normalized.
# Fit below the 1% 5,000x ceiling; do not just change the reported risk threshold.
MYSTERY_TAIL_5000_TARGET = Fraction(9, 1000)
MYSTERY_TAIL_10000_TARGET = Fraction(45, 10000)
# Studio 2-star absolute CVaR: worst weighted 0.1% must average <=20,000x
# base stake.  The 5k/10k probability caps alone allowed 22,802.2x.
MYSTERY_TAIL_20000_TARGET = Fraction(3, 10_000)
MYSTERY_CVAR_001_LIMIT_X = Fraction(20_000, 1)
# Conditional on Hidden: aggregate ALL books with the same payout, not each ID.
# Fail generation/validation instead of shipping a concentrated payout atom.
HIDDEN_MAX_EXACT_PAYOUT_PROBABILITY = Fraction(1, 100)
TAIL_LIMITS = {500_000: Fraction(1, 100), 1_000_000: Fraction(5, 1000),
               2_500_000: Fraction(2, 1000)}


def natural_weights(rate: Fraction) -> dict[str, int]:
    weights = {tier: int(LOOKUP_SCALE * rate * mix) for tier, mix in NATURAL_TIER_MIX.items()}
    weights["base"] = int(LOOKUP_SCALE * BASE_PAYING_GROUP_RATE)
    return {"zero": LOOKUP_SCALE - sum(weights.values()), **weights}


MODE_GROUP_WEIGHTS = {
    "BASE": natural_weights(BASE_TRIGGER_RATE),
    "CHANCE": natural_weights(CHANCE_TRIGGER_RATE),
    "FEATURE": {"feature": LOOKUP_SCALE},
    "BONUS": {"normal": LOOKUP_SCALE},
    "SUPER": {"super": LOOKUP_SCALE},
    "MYSTERY": {tier: int(LOOKUP_SCALE * mix) for tier, mix in MYSTERY_MIX.items()},
}

# Exact source paytable in book units. Rows: 8-9, 10-11, 12-30.
PAYTABLE = {
    "GUARDIAN_MASK": (1000, 2500, 5000),
    "SUN_MEDALLION": (250, 1000, 2500),
    "SACRED_EYE": (200, 500, 1500),
    "RUNE_CHALICE": (150, 200, 1200),
    "CRYSTAL_ORB": (100, 150, 1000),
    "RED_GEM": (80, 120, 800),
    "BLUE_GEM": (50, 100, 500),
    "GREEN_GEM": (40, 90, 400),
    "PURPLE_GEM": (25, 75, 200),
    "AMBER_GEM": (20, 50, 150),
}
PAY_SYMBOLS = tuple(PAYTABLE)
KEY, WILD = "KEY", "WILD"

# Candidate proposal settings, subject to later simulation/tuning by the user.
SYMBOL_WEIGHTS = (3, 5, 6, 7, 8, 10, 12, 13, 15, 16)
# Proposal only.  Published lookup weights define the delivered RTP.  These
# profiles provide enough multi-tumble paths for gates to feel like the core
# feature rather than a rare interruption.
HOT_PROBABILITIES = (0.0, 0.08, 0.16, 0.28, 0.40)
PROFILE_WEIGHTS = {
    "base": (35, 30, 18, 12, 5),
    "feature": (0, 2, 10, 38, 50),
    "normal": (10, 25, 30, 25, 10),
    "super": (8, 17, 28, 30, 17),
    "hidden": (5, 12, 22, 35, 26),
}
# Hot symbols must not remain fixed for the entire round.  A mandatory refresh
# after every opened gate makes the next gate chain visibly distinct; the
# between-gate refresh mixes ordinary tumbles as well.  Candidate proposal
# only; replay remains seed-deterministic.
TUMBLE_HOT_REFRESH = {
    "base": 0.28,
    "feature": 0.18,
    "normal": 0.24,
    "super": 0.20,
    "hidden": 0.20,
}
GATE_VALUES = (2, 3, 4, 5, 8, 10, 12, 15, 20, 25, 50, 100, 200, 500, 1000)
GATE_VALUE_WEIGHTS = (30000, 22000, 16000, 12000, 8000, 5000, 3000, 2000, 1000, 500, 150, 40, 10, 2, 1)
# PRD: Normal remains additive-only.  Super has the full reward pool; Hidden
# uses precisely that same pool twice per opened gate.  Retrigger is a larger,
# distinct extension (15 FS), not a renamed small extra-spin award.
SUPER_REWARD_WEIGHTS = {"addMultiplier": 40, "multiplyMultiplier": 15,
                        "stickyWild": 25, "extraSpin": 15, "retrigger": 5}
MULTIPLY_VALUES, MULTIPLY_WEIGHTS = (2, 3, 5), (80, 18, 2)
EXTRA_SPIN_VALUES, EXTRA_SPIN_WEIGHTS = (1, 2, 3, 5), (45, 30, 18, 7)
RETRIGGER_VALUES, RETRIGGER_WEIGHTS = (15,), (100,)
STICKY_WILD_COUNTS, STICKY_WILD_WEIGHTS = (1, 2), (80, 20)
MAX_STICKY_WILDS = 3  # One per sticky reward; no more than three at once.
# Feature spins may trigger bonuses; they must earn a gate on the ENTRY spin.
FEATURE_KEY_COUNTS, FEATURE_KEY_WEIGHTS = (0, 1, 2, 3, 4, 5), (900, 50, 35, 12, 2, 1)
# Limits reject a whole candidate. They NEVER truncate an accepted round or
# discard an awarded extension. Raise these if guard rejection is significant.
MAX_CASCADES_PER_SPIN = 256
MAX_SPINS_PER_BONUS = 500
MAX_GENERATION_ATTEMPTS = 1000


def check_targets() -> None:
    if TIER_TARGET_MEANS["hidden"] != Fraction(47089, 10):
        raise ValueError("Mystery economics changed; review the Hidden target")
    for mode, groups in MODE_GROUP_WEIGHTS.items():
        if sum(groups.values()) != LOOKUP_SCALE or any(w <= 0 for w in groups.values()):
            raise ValueError(f"Invalid mode weights: {mode}")
        for tier in TIERS:
            if tier in groups and groups[tier] % TIER_POOL_SCALE:
                raise ValueError(f"{mode}/{tier}: shared pool cannot scale exactly")
    for tier in TIERS:
        if MODE_GROUP_WEIGHTS["CHANCE"][tier] != 3 * MODE_GROUP_WEIGHTS["BASE"][tier]:
            raise ValueError("Extra Chance must triple each natural bonus probability")
