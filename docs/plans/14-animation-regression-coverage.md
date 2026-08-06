# 14 — No deterministic animation regression coverage

- **Covers:** regression coverage (3-agent: Sol raised, Opus concurred, Kimi verified the absence independently and signed in chat-2 Kimi — 4), plus `prefers-reduced-motion` · **Effort:** ~2 days · **Blocked by:** plan 05
- **Files:** new test infrastructure; `apps/forest-gang/src/stories/`, CI config

## Problem

There is no automated check that any animation still works. No deterministic animation stories, no timestamped visual snapshots, no frame-time budgets, no atlas validation, and no `prefers-reduced-motion` path anywhere in `src/` (0 matches).

The case for this plan is the audit history rather than an abstract argument:

- **R1** — every `AnimatedSprite` on the board froze on frame 0 whenever any prop changed. It shipped, and the response was `EnableSharedTicker`, a scene-walking rAF patch built to work around a bug nobody had located. A single test asserting "a looping sprite's `currentFrame` advances after a `y` write" would have caught it.
- **R13** — a one-character defect that makes the first bonus outro hard-pop. It has now survived two audits and a revision that edited the adjacent lines.
- **N4** — the winning scatter does not animate on a bonus trigger. Nobody noticed manually.
- **N5** — two rAF loops running with no consumer.
- **R9** — two of three agents wrote that it was partly fixed; `git diff` was empty.

Every one of these is mechanically detectable. The audit found them by reading; a human tester did not find them by playing, across multiple release passes.

## Change

**Scope: build sections 1–3 and stop there.** Sections 4–6 are recorded below as a backlog, not as part of this plan's ~2 days. The reasoning, which Kimi endorsed in review: sections 2 and 3 are the cheapest, catch the largest share of what has actually shipped, and are the only ones that stay valuable without maintenance. **They do not catch everything** — R13's cold-load case needs the deferred snapshots, and 20.4 MiB of the dead-sheet finding needs a render-usage assertion rather than a reference check. Sol was right to push back on the stronger claim an earlier revision made here. Six sections at 2 days means six shallow sections, and the shallow version of section 4 (screenshots) is the one that gets disabled first and then makes the coverage *look* better than it is. Do 1–3 properly; promote 4–6 only when someone asks for them with time attached.

### 1. Deterministic clock (prerequisite, and the reason this is blocked by plan 05)

Nothing here works while animation depends on wall-clock rAF. Plan 05 gives one ticker owner; expose a test hook that advances it by a fixed delta instead of by real time. Everything below assumes `advanceFrames(n)`.

**Scope this honestly — "one ticker owner" is not "one clock".** Plan 05 migrates exactly one private rAF (the scene walker). It does **not** migrate `Board`'s pulse rAF, `Win`'s breathe rAF, `ExpandedSymbolOverlay`'s rAF, Svelte `Tween`, or the sequence `setTimeout`s. So an `advanceFrames(n)` built only on the extracted scene `advance()` deterministically drives `AnimatedSprite` and Spine — and nothing else. Either state that limit (scene-sprite liveness only, which is enough for section 2's first four assertions) or go further: stop the app ticker, drive `app.ticker.update(t)` under fake time, and fake rAF plus timers. Sol raised this; do not let section 1's promise outrun what it controls.

Even scoped narrowly this is the most useful infrastructure in the plan — it makes every sprite-liveness bug reproducible.

### 2. Sprite-liveness assertions (highest value, lowest cost)

Plain unit-style tests, no screenshots:
- A looping `AnimatedSprite` advances `currentFrame` across `advanceFrames(n)`.
- **It keeps advancing after an unrelated prop write** (`y`, `alpha`, `width`). This is R1, directly.
- A textures swap does not leave the sprite stopped.
- **`app.ticker.count` is flat across N simulated wins.** This is R3, and it is *the* acceptance test for it. The property is public in PIXI v8 — `Ticker.mjs:188-198`, a readonly getter walking the `_head` linked list — so no instrumentation is needed. (Review raised a doubt that it did not exist; it does. If a future PIXI major removes it, wrap `ticker.add`/`remove` in the test hook and count there.)
- No rAF loop is scheduled while the base game is idle. This is R13's second half and N5.
- **N4: the pulse predicate includes wild and scatter.** Extract `anyPulsingWin` as a pure function of the board and assert it directly: true for a scatter-only win, true for a wild-only win, true for a letter win, false with no win. **Test the predicate, not the clock** — Sol's point, and it is the cheaper and more honest option: section 1's scene clock does not drive Board's rAF, so an assertion that `letterPulseT` *advances* would need faked rAF that sections 1–3 do not provide. The predicate is where the defect lives (the two deleted exclusions), so a predicate test fails when they come back. Without this assertion, adversarial check 3 has nothing to fail — none of the other section-2 tests can catch N4, since sprite liveness proves an `AnimatedSprite` *can* advance, not that Board's predicate fires.

These are cheap, fast, and catch the entire class of defect that has actually shipped.

### 3. Atlas validation (cheap, scriptable, already written)

Assert on every sheet JSON in CI:
- declared `meta.size` matches the actual image (this round found **three** mismatches: `freeSpins` 932×981 vs 928×979, `MM_pressanywhere`, `MM_Localisation_winsmall`);
- no atlas dimension exceeds 4096 (this round found `loading_bar` at 5992×560, since fixed);
- every `assets.ts` src path exists (150/150 currently pass);
- **every referenced key is *syntactically referenced* by at least one component.** Be precise about what this buys: it catches `coins`, `freeSpins` and `progressBar` — **3 of the 8 dead keys, 9.099 of the 29.523 MiB.** It does **not** catch the five letter sheets, because they *are* referenced: `Board.svelte:63-67` and `ExpandedSymbolOverlay.svelte:70-84` map them to keys and derive texture arrays from them. They are dead only because those arrays never reach a rendered branch — a control-flow property, not a reference property. Sol caught this; an earlier revision of this plan twice claimed the check "found 29.5 MiB", and that claim is withdrawn.
  To cover the other 20.424 MiB you need a **render-usage** assertion: record the atlas texture sources actually submitted under forced letter-win and expanded-letter fixtures, and compare against the loaded wave, with an allowlist for legitimately-preloaded-but-not-drawn assets. That is worth doing, but do not label it a lint rule — static control-flow analysis proving `lowAnimFrames` never reaches the template is not a cheap two-day check;
- decoded-memory total stays under an agreed budget, failing loudly when it moves;
- no `.py` (or other non-asset source) is tracked under any app's `static/` tree. **Write this one repo-wide**, not scoped to forest-gang: there are 40 such files today across four apps.

The scan scripts already exist in the audit work; this is mostly promoting them to CI.

---

## Backlog — not in this plan's scope

Recorded so the reasoning is not lost, but explicitly deferred per the scope note above.

### 4. Timestamped visual snapshots

With the deterministic clock, capture the canvas at fixed frame offsets through: base spin and settle, letter win, animal win, scatter trigger, tier crossings through a big win, MAX WIN entrance, free-spin intro, free-spin outro **from a cold load** (R13's exact case), and the transition wipe.

Compare against approved baselines with a small tolerance. Be honest about the maintenance cost — snapshots go stale on every intentional art change, and a suite nobody re-approves gets disabled. Scope it to the moments that have actually regressed.

### 5. Frame-time budgets

With the same fixture, assert frame time stays under budget during: a multi-line win with the fountain running, a tier crossing, and the expanded-symbol reveal. This is what would make plan 10's benefit measurable rather than asserted.

### 6. `prefers-reduced-motion`

Currently absent entirely. Decide the intended behaviour with design — likely: no idle loops, no breathing/pulse, instant count-up, cross-fades instead of pops, reels still spin but without anticipation padding. Then implement and test it. This is an accessibility gap, not a nice-to-have, and it is also the cheapest way to get a second rendering path that exercises the same state machine.

## Do not

- Do not start with screenshots. They are the most expensive and most brittle layer, and items 2 and 3 catch the largest share of what has shipped for the least cost. They do **not** catch all of it — see the scope note.
- Do not build any of it on wall-clock timing. A flaky animation test gets deleted, and then the coverage is worse than none because it was believed to exist.
- Do not assert exact pixel equality on the whole canvas. Tolerance and region-of-interest, or it will fail on GPU driver differences between dev and CI.
- Do not skip the unreferenced-key check because it feels like linting — but do not oversell it either. It covers 3 of the 8 dead keys (9.099 MiB); the letter sheets need the render-usage assertion in section 3.

## Verify

The tests are the verification, so validate them adversarially: **re-introduce each historical bug and confirm the suite fails.**

1. Revert the R1 fix in `AnimatedSprite.svelte` → sprite-liveness test must fail.
2. Set `FreeSpinOutro` `show` back to `$state(true)` → cold-load outro snapshot must fail.
3. Restore the wild/scatter exclusions in `anyLetterWin` → the N4 predicate test must fail.
4. Re-add `coins`, `freeSpins` or `progressBar` → the unreferenced-key check must fail. (Re-adding a *letter* sheet will **not** fail it — see section 3. That asymmetry is the check's real boundary, so test both directions and record which one passes for the wrong reason.)
5. Re-add the anonymous emitter `ticker.add` → listener-count test must fail.

A suite that passes on 1, 3, 4 and 5 is not testing anything. **Check 2 is exempt while section 4 is deferred** — it needs the cold-load snapshot, so it cannot fail under sections 1–3 and must not be counted as passing coverage. (Sol caught this contradiction; an earlier revision demanded all five.)

## Done when

Sections 1–3 exist, the reverted-bug checks that they cover (1, 3, 4, 5) all fail as expected, and the atlas and unused-key validations run in CI. Check 2 (the cold-load outro snapshot) belongs to deferred section 4 — until that ships, R13's regression is covered only by the "no rAF while idle" assertion in section 2, which is a partial guard and should be recorded as such rather than assumed complete.
