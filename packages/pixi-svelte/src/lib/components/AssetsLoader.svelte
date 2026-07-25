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
	// the pages into GPU residency ahead of use, so the decoded pool and the GPU pool now hold the
	// same set. See docs/plans/11-asset-residency-and-prewarm.md.
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

	const prewarm = (sources: PIXI.TextureSource[]) => {
		const prepare = context.stateApp.pixiApplication?.renderer?.prepare;
		if (!prepare || sources.length === 0) return;
		// Fire and forget: prepare drains its queue over Ticker.system a few items per frame, so it
		// must never gate a load, and a failed upload must never reject one. upload() dedupes the
		// queue by TextureSource uid, so pages shared by several keys are uploaded once.
		// Known ceiling: pixi's PrepareSystem.destroy() nulls its queue but leaves any already-armed
		// Ticker.system callback in place, so destroying the Application mid-drain throws once from
		// that stray tick. In this app destroy only happens on page teardown / dev HMR, and pixi
		// exposes no way to cancel the queue, so it is left alone rather than reimplemented.
		prepare
			.upload(sources)
			.catch((error) => console.error('[pixi-svelte] texture prewarm failed', error));
	};

	const loadAssets = async (nameList: string[]) => {
		const prewarmSources: PIXI.TextureSource[] = [];
		const loadedAssetsArray = await Promise.all(
			nameList.map(async (key) => {
				try {
					const { type, src } = context.stateApp.assets![key];
					const loadSrc =
						type === 'spine' ? Object.values(src).filter((item) => typeof item === 'string') : src;
					const rawAsset = await Promise.race([
						PIXI.Assets.load<RawAsset>(loadSrc, onProgress),
						new Promise<never>((_, reject) => {
							setTimeout(() => reject(new Error(`Asset load timeout (${LOAD_TIMEOUT_MS}ms): ${key}`)), LOAD_TIMEOUT_MS);
						}),
					]);
					const processed = getProcessed({ key, rawAsset, type, src });
					collectTextureSources({ out: prewarmSources, processed, rawAsset, type, src });
					return processed;
				} catch (error) {
					console.error(error);
				}
			}),
		);

		prewarm(prewarmSources);

		return loadedAssetsArray.reduce(
			(acc, cur) => ({
				...acc,
				...cur,
			}),
			{} as LoadedAssets,
		);
	};

	$effect(() => {
		if (!preLoaded) {
			(async () => {
				if (preAssetNameList.length > 0) {
					const preLoadedAssets = await loadAssets(preAssetNameList);
					if (preLoadedAssets) context.stateApp.loadedAssets = preLoadedAssets;
				}
				preLoaded = true;
			})();
		}
	});

	$effect(() => {
		if (!context.stateApp.loaded && preLoaded) {
			(async () => {
				if (assetNameList.length > 0) {
					const postLoadedAssets = await loadAssets(assetNameList);
					if (postLoadedAssets)
						context.stateApp.loadedAssets = {
							...context.stateApp.loadedAssets,
							...postLoadedAssets,
						};
				}
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
					const waveAssets = await loadAssets(wave);
					if (waveAssets)
						context.stateApp.loadedAssets = {
							...context.stateApp.loadedAssets,
							...waveAssets,
						};
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
			const demandAssets = await loadAssets(wave);
			if (demandAssets)
				context.stateApp.loadedAssets = {
					...context.stateApp.loadedAssets,
					...demandAssets,
				};
		});
		return () => setDemandLoader(undefined);
	});
</script>

{#if preLoaded}
	{@render props.children()}
{/if}
