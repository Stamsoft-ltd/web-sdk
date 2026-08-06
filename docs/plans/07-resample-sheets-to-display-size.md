# 07 — Symbols are drawn 2.3–3.4× upscaled

- **Covers:** N1 (3-agent, HIGH) · **Effort:** ~1 day (mostly re-export and measurement) · **Blocked by:** plan 03
- **Files:** `apps/forest-gang/static/assets/sprites/**`, the generator scripts, `src/game/assets.ts`

## Problem

The payload work in the post-audit commits did not re-export sheets at a chosen target size. **Every sheet was scaled by exactly 0.5 in both axes:**

```
wolf_idle     2359×2160 → 1180×1080      frame 337×360 → 168×180
loading_bar   5992×560  → 2996×280       frame 856×80  → 428×40
```

The DPR cap was simultaneously *raised* to 2.

**Correction to an earlier framing of this plan.** It previously said "rendered size did not change" and that pre-shrink ratios were "essentially native (1.0–1.3×)". Both are unsupportable — Sol disproved them and Kimi co-signed. The same commits rewrote Board sizing and framing: baseline `b14a73e` had `boardScale = getBoardScale() * 0.81 * 1.27` (×1.0287) against today's `* 1.05`, `getBoardScale` was 1.4383 rather than 1.5354, and the idle bust zoom/mask machinery had no baseline counterpart at all — compare `Board.svelte:133` and `:162` against `git show b14a73e:…Board.svelte`, where nothing equivalent exists. Baseline target ratios were roughly **0.87–1.58×** — several sprites were *down*sampled.

(An earlier revision of this paragraph cited "zoom references went from 3 to 13". That count came from `grep 'ZOOM\|zoom'`, which is case-*sensitive* and silently dropped the six baseline `Zoom` lines. Reproducible counts are 9 → 14 lines, or 10 → 14 occurrences, with `grep -ci zoom`. Kimi caught it; the figure is removed rather than relabelled, because the `boardScale` formulas above establish the point without it.)

So the honest statement is: **current ratios of 2.3–3.4× are the product of source downsizing *combined with* the simultaneous target-size and bust-layout redesign**, not of the downsizing alone. The current-tree table below and the HIGH rating are unaffected; only the history is. This matters because whoever writes the re-export ticket will otherwise assume reverting the sheet sizes restores a good baseline. It does not — there was no clean baseline to restore.

**Layout chain** (derived by all three agents; this version is the one that survived review — it applies each sprite's own template formula rather than comparing against the whole cell):

```
mainLayout.scale      = min(1920/1422, 1080/800)                  = 1.350
availableCanvasHeight = max(412×1.350, 1080−76−150) = max(556.2, 854) = 854
getBoardScale()       = max(1, min(854/556.2, 1492/816.8))        = 1.5354
boardScale            = 1.5354 × 1.05                             = 1.6122
boardScaleX           = 1.6122 × 1.12 (H_SPREAD)                  = 1.8057
```
`<Board/>` sits inside `<MainContainer>`, which applies `scale={mainLayout.scale}` (`MainContainer.svelte:37-46`), so the scales compose.

**Measured upscale at 1920×1080, DPR 2:**

| sprite | source frame | target device px | upscale |
|---|---|---:|---:|
| wolf idle | 168×180 | ~504×536 | **3.00×** |
| WILD | 112×112 | ~385×346 | **3.09–3.43×** |
| SCATTER | 168×153 | ~459×418 | **2.73×** |
| wolf win v2 | 186×160 | ~435×372 | **2.34×** |


**It gets worse on better hardware.** `getBoardScale()` (`apps/forest-gang/src/game/stateGame.svelte.ts:159-167` — note the app's file, not `packages/state-shared`; two files share the name) grows with available canvas, so a larger monitor increases the upscale factor. This is the inverse of the usual "looks fine on my machine" failure — it looks *worst* on the best display, which is what an external reviewer is likely to be using.

**Note on a disproved mechanism:** `antialias: false` is *not* a contributing cause. It controls MSAA on geometry edges; bitmap magnification is governed by the texture sampler (`scaleMode`), which `antialias` does not touch. The texel shortage is sufficient on its own. Do not add MSAA back expecting it to help here.

## Change

Do **not** revert. 557.8 MiB of decoded sheets was untenable and halving a 5992 px loading bar was strictly correct. The defect is the *uniform* operator: right for the loading bar, wrong for a 337 px symbol.

1. **Compute the device-pixel target per sheet**, at the largest layout you intend to support well, at DPR 2. Note that `getBoardViewportPadding` (`stateGame.svelte.ts:130-141`) is **not** a constant — desktop returns `bottom: 118` on canvases under 640 px tall and `150` otherwise — so the chain must be evaluated at your largest supported canvas. Derive it on a laptop-sized window and every target comes out too small. Reuse the chain above; the per-sprite formulas are in `Board.svelte` (`symScale`, `winFit`, `idleFit`, bust zoom, `WILD_SIZE = 0.78` at `:343`, `SCATTER_SIZE = 0.72` at `:335`) and in `ExpandedSymbolOverlay` / `ExpandedSymbolPresenter` for the expanded art.
2. **Re-export each sheet at that size**, not at a fixed fraction. Roughly: board symbols need ~2× their CSS size; full-screen art (max-win plaque, backgrounds) is already fine at 1×; the loading bar stays halved.
3. **Keep every atlas ≤ 4096** in both dimensions. This is the constraint that forced the original halving of `loading_bar` and it must not regress — check every regenerated sheet.
4. **Re-measure the decoded total.** Expect it to rise from 155.1 MiB. Budget for that: plan 03 removes 29.5 MiB of dead sheets first, which is why it is a prerequisite — spend that headroom on resolution for art that is actually drawn.
5. **Bump the `?v=` cache-busters** in `assets.ts` for every regenerated sheet, or clients will serve stale art.

## Do not

- Do not resize sheets in the same commit as plan 03's deletions. Deleting and resizing together makes a visual regression impossible to bisect.
- Do not raise the DPR cap above 2 to compensate. That multiplies fragment cost across the whole canvas to fix a texel shortage in a few sheets.
- Do not assume the `?v=` query is cosmetic — an earlier memory scan silently dropped five sheets because `meta.image` carried a cache-buster and the file-existence check failed.
- Do not re-export blind. Two of the three agents got this scale chain wrong in different ways; measure against the template formula for each sprite, not the cell it sits in.

## Verify

1. **Per-sheet ratio table.** For each regenerated sheet, record source frame size against computed device-pixel target. Every board symbol should land at ≥ 1.0×; none should be below.
2. **Visual A/B at 1920×1080 and 2560×1440**, DPR 2, on the animals, WILD and SCATTER. Fur and edge detail should be visibly crisper. WILD is the worst case today and the clearest test.
3. **No atlas over 4096.** Script it across every sheet JSON; do not spot-check.
4. **Payload budget.** Compare blocking transfer size against the target the perf commits were hitting (`1763ced` reached 4.7 MB). If resolution pushes past budget, prefer trimming frame counts on ambient loops over reducing symbol resolution — the audit's R4 shows frame counts are already low, so this is a real trade to discuss, not an obvious call.
5. Re-run the decoded-memory scan and record the new totals in the audit doc.

## Done when

No board symbol is drawn upscaled at 1920×1080 / DPR 2, every atlas is ≤ 4096, and the blocking payload is within an agreed budget with the new numbers recorded.
