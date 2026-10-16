# V8 gate-driven 10k/mode package

**60,000 books generated and full independent event/weight/package validation PASS.** Not uploaded.

| Mode | Books | Exact weighted RTP | Normal gates | Super gates | Hidden gates |
|---|---:|---:|---:|---:|---:|
| BASE | 10000 | 96.100% | 4.0341 | 6.0600 | 8.0800 |
| CHANCE | 10000 | 96.100% | 4.0400 | 6.0600 | 8.0800 |
| FEATURE | 10000 | 96.100% | 3.9600 | 5.9400 | 7.9200 |
| BONUS | 10000 | 96.100% | 3.9860 | — | — |
| SUPER | 10000 | 96.100% | — | 6.0600 | — |
| MYSTERY | 10000 | 96.100% | 4.0038 | 6.0600 | 8.0800 |

## Rules preserved

3 winning cascades per gate; 15 starting free spins; all awarded extensions play unless max win ends the round; unchanged paytable, costs, scatter awards, cap, ordinary natural trigger/tier probabilities, 50% regular Base/Chance paying mass, prior experience and concentration guards.

## Weighted experience guarantees

Gate mean ±5% (fitted ±1%); eligible-state reward type 40/15/25/15/5 within ±1pp (fit ±0.5pp). Full sticky state renormalizes remaining types, rather than promising impossible 25% Wilds with no free slots. Inner odds checked separately with ±1pp tolerance (5× boost ±0.5pp). Minimum 80% 8–9-symbol clusters; gate multiplier uplift minimum 70% bonus payout. Normal is always additive-only.

FEATURE incidental bonuses now have an explicit minimum 0.001% conditional-support mass per tier, replacing prior effectively floor-only events. This keeps conditional reward constraints numerically meaningful; actual frequency appears below.

## Actual delivered reward-type odds (Wild eligible)

| Mode/tier | Add | Boost | Wild | Extra spin | Retrigger |
|---|---:|---:|---:|---:|---:|
| BASE/normal | 100.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% |
| BASE/super | 40.0000% | 15.5000% | 24.5000% | 14.5000% | 5.5000% |
| BASE/hidden | 40.5000% | 15.5000% | 24.5000% | 14.6177% | 4.8823% |
| CHANCE/normal | 100.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% |
| CHANCE/super | 40.2342% | 15.5000% | 24.5000% | 14.5000% | 5.2658% |
| CHANCE/hidden | 40.5000% | 15.5000% | 25.0000% | 14.5000% | 4.5000% |
| FEATURE/normal | 100.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% |
| FEATURE/super | 39.5000% | 15.0000% | 25.5000% | 15.5000% | 4.5000% |
| FEATURE/hidden | 39.5000% | 14.5000% | 25.5000% | 15.5000% | 5.0000% |
| BONUS/normal | 100.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% |
| SUPER/super | 40.3327% | 15.5000% | 24.5000% | 14.5000% | 5.1673% |
| MYSTERY/normal | 100.0000% | 0.0000% | 0.0000% | 0.0000% | 0.0000% |
| MYSTERY/super | 40.3054% | 15.5000% | 24.5000% | 14.5000% | 5.1946% |
| MYSTERY/hidden | 40.3964% | 15.5000% | 24.5000% | 14.5000% | 5.1036% |

## Tail / activity

Mystery worst-0.1% CVaR: **19863.4688×**, below unchanged 20,000× limit. Explicit excess-value constraint at η=18,000× plus retained higher-tail budgets used; thresholds alone did not protect CVaR in first fit.
Feature incidental bonus probability: **16.95051624%**.

## Validation / caveats

42 math unit tests + 15 contract tests pass. All 60k generated paths and post-weighting gates/rewards/RTP pass generation-side checks. Independent full event replay PASS across all 60,000 books, including final weighted reward/gate contracts. No live RGS calls/uploads. Weighted finite-library exactness is not fresh-generator convergence or release approval. Quarter-unit platform compatibility remains unresolved.

## Frontend

Generated smooth gold/navy/cyan branded coin via built-in image_gen; uses existing bounded win fountain (Veggie reference). Landing cards drop left-to-right, logo last; click drops cards down, brings HUD/board down and moves/scales logo to existing game target. Desktop/portrait settled states and live coin fountain visually checked. 259 frontend tests, typecheck/build and runtime asset dry-run pass. Full physical-device performance QA remains separate.

Proofs: `/tmp/gates-win-coin-live-20261015.png`, `/tmp/gates-entry-choreography-20261015.png`, `/tmp/gates-entry-portrait-20261015.png`.

## Reproducibility / storage

Installed source: `/Users/simeonhristov/Documents/GitHub/math-sdk/games/0_0_the_gates`. Package: `library-v8-gate-driven-10k-20261015/publish_files`. Package includes an exact `source_snapshot`, source hashes, publish hashes and fit diagnostics. Existing v7 libraries untouched. Full v8 candidate scratch remains in `/private/tmp/gates-v8-10k-20261015/mode_pools` for this run; final package avoids duplicating that scratch. Install `requirements-v8.txt` for SciPy 1.16.2, then run the documented 10k/mode command into a new output path. No uploads/commits performed.

Initial unconstrained tail count checks allowed Mystery CVaR 24,646.711×, above the 20,000× lock. Run failed closed. A 10,000× CVaR threshold certificate proved infeasible with the other constraints; the final 18,000× certificate is feasible and gives 19,863.469× worst-0.1% CVaR. No risk limits relaxed. Logs retained under `iterations`. A scratch recovery helper initially lacked the multiprocessing main guard; workers failed without publishing a final package. Corrected helper reused verified deterministic candidate pools and refit all weights. Final reproducible production command uses guarded `run.py`, not the scratch helper.
