# The Gates — weighted bonus audit (2026-09-23)

Exact enumeration of 160,000 mode-book records in the local `math-sdk/games/0_0_the_gates/library/publish_files` artifacts generated September 22. This is the full lookup-weighted distribution, not Monte Carlo, not live telemetry, and not proof these artifacts are deployed.

Units: gross multiples of base bet. Round payouts include the triggering/entry spin. Natural comparisons condition on a bonus being triggered in BASE or CHANCE, excluding prior spins spent finding it. Weighted median = smallest payout with cumulative probability ≥ 50%.

## Hidden pacing

- Mean gates: 1.9127; median: 1.
- Exactly one gate: 81.4272%; at least three: 18.0919%.
- Mean winning free spins: 8.1969; median: 7.
- 5–8 winning free spins: 81.3947%; just one: 0.0234%.
- Exact 3,750× outcome: 45.5571%.

Cause: `SpreadHiddenTailSource` distributes payouts over 5–8 winning spins, but sets only its first paying spin as `gate_spin`. Its inherited refill produces three cascades only on that spin. These paths have 81.39148% conditional Hidden probability, and all have exactly one bonus gate. The previous payout-spread fix did not increase gate count.

## Hidden payout distribution

| Gross round payout | Probability |
|---|---:|
| 0× | 0.011365% |
| 0.01× to <100× | 0.072236% |
| 100.00× to <500× | 0.044811% |
| 500.00× to <1,000× | 0.196386% |
| 1,000.00× to <2,500× | 6.723751% |
| 2,500.00× to <5,000× | 75.036682% |
| 5,000.00× to <10,000× | 10.159738% |
| 10,000.00× to <25,000× | 7.746152% |
| 25,000× cap | 0.008879% |

## Bought vs natural: complete triggered round

| Tier | Bought mean | Bought median | Natural mean | Natural median |
|---|---:|---:|---:|---:|
| Normal | 96.10× | 82.60× | 96.10× | 82.60× |
| Super | 288.30× | 214.55× | 288.30× | 214.55× |
| Hidden | 4,708.90× | 3,750.00× | 4,708.90× | 3,750.00× |
| Mixed: Mystery / natural bonus | 384.40× | 107.35× | 169.14× | 91.80× |

Hidden bought means conditional on Mystery selecting Hidden, not all Mystery buys. Same-tier pool IDs, normalized weights and payout/pacing metrics match exactly across natural BASE and corresponding purchased modes. Mystery tier mix is 65/30/5%; natural bonus mix is 85/14/1%, hence the different mixed averages/medians.

## Free-spins-only payouts (entry spin excluded)

| Tier | Bought and natural mean | Bought and natural median |
|---|---:|---:|
| Normal | 92.3445× | 79.00× |
| Super | 283.5960× | 214.55× |
| Hidden | 4,707.8441× | 3,750.00× |

## Paid mode totals (all rounds, not bonus-conditioned)

| Mode | Cost | Mean payout | Median payout | Lookup RTP |
|---|---:|---:|---:|---:|
| BASE | 1× | 0.961× | 0.00× | 96.1000% |
| CHANCE | 2× | 1.922× | 0.00× | 96.1000% |
| FEATURE | 20× | 19.220× | 15.00× | 96.1000% |
| BONUS | 100× | 96.100× | 82.60× | 96.1000% |
| SUPER | 300× | 288.300× | 214.55× | 96.1000% |
| MYSTERY | 400× | 384.400× | 107.35× | 96.1000% |

## Proposed next step — not implemented

Target 3–5 genuine gate openings in the dominant Hidden paths, distributed across different free spins, with smaller staged multiplier rewards. Preserve exact book totals/weights where legal path construction permits; otherwise re-fit weights and revalidate 96.1% RTP, tier mixes, 25,000× cap and existing tail limits. Do not add fake visual gates unsupported by math events. Low-paying and cap-ending rounds require exceptions; 3–5 is a proposed typical range, not a guarantee.

No math, generated books, lookup weights or UI changed in this audit. Generator source hashes (`gates_math.py`, `math_targets.py`, `weight_lookups.py`) match the generation manifest. Published lookup/book payouts and sum of actual spin awards were checked for every record. Every weight is positive and every lookup record matched one book. All six lookup RTPs are 96.1%; existing manifest still labels the artifacts generated_not_validated, so this is not release sign-off.

Full metrics, quantiles, histograms and input SHA-256 fingerprints: `bonus-distribution-2026-09-23.json`.

Reproduce from repository root:
```sh
python3 apps/the-gates/tools/audit-bonus-distribution.py \
  ../math-sdk/games/0_0_the_gates/library/publish_files \
  /tmp/gates-bonus-audit.json
```
