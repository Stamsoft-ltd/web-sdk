# Safari spin stutter — root cause and fix plan

**Status:** root cause found, confirmed in real Safari, and fixed (2026-08-06) by culling
off-grid symbols in `Board.svelte` — see [Fix options](#fix-options). Option 2 remains available
if the residual per-frame cost ever matters.

**Branch investigated:** `feature/forest-gang-v1` @ `0d0c905`.

## Symptom

Safari stutters badly during reel spins. Chrome is fine on the same build. Measured in real
Safari (Apple GPU, hardware-accelerated) with no wins in play:

| | |
|---|---|
| frame rate | ~31 fps (should be 60) |
| time frozen | 13–28% of wall time |
| freeze shape | ~400ms, roughly one per spin |

## Root cause

**The board renders every symbol a spinning reel holds, including the ones scrolled off-grid,
and a single tween tick invalidates all of them at once.**

Three facts combine:

1. **`Board.svelte` renders all symbols, with no culling.**
   ```svelte
   {#each reel.reelState.symbols as reelSymbol, symbolIndex (symbolIndex)}
   ```
   A spinning reel's `symbols` array is `targetSymbols + padding + prevSymbols`
   (`createReelForSpinning.svelte.ts:123`). With `reelPaddingMultiplierNormal: 1.2` that is
   ~20–26 symbols per reel; `reelPaddingMultiplierAnticipated` is **10** (16 in some configs), so an
   anticipated reel holds ~70. Across 5 reels the board maintains **~130 symbol subtrees while
   ~30 are visible**. The board mask at `Board.svelte:415` merely *hides* the rest — they are still
   fully-live components with sprites, props, and effects.

2. **Every symbol's Y derives from one tween per reel.**
   ```ts
   // packages/utils-slots/src/createReelForSpinning.svelte.ts
   :66  const reelY = new Tween(defaultY);
   :22  const symbolY = () => reelY.current + (reelSymbol.symbolIndex + 0.5) * symbolHeight;
   ```
   So one `reelY.current` write invalidates every symbol on that reel.

3. **Svelte flushes the resulting effects synchronously in one microtask.**
   `svelte/motion`'s tween is driven by `svelte/internal/client/loop.js` → `run_tasks`, which runs
   on rAF. Each tick writes `reelY.current`, ~130 subtrees go dirty, and the flush blocks the main
   thread.

Safari's Timeline names it precisely — sorted by Total Time during spins:

```
Animation Frame 136,673 Fired   loop.js:9   230.9ms
Microtask Dispatched            —           230.4ms
Animation Frame 136,677 Fired   loop.js:9   224.8ms
Animation Frame 136,773 Fired   loop.js:9   221.3ms
```

Each animation frame is paired with a microtask of near-identical duration: the frame's cost *is*
the effect flush. No individual JS event exceeds ~4ms — it is one large flush, not a slow function.

**Why Safari only:** JSC is dramatically slower than V8 at this invalidate-and-flush pattern.
Chrome absorbs the same graph churn. This is an amplifier, not a different code path.

## Evidence it is the cause

Gating the each-block on visible rows only (`row >= -1 && row <= BOARD_DIMENSIONS.y`), measured
headlessly over 5 spins with the RGS book pinned so outcomes are identical:

| | baseline | culled |
|---|---|---|
| spin freezes | 22 | **2** |
| frozen ms | 3219 | **242** |
| effect runs | 273,392 | 110,610 |
| prop writes | 1,605,256 | 610,436 |

Confirmed by hand in real Safari via `?cullPadding=1`.

## Fix options

1. **Cull off-grid symbols** — **SHIPPED.** `Board.svelte`'s `isRowVisible()` gates the each-block
   on `row >= -2 && row <= BOARD_DIMENSIONS.y + 1`: the rows that can be even partially visible
   (`-1 .. y`, since a symbol one row out still has its near edge inside the mask), plus one
   fully-hidden row of slack on each side so a long frame can't pop a symbol in at the edge.
   ~130 live subtrees → ~40.

   Culling in reel *state* instead (keeping off-grid padding as raw data so it never becomes
   components) was considered and rejected: `reelState.symbols` would have to derive from
   `reelY.current`, so the array identity changes every frame and the keyed each-block re-diffs
   every frame — it trades the cost rather than removing it, unless the window is quantised, which
   is more machinery than the template guard for the same result. The one thing the state cull
   would additionally save is constructing the padding `$state` objects, which happens once per
   spin, not per frame.
2. **Hoist the scroll to a per-reel container** — since every symbol's Y is `reelY + constant`,
   wrap each reel's symbols in `<Container y={reelY}>` and give symbols static offsets. Then
   **5** props change per frame instead of ~130, and symbol y props stop changing entirely. This
   also helps the *visible* symbols, which option 1 does not.
   Touches every `y` usage in the each-block, plus the `row` calculation at `Board.svelte:450`
   that drives the expanded-symbol coverage check.
3. Reduce `reelPaddingMultiplierAnticipated` (10–16) — a cheap partial mitigation, changes feel.

Options 1 and 2 are complementary. 2 additionally helps the ~40 symbols that *are* visible, whose
`y` prop still changes every frame; revisit it only if measurement says the residual matters.

## Dead ends — disproven, do not re-litigate

Each was tested by ablation and failed:

- **`propsSyncEffect` reactive churn.** Splitting the monolithic effect into per-prop effects cut
  time inside the sync from ~2500ms to ~90ms per session (writes 1.77M → 615k) and freezes did not
  improve. Disabling the sync entirely barely moved it.
- **Safari's 16 vs Chrome's 32 `MAX_TEXTURE_IMAGE_UNITS`.** Pixi does flush a batch at that limit
  (`Batcher.js:180`), but batches never get near it: **52% of batches carry a single texture**, and
  3 of 46,499 hit the limit. Batching is not the constraint.
- **The per-cell bust mask** (`Board.svelte:598`). Removing it cut draw calls 46 → 4.8/frame and
  stencil ops 70 → 8/frame, and the stutter got **worse**. Not the cause.
- **GPU / draw calls / texture uploads generally.** Worst freezes consistently show
  `uploads=0, renderMs≈1` — during no-win spins total upload time is 118ms per session.

### Measurement trap

WebGL counters sampled inside a frame gap **accumulate over the whole gap**. A freeze showing
"196 draws" is ~6 frames' worth of normal work (31/frame), *not* a burst. Misreading this sent the
investigation at masks for a while. Compare per-frame averages, never per-gap totals.

## Separate, still open: win-presentation cost

Distinct from the spin problem, and real. During free spins with a win count-up:

```
541 uploads / 594MB / 13025ms   ← 21.7% of wall time in texImage2D
  512x256  HTMLCanvasElement x290
  1024x256 HTMLCanvasElement x166
```

Pixi `<Text>` rasterises to a canvas and re-uploads on every string change; on Safari that costs
~24ms per upload because canvases are GPU-backed and the upload forces a round trip. The count-up
(`Win.svelte:261`, plus `WinBoard` and `MaxWinScreen`) re-renders every frame. Removing wins takes
the session from 32 fps / 27.8% frozen to 51 fps / 13.1% frozen.

**Fix:** use `<BitmapText>` for text whose content changes during play. Four bitmap font sets
already ship unused in `static/assets/fonts/` (gold, silver, purple, goldBlur). The game currently
uses 30 `<Text>` and 1 `<BitmapText>`. Static labels can stay as `<Text>` — they upload once.

## How to reproduce the measurements

**Pin the outcome** so runs are comparable (run-to-run variance otherwise swings freeze counts
6–45× and makes A/Bs worthless):

This branch has no book-pinning hook, so add one locally (do not commit it) — an early return at
the top of `getRoundFromGeneratedBooks` in `mock-rgs/server.mjs`:

```js
const FORCE_BOOK_ID = process.env.FORCE_BOOK_ID ? Number(process.env.FORCE_BOOK_ID) : null;
// ...inside getRoundFromGeneratedBooks, before the weighted pick:
if (FORCE_BOOK_ID != null) return books.find((b) => b.id === FORCE_BOOK_ID);
```
```bash
FORCE_BOOK_ID=0 node mock-rgs/server.mjs    # BASE book 0 pays 0 — plain no-win spins
```
Books 0, 2, 3, 4, 5 all pay zero
(`apps/forest-gang/library/publish_files/lookUpTable_BASE_0.csv`). A forced BASE id does not carry
into a bought bonus.

**Measure in real Safari** — paste a console probe that wraps the WebGL prototypes (draw calls,
stencil ops, `texImage2D` count/bytes/time) and watches for rAF gaps >100ms. Wrapping the
*prototype* works even after the app has booted. Report per-frame averages plus the worst gaps.

**Attribute a block** with Safari's Web Inspector → Timelines → JavaScript & Events, sorted by
Total Time. That is what named `loop.js:9`; nothing else in the investigation did.

**Is the main thread blocked?** Run a `setInterval` heartbeat alongside the rAF monitor and compare
*total* stall time on each. Do not sample the heartbeat lag inside the rAF callback — queued timer
callbacks run first on unblock and it always reads small (this produced a wrong "thread alive"
verdict mid-investigation).

## Diagnostics

None remain in the tree — the investigation's ablation flags (`?cullPadding=1`, `?noCellMask=1`,
`?freezeCountUp=1`) and the `pixi-svelte` prop-sync probe (`?perPropSync=1`, `window.__pixiProbe`,
`window.__ablate`) were all reverted once the cause was confirmed. `packages/pixi-svelte/dist` is
gitignored but is what the app actually loads: rebuild it with `pnpm --filter pixi-svelte build`
after touching that package, or a stale instrumented build will silently stay in play.

## Unrelated bug spotted

Free spins emit an unhandled book event — reel multipliers are silently not applied:

```
[Error] Missing bookEventHandler in "bookEventHandlerMap" for:
  {index: 14, type: "updateReelMultipliers", multipliers: [2,1,2,1,2], changedReels: [0,2,4]}
```
