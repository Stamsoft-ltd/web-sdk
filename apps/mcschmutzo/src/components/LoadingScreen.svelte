<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';
	import { FadeContainer, LoadingProgress } from 'components-pixi';
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
				<LoadingProgress y={250} width={1967 * 0.2} height={346 * 0.2}>
					{#snippet background(sizes)}
						<Sprite key="progressBarBackground.png" {...sizes} />
					{/snippet}
					{#snippet progress(sizes)}
						<Sprite key="progressBar.png" {...sizes} />
					{/snippet}
					{#snippet frame(sizes)}
						<Sprite key="progressBarFrame.png" {...sizes} />
					{/snippet}
				</LoadingProgress>
			{/if}
		</Container>
	</MainContainer>
</FadeContainer>

<!-- transition between the loading screen and the game -->
<FadeContainer show={loadingType === 'transition'}>
	<TransitionAnimation oncomplete={props.onloaded} />
</FadeContainer>
