<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as PIXI from 'pixi.js';

	import { getContextApp } from '../context.svelte';
	import { getProcessed } from '../assetLoad';
	import { setDemandLoader } from '../assetDemand';
	import type { LoadedAssets, RawAsset, RawSpine, RawType, SpineSrc } from '../types';

	type Props = { children: Snippet };

	const props: Props = $props();
	const context = getContextApp();

	let preLoaded = $state(false);
	let deferLoaded = $state(false);
	// A load that outlived the component must not write back: stateApp is created once per game
	// module and survives a remount, so a late merge would republish assets whose textures the
	// destroyed renderer already took with it.
	let destroyed = false;

	// Main gating pass: everything that is neither preloaded nor deferred. `context.stateApp.loaded`
	// (and the loading screen) waits only on THIS set, so the game becomes playable without waiting
	// on the deferred (bonus / win / free-spin) assets.
	const assetNameList = $derived(
		context.stateApp.assets
			? Object.keys(context.stateApp.assets).filter(
					(key) =>
						Boolean(context.stateApp.assets?.[key].preload) === false &&
						Boolean(context.stateApp.assets?.[key].defer) === false &&
						Boolean(context.stateApp.assets?.[key].deferDemand) === false,
				)
			: [],
	);

	const preAssetNameList = $derived(
		context.stateApp.assets
			? Object.keys(context.stateApp.assets).filter(
					(key) => context.stateApp.assets?.[key].preload === true,
				)
			: [],
	);

	// Deferred pass: streamed in the background AFTER the game is interactive (see effect below).
	// `deferDemand` keys are excluded — they wait for an explicit loadDemandAssets() call.
	const deferredNameList = $derived(
		context.stateApp.assets
			? Object.keys(context.stateApp.assets).filter(
					(key) =>
						context.stateApp.assets?.[key].defer === true &&
						context.stateApp.assets?.[key].deferDemand !== true,
				)
			: [],
	);

	// Demand pass: never streamed automatically. See ../assetDemand.ts.
	const demandNameList = $derived(
		context.stateApp.assets
			? Object.keys(context.stateApp.assets).filter(
					(key) => context.stateApp.assets?.[key].deferDemand === true,
				)
			: [],
	);

	let counter = 0;

	const onProgress = (value: number) => {
		if (preLoaded && value === 1) {
			counter = counter + 1;
			const ratio = counter / assetNameList.length;
			context.stateApp.loadingProgress = ratio * 100;
		}
	};

	// A single stuck asset must never brick the game on the loading screen forever — some
	// environments (data-saver, media-suspend policies) defer <video> loading indefinitely, which
	// would otherwise hang the gating Promise.all at 100%. Race each load against a timeout; on
	// timeout the asset is skipped (render paths fall back) and loading completes.
	const LOAD_TIMEOUT_MS = 15000;

	// ── GPU upload warm-up ───────────────────────────────────────────────────────────────────────
	// Without this a texture's first upload happens on its first DRAW, which for streamed art is
	// mid-spin or mid-presentation — a stall exactly when a new animation appears. Uploading at load
	// time moves that cost off the animation's first frame. It is not free: it deliberately brings
	// each pass's pages into GPU residency at load rather than at first use, so the GPU now holds
	// roughly what the CPU-side decode holds instead of trailing it.
	// See docs/plans/11-asset-residency-and-prewarm.md.
	const collectTextureSources = ({
		out,
		processed,
		rawAsset,
		type,
		src,
	}: {
		out: PIXI.TextureSource[];
		processed: LoadedAssets | undefined;
		rawAsset: RawAsset;
		type: RawType;
		src: string | SpineSrc;
	}) => {
		const push = (value: unknown) => {
			if (value instanceof PIXI.Texture) out.push(value.source);
		};
		// `sprite` publishes one Texture, `sprites`/`spriteSheet` publish many. Everything else in a
		// LoadedAssets value (SkeletonData, audio config) is not a Texture and is skipped.
		for (const value of Object.values(processed ?? {})) {
			if (Array.isArray(value)) value.forEach(push);
			else push(value);
		}
		// Spine publishes SkeletonData, never a top-level Texture, so the walk above misses its atlas
		// pages — which are exactly the deferred art (transition / presenter spines) whose first draw
		// this targets. Take the pages off the TextureAtlas the loader already returned.
		if (type === 'spine') {
			const atlas = (rawAsset as RawSpine)[(src as SpineSrc).atlas] as
				| { pages?: { texture?: { texture?: PIXI.Texture } | null }[] }
				| undefined;
			for (const page of atlas?.pages ?? []) push(page?.texture?.texture);
		}
	};

	// Uploaded in small batches rather than one upload() call: pixi's prepare drains four items per
	// frame from a queue it exposes no way to cancel, and PrepareSystem.destroy() nulls that queue
	// while leaving an armed Ticker.system callback behind. Re-checking the renderer between batches
	// keeps the window in which destroying the Application can hit that stray tick down to one batch.
	const PREWARM_BATCH = 8;
	// A pass must never hang on the prewarm — Ticker.system drives the drain, so anything that stops
	// it would otherwise strand the loading screen. Same reasoning as LOAD_TIMEOUT_MS above.
	const PREWARM_TIMEOUT_MS = 5000;

	const prewarm = async (sources: PIXI.TextureSource[]) => {
		for (let index = 0; index < sources.length; index += PREWARM_BATCH) {
			const prepare = context.stateApp.pixiApplication?.renderer?.prepare;
			if (!prepare || destroyed) return; // application gone mid-warm; the rest is moot
			try {
				// upload() dedupes its queue by TextureSource uid, so a page shared by several keys is
				// uploaded once. A failed upload must never fail the load that triggered it.
				await prepare.upload(sources.slice(index, index + PREWARM_BATCH));
			} catch (error) {
				console.error('[pixi-svelte] texture prewarm failed', error);
				return;
			}
		}
	};

	/**
	 * Loads `nameList` and uploads its textures to the GPU before resolving, so a caller that
	 * publishes the result is publishing art that is ready to draw, not art that will stall on its
	 * first frame. `failed` lists keys that produced nothing — the caller decides whether a partial
	 * result is acceptable (it is for the background passes, it is not for a demand load).
	 */
	// A failed or timed-out load must never cost the session that asset: retry before giving up.
	// A slow-but-healthy download that misses one timeout window usually finishes inside the next —
	// PIXI.Assets dedupes in-flight loads by URL, so the re-await joins the same request rather
	// than restarting it — while a hard network error gets a fresh request.
	const LOAD_ATTEMPTS = 3;

	const loadAssets = async (nameList: string[]) => {
		const prewarmSources: PIXI.TextureSource[] = [];
		const failed: string[] = [];
		const loadedAssetsArray = await Promise.all(
			nameList.map(async (key) => {
				try {
					const { type, src } = context.stateApp.assets![key];
					const loadSrc =
						type === 'spine' ? Object.values(src).filter((item) => typeof item === 'string') : src;
					let rawAsset: RawAsset | undefined;
					for (let attempt = 1; ; attempt++) {
						try {
							rawAsset = await Promise.race([
								PIXI.Assets.load<RawAsset>(loadSrc, onProgress),
								new Promise<never>((_, reject) => {
									setTimeout(() => reject(new Error(`Asset load timeout (${LOAD_TIMEOUT_MS}ms): ${key}`)), LOAD_TIMEOUT_MS);
								}),
							]);
							break;
						} catch (error) {
							if (attempt >= LOAD_ATTEMPTS) throw error;
							console.warn(`[pixi-svelte] asset load attempt ${attempt}/${LOAD_ATTEMPTS} failed, retrying: ${key}`, error);
						}
					}
					const processed = getProcessed({ key, rawAsset, type, src });
					collectTextureSources({ out: prewarmSources, processed, rawAsset, type, src });
					return processed;
				} catch (error) {
					failed.push(key);
					console.error(error);
				}
			}),
		);

		await Promise.race([
			prewarm(prewarmSources),
			new Promise<void>((resolve) => setTimeout(resolve, PREWARM_TIMEOUT_MS)),
		]);

		const loadedAssets = loadedAssetsArray.reduce(
			(acc, cur) => ({
				...acc,
				...cur,
			}),
			{} as LoadedAssets,
		);
		return { loadedAssets, failed };
	};

	const merge = (loadedAssets: LoadedAssets) => {
		if (destroyed) return;
		context.stateApp.loadedAssets = { ...context.stateApp.loadedAssets, ...loadedAssets };
	};
	$effect(() => () => {
		destroyed = true;
	});

	$effect(() => {
		if (!preLoaded) {
			(async () => {
				if (preAssetNameList.length > 0) merge((await loadAssets(preAssetNameList)).loadedAssets);
				preLoaded = true;
			})();
		}
	});

	$effect(() => {
		if (!context.stateApp.loaded && preLoaded) {
			(async () => {
				if (assetNameList.length > 0) merge((await loadAssets(assetNameList)).loadedAssets);
				context.stateApp.loaded = true;
			})();
		}
	});

	// Deferred assets: load in the background once the game is interactive (`loaded` is set), merging
	// each into loadedAssets as it arrives. Never gates playability — render paths fall back until then.
	// Loaded in ascending deferPriority waves (default 1): each wave's downloads complete (and merge)
	// before the next wave starts, so first-win-critical sheets aren't queued behind bonus-only art.
	$effect(() => {
		if (context.stateApp.loaded && !deferLoaded) {
			deferLoaded = true;
			(async () => {
				const priorityOf = (key: string) => context.stateApp.assets?.[key].deferPriority ?? 1;
				const priorities = [...new Set(deferredNameList.map(priorityOf))].sort((a, b) => a - b);
				for (const priority of priorities) {
					const wave = deferredNameList.filter((key) => priorityOf(key) === priority);
					merge((await loadAssets(wave)).loadedAssets);
				}
			})();
		}
	});

	// Demand pass: publish a loader the game can call when a feature that needs the withheld art is
	// actually about to be presented (see ../assetDemand.ts). Registered unconditionally so an app
	// that flags nothing still resolves loadDemandAssets() immediately instead of hanging on it.
	// The effect body reads nothing reactive on purpose — `demandNameList` is read when the loader
	// RUNS, not when it is registered, so re-registration (which would drop the once-only latch and
	// re-run a completed load) can't be triggered by a derived recompute.
	$effect(() => {
		setDemandLoader(async () => {
			const wave = demandNameList;
			if (wave.length === 0) return;
			const { loadedAssets, failed } = await loadAssets(wave);
			merge(loadedAssets);
			// Throw on a partial result so the caller's latch is not left claiming success: a demand
			// load exists because something is about to DRAW this art, and silently resolving after a
			// timeout would ship the fallback for the rest of the session with no retry.
			if (failed.length > 0) throw new Error(`Demand assets failed to load: ${failed.join(', ')}`);
		});
		return () => setDemandLoader(undefined);
	});
</script>

{#if preLoaded}
	{@render props.children()}
{/if}
