<script lang="ts">
	import type { Snippet } from 'svelte';
	import * as PIXI from 'pixi.js';

	import { getContextApp } from '../context.svelte';
	import { getProcessed } from '../assetLoad';
	import type { LoadedAssets, RawAsset } from '../types';

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
						Boolean(context.stateApp.assets?.[key].defer) === false,
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
	const deferredNameList = $derived(
		context.stateApp.assets
			? Object.keys(context.stateApp.assets).filter(
					(key) => context.stateApp.assets?.[key].defer === true,
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

	const loadAssets = async (nameList: string[]) => {
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
					return processed;
				} catch (error) {
					console.error(error);
				}
			}),
		);

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
	$effect(() => {
		if (context.stateApp.loaded && !deferLoaded) {
			deferLoaded = true;
			(async () => {
				if (deferredNameList.length > 0) {
					const deferredAssets = await loadAssets(deferredNameList);
					if (deferredAssets)
						context.stateApp.loadedAssets = {
							...context.stateApp.loadedAssets,
							...deferredAssets,
						};
				}
			})();
		}
	});
</script>

{#if preLoaded}
	{@render props.children()}
{/if}
