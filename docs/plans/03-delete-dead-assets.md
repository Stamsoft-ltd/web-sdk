# 03 — 29.5 MiB of referenced art that no code path draws

- **Covers:** R10b (3-agent, HIGH) · **Effort:** ~2 hours · **Blocked by:** nothing
- **Files:** `apps/forest-gang/src/game/assets.ts`, `src/components/Board.svelte`, `src/components/ExpandedSymbolOverlay.svelte`, plus sheet files under `static/assets/`

## Problem

Eight keys in `assets.ts` are downloaded, decoded, wave-prioritised and drawn by nothing. Measured independently by all three agents, agreeing to three decimals:

| key | `assets.ts` | decoded | why dead |
|---|---|---:|---|
| `qWinAnim` | `:360` | 5.260 MiB | letter wins render a static tile |
| `kWinAnim` | `:359` | 4.413 MiB | ″ |
| `aWinAnim` | `:357` | 4.287 MiB | ″ |
| `tenWinAnim` | `:356` | 4.095 MiB | ″ |
| `jWinAnim` | `:358` | 2.369 MiB | ″ |
| `coins` (`SD2_Coin`) | `:315` | 5.354 MiB | fountain uses `pCoins` |
| `freeSpins` | `:303` | 3.488 MiB | no consumer |
| `progressBar` | `:299` | 0.257 MiB | LoadingScreen uses `loadingBarAnim` |
| | | **29.523 MiB** | |

**Why the letter sheets are dead.** `Board.svelte:508-518`:

```svelte
{:else if isWin && winAnimTextures[reelSymbol.rawSymbol.name]}
  {#if HIGH_SYMBOLS_SET.has(reelSymbol.rawSymbol.name)}
    <AnimatedSprite textures={winAnimTextures[...]} … />   ← animals only
  {:else}
    <!-- Low symbol (letter) win: no win-animation sheet -->
    <Sprite … width={symbolW * s * letterPulse} … />       ← static tile
  {/if}
```

The `:508` guard *passes* for T/A/J/K/Q because `winAnimTextures` (`:75-85`) builds entries for every key in `WIN_ANIM_KEY` — including the letters at `:63-67` — trimming them with `LETTER_WIN_TRIM_START/END` and ping-ponging them. The letters then fall into the inner `{:else}` and render a static sprite. The frames are loaded, trimmed, reversed and concatenated into arrays nothing draws.

The same five sheets are ping-ponged a **second** time by `ExpandedSymbolOverlay.svelte:77` (`lowAnimFrames`), which is referenced exactly once — at its own declaration. The template uses `LOW_EXP_TILE` (`:188`) instead.

**Why this is more than wasted memory.** `DEFER_WAVE_0` (`assets.ts:412-419`) is the set the loader deliberately races to the front of the queue so a first base-game win has its art ready (see the comment at `:408-411`). **25.778 MiB of that 72.719 MiB wave — 35.4% — is never rendered**, competing for bandwidth with the idle blinks and animated wild/scatter queued alongside it. On a slow connection the visible art arrives later *because* the invisible art was prioritised with it.

Deleting these drops the referenced sheet pool from 129.858 → **100.335 MiB** and `DEFER_WAVE_0` from 72.719 → **46.941 MiB**, with no visual change.

## Change

### ⚠️ This is not a pure deletion — read this first

Removing the letters from `WIN_ANIM_KEY` changes the `:508` guard's result. A winning letter would then fail `{:else if isWin && winAnimTextures[name]}`, skip `:551` (`HIGH_SYMBOLS_SET` — false for letters), and land in the final `{:else}` at `:629`, which renders a plain static tile **without `letterPulse`**. The winning-letter pulse would silently disappear.

So restructure the branch to state the two cases explicitly instead of relying on `winAnimTextures` having letter entries:

```diff
-{:else if isWin && winAnimTextures[reelSymbol.rawSymbol.name]}
-  {#if HIGH_SYMBOLS_SET.has(reelSymbol.rawSymbol.name)}
-    …animal win animation…
-  {:else}
-    …letter win: static pulsing tile…
-  {/if}
+{:else if isWin && HIGH_SYMBOLS_SET.has(reelSymbol.rawSymbol.name) && winAnimTextures[reelSymbol.rawSymbol.name]}
+  …animal win animation…
+{:else if isWin && LOW_SYMBOLS_SET.has(reelSymbol.rawSymbol.name)}
+  …letter win: static pulsing tile…
```

**The second branch must be gated on `LOW_SYMBOLS_SET`, not on a bare `isWin`.** A bare `{:else if isWin}` also catches a winning **animal** whose win sheet has not loaded yet — today that symbol falls through to `:551` and draws `key="animalBorder"` plus its idle, but under a bare catch-all it would render a static tile with **no frame**. The comment at `:551-556` records why that is not acceptable: the frame carries the opaque forest panel the bust sits on, and omitting it left "the transparent bust cutout floating on the bare board background" — a bug that shipped once already. Gating on the set keeps animals on their existing path and, as a bonus, gives `LOW_SYMBOLS_SET` a third consumer so step 2's "keep it" no longer rests on two incidental uses.

Two consequences worth knowing:

- A winning **WILD** with unloaded `wildFrames` still reaches `:629`, exactly as today. (`WIN_ANIM_KEY` at `:57-68` contains the five animals and `T/A/J/K/Q` only — **WILD is not in it** — so `winAnimTextures['WILD']` is never defined.) That is deliberate: zero behaviour change outside the letters is worth more than a marginal pre-load improvement.
- The letters get **strictly better**, not merely preserved. Today a winning letter renders with no pulse at all until the letter sheets load, because `winAnimTextures['T']` does not exist yet, `:508` fails and `:629` draws a plain tile. After the restructure the pulse is load-independent.

### Then, in order

1. **`assets.ts`** — delete the eight entries (`:299` `progressBar`, `:303` `freeSpins`, `:315` `coins`, `:356-360` the five letter sheets) and every list reference to them: `:386` (`'coins'`), `:393` (letters), `:400` (`'freeSpins'`), `:417` (letters), `:418` (`'coins'`).
2. **`Board.svelte`** — remove the letter entries from `WIN_ANIM_KEY` (`:63-67`). `LETTER_WIN_TRIM_START`/`_END` (`:73-74`) and the trim branch (`:79-81`) become dead — delete them too. **Keep `LOW_SYMBOLS_SET`** (`:28`); it is still used at `:221` and `:360`.
3. **`ExpandedSymbolOverlay.svelte`** — delete `LOW_WIN_ANIM_KEY` (`:70-76`) and `lowAnimFrames` (`:77-85`).
4. **Comments** — `ExpandedSymbolOverlay.svelte:69-71` claims letters "expand with their WIN animation too", contradicted by `:86-88` three lines later. Delete the first; it is the reason someone would re-add these assets. (Also plan 12.)
5. **Files on disk** — remove `static/assets/sprites/{tenWinAnim,aWinAnim,jWinAnim,kWinAnim,qWinAnim}/`, the `SD2_Coin` sheet, `freeSpins`, and `progressBar`. Two of these also carry declared/actual dimension mismatches (`freeSpins` declares 932×981, actual 928×979), which this deletion resolves.

## Do not

- Do not delete the `assets.ts` entries without step 2. `winAnimTextures` would then call `loadedAssets['tenWinAnim']`, get `undefined`, and fall to `?? []` — harmless, but you would be leaving the dead derivation in place, and the next person re-adds the assets to make it "work".
- Do not delete `LOW_SYMBOLS_SET`. After the restructure it gates the letter-win branch as well.
- Do not write the letter branch as a bare `{:else if isWin}`. See the boxed warning above — it silently drops the `animalBorder` frame from a winning animal whose sheet has not loaded.
- Do not ship this in the same commit as plan 07 (sheet re-export). Deleting sheets and resizing sheets in one change makes a visual regression impossible to bisect.
- Land this after plan 02 if you can — **recommended, not required.** The hunks are disjoint (02 touches `Board.svelte:309-333`, this touches `:57-85` and `:508-560`) and either order is correct; the reason to prefer 02 first is that it makes the pulse actually run for wild and scatter, so landing 03 first means reviewing a pulse you cannot see working. Kimi corrected an earlier "must" here.

## Verify

1. **Letter win still pulses.** Force a T/A/J/K/Q line win and confirm the tile still breathes 1.0 → 1.1 → 1.0. This is the one thing this change can plausibly break.
2. **Animal win unchanged.** Force an animal line win; the win animation should play as before.
3. **Animal win *before* its sheet loads** — the regression the `LOW_SYMBOLS_SET` gate exists to prevent. Throttle the network (or stall the win-sheet wave) and force an animal win: the brown `animalBorder` frame must still draw. A frameless bust on the bare board background means the branch was written as a bare `{:else if isWin}`.
4. **Expanded letter symbol unchanged** — should still show the clean `LOW_EXP_TILE` with its pulse.
5. **Loading screen and progress bar unchanged** (they use `loadingBarAnim`, not `progressBar`).
6. **Coin fountain unchanged** (uses `pCoins`).
7. **No *new* missing-asset warnings** through a base spin, a letter win, an animal win, a bonus trigger and a bonus round. The shared components log a fallback warning when a key is absent, so any of those is a real regression here. Do **not** assert a wholly clean console — PIXI's v7 `beginFill` deprecation group is present on every cold load until plan 12 §A2 lands, and this plan is not blocked on it (Sol's correction).
8. **Re-measure.** Referenced sheet pool should read ~100.335 MiB and `DEFER_WAVE_0` ~46.941 MiB.

## Done when

`assets.ts` has no reference to the eight keys, no component derives them, the sheet files are gone, the letter-win pulse is intact, and a re-scan reports ~100 MiB referenced.
