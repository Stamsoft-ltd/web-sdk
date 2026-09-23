# Hidden payout diversity — implementation and pilot

Implemented in `math-sdk/games/0_0_the_gates`. Existing books and live deployment
are unchanged; regenerate books AND fit fresh weights before publishing.

## Exact finite-library pilot (10k shared candidates per pool)

All 999 changed Hidden tail paths regenerated in memory and individually
replay-validated. Other candidate metadata reused. All six mode distributions
refit and checked for actual weighted RTP and the existing three tail thresholds.
This is not a 500k production run, Monte Carlo confidence estimate or certification.

| Conditional Hidden metric | Before | New pilot |
|---|---:|---:|
| Most common exact payout probability | 45.5571% | 0.416634% |
| Exactly 3,750x | 45.5571% | 0% |
| Mean gross payout | 4,708.90x | 4,708.90x |
| Median gross payout | 3,750x | 3,693x |
| Mean bonus gates | 1.9127 | 4.3310 |
| Median bonus gates | 1 | 4 |
| 3–5 gates | — | 90.6734% |

New pilot contains 1,228 distinct Hidden payout totals. Real gate events occur on
separate winning spins, each with two ordered rewards. Boards/cascades determine
payouts; no post-hoc credit jitter or fake UI gates. Genuine cap wins can end a
round before every scheduled spin/gate occurs.

Generation and artifact validation reject aggregate probability above 1% for
ANY exact Hidden payout (not merely any single book ID). A larger run or different
seed must pass independently; these pilot metrics are not promised for every run.

All six weighted RTPs = 96.1%. Mystery >=5,000x probability = 0.90% (limit 1%);
>=10,000x = 0.45% (limit 0.5%). Fitter first bounds the upper tail, then preserves
its weights while fitting the lower tail. Existing fixed rare anchors and
positive integer weights remain intact. Fixed a pre-existing integer residue
failure via same-band balanced transfers; payout values and limits unchanged.

28 tests pass: four Hidden, nine weight-fitter, fifteen contract tests. Other
Normal/Super concentration/effective-count warnings remain in this prototype;
this Hidden fix does not claim to resolve them. User must run full artifact and
Studio validation after generation. The RGS verifier is untouched.

## 500k command

From `math-sdk`, activate `env`, use a NEW output on a large mounted volume:

```sh
source env/bin/activate
OUT="/Volumes/YOUR_DRIVE/TheGates/library-500k-diverse"
python games/0_0_the_gates/run.py \
  --samples 500000 --workers 4 --batch 256 --seed 20260921 \
  --output "$OUT"

# After successful generation:
python games/0_0_the_gates/validate_gates_artifacts.py --library "$OUT"
python games/0_0_the_gates/audit_hidden_spread.py "$OUT"
```

Replace `YOUR_DRIVE` with an existing mounted volume. Current runner retains plain
books and source pools: 10k package ~15 GiB → 500k projection ~700+ GiB. Allow ~1 TiB
free as a planning buffer; actual size/RAM depend on generated paths. Local disk
had only ~29 GiB free; do not launch the large run there. No large run started.

`--samples` is PER SHARED POOL, not per published mode:

| Mode | Published records at --samples 500000 |
|---|---:|
| BASE | 2,500,000 |
| CHANCE | 2,500,000 |
| FEATURE | 500,000 |
| BONUS | 500,000 |
| SUPER | 500,000 |
| MYSTERY | 1,500,000 |

3 million unique source candidates → 8 million mode-book records. Exactly 500k
in each mode is not supported by this shared-pool packaging scheme. The direct
buys and natural modes share complete tier pools and normalized tier weights.

Full pilot metrics/fingerprints: `hidden-diversity-pilot-2026-09-23.json`.
Reproduce the read-only pilot from web-sdk:

```sh
PYTHONDONTWRITEBYTECODE=1 ../math-sdk/env/bin/python \
  apps/the-gates/tools/audit-hidden-diversity-pilot.py \
  ../math-sdk/games/0_0_the_gates /tmp/hidden-diversity-pilot.json
```
