<script lang="ts">
	import { onMount } from 'svelte';
	import { Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	type Props = { onloaded: () => void; oncanproceed?: (onpress: () => void) => void };
	const props: Props = $props();
	const context = getContext();
	let loadingType = $state<'start' | 'ready'>('start');

	const MIN_LOADER_MS = 1500;
	let minTimeElapsed = $state(false);
	onMount(() => {
		setTimeout(() => {
			minTimeElapsed = true;
		}, MIN_LOADER_MS);
	});

	const canProceed = $derived(context.stateApp.loaded && minTimeElapsed);

	let _notified = false;
	$effect(() => {
		if (canProceed && !_notified) {
			_notified = true;
			props.oncanproceed?.(() => {
				loadingType = 'ready';
				props.onloaded();
			});
		}
	});

	// Cover-scale splash to 16:9.
	const SPLASH_ASPECT = 16 / 9;
	const splashW = $derived(
		context.stateLayoutDerived.mainLayout().width / context.stateLayoutDerived.mainLayout().height >= SPLASH_ASPECT
			? context.stateLayoutDerived.mainLayout().width
			: context.stateLayoutDerived.mainLayout().height * SPLASH_ASPECT,
	);
	const splashH = $derived(
		context.stateLayoutDerived.mainLayout().width / context.stateLayoutDerived.mainLayout().height >= SPLASH_ASPECT
			? context.stateLayoutDerived.mainLayout().width / SPLASH_ASPECT
			: context.stateLayoutDerived.mainLayout().height,
	);
</script>

<!-- Plain splash image while assets load — matches the Forest Gang loader (no progress bar/leaf). -->
<FadeContainer show={loadingType === 'start'}>
	<MainContainer>
		<Sprite
			key="splash"
			anchor={{ x: 0.5, y: 0.5 }}
			x={context.stateLayoutDerived.mainLayout().width * 0.5}
			y={context.stateLayoutDerived.mainLayout().height * 0.5}
			width={splashW}
			height={splashH}
		/>
	</MainContainer>
</FadeContainer>
