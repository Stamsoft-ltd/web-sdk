# Stake review — findings from the reviewed build delta

- **Date:** 2026-07-27
- **Feedback:** 2 stars from the Stake review team. One reviewer comment: *"poor animations."*
- **Build reviewed:** `feature/forest-gang-v1` (origin `01c7f19`, local `1e1a2dd`) — as stated in `stake-review-poor-animations.md`.
- **Method:** diff the reviewed build against the current tree (`fd75e79`) and read the animation code as shipped in v1, independently of the existing audit trail.
- **Relationship to `stake-review-poor-animations.md`:** that document was verified against the tree *at* `fd75e79` and covers what still reproduces. This document covers the one thing it structurally could not see: an animation defect that exists **only in the reviewed build** and was fixed before its verification point.

---

## Headline

**Exactly one forest-gang commit sits between the reviewed build and the current tree: `fd75e79`. It fixes a genuinely broken feature animation. Everything else I found independently converges with the existing review doc.**

`git log origin/feature/forest-gang-v1..HEAD` contains a single commit — `fd75e79`, *"keep the expanded-animal animation from restarting every state change."* The reviewed build therefore shipped a version of the game in which the expanded-animal money clip — the centrepiece of the expanding-symbol feature — never actually played. A reviewer who triggered the feature even once saw a static pose where the game's biggest animation moment should be.

This does not replace the plan-13 findings in `stake-review-poor-animations.md` (reel strobe, ping-pong, decimated sheets). By screen time those still dominate. But it is the only finding anywhere in the two documents that is a hard defect rather than a quality judgement, and it is the only one already fixed.

---

## Finding 1 — the expanded-animal clip reads as frozen (reviewed build only)

**As shipped in v1** (`apps/forest-gang/src/components/ExpandedSymbolOverlay.svelte:80-84` at `origin/feature/forest-gang-v1`):

```ts
const animFrames = $derived.by(() => {
	const animKey = expanded ? EXPAND_ANIM_KEY[expanded.symbol] : undefined;
	if (!animKey) return [];
	const t = (context.stateApp.loadedAssets?.[animKey] ?? []) as Texture[];
	return t.length ? [...t, ...t.slice(1, -1).reverse()] : [];
});
```

Every recompute returns a **fresh array identity**. PIXI's `AnimatedSprite` guards texture reassignment by identity, so each reassignment is treated as new textures and forces `gotoAndStop(0)`. Recomputes fire on every reel append during the reveal and on every background `loadedAssets` merge — i.e. continuously during exactly the sequence the clip is supposed to play. Net effect: the clip restarts from frame 0 several times a second and **reads as frozen on its start pose**.

Affected clips — all five animal money sheets (`ExpandedSymbolOverlay.svelte:73-78` at v1): `rabbitMoney`, `bearMoney`, `foxMoney`, `wolfMoney`, `squirrelMoney`.

**Fix (already in tree, not in the reviewed build):** `fd75e79` memoizes the ping-pong array per `animKey` so the sprite keeps texture identity and the clip plays through.

**Why it matters for the review:** the expanding-symbol reveal is the moment a reviewer judges. It is lower exposure than reel spin (finding R7 in the companion doc) but far higher intent — a frozen centrepiece reads as "the animations are broken," not "the animations are cheap," and either phrasing lands as *"poor animations."*

**Status:** **merged 2026-07-27** via PR #21 (`6f914df`). Any resubmission must include it; the reviewed build must not be resubmitted as-is.

> **Correction.** When written, this section claimed the fix was "in tree" and "current `HEAD`". It was not. `fd75e79` sat on the sibling branch `fix/forest-gang-expanded-anim-restart`, forked from `01c7f19`, while `feature/forest-gang-v1` had moved on to `f9d994f` — so the branch that would have been resubmitted still carried the frozen clip. PR #21 merged it. The claim is now true; it was not true when made.

---

## Finding 2 — convergent: effective clip rates of 12–24 fps

Independent derivation from the v1 tree produced the same table as the companion doc's R4: with the ticker capped at 60 Hz (`SceneAnimationDriver.svelte`), `animationSpeed` 0.2–0.4 yields ~12–24 effective fps, and the priority is inverted — the deer presenter (0.2, `ExpandedSymbolPresenter.svelte:336`) and expanded animal (0.25) run slower than background idle (0.28, `Board.svelte:556`).

**Where this doc defers:** the companion doc's root-cause analysis stands — the sheets were decimated at export (35 unique frames in `*_win_v2`, down from 55–79 source frames), so raising `animationSpeed` plays the same gaps faster (Rev 3 Disproved #6). My initial instinct — "bump the presenter/intro clips to 0.36+" — is explicitly disproved and is withdrawn. Finding 2 is a symptom measurement, not a fix path.

## Finding 3 — convergent: frame-hold judder

Same derivation as the companion doc: at 60 Hz, speeds that don't divide the tick produce alternating hold patterns (0.36 → 50/50/33 ms; 0.40 → 50/33 ms), worst on the two most-watched sprites (win symbols, WILD). `SceneAnimationDriver.svelte:35` documents the 30 Hz variant of this and defers resolution to plan 13. No new information here; recorded for completeness.

## Finding 4 — retracted: multiple unsynchronized clocks

My initial list included "five independent clocks" (scene walk, Board pulse rAF, Win breathe rAF, overlay rAF, Svelte `Tween`s, `setTimeout` sequences — per the `sceneAnimation.ts` header) as a reviewer-visible coordination defect. The companion doc's scope analysis is more credible: the clock engineering is *provable from source but largely invisible to a player*, and phase drift between a pulse tween and a sprite clip is not something a two-word review comment plausibly encodes. Retracted as an explanation of the feedback; kept here so the retraction is on record.

---

## What this review missed (and the companion doc caught)

For the record, the items in `stake-review-poor-animations.md` that this independent pass did **not** find, all verified accurate after the fact:

1. **R7 — reels strobe on every spin.** `MOTION_BLUR_VELOCITY = 31` declared at `constants.ts:131`, referenced nowhere; no spin-state art, no blur pass. The doc's #1 by screen time.
2. **R5b — ping-pong reversed one-shots.** The `[...t, ...t.slice(1, -1).reverse()]` construction (`Board.svelte:73,80`, `ExpandedSymbolOverlay.svelte:93`) plays directional clips forward then backwards — "the wolf howls, then un-howls." I read this exact line while verifying `fd75e79` and flagged the identity bug but not the visual semantics. The doc's #2, and the only plan-13 item that is a ~2-line code fix.
3. **Two hard cuts** — splash carousel `setInterval` swap (`SplashIntro.svelte:45`) and Spine `setEmptyAnimation(trackIndex, 0)` with mix 0 (`SpineTrack.svelte:26,45`).
4. **The blocker** — source frame masters are not in the repo; plan 13 scope cannot be settled until that is confirmed with the art producer.

---

## Bottom line

| Source | Findings | Nature |
|---|---|---|
| This document | Frozen expanded-animal clip in the reviewed build | Defect — **merged**, PR #21 (`6f914df`) |
| Companion doc | Reel strobe, ping-pong, decimated sheets, hard cuts | Quality — **all still open**, plan 13 |

Since this document was written, two PRs have merged: **#21** (the frozen clip above) and **#22** (`3069dc1` — splash cross-fade, plus a newly-found ticker defect where `maxFPS = 60` capped the game at 58 fps and turned every dropped frame into a doubled one). Both are recorded in the companion doc's Status section. Neither touches the three findings that dominate screen time.

Two conditions for resubmission, in order:

1. Ship a build that includes PR #21 — done as of `6f914df`.
2. Accept that fixing the defect alone will not move the animation score. The score lives in the companion doc's list, and items 4–5 there are art orders, not code tickets.

---

*Verified against `git log origin/feature/forest-gang-v1..HEAD` (single commit `fd75e79`), the v1 source of `ExpandedSymbolOverlay.svelte`, and re-greps of every companion-doc claim (`constants.ts:131`, `SplashIntro.svelte:45`, `Board.svelte:73,80`, `ExpandedSymbolOverlay.svelte:93`, `SpineTrack.svelte:26,45`). Effective-fps math per PIXI's `AnimatedSprite` advance rule against the 60 Hz cap.*
