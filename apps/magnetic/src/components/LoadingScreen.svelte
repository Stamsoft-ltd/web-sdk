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
	onMount(() => {
		setTimeout(() => {
			minTimeElapsed = true;
		}, MIN_LOADER_MS);
	});

	const canProceed = $derived(context.stateApp.loaded && minTimeElapsed);

	// The bar tracks the REAL download. It used to be an orb sliding across a permanently empty
	// slot, which reads as a stalled bar because nothing ever fills — and it sat at 0 for the whole
	// load anyway, since every asset was in the `preload` tier that the progress counter ignores by
	// design. Both halves are fixed: assets.ts now puts base-game art in the counted tier, and the
	// slot actually fills.
	const barProgress = $derived(context.stateApp.loaded ? 100 : context.stateApp.loadingProgress);

	// Smooth the fill so a wave of assets resolving together doesn't jump the bar, and clamp it to
	// forward-only so it can never appear to lose progress.
	let shownProgress = $state(0);
	let bobY = $state(0);
	onMount(() => {
		const startTime = performance.now();
		let id: number;
		let last = startTime;
		const tick = (now: number) => {
			const dt = Math.min(64, now - last);
			last = now;
			const eased = shownProgress + (barProgress - shownProgress) * (1 - Math.exp(-dt / 110));
			shownProgress = Math.max(shownProgress, eased);
			bobY = Math.sin((now - startTime) * 0.002) * 3;
			id = requestAnimationFrame(tick);
		};
		id = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(id);
	});

	let _notified = false;
	$effect(() => {
		if (canProceed && !_notified) {
			_notified = true;
			const proceed = () => {
				loadingType = 'ready';
				props.onloaded();
			};
			if (props.oncanproceed) props.oncanproceed(proceed);
			else proceed();
		}
	});

	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const main = $derived(context.stateLayoutDerived.mainLayout());

	// Bar geometry. Slot art is 492×87 with a glowing cyan rim; the fill sits inside that rim.
	const BAR_ASPECT = 87 / 492;
	const barW = $derived(Math.min(main.width * 0.6, 720));
	const barH = $derived(barW * BAR_ASPECT);
	const INSET = $derived(barH * 0.16); // rim thickness in the source art
	const trackW = $derived(barW - INSET * 2);
	const trackH = $derived(barH - INSET * 2);
	const fillW = $derived(Math.max(0, trackW * (shownProgress / 100)));

	// Orb rides the leading edge of the fill. Native 100×111, so it overhangs the bar slightly.
	const ORB_H = $derived(barH * 1.28);
	const ORB_W = $derived(ORB_H * (100 / 111));

	// Studio "Press Play" branding above the bar. Native 548×228.
	const LOGO_ASPECT = 228 / 548;
	const logoW = $derived(Math.min(main.width * 0.34, 420));
	const logoH = $derived(logoW * LOGO_ASPECT);
	const hasLogo = $derived(!!context.stateApp.loadedAssets?.pressPlayLogo);
	const hasBar = $derived(!!context.stateApp.loadedAssets?.['progressBarBackground.png']);
</script>

<!-- Plain dark backdrop rather than the splash art: the bar and logo are the only preloaded assets,
     so this screen paints immediately instead of waiting on a full-screen JPEG that is itself part
     of the download being measured. The themed splash/press screen follows once loading completes.
     Mirrors forest-gang's loader. -->
<FadeContainer show={loadingType === 'start'}>
	<Rectangle {...canvas} backgroundColor={0x040711} />
	<MainContainer>
		{#if hasLogo}
			<Sprite
				key="pressPlayLogo"
				anchor={{ x: 0.5, y: 0.5 }}
				x={main.width * 0.5}
				y={main.height * 0.5 - logoH * 0.9}
				width={logoW}
				height={logoH}
			/>
		{/if}

		{#if hasBar}
			<Container x={main.width * 0.5} y={main.height * 0.5}>
				<Container pivot={{ x: barW / 2, y: barH / 2 }}>
					<!-- Dark metal slot with the glowing cyan rim -->
					<Sprite key="progressBarBackground.png" width={barW} height={barH} />

					<!-- Energy fill inside the rim. A dim channel spans the whole track so the empty
					     part still reads as a slot, then the bright fill grows over it. -->
					<Rectangle
						x={INSET}
						y={INSET}
						width={trackW}
						height={trackH}
						borderRadius={trackH * 0.5}
						backgroundColor={0x0a1c33}
						backgroundAlpha={0.85}
					/>
					{#if fillW > 1}
						<Rectangle
							x={INSET}
							y={INSET}
							width={fillW}
							height={trackH}
							borderRadius={trackH * 0.5}
							backgroundColor={0x2fb6ff}
							backgroundAlpha={0.9}
						/>
						<!-- Brighter core line for the charged look -->
						<Rectangle
							x={INSET}
							y={INSET + trackH * 0.28}
							width={fillW}
							height={trackH * 0.44}
							borderRadius={trackH * 0.22}
							backgroundColor={0x9ce4ff}
							backgroundAlpha={0.75}
						/>
					{/if}

					<!-- Orb cursor at the fill edge -->
					<Sprite
						key="progressBarLeaf.png"
						width={ORB_W}
						height={ORB_H}
						anchor={{ x: 0.5, y: 0.5 }}
						x={INSET + fillW}
						y={barH / 2 + bobY}
					/>
				</Container>
			</Container>
		{/if}
	</MainContainer>
</FadeContainer>
