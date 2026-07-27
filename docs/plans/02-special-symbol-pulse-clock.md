# 02 — The winning wild and scatter are driven by a clock that excludes wild and scatter

- **Covers:** N4 (3-agent, HIGH) · **Effort:** ~30 minutes · **Blocked by:** nothing
- **Files:** `apps/forest-gang/src/components/Board.svelte`

## Problem

`Board.svelte:463` feeds the win-state scale of the special symbols:

```svelte
{@const specialPop = isWin ? letterPulse : 1}
```

`specialPop` scales the winning SCATTER (`:474-475`) and WILD (`:490-491`). `letterPulse` (`:333`) is derived from `letterPulseT`, whose rAF clock (`:321-331`) only runs while `anyLetterWin` (`:309-319`) is true — and that predicate excludes exactly the symbols that consume it:

```js
const anyLetterWin = $derived(
    board.some((reel) => reel.reelState.symbols.some((sym) =>
        !HIGH_SYMBOLS_SET.has(sym.rawSymbol.name) &&
        sym.rawSymbol.name !== 'WILD' &&        // ← excluded
        sym.rawSymbol.name !== 'SCATTER' &&     // ← excluded
        isWinState(sym.symbolState),
    )),
);
```

So on any win containing no card letter — a **scatter bonus trigger**, a wild-only line, animals plus wilds — the clock never starts.

It is worse than simply not animating. `letterPulseT` is never reset, so it holds whatever value the previous letter win left it at, and `letterPulse = 1 + 0.1·(0.5 − 0.5·cos(letterPulseT·7.2))` evaluates to a frozen constant somewhere in **[1.0, 1.1]**. The emblem renders at a stale scale — up to 10% oversized — for the duration of the win. The scale depends on when some earlier, unrelated win's clock happened to stop, which is why it reads as random rather than as a missing animation.

The case that matters most is the bonus trigger: the loudest moment in the game, and the scatter is inert.

## Change

Two parts. The first is a deletion.

**(a) Fix the predicate.** The symbol set is five animals (`HIGH_SYMBOLS_SET`), five letters, `WILD`, and `SCATTER`. So `!HIGH_SYMBOLS_SET.has(name)` already means "letters, wild, or scatter" — precisely the set that consumes `letterPulse`. The two exclusion lines are the entire bug:

```diff
 const anyLetterWin = $derived(
     board.some((reel) => reel.reelState.symbols.some((sym) =>
         !HIGH_SYMBOLS_SET.has(sym.rawSymbol.name) &&
-        sym.rawSymbol.name !== 'WILD' &&
-        sym.rawSymbol.name !== 'SCATTER' &&
         isWinState(sym.symbolState),
     )),
 );
```

Rename it while you are there — `anyLetterWin` is no longer accurate. `anyPulsingWin` describes what it now gates. It has exactly one consumer (`:322`), so the rename is safe.

**(b) Stop the state leaking between wins.** Reset the accumulator when the clock stops, so a frozen value can never be read:

```diff
 $effect(() => {
-    if (!anyPulsingWin) return;
+    if (!anyPulsingWin) {
+        letterPulseT = 0;   // never let the next win read a stale phase
+        return;
+    }
     let raf = 0;
     const t0 = performance.now();
     ...
 });
```

At `letterPulseT = 0` the pulse evaluates to exactly 1.0, so a symbol is always at its authored size when not pulsing. Without (b), the bug's *visible* symptom is fixed for the wild/scatter case but the leak remains for any future consumer.

## Do not

Do not give the special symbols a second, separate clock. There is already one rAF loop for this, the pulse is shared, and a second clock would drift out of phase with the letters — two symbols pulsing at visibly different points in the same win. Widening the existing predicate is both smaller and more correct.

## Verify

1. **Bonus trigger:** spin to a scatter win with no letter win on the board. The scatter emblems should pulse smoothly between 1.0× and 1.1× at ~1.15 Hz for the duration of the win. Today they sit still.
2. **Stale-scale check (the regression this fixes):** trigger a letter win, let it finish, then trigger a scatter-only win. Before the fix the scatter renders at a constant, arbitrarily-sized scale; after, it pulses from 1.0.
3. **No change to letters:** a normal letter win should look exactly as it does today.
4. **Wild-only line:** confirm the wild pulses.
5. Confirm the clock still stops when no win is showing — the effect's cleanup (`cancelAnimationFrame`) is unchanged, and `letterPulseT` should read 0 at rest.

## Done when

Every symbol that reads `letterPulse` — letters, wild, scatter — animates on its own win, and `letterPulseT` is 0 whenever no pulsing win is on screen.
