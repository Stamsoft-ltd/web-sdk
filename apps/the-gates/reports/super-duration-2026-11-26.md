# Super duration fix — 2026-11-26

Supersedes the pending-Super note in the earlier Mystery Extreme report.

## Approved contract

Super30+ actually played free spins: >=500x base-bet return from free spins alone (entry credits excluded), at most1% of Super bonuses. Applied conditionally to Super in Base, Chance, Feature, direct Super, Mystery Bonus and Mystery Extreme. Interpret “most20+ rounds recoup” as >=80% of20+ Super bonuses returning >=300x from free spins alone, the direct Super buy cost. No threshold applies to Normal or Hidden.

The existing5% eligible retrigger target was infeasible on retained support with the new hard limits. Explicit Super-only eligible reward targets:44.5% add,15% multiply,25% Wild,15% extra,0.5% retrigger. Full Wild slots renormalize non-Wild kinds by0.75. Inner rewards and+15 retrigger size stay unchanged. Unsafe long/weak paths are omitted, not left at tiny positive weights. Retained events, boards and evaluated payouts stay unchanged; public IDs remapped and shared plan mappings preserved. No already-awarded spins are truncated.

All affected mode weights are refit to96.1% RTP, with the original cost/mix/paytable/cap and other reward/experience/risk gates retained. Mystery Extreme is then rebuilt from the corrected shared Super law, not the earlier uncorrected candidate.

## Frontend

Rules disclose30+/500x/<=1% and explicitly exclude entry credit. This guarantee must ship with matching math, never as a frontend-only patch against old books.394 frontend tests, TypeScript and build pass;22 shared resume regressions pass. The previous distinct +N×/×N signs, colours, badge shapes and motion, and both400x Mystery buys remain present.

Browser access was retried but is unavailable. No visual/device sign-off or live wagers/RGS calls. The existing dirty primary-checkout font changes remain untouched.

## Math source / package gates

Canonical math-sdk files:super_duration.py,build_super_duration.py,validate_super_duration.py,test_super_duration.py,SUPER-DURATION.md. Extreme builder detects and carries the Super contract. Independent published-file validation recomputes conditional duration/payback rates, final RTP, config/hash/ID alignment, reward/risk/experience gates and shared Super law; full mathematical replay and20M finite-LUT selections per mode are separate from independent fresh gameplay simulation.

The available input remains a local v14 pilot, not a confirmed deployed production package. Exact package metrics and final replay results are saved alongside the rebuilt Downloads candidate. Platform acceptance and strict quarter-unit compatibility remain open. No operator deployment is claimed.

## Measured final package

60858 published books independently mathematically replayed. All seven mode weighted RTPs96.1% within existing1e-8 tolerance; direct Super and Extreme exactly961/1000. Every Super route:P(30+)=44550001/4500000000 (~0.9900000222%); minimum30+ bonus-only return506.8x;P(return>=300x |20+)=80.1000000039%.857 unsafe paths excluded,2143 retained.15 math extension tests pass.20M finite-LUT draws per mode,140M total; exact laws, intervals and any sampling warnings recorded separately.
