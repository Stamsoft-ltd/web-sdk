# 11 — No demand-based residency, no GPU upload warm-up

- **Covers:** R10c (3-agent, MEDIUM) · **Effort:** ~1 day · **Blocked by:** plans 03 and 07
- **Files:** `apps/forest-gang/src/game/assets.ts`, `packages/pixi-svelte/src/lib/components/AssetsLoader.svelte`

## Problem

Two separate gaps.

**Everything loaded stays loaded.** All deferred waves are streamed and retained for the session; there is no feature-demand load or unload. After plan 03 the referenced sheet pool is ~100.335 MiB decoded, before static textures, render targets, Spine pages, and duplicate CPU-side decode. Bonus-only art (`DEFER_WAVE_2`: transition, deer presenter, bonus backgrounds, the five money clips) is resident for the whole session even for a player who never triggers a bonus.

**No upload warm-up.** `grep -rn 'renderer.prepare'` returns nothing. A texture's first GPU upload happens on first draw, which for wave-1 and wave-2 art means mid-spin or mid-presentation — a stall exactly when a new animation appears. This matters less than it did at 483.8 MiB, but it is still the first frame of every newly-arrived animation.

### On the blocking-pass figure

**Do not quote a blocking-residency number from the audit.** The asset map contains **142 entries pointing at only 115 unique URLs**: 22 URLs are shared by more than one key, 49 keys participate in that sharing, and **27 key→URL mappings are therefore redundant**. PIXI caches by source URL, so any key-summed total counts those 27 payloads twice or more and overstates residency. (The audit's "22 duplicate aliases", measured independently by two agents, means 22 *shared URLs* — this is the same figure with its definition pinned down.) Both agents produced deduplicated figures and they differ by ~5 MiB because the scope (JSON sheet pages, fonts, Spine pages, preloads) was never normalised. The audit deliberately publishes no number.

**If you need one, normalise the scope first** and state it: unique source URLs, and an explicit decision on whether sheet pages, font atlases, Spine pages and preloads are counted. Then the number is worth acting on. The 22 aliases are themselves worth a look — `aTile`/`aExpTile` and three aliases per animal pointing at one URL is fine for the cache but makes every audit of this map harder.

## Change

Do these in order of confidence, and stop when the measured benefit flattens.

1. **Prewarm after each wave.** In `AssetsLoader`, once a wave resolves, call `renderer.prepare.upload(...)` for its textures. `prepare.upload` is real in 8.8.1 and accepts `Texture` / `TextureSource` / `Container` — but **`waveAssets` is a `LoadedAssets` object** holding arrays, plain objects, `SkeletonData` and audio, so passing it queues **nothing**. Flatten and deduplicate the actual `Texture` values first.
   **Flattening does not reach Spine.** `getProcessed(type='spine')` publishes `SkeletonData`, not top-level `Texture`s, so a flatten over `LoadedAssets` texture arrays covers sprite sheets and misses the transition and deer Spine pages — which are wave-2 art, i.e. exactly the first-draw stall this step targets. Either scope prewarm explicitly to discovered sprite textures and say so, or retain a supported Spine texture/container handle to traverse, and verify first-draw upload for the transition specifically (Sol). Also note prewarming deliberately brings those atlas pages into **GPU** residency, so measure GPU memory and frame impact rather than calling it unconditionally low-risk (Sol's correction on both points).
2. **Cap resolution before residency.** Plan 07 will change sheet sizes; establish the post-07 decoded total before designing unload logic against numbers that are about to move.
3. **Demand-load `DEFER_WAVE_2`.** **This is more than a trigger change** — Sol traced it and she is right. `AssetsLoader.svelte:126-132` starts *every* deferred priority from one package-level `$effect` as soon as `loaded` flips, iterating priorities in ascending order. It has no forest-gang state and no external demand input, so holding wave 2 back requires a **new contract** (a prop, a controller, or an asset-load service), not the relocation of an existing hook.
   **And "bonus-trigger anticipation" does not cover all the entry paths.** The code explicitly handles at least three others: direct bought BONUS/SUPER rounds, one-spin FEATURE books (where `bonusSymbolSelected` / `expandedSymbolReveal` ordering differs), and resumed playback via `createBonusSnapshot`. Tie the load to knowledge in the returned book — ideally scan at `playBet` entry, before presentation — and accept it only against **all four**: natural scatter, direct buy, feature spin, and resume. Testing "a bonus as early as the game allows" passes natural play and still ships blank deer and money art on the other three.
4. **Unload on feature exit** — only if 1–3 do not get residency to target. Unloading is the riskiest step here: a texture destroyed while a component still references it renders nothing, and the failure is intermittent. If you do it, unload on a state-machine transition with no live consumers, never on a timer.

## Do not

- Do not implement unload before prewarm. Prewarm carries **lower lifecycle risk** than unload — it cannot produce blank symbols — but it is not free: measure GPU residency and first-draw stalls, per step 1. (An earlier revision called it "cheap and safe" in the same file that corrected the claim.)
- Do not design residency caps against the current 155.1 MiB figure — plan 03 removes 29.5 MiB and plan 07 will add some back. Measure after both.
- Do not deduplicate the 22 aliases by rewriting call sites in the same change as the residency work. It is a readability fix with a wide blast radius; separate commit.
- Do not quote the audit's withdrawn blocking-pass numbers in a ticket or a status update.

## Verify

1. **First-draw stall.** Capture frame times at the moment a wave-1 animation first appears (e.g. the first idle blink after load). Compare before and after prewarm; the spike should flatten.
2. **Bonus availability on every entry path.** After demand-loading wave 2, confirm the transition, deer presenter and bonus backgrounds are all present — no fallback art — for **each of: natural scatter trigger, direct bought BONUS/SUPER, a one-spin FEATURE book, and a resumed `createBonusSnapshot` round.** Any one of these can pass while another ships blank art.
3. **No *new* missing-asset warnings** through: cold load, 20 base spins, a bonus trigger, a full bonus round, a big win, and a layout rotate. The shared components warn on absent keys, and any such warning here is a real regression — but do **not** assert a wholly clean console: PIXI's v7 `beginFill` deprecation group is logged on every cold load until plan 12 §A2 lands, and this plan is not blocked on it.
4. **Measured residency**, with the scope written down alongside the number.
5. **Rotate/resize after load** still works — the non-matching layout's art is demoted to the deferred pass, so this path is easy to break.

## Done when

Wave textures are uploaded before first draw, bonus art loads on demand without any fallback appearing on **any of the four entry paths**, no new missing-asset warning appears across the full flow above, and a residency figure exists with its scope stated.
