<script lang="ts">
	import { onMount } from 'svelte';
	import { Container, Rectangle, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	type Props = { onloaded: () => void; oncanproceed?: (onpress: () => void) => void };
	const props: Props = $props();
	const context = getContext();
	let loadingType = $state<'start' | 'ready'>('start');

	const MIN_LOADER_MS = 1500;
	let minTimeElapsed = $state(false);
	onMount(() => { setTimeout(() => { minTimeElapsed = true; }, MIN_LOADER_MS); });

	const canProceed = $derived(context.stateApp.loaded && minTimeElapsed);

	let displayedProgress = $state(0);
	onMount(() => {
		let id: number;
		const tick = () => {
			const realProg = context.stateApp.loadingProgress;
			displayedProgress = context.stateApp.loaded ? 100 : Math.min(95, realProg);
			id = requestAnimationFrame(tick);
		};
		id = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(id);
	});

	const BAR_W = 430;
	const BAR_H = 34;

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
			: context.stateLayoutDerived.mainLayout().height * SPLASH_ASPECT
	);
	const splashH = $derived(
		context.stateLayoutDerived.mainLayout().width / context.stateLayoutDerived.mainLayout().height >= SPLASH_ASPECT
			? context.stateLayoutDerived.mainLayout().width / SPLASH_ASPECT
			: context.stateLayoutDerived.mainLayout().height
	);
</script>

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

		{#if !canProceed}
			<Container
				x={context.stateLayoutDerived.mainLayout().width * 0.5}
				y={context.stateLayoutDerived.mainLayout().height - 150}
			>
				<Container pivot={{ x: BAR_W / 2, y: BAR_H / 2 }}>
					<Rectangle width={BAR_W} height={BAR_H} backgroundColor={0xffc52f} radius={BAR_H / 2} />
					<Rectangle x={4} y={4} width={BAR_W - 8} height={BAR_H - 8} backgroundColor={0x16062c} radius={(BAR_H - 8) / 2} />
					<Rectangle
						x={7}
						y={7}
						width={Math.max(1, (BAR_W - 14) * displayedProgress / 100)}
						height={BAR_H - 14}
						backgroundColor={0xc52bd7}
						radius={(BAR_H - 14) / 2}
					/>
				</Container>
			</Container>
		{/if}
	</MainContainer>
</FadeContainer>
