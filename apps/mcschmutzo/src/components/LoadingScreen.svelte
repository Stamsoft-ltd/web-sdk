<script lang="ts">
	import { Container, Sprite, Rectangle } from 'pixi-svelte';
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

	// Press Play "P" loader: dark empty shell + a red fill that rises from the bottom with progress.
	const P_ASPECT = 81 / 146; // isolated loader-p.webp
	const P_HEIGHT = 190;
	const P_WIDTH = P_HEIGHT * P_ASPECT;
	const fillFraction = $derived(Math.max(0, Math.min(1, context.stateApp.loadingProgress / 100)));

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
					<!-- Empty shell: the P in a muted grey so its outline reads on the black loading bg. -->
					<Sprite
						key="loaderP"
						anchor={0.5}
						width={P_WIDTH}
						height={P_HEIGHT}
						tint={0x5b5b5b}
					/>
					<!-- Red fill, revealed from the bottom up by a mask that grows with progress. -->
					<Container>
						<Sprite
							key="loaderP"
							anchor={0.5}
							width={P_WIDTH}
							height={P_HEIGHT}
							tint={0xd11f0f}
						/>
						<Rectangle
							isMask
							anchor={{ x: 0.5, y: 1 }}
							y={P_HEIGHT / 2}
							width={P_WIDTH}
							height={P_HEIGHT * fillFraction}
						/>
					</Container>
				</Container>
			{/if}
		</Container>
	</MainContainer>
</FadeContainer>

<!-- transition between the loading screen and the game -->
<FadeContainer show={loadingType === 'transition'}>
	<TransitionAnimation oncomplete={props.onloaded} />
</FadeContainer>
