# Multiplier presentation correction

Scope: frontend only on feature/mcschmutzo-v1. No math source, paytable, book, lookup weights or stash changes.

## Implemented

- Base / Extra Chance / Feature Spin: a responsive soup-pot multiplier badge stays visible through Lock & Re-Spin and settlement. Paid-round/replay start resets it to 1x; the bonus's existing pot remains its own target.
- updateGlobalMult / lockRespinUpdate now animate qualifying soup boosts in all modes before win presentation, not just Free Games. The same landed soup reported by both events fires once. Exact individual soup steps are retained when they match the event's authoritative total.
- Line breakdown was previewed, then removed at user request. PaylineOverlay is restored to its original sauce-line-only display; the existing total-win display remains unchanged. Stew source multiplier and sidebar badge remain enabled. Final payout is never calculated or replaced client-side.
- Animation and game-info ladders share the math ladder, including 100x between 80x and 120x.
- English Re-Spin rules clarify final-board settlement once; other locale prose is unchanged. The shared ladder updates every locale's info ladder.
- Resume snapshots restore multiplier/pot, board, bonus mode and current-spin locks without replaying historical boosts; prior free-spin locks cannot leak onto a new blank spin.
- Base badge owns/cleans up its shot target without clearing a newly mounted bonus pot. PotShots teardown resolves its waiting volley rather than stranding playback.
- Stew source callout: added steps (+3 for BASE 40672) appear above its actual cell during the 1,000ms charge, then fade over 180ms as the identically labeled +3 blob flies to the multiplier. Sidebar still shows the resulting 4×. Each stew uses its own staggered clock; unknown source cells never receive a guessed label. No extra timer/emitter.
- Fixed PotShots' reactive clock self-subscription: initialization now reads a nonreactive start timestamp instead of its own just-written reactive state. Previously this repeatedly tore down the volley and resolved it before drawing; cleanup still cancels the RAF and releases playback on actual teardown.
- Base multiplier card has an explicit flight landing point centered above its top edge. Bonus-pot shots retain their soup-surface landing; the HTML card no longer hides arriving boosts under its opaque body.
- Desktop/tablet order notes remain mounted through Lock & Re-Spin and after multiplier increases (where the existing note fits wider than 70px). Shared wall-placement geometry reserves at least 18px between the notes and the multiplier card above them; normal bonus/modal/win-screen hiding remains unchanged. Portrait/landscape layouts are unchanged.

## Verification

- `node --test scripts/tests/mcschmutzo-multiplier.test.mjs`: 20 PASS. Real unmodified BASE book 40672 included as fixture; five-mode handler matrix, shot deduplication, 80→100→120 animation, authoritative payout formatting, new-round reset (including turbo/held-space path), resume, mobile placement, preserved desktop notes, above-card landing and source-callout timing coverage. PotShots also included in Svelte compilation checks.
- Svelte compilation: changed UI components pass through the installed Svelte compiler in regression tests; final Vite production build PASS.
- Full plain-tsc remains blocked by 23 baseline project/shared-component errors (Svelte export declarations, `$app`/ImportMeta environment types). Baseline and current diagnostics compared against HEAD using a virtual read-only compiler host: 23 vs 23, zero new diagnostics. Not claimed as a clean full typecheck.
- Browser: localhost-only mock RGS serving saved book 40672, replay mode, no wagers. Observed 4x while WIN still $0.00; then LINE 9 · $0.10 × 4 = $0.40 and HUD WIN $0.40. Replay completes and repeats without a lockup. Narrow desktop badge checked at 908x853; mobile placement has unit coverage, not physical-device sign-off. Bonus behavior has handler coverage, not a full visual bonus session.
- Evidence: boost-before-win.png; payout-check.png is the completed replay summary. line-calculation.png is historical evidence of the subsequently removed breakdown, not the current UI.
- Source-callout browser regression: replay 40672 shows +3 above the landed stew and on its flying blob; sidebar changes 1× → 4× on arrival. stew-source-4x.png records the previous requested label, now superseded by +3. These are frontend presentation changes only, not changes to the book result.
- `git diff --check`: PASS.

## Local tooling

Four stale ignored node_modules links repaired to already installed matching package versions for Vite, SvelteKit/plugin and Lingui. No install, dependency version or lockfile change.

Local preview: http://127.0.0.1:3012/
Local mock: http://localhost:8988/mcschmutzo (saved replay fixture only).
