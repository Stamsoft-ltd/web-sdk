# 09 — Turbo and skip do not shorten or cancel sequence holds

- **Covers:** R11 (3-agent; core OPEN, component-side improvements recorded) · **Effort:** ~1 day · **Blocked by:** nothing
- **Files:** `apps/forest-gang/src/game/bookEventHandlerMap.ts`, `src/components/DealItMultiplierPanel.svelte`, `GlobalMultiplier.svelte`, `packages/state-shared/src/stateBet.svelte.ts`

## Problem

**The handler is byte-identical to the audit baseline.** `git diff --stat b14a73e..HEAD -- apps/forest-gang/src/game/bookEventHandlerMap.ts` is empty. All six `waitForTimeout` sites are unchanged:

| line | hold | gating |
|---|---|---|
| `:111` | 600 ms inter-bonus-spin pause | semi-gated — skips **only** super-turbo |
| `:198` | 190 ms **per reel** in `expandedSymbolReveal` | none |
| `:209` | 650 ms | none |
| `:297` | 800 ms / 300 ms turbo | correctly gated |
| `:406` | 150 ms beat before coins | bonus-mode-gated, **not** turbo-gated |
| `:419` | 550 ms premium-win hold | correctly gated |

Net effect: an expanding-symbol spin holds roughly 1.4 s even in super-turbo. And because every site is a raw `waitForTimeout`, **a skip press during a hold is simply ignored** — there is nothing to cancel.

Component side: `DealItMultiplierPanel.svelte:134,137,139` hold 300/80/180 ms raw, `:142,148` race 900/260 ms against `skipReveal`; `GlobalMultiplier.svelte:108,120` hold 170/280 ms raw.

`stateBet.svelte.ts:57` returns `1.5` for **both** turbo and super-turbo, so the two modes are indistinguishable to every Spine:
```js
const timeScale = () => (stateBet.isSuperTurbo ? 1.5 : stateBet.isTurbo ? 1.5 : 1);
```

### What *did* improve this round — recorded so the fix is scoped honestly

- `SPIN_OPTIONS_ANTICIPATED_BOUGHT` (`constants.ts:116-121`) halves scatter-anticipation padding on bought-bonus spins (16 → 8). This is the largest wall-clock win in the area.
- DealIt's unskippable reveal phase went 640 → 560 ms (`320→300`, `120→80`, `200→180`), while one raced hold grew `240→260`.

That is 80 ms off one panel plus the bought-bonus padding. The structural problem is untouched.

## Change

1. **One hold helper**, replacing every raw `waitForTimeout` in animation sequences:
   ```ts
   // scales with turbo/super-turbo AND resolves early on stopButtonClick
   const hold = (ms: number) => interruptibleTimeout(ms * holdScale());
   ```
   - `holdScale()` reads the bet state: 1 for normal, and distinct factors for turbo and super-turbo.
   - The returned promise resolves on either the timeout or a `stopButtonClick`, so a skip press lands mid-hold. **Reuse `createInterruptible`** — `packages/utils-shared/interruptible.ts`, imported as `utils-shared/interruptible`, already used by `WinCountUpProvider`, `createReelForSpinning.svelte.ts:61`, `createReelForCascading`, and `OnHotkey`. Do not write a second mechanism.

   **Three properties of `createInterruptible` that decide whether this works.** Read the file before writing the helper; "reuse it" is not sufficient instruction on its own:

   1. **`pendingInterrupt` is sticky** — `interrupt()` sets it and only `clear()` resets it. Across one sequence that is the feature: a single stop press makes every *remaining* hold resolve immediately, without racing each one. But **if `clear()` is not called at the sequence boundary, every hold on every later spin resolves instantly** and the game sits in permanent turbo with no flag set — a worse bug than the one being fixed, and an easy way to write this. Use one interruptible per sequence and `clear()` on both entry and exit.
   2. **`add()` does not cancel the wrapped promise**, it stops awaiting it. Fine around a bare `waitForTimeout`; wrong the moment a hold wraps something with side effects at its end.
   3. **`add()` resolves `{ interrupted }`** and the caller must branch on it to skip the remaining beats. Ignore it and a skip press merely shortens each hold in turn, so the sequence still walks every step.
   4. **`interrupt()` does not empty `resolveList`** (Kimi's addition, verified). Already-settled resolvers stay in the list until `clear()`, so `getLength()` overcounts and a second `interrupt()` walks stale entries. This makes the `clear()` in property 1 mandatory rather than merely tidy.
2. **Define where the subscriber lives and what a sequence boundary is** — without this the plan is not implementable, and Sol is right that the sticky-state warning makes it load-bearing. `createEventEmitter` exports only `subscribeOnMount`, `broadcast` and `broadcastAsync` (`utils-event-emitter/src/createEventEmitter.ts:49-51`); `subscribeHandler`/`subscribeHandlerMap` are module-private, and `subscribeOnMount` wraps `onMount`. **`bookEventHandlerMap.ts` is a module object, not a mounted component, so it cannot subscribe to `stopButtonClick` at all.** So:
   - **One mounted subscriber**, e.g. a `SequenceHoldController` mounted once in `Game.svelte`, delegating to a module-level controller the handler map can reach.
   - **Sequence boundary = `playBet` entry and `finally`** in `game/utils.ts` — including throw recovery and resumed `createBonusSnapshot` playback. Per-handler entry/exit is too narrow if one press is meant to skip the remaining beats across the whole book.
   Without both pinned down, three implementers can produce three incompatible versions that all look like this plan: one interruptible per handler, one permanent global with stale state, or an illegal `onMount` call from module scope.
3. **Route all six handler sites** through it. `:297` and `:419` are already gated — converting them is still worthwhile so skip works, but their timing should not change.
4. **Route the component holds** through it too: `DealItMultiplierPanel:134,137,139` and `GlobalMultiplier:108,120`. Check with design whether DealIt's initial reveal is *deliberately* unskippable — Sol read it as intentional. If so, leave it raw and document why, rather than making it skippable by accident.
5. **Give super-turbo its own `timeScale`.** `stateBet.svelte.ts:57` is in a shared package: adding a distinct super-turbo factor changes behaviour for every game that reads it. Either agree the change globally or override per game.
6. **Delete the two `console.info` calls** at `bookEventHandlerMap.ts:137,230` while you are in the file — they fire on every All-In spin.

## Do not

- Do not share one interruptible across spins, and do not forget `clear()`. Property 1 above turns that into a permanent, invisible turbo mode. This is the single most likely way to get this refactor wrong.
- Do not scale holds by simply multiplying by `timeScale()`. That value is the *Spine* time scale and is currently 1.5 for both turbo modes — reusing it bakes in the very bug step 4 fixes.
- Do not make every hold skippable without checking design intent. Some beats exist so two events read as separate; collapsing them can make a sequence unreadable. The DealIt reveal is the specific case to ask about.
- Do not change `stateBet.svelte.ts` without checking sibling games.
- Do not assume Rev 3's line numbers. They are ~4 lines off the current file, and that discrepancy produced two wrong claims during the audit. Re-grep before editing.

## Verify

1. **Wall-clock per mode.** Time an expanding-symbol spin in normal, turbo and super-turbo. Super-turbo must be measurably faster than turbo — today they are identical.
2. **Skip actually skips.** Press stop during the 650 ms hold at `:209` and during the 190 ms-per-reel reveal. The sequence should advance immediately.
3. **Nothing collapses illegibly.** Watch a full expanding-symbol reveal and a Deal It multiplier reveal in each mode; distinct beats should still read as distinct.
4. **Bonus round end-to-end** in super-turbo, checking that no sequence deadlocks — an interruptible promise that never resolves is the main risk of this refactor. Note the known hazard that superseded `Tween.set()` promises never settle; do not build the helper on tween promises. (`createInterruptible` is generic, not tween-based, so it is safe on this point.)
5. **Sticky-interrupt regression, spanning two handlers:** press stop once during a hold in the *first* of two consecutive handlers; the remaining beats of both should skip. Then spin again **without** pressing anything — the new spin's holds must take their full time. If they run at skip speed, `clear()` is missing at the `playBet` boundary; if only the first handler skipped, the controller is scoped per-handler instead of per-sequence. Both failure modes look correct in a single-handler test.
6. **Sibling games** if `stateBet` changed.

## Done when

Super-turbo is measurably faster than turbo, a stop press during any animation hold advances the sequence, and no raw `waitForTimeout` remains in an animation path except ones documented as deliberately unskippable.
