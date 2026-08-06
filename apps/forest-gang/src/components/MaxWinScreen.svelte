<script lang="ts">
	import { onMount } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';

	import { FillGradient } from 'pixi-svelte';
	import { Sprite, Container, Text } from 'pixi-svelte';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';

	import { getContext } from '../game/context';

	type Props = {
		countUpText: string;
		breatheScale?: number;
	};

	const { countUpText, breatheScale = 1 }: Props = $props();
	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());

	// Special MAX WIN art (roe-deer + ornate plaque, Figma 2642-5316), 1639×959, transparent bg.
	const IMG_ASPECT = 1639 / 959;
	const imgW = $derived(Math.min(main.width * 0.94, main.height * 0.9 * IMG_ASPECT));
	const imgH = $derived(imgW / IMG_ASPECT);

	// Amount plaque centre, as fractions of the art (the green box below the P medallion).
	const BOX_CX = 0.545;
	const BOX_CY = 0.745;
	const fontSize = $derived(imgH * 0.1);

	// Win amount — Cinzel 900 gold gradient (matches the tier boards).
	const goldFill = new FillGradient({
		type: 'linear',
		start: { x: 0, y: 0 },
		end: { x: 0, y: 1 },
		colorStops: [
			{ offset: 0.176, color: '#E2D981' },
			{ offset: 0.6, color: '#FBC503' },
			{ offset: 1, color: '#D98503' },
		],
		textureSpace: 'local',
	});

	let amountNatW = $state(0);
	const amountMaxW = $derived(imgW * 0.3);
	const amountScale = $derived(amountNatW > 0 ? Math.min(1, amountMaxW / amountNatW) : 1);

	// ── Entrance (R14) ────────────────────────────────────────────────────────────────────────
	// Crossing 25,000× used to swap this component in for the LEGENDARY board inside an already
	// visible container — a hard cut with no choreography at all. This component only ever mounts
	// on that crossing, so its mount IS the transition: a one-shot white flash covers the swap and
	// the art overshoots up to size behind it as the flash decays.
	const enter = new Tween(0);
	const flash = new Tween(1);
	onMount(() => {
		enter.set(1, { duration: 520, easing: backOut });
		flash.set(0, { duration: 420, easing: cubicOut });
	});
	// backOut takes `enter` slightly past 1, so the art settles back from a small overshoot.
	const enterScale = $derived(0.72 + 0.28 * enter.current);
	const enterAlpha = $derived(Math.min(1, enter.current * 2.5));
</script>

<MainContainer>
	<Container
		x={main.width / 2}
		y={main.height * 0.46}
		scale={breatheScale * enterScale}
		alpha={enterAlpha}
	>
		<Sprite key="maxWinScreen" anchor={0.5} width={imgW} height={imgH} />

		<Container x={(BOX_CX - 0.5) * imgW} y={(BOX_CY - 0.5) * imgH} scale={amountScale}>
			<Text
				anchor={0.5}
				text={countUpText}
				onresize={({ width }) => (amountNatW = width)}
				style={{
					fontFamily: 'Cinzel',
					fontWeight: '900',
					fontSize,
					fill: goldFill,
					align: 'center',
					letterSpacing: fontSize * 0.03,
				}}
			/>
		</Container>
	</Container>
</MainContainer>

<!-- Drawn last so it sits over the art (and, for its first frame, over the LEGENDARY board being
     removed) — the swap happens behind the flash instead of in plain sight. -->
{#if flash.current > 0.01}
	<CanvasSizeRectangle backgroundColor={0xffffff} backgroundAlpha={flash.current * 0.85} />
{/if}
