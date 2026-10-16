> **v7.2 (2026-10-15):** 50% regular paying rounds in Base/Chance. Zero-return rates 49.75% / 49.25%. Exact RTP stays 96.1%; bonus frequencies and scatter awards unchanged. More positive returns are not necessarily more net-profitable rounds; overall tail volatility remains high. Earlier version notes below are historical.

> **2026-10-15 v7.1:** Entry Key awards restored; all modes still target 96.1% RTP. See `V7-EXPERIENCE.md`. Earlier pilot/run descriptions below are historical, not current release approval.

> **Current generation command:** see [GENERATING.md](GENERATING.md).
> Use `--books-per-mode 500000` for exactly 500k distinct books per mode,
> compressed streaming, no retained plain copies. Old `--samples` examples below
> describe the legacy shared-pool scheme; their disk estimates no longer apply
> to the new per-mode streaming workflow.

# The Gates math generation

Generation sources and local weighted-library audits. Deterministic contract and
Hidden-spread tests have been run. A compressed 30k-per-mode pilot has been
generated; the full 500k-per-mode run and live Studio/RGS sign-off remain pending.

Sources: `The_Gates_Game_Explanation.docx` and `The_Gates_Paytable.xlsx`
(`Paytable!B5:E14`) from the supplied `The Gates slot_Project` folder. User
clarifications restore entry scatter payouts in v7.1 and set 96.1% RTP and 15
starting spins per tier. This handoff preserves the source documents unchanged.

## Confirmed product rules

- 6 columns x 5 rows, column-major boards, row zero at the top.
- Pay-anywhere: 8-9, 10-11 and 12+ matches. Each symbol pays independently;
  simultaneous groups are summed. Source paytable preserved exactly.
- Purple Gem remains **0.25x / 0.75x / 2x**. No payout rounding.
- v7.1: 3 / 4 / 5+ Keys pay **2× / 10× / 50× base bet**, once on the entry spin (including purchase entries). Separate from Gate multiplication and included in the 25,000× whole-round cap. This supersedes the earlier no-Key-payout rule. Existing v7 books must be regenerated/refitted; frontend code cannot retrofit winnings.
- Keys survive gravity/cascades; final entry board determines the bonus.
  3 = Normal, 4 = Super, 5+ = Hidden. All start with **15 free spins**.
- No Keys/scatters appear in bonus boards or refills. Extra spins and retriggers
  are awarded only through gate rewards, never through scatters.
- Every third winning grid opens a gate: the initial winning board counts as
  cascade 1. Multiple groups on the same board count as ONE winning cascade.
- Base gates add multipliers for that spin only. First additive reward replaces
  the neutral 1x; later additive rewards add. The final spin multiplier applies
  to the entire raw cascade sum, including wins before the gate opened.
- Bonus multipliers persist; each new spin resets the cascade meter only.
  Entry-spin multipliers do not carry into the bonus.
- Normal gates always add; Super gates give one reward; Hidden gates give two
  ordered rewards from the same pool. Duplicate reward types are allowed.
- Super/Hidden pool: additive multiplier, multiplier-of-multiplier, Sticky Wild,
  extra spin, retrigger. Reward effects are included explicitly in events.
- Buy bonuses include a **full entry spin with the appropriate Keys**, including
  any paying cascades and base-game gates. No jump straight into free spins.
- Global **25,000x base-bet** cap covers entry plus all bonus wins. Purchase cost
  does not multiply the cap. Once capped, no more grids/spins are played.
- Target **96.1%** per published paid mode.

| Mode | Cost in base bets | Behavior |
|---|---:|---|
| BASE | 1 | Standard paid spin |
| CHANCE | 2 | Exactly 3x BASE's probability for each natural bonus tier |
| FEATURE | 20 | At least one gate earned during the full paid entry spin |
| BONUS | 100 | Full three-Key entry spin then Normal |
| SUPER | 300 | Full four-Key entry spin then Super |
| MYSTERY | 400 | 65% Normal / 30% Super / 5% Hidden, including full entry spin |

Hidden has no direct-buy mode.

## Legacy shared-pool example

For the requested exact 500k per mode, use [GENERATING.md](GENERATING.md), not
the legacy `--samples` examples below.

From the `math-sdk` root, use the project's Python environment with `zstandard`
installed. No additional packages beyond the SDK environment are needed.

```bash
# Deterministic rules/replay/weighting tests; no generated artifacts needed.
python3 games/0_0_the_gates/validate_gates_contract.py

# Initial prototype. 10,000 candidates PER SHARED POOL, not per paid mode.
python3 games/0_0_the_gates/run.py --samples 10000 --workers 4

# Full streaming event/lookup/package validation, allowing exact quarter pays.
python3 games/0_0_the_gates/validate_gates_artifacts.py
```

`GATES_BOOKS_PER_MODE` (default 50,000) and `GATES_THREADS` provide defaults for
per-mode count and workers. Legacy `--samples` must be explicit; `GATES_SIMS` is
not used by this runner.
`--seed` defaults to `20260921`. Worker count and batch size do not change seeds
or output order. Keep the same Python version and source hashes for replayable
generation. The default writes `games/0_0_the_gates/library`.

Each of six shared pools contains `--samples` accepted candidates. Published
BASE and CHANCE each contain five pools; FEATURE/BONUS/SUPER one each, and
MYSTERY three. Thus 10,000 candidates/pool produces 160,000 published books
across six modes, with tier pools deliberately reused.

Output is staged before installation; a failed generation preserves its staging
directory for diagnosis and leaves the previous library unchanged. On repeat:

```bash
python3 games/0_0_the_gates/run.py --samples 100000 --workers 4 --replace
```

`--replace` archives the previous library beside it, rather than deleting it.
Keep enough disk for pools, uncompressed books, compressed books and backups.
The larger run is still a finite-book build, not independent simulation or
certification. Review actual diversity/risk metrics before choosing final size.

## Quarter-payout compatibility caveat

The user explicitly chose to try exact **0.25x** wins. They are encoded as `25`
in both `payoutMultiplier` and lookup CSV, where `100 = 1x`.

The unmodified upstream SDK's `utils/rgs_verification.py` enforces
`payout % 10 == 0`. It will reject an otherwise consistent 0.25x book. The live
Engine docs reviewed on 2026-09-21 describe integer payout encoding but do not
explicitly state this tenth-unit restriction. Backend acceptance is **unknown**.

```bash
# Intentionally expected to FAIL on a preserved 0.25x round:
python3 games/0_0_the_gates/validate_gates_artifacts.py --strict-sdk-increments

# Actual upstream verifier; unchanged, same known increment incompatibility:
PYTHONPATH=.:games/0_0_the_gates python3 -m utils.rgs_verification -g 0_0_the_gates
```

Do not weaken the upstream checker or silently round payouts to get a pass.
The default local validator reports how many books use non-tenth final payouts;
its PASS means **local contract consistency**, not platform approval. Confirm
with Engine support or an explicitly authorized test upload. This generator
does not upload anything.

- [Math file format](https://studio.engine.io/docs/math/math-file-format)
- [Math verification](https://studio.engine.io/docs/approval-guidelines/math-verification)
- [Upstream verifier](https://github.com/engineio/math-sdk/blob/main/utils/rgs_verification.py)

## Generation and weighting model

`gates_math.py` creates deterministic, legal complete rounds. Random proposals
use a weighted hot-symbol mixture to obtain sufficient cascade/gate diversity;
coverage witnesses provide losing, small, quarter, upper-tail, max and 1,000x
gate outcomes. Every witness still resolves real board wins, gravity and gate
rules: no payout is assigned independently of visible play.

Candidate frequencies are **not** live probabilities. `weight_lookups.py` fits
positive integer weights without changing events/payouts. Maximum-win and
1,000x-reward books retain minimum weight. Published CSVs define the live game.
Do not estimate live RTP/trigger frequency from unweighted candidate counts.

In legacy `--samples` mode, Normal/Super/Hidden each use one shared outcome
pool with identical normalized conditional weights across modes. In the current
`--books-per-mode` workflow, each mode instead gets distinct independent samples
and independently fitted weights. Mechanics, tier means and probability targets
stay the same; finite medians and exact payout distributions can differ. This
trade-off was explicitly approved for 500k distinct rounds per mode.

Conditional tier means include the full entry spin:

```text
Normal = 100 * 0.961 = 96.1x
Super  = 300 * 0.961 = 288.3x
Hidden = (400 * 0.961 - 0.65 * 96.1 - 0.30 * 288.3) / 0.05
       = 4,708.9x
```

**Economic risk:** the fixed Mystery price/mix makes Hidden extremely strong.
Fifteen starting spins do not guarantee acceptable volatility, concentration or
platform risk limits. Inspect the report and run platform risk review before
publication. Matching 96.1% alone is not a release criterion.

## Tunable decisions

All values live in `math_targets.py`, not scattered through rendering code.

- BASE trigger rate 1/400; CHANCE 3/400; natural tier split 85/14/1.
- v7.2 paying non-trigger group probability 50% in BASE and CHANCE (previously 30%). Their conditional
  non-trigger payout weighting differs to meet 96.1% at different costs while
  maintaining exactly triple bonus probability. Gate/board rules are identical.
- Keys land on initial entry reveals only and fall as regular survivors; new
  Keys are not introduced on refills. Bonus spins have no Keys. Extensions are
  gate rewards only. FEATURE can naturally trigger a bonus after earning its
  guaranteed entry gate; its actual trigger rate is reported, not promised.
- Sticky reward places one Wild, maximum three simultaneously. At the limit,
  the sticky reward is removed from the eligible reward pool and the remaining
  weights are renormalized. No invisible/no-op reward conversion.
- Wilds substitute independently for each regular symbol, never for Keys;
  no standalone all-Wild payout. They remain anchored and are never removed.
  Gravity resolves in segments above/below Wilds; symbols do not pass through.
- Extra Spin = +1 or +2; Retrigger = +3 or +5. There is no player-facing
  extension cap. Safety guards reject an entire candidate (recording why),
  never cut off an awarded free spin or fabricate a final loss.
- A multiplier-of-multiplier activates the multiplier even before an additive
  reward: neutral 1x, then x2, then +5 = 7x. Hidden rewards resolve in order.
- Winning-grid settlement resolves all rewards of its gate, then checks the
  overall cap. A capped round does not emit a fake losing refill.
- PRD high-volatility intent is retained as a tuning goal, not a measured claim.

## Files and output

- `math_targets.py`: locked economy/paytable and editable tuning settings.
- `gates_math.py`: deterministic round engine and legal coverage witnesses.
- `weight_lookups.py`: positive integer EV/group weighting.
- `run.py`: bounded-memory pool generation, shared-mode packaging, safe archives.
- `artifacts.py`: immutable replay adaptation, configurations and exact reports.
- `game_config.py`, `gamestate.py`: SDK adapters. Use `run.py` for publication;
  the generic SDK simulator does not implement shared-pool cross-mode weighting.
- `validate_gates_contract.py`: deterministic rules, cap, corruption and weight tests.
- `validate_gates_artifacts.py`: streaming independent event-state reconstruction,
  payout checks, exact group frequencies, cross-mode pool equality and hashes.
- `EVENT_CONTRACT.md`: UI animation/replay integration contract.

Generated `library/publish_files` contains one `index.json`, six
`books_<MODE>.jsonl.zst` files and six `lookUpTable_<MODE>_0.csv` files.
`library/books` contains matching plain JSONL for frontend integration.
`library/configs` contains FE/BE configs, source hashes, weighting diagnostics
and `simulation_report.json`. That report is explicitly **generated_not_validated**.
`library/pools` preserves original shared candidates and summary metadata.

Before handoff to UI: run the two local validators, inspect weighted diversity,
max-win/1,000x frequencies, quarter-payout compatibility, long-round rejection
counts and risk metrics. No certification or production-ready claim is made.

## MYSTERY 5,000x tail fix

The supplied Studio screen sets a 1% ceiling for `P(round payout >= 5,000x)`
using **base-bet multiples**, not the 400x Mystery price. The existing library
has 1.82901905%; the previous fit solved EV without this constraint.

The revised fitter budgets **0.90%** for Mystery, subtracts the actual weighted
Normal/Super contributions, then caps the shared Hidden pool accordingly.
It preserves every >=10,000x book's original fitted weight, the 25,000x/1,000x-gate
rare anchors, positive integer weights, all payouts and exact tier means.
Correction transfers stay within payout bands, so integerization cannot undo
the tail constraint. Infeasible pools fail loudly; no payouts are truncated.
The new Hidden weights remain identical conditional distributions across all
modes. Pricing, 65/30/5 mixture, 15 spins, quarter pays and mechanics are unchanged.

Read-only in-memory fit against the current 10,000-candidate pools:

| Metric | Before | Revised fit |
|---|---:|---:|
| Mystery weighted RTP | 96.1% | 96.1% |
| Mystery P(>=5,000x) | 1.82901905% | 0.90000000% |
| Mystery P(>=10,000x) | 0.39033145% | 0.39033145% |
| Mystery P(>=25,000x) | 0.00198095% | 0.00198095% |

These are exact finite-book weighting calculations, **not** a generated package,
Monte Carlo validation or a new Studio rating. Existing library files were not
modified. Hidden conditional effective book count falls from ~805 to ~375;
concentration/diversity still needs review. Full platform risk checks remain
required after publication, not just the one failing threshold.

To reuse existing outcomes without running gameplay generation again:

```bash
python3 games/0_0_the_gates/test_tail_weights.py
python3 games/0_0_the_gates/reweight_only.py
python3 games/0_0_the_gates/validate_gates_artifacts.py \
  --library games/0_0_the_gates/library-tailfix
```

Upload the complete `library-tailfix/publish_files` package, not the old `library`.
Its configs/checksums/reports are regenerated. Old output is untouched; existing
large books/pools are hard-linked where possible (copied otherwise). Treat book
files as immutable; removing an old directory is safe, editing a hard-linked book
in place is not. A new output directory is required on every reweight run.
Reweighting refuses changed gameplay-generator source, different starting spins,
source package hash mismatches and lookup/metadata payout-order mismatches.
It is not a substitute for full artifact validation.

Fresh `run.py` generation uses this fit automatically. Both package reporting
and artifact validation now reject the supplied 5k/10k/25k tail limit breaches.
The upstream RGS validator is unchanged.

## Historical Hidden pacing fix (2026-09-22; superseded below)

`audit_hidden_spread.py` joined 10,000 Hidden candidates with **published MYSTERY
lookup weights**, not equal candidate probabilities. Both local `library` and
`library-tailfix` showed the same result:

| Conditional on Hidden | Existing | Proposed, same weights |
|---|---:|---:|
| Exactly 1 paying FS + 14 blanks | 81.414349% | 0.023013% |
| Mean paying free spins | 3.63511108 | 8.19689091 |
| Mean round payout | 4,708.9x | 4,708.9x |
| 3,750x rounds with 1 win + 14 blanks | 100% | 0% |

Cause: tail witnesses always paid on FS1; optimization assigned them 81.39% of
Hidden probability. `SpreadHiddenTailSource` now creates 5–8 genuinely paying
spins for uncapped Hidden tail witnesses, spread across the 15 spins. First win
opens a gate with the original two rewards. Later paying boards use the persistent
multiplier. Pays/cascades are evaluated normally; no post-result credit splitting,
fake client wins, new scatter retriggers or paytable changes.

855 paths changed. The counterfactual regenerated every Hidden tail candidate
in memory, replay-validated each, and checked its total against the old lookup.
All totals were unchanged. Capped/rare/other-tier paths stay unchanged. The
weight fitter uses unchanged payout and rare-reward inputs, so the same seed,
count and fitter retain the payout distribution, RTP and payout-tail exposure.
This is exact finite-library evidence, **not** a fresh million-spin simulation,
certification, live telemetry or proof of which library is currently deployed.
Full before/after evidence: `hidden_spread_audit.json`.

Existing books were NOT rewritten. Reweight-only cannot change spin pacing.
User must regenerate and validate a separate package before replacing uploads:

```sh
# From math-sdk; activate the project's Python environment first.
python3 games/0_0_the_gates/test_hidden_spread.py
python3 games/0_0_the_gates/validate_gates_contract.py
python3 games/0_0_the_gates/audit_hidden_spread.py games/0_0_the_gates/library
python3 games/0_0_the_gates/audit_hidden_spread.py --proposed games/0_0_the_gates/library
python3 games/0_0_the_gates/run.py --samples 10000 --workers 4 --seed 20260921 \
  --output games/0_0_the_gates/library-spread
python3 games/0_0_the_gates/validate_gates_artifacts.py --library games/0_0_the_gates/library-spread
python3 games/0_0_the_gates/audit_hidden_spread.py games/0_0_the_gates/library-spread
```

The existing `utils/rgs_verification.py` user changes were not touched.

### Historical verification caveat (resolved 2026-09-23 below)

- 15 contract tests pass. Hidden-spread regression passes 90 seed/index cases,
  including deterministic replay, 5–8 hits, blank-streak bound, original rewards,
  exact total preservation and unchanged capped paths.
- Existing `test_tail_weights.py`: 4 pass, 1 fails
  (`test_cap_preserves_ev_upper_tail_and_records`, moment residual `-50000`).
  Both this test and `weight_lookups.py` exactly match the pre-change generation
  manifest hashes; neither was modified by the spread fix. Left unchanged rather
  than relax risk tolerances or silently alter weights.
- Separately, `build_weights` on all six existing pool metadata files reproduced
  every weight in all six published lookup CSVs exactly. The synthetic edge-case
  failure is still an open fitter regression, not a claimed all-tests pass.


## Hidden diversity + multiple gates (2026-09-23)

The old 5–8-spin spread still placed 45.56% of Hidden mass at exactly 3,750x and
81.43% on a single gate. The new `SpreadHiddenTailSource` builds 3–5 real gates
on separate winning spins (5–8 winning spins in 15). Symbol/pay tiers and each
of the two ordered additive rewards per gate vary. Awards are evaluated from
actual boards/cascades; no random number is added to the final payout. Genuine
25,000x cap events can end a round before all planned gates/spins occur.

**New payouts require NEW books and NEW weights.** Old `library` and uploads
remain unchanged. `reweight_only.py` refuses the changed generator; the old
`audit_hidden_spread.py --proposed` comparison is now rejected because applying
old weights to newly different payouts would be misleading.

Both generation and artifact validation now reject a package if **any exact
payout aggregates more than 1% of conditional Hidden probability**, summed over
all book IDs paying that amount. This is a fail-closed guard, not payout clipping.
96.1% mode RTP, equal natural/bought tier mean targets, 25,000x cap and tail
checks remain in force. Identical tier weights apply only to legacy shared pools. Hidden fitting first caps the mixed Mystery >=10,000x tail at
0.45%, then caps >=5,000x at 0.90% while preserving the upper-tail weights.
These are internal targets below the unchanged platform limits (0.5% and 1%). Regeneration is mandatory; do not copy old CSV weights.

### Current 500k-per-mode command

See [GENERATING.md](GENERATING.md): `--books-per-mode 500000` produces exactly
500k distinct records in each of six modes (3M total), with compressed-only
storage. Measured pilot size projects to ~13.18 GiB final; plan 35–40 GiB free
for scratch/headroom. Full-run size and validation remain unmeasured.

The old `--samples 500000` plan meant 500k **per shared pool**, resulting in
2.5M BASE, 2.5M CHANCE, 500k FEATURE, 500k BONUS, 500k SUPER and 1.5M MYSTERY
(8M published total). That is NOT the requested plan. The earlier 700+ GiB plain
storage estimate described the superseded runner, not compressed streaming.

For independent mode generation, inspect
`configs/weighting_report.json` → `<MODE>.hidden.payoutDiversity` wherever Hidden
is present. Each new seed/count must pass the 1% exact-payout guard and all
RTP/tail checks. Generation is not certification; run Studio validation too.

The upstream RGS validator and the user's quarter-unit payout handling are
untouched. The old synthetic tail-fitter edge-case is fixed: integer correction now allows
balanced, same-band transfers when a greedy residue requires temporarily
overshooting it. Transfers commit together only when positivity is preserved;
fixed rare books, band masses and actual payout values never change. Nine tail
fitter tests now pass, including the previously failing -50,000 moment residue.
A failed full fit must never be published.

### Weighted pilot evidence (10k per pool, not a 500k sign-off)

Regenerated and replay-validated all 999 changed Hidden tail candidates; refit
all six modes using unchanged metadata for unaffected candidates. Results:

| Conditional Hidden metric | Previous | New pilot |
|---|---:|---:|
| Largest exact payout probability | 45.5571% | 0.416634% |
| Exactly 3,750x | 45.5571% | 0% |
| Distinct payout values | — | 1,228 |
| Mean payout | 4,708.90x | 4,708.90x |
| Median payout | 3,750x | 3,693x |
| Mean gates | 1.9127 | 4.3310 |
| Median gates | 1 | 4 |
| 3–5 gates | — | 90.6734% |

All six weighted RTPs are exactly 96.1%; all three existing tail thresholds pass
in every mode. Mystery >=5,000x is 0.90%; >=10,000x is 0.45%. Four Hidden tests
(300 varied seed/index paths plus deterministic replay and rare-anchor checks),
15 contract tests and nine fitter tests pass. Full package generation, full
artifact validation and live Studio acceptance remain user-run steps.
Normal/Super prototype concentration/effective-book warnings still exist in the
10k pilot and were not silently changed to make this Hidden fix appear broader.
A larger candidate count is not proof those warnings disappear; review its reports.
