# v7.1 scatter revision — 2026-10-15

Model: `the-gates-v7.1-scatter-diverse-paced-bonuses`.

## Rules

3 / 4 / 5+ Keys award 2× / 10× / 50× base bet, once per entry spin, including direct and Mystery purchase entries. This component is never multiplied by a Gate. It is included in base-game win and the whole-round 25,000× cap. No Keys or Key awards during Free Spins. Fields `spinWin.scatterCount` and `scatterAmount` expose the uncapped component; `amount` remains the capped authoritative credit. Frontend highlights landed Keys without recomputing or adding money.

All prior costs, ordinary paytable, bonus tier probabilities, 15 starting Free Spins, third-Cascade Gates, persistent rewards and v7 experience constraints retained. Existing books/weights unchanged: regeneration and refitting mandatory.

## Exact generated-library results

| Mode | Books | Weighted RTP | Identical transitions | One paid + 14 blank FS |
|---|---:|---:|---:|---:|
| BASE | 10,000 | 96.1000000000% | 0.00000032% | 0.00000200% |
| CHANCE | 10,000 | 96.1000000000% | 0.00031448% | 0.00000200% |
| FEATURE | 10,000 | 96.1000000000% | 0.00000002% | 0.00000000% |
| BONUS | 10,000 | 96.1000000000% | 0.00002893% | 0.00000200% |
| SUPER | 10,000 | 96.1000000000% | 0.00021208% | 0.00000200% |
| MYSTERY | 10,000 | 96.1000000000% | 0.00000097% | 0.00000020% |

Each mode and conditional bonus tier passed generation guards: repeats <15%, one paid +14 blanks <5%, positive atom caps and tail/CVaR limits. Extremely low repeats still warrant replay/playfeel review, not release approval.

## Verification

- Installed-source deterministic contract suite: 15/15 pass.
- New scatter tests: 3/3 pass; exercise bands, 6+ Keys, once-only settlement, no Gate multiplication, cap, zero bonus scatter awards, all mode adaptations and corrupted count/amount rejection.
- Frontend: 215/215 tests pass; typecheck/build pass.
- Full math discovery: 32/34 pass. Same two pre-existing recovery issues: stale Mystery precision expectation; missing provenance seed argument. Not silently changed.
- Independent artifact replay validation: PASS across all 60,000 books; see final-validation.log.

## Sampling caveat

1M and independent-seed 20M weighted draws per mode are finite-library diagnostics, not fresh candidate simulation or live RGS sign-off. Exact lookup enumeration is 96.1% per mode. A one-million BASE normal-approximation CI missed the target; the independent 20M BASE interval includes it. The 20M SUPER approximate interval lies narrowly above 96.1%, consistent with imperfect finite-sample CI coverage; do not claim all sample intervals pass or tune/select seeds to hide this. Full results and SE/CI retained in JSON.

## Packaging and outstanding work

The test library was generated in `/tmp/gates-v7-1-scatter-10k`. Scatter metadata was added to frontend configs afterward; config-only repackaging records source hashes and asserts books/lookups remain byte-identical. Full replay validator then checks exact Key table and settlement. Persistent validated test package: `/Users/simeonhristov/Documents/GitHub/math-sdk/games/0_0_the_gates/library-v7-1-scatter-10k-20261015`. Upload payload is its `publish_files` directory. Every published file was SHA-256 verified after copying.

No RGS upload, no wagering, no production release sign-off. Quarter-unit payouts remain intentional; live RGS increment compatibility remains unconfirmed. Deploy matching frontend and regenerated v7.1 books together. Any already-started old v7 run lacks these awards and must not be uploaded as v7.1.
