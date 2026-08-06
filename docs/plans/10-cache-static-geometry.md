# 10 — Per-frame Graphics re-tessellation during the win presentation

- **Covers:** R12b (3-agent, MEDIUM) · **Effort:** ~half a day · **Blocked by:** nothing
- **Files:** `apps/forest-gang/src/components/VineRope.svelte`, `WinBoard.svelte`, `ExpandedSymbolOverlay.svelte`

## Problem

Three components rebuild vector geometry every frame, all of them during the win presentation — exactly when frame budget matters most.

**`VineRope.svelte:49-60`** — an `$effect` depending on `props.progress` calls `line.clear()` and restrokes the full travelled payline path, plus comet circles, every frame, per win line. Only the reveal *extent* actually changes per frame; the path itself is fixed for the duration of the win.

**`WinBoard.svelte:141-153`** — a `draw` callback rebuilds **14 concentric glow circles** every frame. `boardSize` (`:68`) is `maxBoardSize × accumulationScale × breatheScale`, so it changes for **two** independent reasons: `breatheScale` (a rAF clock in `Win.svelte`) *and* `accumulationScale`, which is derived from `tierProgress` — the live count-up multiplier. The rebuild therefore fires on every breathe frame *and* every count-up tick. The geometry is identical each time; only its scale changes.

**The mechanism, confirmed in `packages/pixi-svelte/src/lib/components/Graphics.svelte`:** the component's own `$effect` calls `graphics.clear()` and then `props.draw(graphics)`, and it re-runs whenever `props.draw` changes identity. An inline `draw={(g) => …}` closing over a reactive value is recreated whenever that value changes, so the closure's captured state *is* the effect's dependency set. Two consequences: the `g.clear()` calls inside these callbacks are **redundant** (the component already cleared), and the only way to stop the rebuild is to stop the closure capturing per-frame values.

**`ExpandedSymbolOverlay.svelte:182` and `:226`** — geometry rebuilt through the whole 460 ms expansion, verified by Kimi: `:178-186` is an `isMask` Graphics whose `draw` clears and re-fills a rect sized from the animating `h`, and `:222-230` rebuilds a `roundRect` from `h` the same way. Both genuinely re-tessellate every frame.

Two notes for whoever implements it:
- **`:182` is also one of the twelve forest-gang `beginFill`/`endFill` sites** in plan 12's A2 migration. The two changes touch the same lines — sequence them rather than merging them, or resolve both in one pass deliberately.
- **The mask animates on two independent axes**, and they are not the same kind of quantity. `px = anim.pop.current` is already a **dimensionless x scale** (~1 -> 1.08); `h` is **pixels**; and the mask's centre `cy` moves separately from its height. So a single `{x: px/ref, y: h/ref}` is dimensionally wrong — `px` must not be divided by a pixel reference. State it as independent operations: keep x scale `= px`, draw reference-height geometry centred on zero, translate by `cy`, and set y scale `= h / referenceHeight`. (Sol's correction to a note I added at Kimi's request; my `{x: px/ref, y: h/ref}` shorthand was wrong.)

Worth recording for the VineRope decision: a Graphics mask **is already working in this component**, filter-free. That is useful supporting evidence for option 1 below — but it is **not proof**, and the decision gate stays "prove it renders first". The documented failure was a mask inside a *filtered* container; VineRope has no filter now, but it also has different bounds and path parenting than this component. Sol's point, and she is right that the stronger prose was starting to erase the gate.

**Mechanism correction on the record:** Rev 3 described VineRope as rebuilding "extents and mask per frame under a `GlowFilter`". That was **false at ratification time** — `git show b14a73e:.../VineRope.svelte` contains the same "No mask and no filter on purpose" implementation as today, and the file is untouched by the post-audit commits. The comment at `:17-20` explains why: a Graphics mask inside a filtered container silently rendered nothing in pixi v8, so the reveal is done by drawing only the travelled path and faking the glow with layered strokes. The per-frame restroke is real; the mask and filter never existed. `docs/fable-animation-audit-v2.md:96` repeated the stale claim — do not carry it forward again.

## Change

The general shape: **draw geometry once, animate a transform.**

**`WinBoard` glow** — the cleanest win. Draw the 14 circles once at a reference radius, then scale by `boardSize / referenceSize`. The `draw` callback then closes over constants only and never re-runs.

⚠️ **Wrap the `Graphics` in its own `Container`; do not scale the existing one.** The `Container` at `:143` already carries `scale={pop.current}` and also holds `<Sprite key={shownKey} width={boardSize} height={boardSize}>` plus the amount text as siblings. Adding `boardSize / referenceSize` to *that* container would scale the sprite as well — and the sprite already sizes itself from `boardSize`, so it would be scaled twice and grow quadratically through the climb. The new scale belongs on a wrapper around the glow `Graphics` alone.

Also drop the `g.clear()` at `:145`: `Graphics.svelte` clears before every `draw`, so it is a duplicate.

**`VineRope`** — the path is fixed once the win's waypoints are known; only `revealX` moves. Options, in order of preference:
1. Draw the full path once, and reveal it by moving a rectangular mask. **But read the comment at `:17-20` first** — a Graphics mask inside a filtered container was the exact combination that rendered nothing here. There is no filter now, so a mask may be viable; prove it renders before committing to it.
2. If a mask is not viable, keep the per-frame restroke but hoist everything invariant out of the loop: the waypoint array, `minX`/`maxX`, and the stroke styles. `:55-56` currently computes these as `Math.min(...pts.map((p) => p.x))` and `Math.max(...pts.map((p) => p.x))` — **two array allocations plus two spread applications per frame, per win line**, for a value that cannot change while the win is on screen. That alone removes most of the per-frame allocation without touching the render approach.

**`ExpandedSymbolOverlay`** — same idea, animate transforms rather than geometry, but with the **three independent quantities** set out in the problem section: x scale `px` (already dimensionless), y scale `h / referenceHeight`, and translation `cy`. Unlike the `WinBoard` glow this is not a single uniform scale, and conflating `px` with a pixel reference is the specific mistake to avoid. Do the `beginFill`/`endFill` migration from plan 12 §A2 in the same visit or explicitly after it — `:182` is one of those call sites.

## Do not

- Do not reintroduce a Graphics mask inside a filtered container anywhere in this component. That is the documented pixi-v8 failure this file was written around, and the comment records real debugging time.
- Do not assume this is a large win on its own. It is a frame-budget improvement, not a correctness fix, and its benefit is partly masked today by the double render loop — measure after plan 05, or you will attribute plan 05's improvement to this work.
- Do not remove the layered-stroke glow in favour of a `GlowFilter`. That is a rendering change with its own cost and the current approach was chosen deliberately.

## Verify

1. **Profile before and after** during a multi-line win with the fountain running. Compare frame time; expect a modest improvement, larger on low-end mobile.
2. **Payline reveal is visually identical** — the sweep should look the same, including the comet head and the glow falloff.
3. **Multi-line wins** — several `VineRope` instances at once is the load case that matters.
4. **Tier board glow identical** across a full big-win climb, including tier crossings (coordinate with plan 06, which changes the tier transition). Watch the board **sprite** here specifically, not just the glow: if the new scale was put on the shared `Container` instead of a glow-only wrapper, the board grows quadratically and it is most visible near the top of a tier.
5. **Expanded symbol** expansion unchanged over its 460 ms.
6. Confirm `draw` callbacks no longer re-run per frame — instrument the callback with a counter and check it does not increment during a win. **This counter cannot see VineRope**, which drives a manually-created `PIXI.Graphics` from its own `$effect` rather than through the `Graphics` component's `draw` prop; it needs its own effect/restroke counter.

## Done when

For `WinBoard` and `ExpandedSymbolOverlay`: no `draw` callback re-runs per frame. **For VineRope the condition depends on which option you took** — option 1 (mask) means no per-frame restroke; option 2 explicitly keeps it, so its condition is instead *invariant arrays and spreads hoisted out of the effect, and a measured frame/allocation budget met*, counted with a VineRope-specific restroke counter. Sol caught that the old blanket "no per-frame Graphics work in all three" contradicted option 2 being offered at all. In both cases: visuals unchanged, and a profiled multi-line win shows lower frame time than before.
