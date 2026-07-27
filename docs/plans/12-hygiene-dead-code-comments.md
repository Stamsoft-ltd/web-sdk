# 12 — Dead branches, tracked binaries, and comments that assert fixes the code lacks

- **Covers:** N6 (LOW), N7 (LOW), repo hygiene (all 3-agent) · **Effort:** ~half a day · **Blocked by:** nothing
- **Files:** many; all small

Group these into three commits — dead code, comments, tracked files — so each is trivially reviewable.

## A. Dead code (N6 and friends)

**`GlobalMultiplier.svelte:99`** — `const useFlatBoard = true;` is a constant, so every `else` branch is unreachable: the slide-out at `:106`, the slide-in at `:116-117`, and the `multiplierHand` sprite at `:177`. Consequently `groupX` (`:90`) can never leave 0, yet `:166` still reads `x={position.x + groupX.current}`. Dead with it: `SLIDE` (`:33`), `HAND_W`/`HAND_H` (`:26-27`).

`multiplierHand` is still declared at `assets.ts:69` and **still blocking-loaded** for a sprite that cannot render: 944×708 = **2.550 MiB decoded**, 61,878 bytes compressed, plus a 609,226-byte PNG duplicate also sitting in `static`. Remove the declaration and both files.

**Also dead, verified:**
- **`apps/forest-gang/src/components/SymbolWrap.svelte`** — zero references in forest-gang. **Mind the path:** the same filename exists in nine apps and is imported by `ReelSymbol.svelte` in eight of them (magnetic, cluster, price, scatter, magnetic-megachain, ways, lines, press_play_template). Only forest-gang's copy is dead; a `grep SymbolWrap` without the path will look like it is live.
- Unused `lodash` (`_`) and `sequence` imports in `bookEventHandlerMap.ts:1,5` — both used **zero** times in the file.
- `card-icon-swing` keyframes in `CustomBuyBonusModal.svelte`.
- `MOTION_BLUR_VELOCITY = 31` (`constants.ts:123`) — referenced nowhere, **and declared unused in eight apps** (`cluster`, `forest-gang`, `price`, `scatter`, `magnetic-megachain`, `ways`, `number-picker`, `lines`), with `press_play_template:94` carrying the original `SYMBOL_H * 0.7`. It is template boilerplate, so deleting it from forest-gang alone is cosmetic — either delete it across the board or leave it. **Leave this one** if plan 13 will use it, but see plan 13: the literal `31` does not match the template formula for forest-gang's `SYMBOL_H = 103` (which gives 72.1), so it must not be wired up as-is.
- `console.info` at `bookEventHandlerMap.ts:137,230` — fires on every All-In spin.
- `AmountFadeProvider`'s fade — children hardcode `alpha: 1` (2-agent: Kimi, Sol).
- Debug/cell-shading rectangles behind every symbol — remove or document; possibly deliberate, so ask before deleting.

### A2. PIXI v7 Graphics APIs still in use — and they break "the console is clean"

**20 call sites** use `beginFill`/`endFill`: 12 in forest-gang (`Board.svelte:430,432,578,585`, `ExpandedSymbolOverlay.svelte:183,185`, `ExpandedSymbolPresenter.svelte:310,312,347,354`, `BonusSymbolPanel.svelte:184,191`) and 8 in `apps/magnetic`.

In pixi 8.8.1 these are **deprecation shims, not removals** — `Graphics.mjs:312-332` still implements them, so nothing is broken today. Two reasons to migrate anyway:

1. **They log.** Each distinct message calls `deprecation()` (`utils/logging/deprecation.mjs`), which emits a collapsed `console.groupCollapsed` + stack. It is deduped by message (`warnings[message]` guard), so this is **once per session, not per frame** — no measurable runtime cost, and any claim otherwise is wrong. But it does mean **the console is never clean on a cold load.** Plans 03, 05 and 11 all use "the console stays clean" as an acceptance test; that criterion is unusable until this is fixed. Fixing it is the cheapest way to make three other plans verifiable.
2. `endFill()` is not a pure fill — `Graphics.mjs:325-332` calls `context.fill()` and then **also `context.stroke()`** if the current stroke style differs from the default. Harmless in the current call sites (each is a fresh `clear()`ed mask), but it is a surprise waiting for whoever adds a stroke nearby.

Mechanical migration: `beginFill(c, a); …shape…; endFill()` → `…shape…; fill({ color: c, alpha: a })`. They are slated for removal in v9, so this is a debt payment either way.

**Also redundant:** `Graphics.svelte`'s `$effect` calls `graphics.clear()` before every `props.draw(graphics)`, so every `g.clear()` / `graphics.clear()` at the top of a `draw` callback is a duplicate. Free deletion wherever you are already in the file.

## B. Comments that describe behaviour the code does not have (N7)

Eight verified contradictions. Rated as one consolidated LOW item, but this is the category most likely to cause the next reviewer to mark something closed when it is not — and the eighth entry below is no longer a hypothetical risk, because it demonstrably caused one.

| location | claims | reality |
|---|---|---|
| `EnableSharedTicker.svelte:10-11` | "no continuous render loop" | the app ticker runs (plan 05) |
| `EnableSharedTicker.svelte:66-73` | "~halves idle GPU cost", "caps the active path at ~60" | only one of two loops is throttled |
| `constants.ts:70-72` | reel "DECELERATES into the bounce point" | 2.8 > 2.3; 3.65× spike (plan 08) |
| `Board.svelte:465-466`, `:482` | scatter/wild "does one pop when it enters the win state" | the pop code is dead (plan 04) |
| `Board.svelte:223` | "Desktop keeps the tuned 1.1" | the next line returns `isLandscape ? 1.25 : 1.0` |
| `Board.svelte:289-290` | scatters "bob with excitement and shimmer faster" during anticipation | `anticZoom` is never read (plan 04) |
| `ExpandedSymbolOverlay.svelte:69-71` vs `:86-88` | letters "expand with their WIN animation too" / letters "show the CLEAN base tile … instead" | the second is true; dead `lowAnimFrames` sits between them |
| `constants.ts:44-45` | `// 150 × 5 = 750` and `// 105 × 4 = 420` | `SYMBOL_W = 121`, `SYMBOL_H = 103` → **605 × 412**. Wrong in the current tree *and* at `b14a73e` — both constants are unchanged, so these comments have never matched. |

The `ExpandedSymbolOverlay` pair is the worst for plan 03: it directly obscures the dead-sheet finding and is the most likely reason someone re-adds the five letter sheets after they are deleted.

**The `BOARD_SIZES` pair is the best-evidenced.** During review of these plans, Kimi set out to independently verify Sol's baseline `getBoardScale = 1.4383`, read `// 105 × 4 = 420`, derived `800/(420×1.35) = 1.4109`, and drafted a correction accusing Sol of hybridising the current height into the baseline. The correction survived two derivation passes before Kimi checked `SYMBOL_H` itself, found 103, and got Sol's 1.4383 exactly. **A stale arithmetic comment produced a false correction inside a three-agent review of a document about stale comments.** Fix these two first; they cost the most per character.

**Several of these resolve as a side effect of other plans** — 04 removes two, 05 removes two, 08 removes one. Fix the remaining ones (`Board.svelte:223`, the `ExpandedSymbolOverlay` pair, the `BOARD_SIZES` arithmetic) directly, and make correcting the comment part of the definition of done for each of those plans rather than a follow-up.

## C. Tracked files that should not be

- **13 `.pyc` files** — 6 under `apps/chicken-crossing/__pycache__/`, 7 under `tmp_fg_math/__pycache__/`. Untrack and add `__pycache__/` + `*.pyc` to `.gitignore`.
- **`Forest Gang_Project/`** — ~23 MB of `.wav`/`.docx`/design sources at repo root.
- **`old_assets/`** — ~15 MB, 38 files. (Chronology note for the record: these predate the `93aaa0a` purge, which removed only references.)
- **13 `.py` generator scripts, 67,543 bytes, under `apps/forest-gang/static/assets/**`** — inside the served tree, so they ship with the build (3-agent: Opus, Sol, Kimi — signed in chat-2 Kimi — 4). Move them to a `tools/` directory outside `static/`. They are worth keeping — they document how the sheets were produced, which plan 07 needs.
  **The same defect exists in three sibling games:** `git ls-files | grep "static/.*\.py$"` returns 40 repo-wide — 13 forest-gang, 9 each in `magnetic`, `magnetic-megachain`, `press_play_template`. Fixing only forest-gang leaves 27. Plan 14's build check should be written repo-wide for the same reason.
- **`transition.atlas`** declares `size:1219,1042`; `transition.webp` measures **1215×1038**, so Spine UVs sample against the wrong page size. One-line fix in the atlas.

## D. Small correctness items in the same neighbourhood

- **Uncleared timers:** `ExpandedSymbolOverlay.svelte:155` (`setTimeout(…, 460)`, no clear) and `TransitionAnimation.svelte:37` (failsafe) can fire after teardown.
- **`FadeContainer`** carries both an `$effect` and an `onMount` path doing overlapping work. Cleanup only — the original runtime claims against it (mount flash, double `oncomplete`, ignored `duration`) were disproved in round 1 and remain disproved. Simplify; do not "fix a bug".
- **No `prefers-reduced-motion` anywhere** — 0 matches in `src/`. This is an accessibility gap, not hygiene; it belongs in plan 14's scope but is listed here so it is not lost.

## Do not

- Do not delete `MOTION_BLUR_VELOCITY` without deciding plan 13's fate first.
- Do not delete the generator scripts — move them. Plan 07 needs them to re-export sheets.
- Do not remove the debug rectangles without asking; they may be intentional cell shading.
- Do not fix comments by deleting them. A comment explaining *why* (like `VineRope.svelte:17-20`'s mask/filter warning) is load-bearing; the problem is comments that assert a behaviour. Correct the claim, keep the reasoning.
- Do not bundle C with A or B. Untracking 38 MB produces a diff nobody can read alongside a logic change.

## Verify

1. `pnpm svelte-check` stays at zero errors (it was zeroed in `86c0237`).
2. Multiplier panel renders and animates identically after the `useFlatBoard` cleanup — the reachable path (fade plus `groupScale` under `backOut`) must be untouched.
3. No missing-asset warnings after removing `multiplierHand`.
4. `git ls-files | grep -c '\.pyc'` returns 0; repo size drops by ~38 MB.
5. Build output no longer contains `.py` files — check all four apps, not just forest-gang.
6. Transition wipe renders correctly after the atlas page-size fix — this one is worth eyes on, since UV changes can be subtle.

## Done when

`svelte-check` is clean, no dead component or asset remains, no comment in the touched files asserts behaviour the code does not implement, and the repo carries no build artefacts or design sources.
