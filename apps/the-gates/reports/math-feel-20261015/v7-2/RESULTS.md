# v7.2 — regular paying mass 50%, 2026-10-15

User approved increasing regular non-trigger paying rounds from 30% to 50% in Base and Chance. Target dead rates: 49.75% and 49.25%. All six modes remain exactly 96.1% weighted RTP. Ordinary paytable, v7.1 scatter awards, costs, bonus frequency/tier mix, cap and experience/tail guards unchanged.

10,000 books per mode generated with seed 20261015. All book payloads are byte-identical to the locally validated v7.1 package: this revision changes outcome probabilities, not presentation or payout paths. Only Base/Chance lookup weights differ; four other mode lookups are byte-identical too. See identical-payloads.json. Full artifact replay validation PASS across all 60,000 books; see final-validation.log. New persistent package: `/Users/simeonhristov/Documents/GitHub/math-sdk/games/0_0_the_gates/library-v7-2-50pct-10k-20261015`. Every publish file hash verified after copy.

## Exact before/after

| Mode | Zero return | SD per paid stake | Net-profitable rounds |
|---|---:|---:|---:|
| BASE | 69.75% → 49.75% | 30.947004 → 30.930849 | 17.07% → 19.04% |
| CHANCE | 69.25% → 49.25% | 26.583490 → 26.575690 | 10.59% → 9.09% |

This is primarily an activity change, not a material volatility reduction. Bonus payout tails remain dominant. Positive returns below the paid mode cost are still net losses: Base partial-return losses rise from 11.97% to 28.86%; Chance from 18.56% to 39.29%. Chance net-profitable rounds actually decrease while blank rounds fall. Do not describe every positive return as profit or market this as low-volatility. Exact lookup comparison, rather than a short play session, establishes these rates.

## Validation / limitations

Contract tests 15/15, scatter tests 3/3, hit-rate locks 2/2. Frontend 217/217 plus typecheck/build pass. Full math suite retains the two previously documented recovery-test failures; not silently fixed. Weighted experience and tail/CVaR generation guards pass. Sampling is weighted finite-library draws, not fresh generated-spin simulation or production sign-off. Live RGS acceptance and quarter-unit compatibility remain unconfirmed. Existing packages are untouched; deploy matching regenerated lookups rather than editing an old upload in place.

## Portrait UI

Counter card height 28 → 48 stage units. Centered title/value spacing expanded; HUD rail moves down 28 units, wallet/bet/win cards down 12 units, keeping the whole 600-unit stage within bounds. Wisp/reward destinations follow the new Pixi positions. Screenshot: /tmp/gates-mobile-proof/portrait-taller-counters.png.
