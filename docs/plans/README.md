# Forest Gang — Animation Remediation Plans

One plan per item in the consensus order of attack from `docs/animation-audit-merged-with-rating-2.md` (Rev 1, three-agent rated, 2026-07-25).

- **Tree these plans were written against:** `feature/forest-gang-v1` @ `3cdde5b`
- **`file:line` references were checked against that commit, but treat them as approximate.** Review has already found ~3-line drift in several plan-06 cites that three separate passes had "verified" — the claim "every line was verified" was itself an overclaim of exactly the kind these plans criticise elsewhere. **Diff the claim, not the line number:** find the code by its content, and if the line disagrees, the line is wrong, not the finding.

## Plans

| # | Plan | Covers | Severity | Effort | Blocked by |
|---|---|---|---|---|---|
| [01](01-outro-first-entrance.md) | First bonus outro hard-pops | R13 | HIGH | ~5 min | — |
| [02](02-special-symbol-pulse-clock.md) | Wild/scatter pulse clock excludes wild/scatter | N4 | HIGH | ~30 min | — |
| [03](03-delete-dead-assets.md) | 29.5 MiB of referenced-but-never-drawn art | R10b | HIGH | ~2 h | — |
| [04](04-delete-dead-raf-loops.md) | Two per-frame loops with no consumer | N5 | MEDIUM | ~20 min | — |
| [05](05-single-ticker-owner.md) | Double render loop + per-win listener leak | R2, R3, N2, N3 | CRITICAL | ~1 d | 04 (recommended) |
| [06](06-win-payoff-choreography.md) | Linear count-up, tier collapse, MaxWin hard cut | R8, R9, R14 | HIGH | ~3 d + design | 05 |
| [07](07-resample-sheets-to-display-size.md) | Symbols upscaled 2.3–3.4× | N1 | HIGH | ~1 d | 03 |
| [08](08-velocity-continuous-reel-stop.md) | 3.65× velocity spike at reel stop | R6 | HIGH | ~half d | — |
| [09](09-interruptible-turbo-holds.md) | Turbo/skip dead time | R11 | MEDIUM | ~1 d | — |
| [10](10-cache-static-geometry.md) | Per-frame Graphics re-tessellation | R12b | MEDIUM | ~half d | — |
| [11](11-asset-residency-and-prewarm.md) | No demand unload, no upload prewarm | R10c | MEDIUM | ~1 d | 03, 07 |
| [12](12-hygiene-dead-code-comments.md) | Dead branches, tracked binaries, false comments | N6, N7, hygiene | LOW | ~half d | — |
| [13](13-art-reauthoring-and-motion.md) | Frame decimation, reversed one-shots, no reel blur | R4, R5b, R7 | HIGH | ~1–2 wk, art-led | 05, 07 |
| [14](14-animation-regression-coverage.md) | No deterministic animation tests | — | MEDIUM | ~2 d | 05 |

## Suggested sequencing

**Batch A — ship today, independently reviewable, no design input needed.** Plans 01, 02, 04, then 03. All are deletions or small predicate fixes; 01/02/04 touch disjoint code and can go in parallel. This closes two HIGH findings and reclaims 29.5 MiB.

**03 is recommended after 02, and the reason is review coherence, not correctness.** The hunks are disjoint — 02 touches `Board.svelte:309-333` (the derived predicate and its effect), 03 touches `:57-85` and the template branch at `:508-560` — and either order works. But 02 is what makes the pulse run for wild and scatter at all, so landing 03 first means reviewing a pulse you cannot see working. (An earlier revision of this README said "must"; Kimi correctly pushed back that there is no behavioural dependency in either direction.)

**Batch B — the structural fix.** Plan 05. Do not start it in the same change set as anything in Batch A, and read its sequencing warning before touching `autoStart`.

**Batch C — the quality work.** Plans 06, 07, 08. This is what decides whether a reviewer calls the game polished. 06 needs a design decision on the count curve; 07 needs an art re-export pass.

**Batch D — everything else.** 09, 10, 11, 12, 14 in any order. 13 is art-led and runs on its own timeline.

## Conventions used in every plan

- **Problem** — what is wrong, with verified `file:line`.
- **Change** — the concrete edit, with real code where it is short enough to state.
- **Do not** — the specific wrong turn that looks correct. Several of these were found only because a fix plan was reviewed before it was implemented.
- **Verify** — how to confirm it worked, and how to confirm nothing else broke.
- **Done when** — the observable end state.

Effort figures assume one developer already familiar with the codebase, and exclude review and QA.
