# Gates math feel audit — 2026-10-15

## Verdict
**Both concerns are supported by the local weighted math. This is a generation/weighting issue, not merely animation. No math, weights or published books changed.**

## Evidence scope
User identified the latest RGS books from math-sdk, not the scripted UI preview. Read-only census of all **100,000 SUPER books** and their actual integer lookup weights in:

`math-sdk/games/0_0_the_gates/.library-v6-sdk-standard-cvar-500k-core-100k-bonuses-build-20260928T153953861637Z/publish_files/`

This is the latest available local Super package found, a staged build directory. No completed publication index or live RGS replay/version was supplied. Results describe these exact local artifacts; they are not a claim to have verified the server's deployed bytes. The lookup checksum is recorded in `source-hashes.json`.

Also audited complete lookup payout distributions for BASE/FEATURE (500,000 rows each), BONUS/SUPER (100,000 each), and reviewed current generation/weighting source. Full event-path census performed for SUPER only. No new million-spin Monte Carlo was run: this is an exhaustive weighted finite-library census, with no sampling uncertainty within that library. It does not establish live RNG, full-package or release sign-off. Current source may have changed since staged book generation; reported artifact results and source behavior are distinguished below.

Amounts below are multiples of base bet, not the 300× Super purchase price. Book values use 100 units per 1×; 750× is 75,000 units.

## 1. Tumble diversity — concern confirmed
Across lookup-weighted SUPER event paths, including their entry spins:

| Metric | Result |
| --- | ---: |
| Adjacent paying boards with identical paying symbol set | **73.14%** |
| Adjacent paying boards sharing any paying symbol | **75.15%** |
| Adjacent paying boards introducing a new paying symbol | **25.60%** |
| Adjacent paying boards with completely different paying symbols | **24.85%** |
| Multi-tumble spins paying only one distinct symbol throughout | **62.28%** |
| Paying boards with multiple symbol groups simultaneously | **2.60%** |
| Mean distinct regular symbols on an initial board | **9.81 / 10** |
| Mean initial symbol types with 5–7 copies | **0.088** |

Transition rates divide weighted transitions, not rounds. Multi-tumble metric divides weighted spins with at least two paying boards. New-symbol and overlap rates are not complements because a board can pay old and new groups together. Initial-board figures are averages across weighted spins and include deliberately balanced witness blanks; they do not alone isolate organic candidates.

Interpretation: the delivered Super experience is usually either a deliberately balanced blank board or a same-symbol chain. Very few boards pay two groups together. Surviving secondary groups being completed by later drops are not providing enough variety.

### Mechanism in current source
`gates_math.py:RandomSource.start_board/draw/refill` chooses one hot symbol. That same symbol is preferentially drawn on initial grids and refills. Super hot refresh is only 20% between ordinary cascades; refresh after a gate helps later chains but not the first three tumbles. Super proposal profiles select 72% or 88% explicit hot-symbol probability for 47% of proposals; baseline symbol draws can add further copies. These are **proposal parameters, not final delivered probabilities**.

`WitnessSource.refill` is stronger: a tail witness refills every removed slot with the same Guardian Mask until the third paying board. These deliberately monochrome legal chains can receive substantial optimizer weight.

## 2. Super one-win / blank-spin pattern — strongly confirmed

| Metric | Exact weighted probability / mean |
| --- | ---: |
| Exactly one paying free spin | **70.96%** |
| Exactly one paying spin and 14 blanks | **70.94%** |
| At least 90% of free-spin payout on one spin | **71.01%** |
| Zero paying free spins | **19.70%** |
| Zero or one paying free spin | **90.66%** |
| Mean paying free spins | **1.882** |
| Mean total free spins including extensions | **15.057** |
| Exactly 750× total | **31.57%** |
| One 750× free spin plus 14 blanks | **31.57%** |

Every weighted 750× outcome in this package follows the one-750×/14-blank pattern. Example book IDs: **50, 230**. More examples and full distribution in `super-v6.json`.

The distribution also has a major gap: only about **0.068%** of probability produces 2–9 paying free spins combined; much of the small remainder jumps to 10+ paying spins. This is not a smooth range of bonus experiences.

### Why specifically 750×?
Current tail witness reproduced deterministically (`generate_candidate('super',160)`, default seed):

1. Free spin 1: Guardian Mask pays 10× on each of three consecutive boards.
2. Gate gives additive 25×; the final multiplier applies to the entire spin's raw 30×.
3. **30× × 25 = 750×**.
4. Witness is no longer live after free spin 1. Remaining 14 boards are deliberately balanced to avoid pays.

This source reproduction is distinct from published ID 160: independent per-mode seeds/IDs need not match the default candidate seed. Stored published IDs above prove the actual delivered pattern separately.

`WitnessSource.start_board` explicitly restricts live tier witness action to spin 1. `balanced_board` constructs the later blank boards. `generate_candidate` inserts a tail witness at every tenth index. Hidden has a specialized multi-spin spread source; **Super and Normal still use the old one-spin witness**.

## 3. RTP correct does not mean experience healthy
Local lookup theoretical RTP is **96.1%** for BASE, FEATURE, BONUS and SUPER, using each mode's cost. This arithmetic check passes; pacing/diversity does not.

Super total payout atoms:

| Total base-bet payout | Probability |
| --- | ---: |
| 750× | 31.5698% |
| 0× | 19.6982% |
| 0.20× | 19.6642% |
| 0.25× | 19.6561% |
| 169.90× | 4.4650% |

**90.59%** of Super weight is on just the first four payout values. The three near-zero outcomes alone carry **59.02%**. The 750× atom supplies **82.13% of all expected Super payout**. 750× equals 2.5× the 300× purchase price; 0.20×/0.25× are tiny returns against that purchase, not 20%/25% of purchase cost.

Normal bonus also needs attention: **34.46%** is below 1× base-bet total, dominated by 0×/0.20×/0.25×. Its full spin-by-spin pacing was not audited here; do not infer Super's exact rates for Normal.

Root cause: weighting fits payout EV and tail controls, but does not constrain bonus pacing, symbol transitions, same-pattern concentration or paying-spin count. Aggregate exact-payout diversity validation currently targets **Hidden only** (`run.py`, `check_payout_diversity` call). Super can satisfy RTP while collapsing onto witness atoms.

## 4. Recommended changes — proposal only

### A. Fix candidate variety before reweighting
- Replace single-hot-symbol-only proposal with several pre-reveal symbol-composition families: single-group chains, switching chains, overlapping groups, simultaneous groups, and short/long chains.
- Generate some boards with fewer distinct symbol types, giving surviving secondary groups enough copies to become plausible later winners. Vary palette size and group counts; do not make every refill a guaranteed next pay.
- Refill candidates should support transitions into surviving secondary groups, alongside repeat wins and natural chain endings. Audit actual weighted outcomes rather than assuming refresh probability fixes the experience.
- Preserve legal gravity, sticky positions, no bonus Keys, 8+ pays, third-winning-board gates, full entry spins and authoritative event payout accounting. No after-reveal board edits, fake pays, player-adaptive steering or client-side payout smoothing.

### B. Replace Super/Normal one-spin tail witnesses
- Build diverse legal reward/payout paths over multiple paying spins, with varied win placement, repeated and switched symbols, and Super's full reward repertoire.
- Retain some one-big-hit bonuses as a volatility path, but prevent that family dominating ordinary outcomes.
- Coverage witnesses remain useful for cap/rare-event proof, not as the main economic support for routine 750× outcomes.

### C. Fit experience metrics as well as payout
- Add weighted gates for exact positive-payout atom mass and witness-family mass in **every bonus tier**, not only Hidden.
- Constrain/discuss distributions of paying spins, longest blank streak, first-paying-spin location, max-spin share, 2–9 paying-spin coverage and retrigger/reward variety.
- Add weighted tumble diagnostics: repeat/switch rate, unique paying symbols per chain, simultaneous pays, initial symbol composition and secondary-group completion rates.
- Set final bands after candidate feasibility and reference playtests. Do not promise a hit every spin or arbitrarily lower volatility; preserve the intended 96.1% RTP, costs, cap and approved rules while testing trade-offs.

### D. Regenerate → fit → validate → compare
Files: `gates_math.py` (proposal/witness families), `math_targets.py` (approved composition and experience targets), `run.py` / `weight_lookups.py` (constraints), new all-tier pacing/diversity tests and artifact audits.

Generate a **new** library, never overwrite shipped artifacts or reuse old weights for changed event paths. Validate exact payout accounting, paytable, cap, gate ordering, bonus reward persistence, tier mix, tail limits, CVaR and RTP. Re-run weighted feel audit on every mode/tier. Then conduct blind replay sessions comparing old/new libraries. For independent simulation-based sign-off, follow project minimum 1M directional / 20M+ final sampling and uncertainty reporting; this report is not that sign-off.

## Reproduction

```sh
# Run from web-sdk; reads sibling math-sdk, writes report only here.
../math-sdk/env/bin/python apps/the-gates/tools/audit-math-feel.py \
  ../math-sdk/games/0_0_the_gates/.library-v6-sdk-standard-cvar-500k-core-100k-bonuses-build-20260928T153953861637Z \
  --mode SUPER --output apps/the-gates/reports/math-feel-20261015/super-v6.json
```

Artifacts: `super-v6.json`, `lookup-atoms-v6.json`, `current-source-750-witness.json`, `source-hashes.json`. No tuning, regeneration, RGS wagering, branch switching or library mutation performed.
