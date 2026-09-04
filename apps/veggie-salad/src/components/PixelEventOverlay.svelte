<script lang="ts">
	import { untrack } from 'svelte';
	import { backOut, cubicIn, cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { fountain as fountainConfig } from 'constants-shared/particleConfig';
	import { Container, Graphics, ParticleEmitter, Rectangle, Sprite, Text } from 'pixi-svelte';
	import {
		bookEventAmountToBetAmountMultiplier,
		bookEventAmountToCurrencyString,
	} from 'utils-shared/amount';
	import { stateI18nDerived } from 'state-shared';

	import { stateGame } from '../game/stateGame.svelte';
	import { getContext } from '../game/context';

	type OverlayData = NonNullable<typeof stateGame.overlay>;
	type ArtKey = 'winSweet' | 'winWild' | 'winEpic' | 'winMythic' | 'winLegendary';
	type WinPlaqueKey =
		| 'winPlaqueSweet'
		| 'winPlaqueWild'
		| 'winPlaqueEpic'
		| 'winPlaqueMythic'
		| 'winPlaqueLegendary';
	type WinTitleKey =
		| 'winTitleSweet'
		| 'winTitleWild'
		| 'winTitleEpic'
		| 'winTitleMythic'
		| 'winTitleLegendary';
	type WinArt = {
		plaque: WinPlaqueKey;
		title: WinTitleKey;
		plaqueWidth: number;
		plaqueHeight: number;
		titleWidth: number;
		titleHeight: number;
		dark: number;
	};

	const WIN_ART: Record<ArtKey, WinArt> = {
		winSweet: {
			plaque: 'winPlaqueSweet',
			title: 'winTitleSweet',
			plaqueWidth: 900,
			plaqueHeight: 266,
			titleWidth: 500,
			titleHeight: 308,
			dark: 0x07598f,
		},
		winWild: {
			plaque: 'winPlaqueWild',
			title: 'winTitleWild',
			plaqueWidth: 900,
			plaqueHeight: 274,
			titleWidth: 470,
			titleHeight: 330,
			dark: 0x2d7614,
		},
		winEpic: {
			plaque: 'winPlaqueEpic',
			title: 'winTitleEpic',
			plaqueWidth: 900,
			plaqueHeight: 280,
			titleWidth: 430,
			titleHeight: 335,
			dark: 0x941713,
		},
		winMythic: {
			plaque: 'winPlaqueMythic',
			title: 'winTitleMythic',
			plaqueWidth: 900,
			plaqueHeight: 273,
			titleWidth: 490,
			titleHeight: 329,
			dark: 0x5b197b,
		},
		winLegendary: {
			plaque: 'winPlaqueLegendary',
			title: 'winTitleLegendary',
			plaqueWidth: 900,
			plaqueHeight: 277,
			titleWidth: 600,
			titleHeight: 280,
			dark: 0xa45808,
		},
	};

	const context = getContext();
	const enter = new Tween(0);
	const flash = new Tween(0);
	const amount = new Tween(0);
	let shownOverlay = $state<OverlayData | null>(null);
	let clock = $state(0);
	let animationId = 0;

	// Keep the outgoing overlay mounted until its shrink/fade finishes. State handlers can clear the
	// overlay immediately; the presentation still gets a real exit instead of one hard-cut frame.
	$effect(() => {
		const incoming = stateGame.overlay;
		const id = ++animationId;
		if (incoming) {
			shownOverlay = { ...incoming };
			clock = 0;
			const targetAmount = incoming.amount ?? untrack(() => stateGame.roundWin);
			enter.set(0, { duration: 0 });
			flash.set(0.9, { duration: 0 });
			amount.set(0, { duration: 0 });
			enter.set(1, { duration: 480, easing: backOut });
			flash.set(0, { duration: 420, easing: cubicOut });
			if (incoming.kind === 'win')
				amount.set(targetAmount, {
					duration: incoming.countDurationMs ?? 1050,
					easing: cubicOut,
				});
			return;
		}

		if (!untrack(() => shownOverlay)) return;
		enter.set(0, { duration: 210, easing: cubicIn }).then(() => {
			if (id === animationId) shownOverlay = null;
		});
	});

	// A second press while a win is counting snaps the amount quickly; the handler owns dismissal.
	// This keeps turbo/slam-stop deterministic without hard-cutting the presentation tree.
	$effect(() => {
		if (!stateGame.skipRequested || shownOverlay?.kind !== 'win') return;
		const targetAmount = shownOverlay.amount ?? stateGame.roundWin;
		if (amount.current < targetAmount)
			amount.set(targetAmount, { duration: 120, easing: cubicOut });
	});

	// One ticker for plaque breathing, tier wobble, and pixel sparks. It exists only while visible.
	$effect(() => {
		if (!shownOverlay) return;
		let raf = 0;
		const started = performance.now();
		const tick = (now: number) => {
			clock = (now - started) / 1000;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	const overlay = $derived(shownOverlay);
	const title = $derived(overlay?.title ?? '');
	const bonusPresentation = $derived(overlay?.bonusPresentation ?? null);
	const artKey = $derived<ArtKey | null>(
		bonusPresentation
			? null
			: title === 'LEGENDARY WIN'
				? 'winLegendary'
				: title === 'MYTHIC WIN'
					? 'winMythic'
					: title === 'EPIC WIN'
						? 'winEpic'
						: title === 'WILD WIN'
							? 'winWild'
							: title === 'SWEET WIN'
								? 'winSweet'
								: null,
	);
	const showAmount = $derived(overlay?.kind === 'win');
	// Every win presentation gets the same centred fountain. Density is driven by the target win,
	// not the count-up value, so crossing a threshold never reinitialises and deletes live coins.
	const showCoins = $derived(showAmount);
	const isSmallWin = $derived(showAmount && title === 'WIN');
	const showBackdrop = $derived(!isSmallWin);
	const smallWinText = $derived(stateI18nDerived.translate('WIN'));
	const winArt = $derived(artKey ? WIN_ART[artKey] : null);

	const tier = $derived(
		artKey === 'winLegendary'
			? 5
			: artKey === 'winMythic'
				? 4
				: artKey === 'winEpic'
					? 3
					: artKey === 'winWild'
						? 2
						: artKey === 'winSweet'
							? 1
							: bonusPresentation === 'end'
								? 4
								: 2,
	);
	const glowColor = $derived(
		artKey === 'winSweet'
			? 0x2c9dff
			: artKey === 'winWild' || bonusPresentation === 'start'
				? 0x72e622
				: artKey === 'winEpic'
					? 0xff3d27
					: artKey === 'winMythic'
						? 0xc43cff
						: 0xffc52c,
	);
	type VeggieKey =
		| 'pixelBroccoli'
		| 'pixelCorn'
		| 'pixelTomato'
		| 'pixelEggplant'
		| 'pixelCarrot'
		| 'pixelCauliflower'
		| 'pixelRadish';
	const winVeggies = $derived<VeggieKey[]>(
		artKey === 'winSweet'
			? ['pixelRadish', 'pixelCauliflower', 'pixelCarrot', 'pixelCauliflower', 'pixelRadish']
			: artKey === 'winWild'
				? ['pixelCarrot', 'pixelEggplant', 'pixelCauliflower', 'pixelEggplant', 'pixelCarrot']
				: artKey === 'winEpic'
					? ['pixelEggplant', 'pixelTomato', 'pixelCarrot', 'pixelTomato', 'pixelEggplant']
					: artKey === 'winMythic'
						? ['pixelTomato', 'pixelCorn', 'pixelEggplant', 'pixelCorn', 'pixelTomato']
						: ['pixelBroccoli', 'pixelCorn', 'pixelTomato', 'pixelCorn', 'pixelBroccoli'],
	);
	const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
	const timeline = (startSeconds: number, durationSeconds: number) =>
		clamp01((clock - startSeconds) / durationSeconds);
	const popIn = (startSeconds: number, durationSeconds: number) =>
		backOut(timeline(startSeconds, durationSeconds));
	const fadeIn = (startSeconds: number, durationSeconds: number) =>
		cubicOut(timeline(startSeconds, durationSeconds));
	const plaqueIn = $derived(popIn(0, 0.48));
	const titleIn = $derived(popIn(0.12, 0.5));
	const amountIn = $derived(popIn(0.4, 0.42));
	const namedWinIdleScale = $derived(1 + Math.sin(clock * (2.25 + tier * 0.1)) * 0.007);
	const countedWinText = $derived(
		bookEventAmountToCurrencyString(amount.current, overlay?.amount ?? stateGame.roundWin),
	);
	const amountFontSize = $derived(
		Math.max(25, Math.min(43, Math.floor(470 / Math.max(7, countedWinText.length * 0.68)))),
	);
	const starSlots = [
		{ x: -390, y: -92, size: 82, phase: 0.1 },
		{ x: 390, y: -82, size: 76, phase: 1.4 },
		{ x: -322, y: 108, size: 54, phase: 2.6 },
		{ x: 326, y: 112, size: 58, phase: 3.7 },
		{ x: -220, y: -176, size: 48, phase: 4.8 },
		{ x: 224, y: -180, size: 52, phase: 5.5 },
		{ x: 0, y: -206, size: 42, phase: 0.8 },
	];
	const visibleStars = $derived(starSlots.slice(0, Math.min(starSlots.length, tier + 2)));

	const breathe = $derived(1 + Math.sin(clock * (2.2 + tier * 0.08)) * (0.006 + tier * 0.002));
	const mainLayout = $derived(context.stateLayoutDerived.mainLayout());
	const presentationBounds = $derived(
		bonusPresentation === 'start'
			? { width: 820, height: 740 }
			: bonusPresentation === 'end'
				? { width: 900, height: 610 }
				: artKey
					? { width: 960, height: 650 }
					: { width: 760, height: 470 },
	);
	const presentationFit = $derived(
		Math.min(
			1,
			(mainLayout.width - 28) / presentationBounds.width,
			(mainLayout.height - 36) / presentationBounds.height,
		),
	);
	const plaqueScale = $derived(Math.max(0, enter.current) * breathe * presentationFit);
	const plaqueRestY = $derived(bonusPresentation === 'start' ? 0 : -44);
	const plaqueY = $derived(plaqueRestY + (1 - enter.current) * 74 + Math.sin(clock * 2.4) * 3);
	const namedWinY = $derived(plaqueY + Math.sin(clock * 2.1) * (2 + tier * 0.35));
	const plaqueRotation = $derived(Math.sin(clock * 1.75) * tier * 0.0009);
	const plaqueAlpha = $derived(Math.min(1, Math.max(0, enter.current * 2.8)));

	const winMultiplier = $derived(
		bookEventAmountToBetAmountMultiplier(Math.max(0, overlay?.amount ?? 0)),
	);
	const coinTier = $derived(
		winMultiplier >= 500
			? 5
			: winMultiplier >= 200
				? 4
				: winMultiplier >= 100
					? 3
					: winMultiplier >= 50
						? 2
						: winMultiplier >= 20
							? 1
							: 0,
	);
	const coinIntensity = $derived({
		// Spawn slower than before, but keep enough headroom that the emitter never reaches its
		// particle cap. Hitting that cap paused emission until a whole cohort expired, which read as
		// separate waves instead of one continuous stream.
		frequency: [0.24, 0.15, 0.105, 0.075, 0.052, 0.036][coinTier],
		maxParticles: [40, 60, 82, 110, 150, 210][coinTier],
		// Tight upward plume. Higher tiers widen only slightly; never a radial explosion.
		spread: [18, 22, 26, 30, 34, 38][coinTier],
		// Magnetic scales launch speed by win level; Forest Gang scales density live without emitter
		// re-init. Keep both behaviours. Base is slightly slower, each named tier moves faster.
		timeScale: [1.28, 1.34, 1.42, 1.55, 1.7, 1.88][coinTier],
		velocityScale: [0.82, 0.96, 1.09, 1.18, 1.28, 1.4][coinTier],
		// Small fountains finish emitting early; their final coins can complete the full fall while
		// the win remains visible. Bigger tiers retain the continuous celebration stream.
		emitterLifetime: [0.7, 1.2, -1, -1, -1, -1][coinTier],
	});
	// Tiered flight speed follows Magnetic's level map; stable config + live scalar/density follows
	// Forest Gang's no-cleanup pattern, preserving one continuous fountain at tier transitions.
	const coinGravity = 520;
	const coinOriginY = 210;
	const mainHeight = $derived(mainLayout.height);
	// Launch high enough to clear the top edge on every layout, then gravity returns the coins
	// through the screen. The 18% overshoot preserves the off-screen beat at cone edges.
	const coinVerticalSpeed = $derived(
		Math.sqrt(2 * coinGravity * (mainHeight * 0.5 + coinOriginY + 140)) * 1.18,
	);
	const coinLaunchSpeed = $derived(
		(coinVerticalSpeed / Math.cos((coinIntensity.spread * Math.PI) / 360)) *
			coinIntensity.velocityScale,
	);
	const coinLifetime = $derived(Math.max(3.2, (2 * coinLaunchSpeed) / coinGravity + 0.7));
	const coinConfig = $derived({
		...fountainConfig,
		alpha: { start: 1, end: 1 },
		// 1254px source -> roughly 120–170 layout pixels. Readable behind every plaque.
		scale: {
			start: 0.095 + coinTier * 0.008,
			end: 0.078 + coinTier * 0.005,
			minimumScaleMultiplier: 0.82,
		},
		speed: {
			start: coinLaunchSpeed,
			end: coinLaunchSpeed * 1.08,
			minimumSpeedMultiplier: 0.94,
		},
		acceleration: { x: 0, y: coinGravity },
		startRotation: { min: 270 - coinIntensity.spread / 2, max: 270 + coinIntensity.spread / 2 },
		rotationSpeed: { min: -85, max: 85 },
		lifetime: { min: coinLifetime, max: coinLifetime + 0.9 },
		frequency: coinIntensity.frequency,
		emitterLifetime: coinIntensity.emitterLifetime,
		maxParticles: coinIntensity.maxParticles,
		spawnType: 'rect',
		spawnRect: { x: -40, y: 0, w: 80, h: 6 },
	});

	const sparks = Array.from({ length: 18 }, (_, index) => ({
		angle: (Math.PI * 2 * index) / 18,
		phase: ((index * 37) % 18) / 18,
		speed: 0.72 + ((index * 11) % 7) * 0.045,
		size: 5 + (index % 3) * 3,
	}));

	const pixelText = (fontSize: number, fill = 0xffffff, stroke = 0x321505) => ({
		fontFamily: 'monospace',
		fontSize,
		fontWeight: '900' as const,
		fill,
		align: 'center' as const,
		stroke: { color: stroke, width: Math.max(3, Math.round(fontSize * 0.1)) },
		letterSpacing: Math.max(1, Math.round(fontSize * 0.035)),
	});
	const bonusModeText = $derived(
		overlay?.tier
			? stateI18nDerived.translate(`BONUS TIER ${overlay.tier.toUpperCase()}`)
			: (overlay?.detail ?? ''),
	);
	const bonusIntroText = $derived(
		overlay?.tier
			? stateI18nDerived.translate(`BONUS INTRO ${overlay.tier.toUpperCase()} TEXT`)
			: '',
	);
	const bonusBoard = $derived(
		bonusPresentation === 'start'
			? { x: -390, y: -350, width: 780, height: 700 }
			: { x: -440, y: -226, width: 880, height: 472 },
	);
	const bonusCorners = $derived([
		[bonusBoard.x, bonusBoard.y],
		[bonusBoard.x + bonusBoard.width - 24, bonusBoard.y],
		[bonusBoard.x, bonusBoard.y + bonusBoard.height - 24],
		[bonusBoard.x + bonusBoard.width - 24, bonusBoard.y + bonusBoard.height - 24],
	]);
	const bonusRivets = $derived([
		[bonusBoard.x + 70, bonusBoard.y + 76],
		[bonusBoard.x + bonusBoard.width - 70, bonusBoard.y + 76],
		[bonusBoard.x + 70, bonusBoard.y + bonusBoard.height - 76],
		[bonusBoard.x + bonusBoard.width - 70, bonusBoard.y + bonusBoard.height - 76],
	]);
</script>

{#if overlay}
	<!-- Stage children are z-sorted. MainContainer applies zIndex to its INNER node, so without this
	     explicit outer wrapper the backdrop (z=50) sorted above it and dimmed the plaque itself. -->
	<Container zIndex={0}>
		{#if showBackdrop}
			<CanvasSizeRectangle backgroundColor={0x04110c} backgroundAlpha={0.68 * plaqueAlpha} />
			{#if flash.current > 0.01}
				<CanvasSizeRectangle
					backgroundColor={glowColor}
					backgroundAlpha={flash.current * (0.18 + tier * 0.035)}
				/>
			{/if}
		{/if}
	</Container>
	<Container zIndex={100}>
		<MainContainer>
			<Container x={mainLayout.width * 0.5} y={mainLayout.height * 0.5}>
				{#if showCoins}
					<!-- Declared before plaque art: all branded coins fly behind the sign. -->
					<!-- One smooth stream. Base flight is restrained; speed and density rise by win tier. -->
					<Container y={coinOriginY} alpha={plaqueAlpha}>
						<ParticleEmitter
							key="pixelCoinSheet"
							config={coinConfig}
							emitSpeed={coinIntensity.timeScale * 0.001}
							emit={enter.current > 0.14}
							frequency={coinIntensity.frequency}
							maxParticles={coinIntensity.maxParticles}
						/>
					</Container>
				{/if}

				{#if bonusPresentation}
					<!-- Bonus intro/outro: built from integer-aligned Pixi primitives + native pixel
					     symbols. No soft generated board and no baked copy: sharp, responsive, localizable. -->
					<Container y={plaqueY} scale={plaqueScale} alpha={plaqueAlpha}>
						{#if bonusPresentation === 'end'}
							<!-- Veggies rise behind the total-win board. The entry board instead uses the
							     selected feature symbol, matching the supplied reference hierarchy. -->
							<Sprite
								key="pixelRadish"
								anchor={0.5}
								x={-310}
								y={-244 + Math.sin(clock * 3.1) * 7}
								width={126}
								height={126}
								rotation={-0.04 + Math.sin(clock * 2.4) * 0.025}
							/>
							<Sprite key="pixelCarrot" anchor={0.5} x={-165} y={-278} width={134} height={134} />
							<Sprite key="pixelTomato" anchor={0.5} x={0} y={-292} width={142} height={142} />
							<Sprite key="pixelCorn" anchor={0.5} x={165} y={-278} width={138} height={138} />
							<Sprite key="pixelBroccoli" anchor={0.5} x={310} y={-244} width={132} height={132} />
						{/if}

						<!-- Stepped wood/cream sign. Hard square edges intentionally mirror the game's
						     16-bit logo and avoid pseudo-HD rounded gradients. -->
						<Rectangle {...bonusBoard} backgroundColor={0x2a1205} />
						<Rectangle
							x={bonusBoard.x + 10}
							y={bonusBoard.y + 10}
							width={bonusBoard.width - 20}
							height={bonusBoard.height - 20}
							backgroundColor={0x8b4a12}
						/>
						<Rectangle
							x={bonusBoard.x + 24}
							y={bonusBoard.y + 24}
							width={bonusBoard.width - 48}
							height={bonusBoard.height - 48}
							backgroundColor={0xffe6a3}
						/>
						<Rectangle
							x={bonusBoard.x + 36}
							y={bonusBoard.y + 36}
							width={bonusBoard.width - 72}
							height={bonusBoard.height - 72}
							backgroundColor={0x4a210b}
						/>
						<Rectangle
							x={bonusBoard.x + 50}
							y={bonusBoard.y + 50}
							width={bonusBoard.width - 100}
							height={bonusBoard.height - 100}
							backgroundColor={bonusPresentation === 'start' ? 0x294a17 : 0x4c1e0d}
						/>
						<!-- Pixel-cut corners. -->
						{#each bonusCorners as corner}
							<Rectangle
								x={corner[0]}
								y={corner[1]}
								width={24}
								height={24}
								backgroundColor={0x061006}
							/>
						{/each}
						<!-- Rivets. -->
						{#each bonusRivets as rivet}
							<Graphics
								x={rivet[0]}
								y={rivet[1]}
								draw={(graphics) => {
									graphics.circle(0, 0, 13);
									graphics.fill(0x2a1205);
									graphics.circle(-2, -2, 8);
									graphics.fill(0xffd773);
								}}
							/>
						{/each}

						<Text
							anchor={0.5}
							y={bonusPresentation === 'start' ? -270 : -133}
							text={stateI18nDerived.translate('CONGRATULATIONS!')}
							style={pixelText(bonusPresentation === 'start' ? 44 : 48, 0xffbc32)}
						/>
						<Text
							anchor={0.5}
							y={bonusPresentation === 'start' ? -210 : -66}
							text={stateI18nDerived.translate('YOU WON')}
							style={pixelText(27, 0xffffff)}
						/>

						{#if bonusPresentation === 'start'}
							<Text anchor={0.5} y={-155} text={bonusModeText} style={pixelText(40, 0xffd24a)} />
							<Text
								anchor={0.5}
								y={-94}
								text={bonusIntroText}
								style={{
									...pixelText(20, 0xffffff),
									wordWrap: true,
									wordWrapWidth: 600,
									lineHeight: 28,
								}}
							/>
							<Sprite
								key="pixelScatter"
								anchor={0.5}
								y={42 + Math.sin(clock * 3) * 5}
								width={150}
								height={150}
							/>
							<Rectangle x={-178} y={128} width={356} height={114} backgroundColor={0x2a1205} />
							<Rectangle x={-166} y={140} width={332} height={90} backgroundColor={0xe78b00} />
							<Text
								anchor={0.5}
								y={185}
								text={overlay.freeSpins ?? 0}
								style={pixelText(72, 0xffffff, 0x4c2008)}
							/>
							<Text
								anchor={0.5}
								y={278}
								text={stateI18nDerived.translate('FREE SPINS')}
								style={pixelText(34, 0xffd678)}
							/>
						{:else}
							<Rectangle x={-294} y={1} width={588} height={106} backgroundColor={0x2a1205} />
							<Rectangle x={-282} y={13} width={564} height={82} backgroundColor={0xe78b00} />
							<Text
								anchor={0.5}
								y={54}
								text={bookEventAmountToCurrencyString(
									amount.current,
									overlay.amount ?? stateGame.roundWin,
								)}
								style={pixelText(45, 0xffffff, 0x4c2008)}
							/>
							<Text
								anchor={0.5}
								y={145}
								text={stateI18nDerived.translate('TOTAL WIN')}
								style={pixelText(31, 0xffd678)}
							/>
						{/if}
					</Container>
				{:else if artKey && winArt}
					<!-- Supplied tier art is split into independently animated Pixi layers. This keeps the
					     authored plaque/title intact while giving every part a real entrance, idle loop and exit. -->
					<Container
						y={namedWinY}
						scale={Math.max(0, enter.current) * presentationFit * namedWinIdleScale}
						rotation={plaqueRotation}
						alpha={plaqueAlpha}
					>
						<Container scale={0.92 + Math.sin(clock * 2.1) * 0.035}>
							<Graphics
								blendMode="add"
								draw={(graphics) => {
									for (let glowIndex = 7; glowIndex >= 1; glowIndex -= 1) {
										graphics.circle(0, 0, 275 + glowIndex * 32);
										graphics.fill({
											color: glowColor,
											alpha: 0.012 + (7 - glowIndex) * 0.006,
										});
									}
								}}
							/>
						</Container>

						{#each sparks as spark, index}
							{@const progress = (clock * spark.speed + spark.phase) % 1}
							{@const radius = 250 + progress * (120 + tier * 14)}
							<Rectangle
								x={Math.cos(spark.angle) * radius}
								y={Math.sin(spark.angle) * radius * 0.56}
								width={spark.size}
								height={spark.size}
								anchor={0.5}
								rotation={spark.angle + clock}
								backgroundColor={index % 3 === 0 ? 0xffffff : glowColor}
								alpha={(1 - progress) * (0.42 + tier * 0.07) * fadeIn(0.08, 0.4)}
							/>
						{/each}

						<!-- Paytable-ranked vegetables rise independently behind the plaque. -->
						{#each winVeggies as veggie, index}
							{@const veggieIn = popIn(0.12 + index * 0.055, 0.42)}
							<Container
								x={(index - 2) * 164}
								y={-194 - (index === 2 ? 22 : 0) + (1 - clamp01(veggieIn)) * 86}
								scale={veggieIn * (1 + Math.sin(clock * 2.7 + index * 0.9) * 0.025)}
								rotation={(index - 2) * 0.025 + Math.sin(clock * 2.1 + index) * 0.02}
								alpha={clamp01(veggieIn)}
							>
								<Sprite
									key={veggie}
									anchor={0.5}
									width={index === 2 ? 146 : 130}
									height={index === 2 ? 146 : 130}
								/>
							</Container>
						{/each}

						<!-- Authored plaque: short squash on impact, then a restrained idle float. -->
						<Container
							y={-18 + (1 - clamp01(plaqueIn)) * 82}
							scale={{ x: plaqueIn, y: 0.72 + plaqueIn * 0.28 }}
							alpha={clamp01(plaqueIn)}
						>
							<Graphics
								y={34}
								draw={(graphics) =>
									graphics
										.ellipse(0, 0, winArt.plaqueWidth * 0.43, winArt.plaqueHeight * 0.42)
										.fill({ color: 0x130702, alpha: 0.42 })}
							/>
							<Sprite
								key={winArt.plaque}
								anchor={0.5}
								width={winArt.plaqueWidth}
								height={winArt.plaqueHeight}
							/>
						</Container>

						<!-- More stars unlock by tier; each has its own pop and twinkle phase. -->
						{#each visibleStars as star, index}
							{@const starIn = popIn(0.24 + index * 0.045, 0.34)}
							<Container
								x={star.x}
								y={star.y}
								scale={starIn * (0.88 + Math.sin(clock * 4.2 + star.phase) * 0.12)}
								rotation={clock * (index % 2 ? -0.34 : 0.34) + star.phase}
								alpha={clamp01(starIn) * (0.8 + Math.sin(clock * 5 + star.phase) * 0.2)}
							>
								<Sprite key="winStar" anchor={0.5} width={star.size} height={star.size * 0.965} />
							</Container>
						{/each}

						<!-- Authored title drops last, overshoots once, then breathes by less than two percent. -->
						<Container
							y={-20 - (1 - clamp01(titleIn)) * 104 + Math.sin(clock * 2.8) * 2.5}
							scale={titleIn * (1 + Math.sin(clock * 2.45 + tier) * (0.005 + tier * 0.0015))}
							rotation={(1 - clamp01(titleIn)) * -0.035 + Math.sin(clock * 1.8) * 0.003}
							alpha={clamp01(titleIn)}
						>
							<Sprite
								key={winArt.title}
								anchor={0.5}
								width={winArt.titleWidth}
								height={winArt.titleHeight}
							/>
						</Container>

						<!-- Original orange amount ticket retained, rebuilt with cream trim and responsive copy. -->
						<Container
							y={194 + (1 - clamp01(amountIn)) * 70}
							scale={amountIn}
							alpha={clamp01(amountIn)}
						>
							<Graphics
								draw={(graphics) => {
									graphics.roundRect(-264, -55, 528, 110, 20).fill(0x241006);
									graphics.roundRect(-254, -47, 508, 94, 15).fill(0xffedb5);
									graphics.roundRect(-244, -37, 488, 74, 10).fill(0xe98608);
									graphics.roundRect(-230, -29, 460, 14, 6).fill({ color: 0xffc335, alpha: 0.72 });
									for (const rivetX of [-228, 228]) {
										graphics.circle(rivetX, 0, 8).fill(winArt.dark);
										graphics.circle(rivetX - 2, -2, 3).fill(0xfff4c8);
									}
								}}
							/>
							<Text
								anchor={0.5}
								text={countedWinText}
								style={{
									fontFamily: 'monospace',
									fontSize: amountFontSize,
									fontWeight: '900',
									fill: 0xffffff,
									stroke: { color: 0x4c2008, width: 5 },
								}}
							/>
						</Container>
					</Container>
				{:else if isSmallWin}
					<!-- Under 20×: text-only pixel win. No fullscreen shade, plaque, vegetables, or coins. -->
					<Container y={plaqueY + 20} scale={plaqueScale} alpha={plaqueAlpha}>
						<Text
							anchor={0.5}
							y={-34}
							text={smallWinText}
							style={{
								fontFamily: 'monospace',
								fontSize: 48,
								fontWeight: '900',
								fill: 0xffdf3f,
								stroke: { color: 0x2b1605, width: 8 },
							}}
						/>
						<Text
							anchor={0.5}
							y={38}
							text={bookEventAmountToCurrencyString(
								amount.current,
								overlay.amount ?? stateGame.roundWin,
							)}
							style={{
								fontFamily: 'monospace',
								fontSize: 54,
								fontWeight: '900',
								fill: 0xffffff,
								stroke: { color: 0x17380d, width: 8 },
							}}
						/>
					</Container>
				{:else}
					<!-- Mystery/retrigger fallback: animated pixel-native plaque, no mismatched baked text. -->
					<Container y={plaqueY} scale={plaqueScale} rotation={plaqueRotation} alpha={plaqueAlpha}>
						<Rectangle x={-360} y={-190} width={720} height={380} backgroundColor={0x3b1b08} />
						<Rectangle x={-348} y={-178} width={696} height={356} backgroundColor={0xd69a2d} />
						<Rectangle x={-336} y={-166} width={672} height={332} backgroundColor={0x4f2078} />
						<Text
							anchor={0.5}
							y={-62}
							text={title}
							style={{
								fontFamily: 'monospace',
								fontSize: 50,
								fontWeight: '900',
								fill: 0xffdf3f,
								stroke: { color: 0x2b0c38, width: 7 },
							}}
						/>
						<Text
							anchor={0.5}
							y={48}
							text={overlay.detail}
							style={{
								fontFamily: 'monospace',
								fontSize: 27,
								fontWeight: '900',
								fill: 0xffffff,
								stroke: { color: 0x2b0c38, width: 5 },
							}}
						/>
					</Container>
				{/if}
			</Container>
		</MainContainer>
	</Container>
{/if}
