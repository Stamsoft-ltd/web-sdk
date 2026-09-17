<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import TransitionAnimation from './TransitionAnimation.svelte';

	type Props = {
		onloaded: () => void;
		/** Fired once assets are ready; the host shows the HTML splash and calls the handler on press. */
		oncanproceed?: (onpress: () => void) => void;
	};

	const props: Props = $props();
	const context = getContext();

	let loadingType = $state<'start' | 'transition'>('start');

	// Press Play "P" loader: a rounded tile whose red fill sweeps left→right across the P, shown as 10
	// discrete frames (loaderP0…loaderP9) picked by load progress.
	const P_SIZE = 156; // square tile
	const P_FRAMES = 10;
	const fillFraction = $derived(Math.max(0, Math.min(1, context.stateApp.loadingProgress / 100)));
	const frameIndex = $derived(Math.min(P_FRAMES - 1, Math.round(fillFraction * (P_FRAMES - 1))));

	// When loading finishes, hand a "proceed" callback to the host (Game) so its HTML SplashIntro can
	// drive the press-to-continue; pressing it runs the same transition → onloaded flow.
	let notified = false;
	$effect(() => {
		if (context.stateApp.loaded && !notified) {
			notified = true;
			props.oncanproceed?.(() => (loadingType = 'transition'));
		}
	});
</script>

<!-- logo and loading progress -->
<FadeContainer show={loadingType === 'start'}>
	<MainContainer>
		<Container
			x={context.stateLayoutDerived.mainLayout().width * 0.5}
			y={context.stateLayoutDerived.mainLayout().height * 0.5}
		>
			{#if !context.stateApp.loaded}
				<Container y={250}>
					<!-- Fill state selected by progress: loaderP0 (empty) … loaderP9 (full red). -->
					<Sprite key={`loaderP${frameIndex}`} anchor={0.5} width={P_SIZE} height={P_SIZE} />
				</Container>
			{/if}
		</Container>
	</MainContainer>
</FadeContainer>

<!-- transition between the loading screen and the game -->
<FadeContainer show={loadingType === 'transition'}>
	<TransitionAnimation oncomplete={props.onloaded} />
</FadeContainer>
