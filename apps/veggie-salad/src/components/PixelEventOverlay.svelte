<script lang="ts">
	import { untrack } from 'svelte';
	import { backOut, cubicIn, cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';
	import { CanvasSizeRectangle, MainContainer } from 'components-layout';
	import { ResponsiveBitmapText } from 'components-pixi';
	import { fountain as fountainConfig } from 'constants-shared/particleConfig';
	import {
		BitmapText,
		Container,
		Graphics,
		ParticleEmitter,
		Rectangle,
		Sprite,
		Text,
	} from 'pixi-svelte';
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
		| 'winPlaqueSweetV2'
		| 'winPlaqueWildV2'
		| 'winPlaqueEpicV2'
		| 'winPlaqueMythicV2'
		| 'winPlaqueLegendaryV2';
	type WinTitleKey =
		| 'winTitleSweetTopV2'
		| 'winTitleWildV2'
		| 'winTitleEpicV2'
		| 'winTitleMythicV2'
		| 'winTitleLegendaryV2';
	type WinAmountKey =
		| 'winAmountSweetV2'
		| 'winAmountWildV2'
		| 'winAmountEpicV2'
		| 'winAmountMythicV2'
		| 'winAmountLegendaryV2';
	type WinArt = {
		plaque: WinPlaqueKey;
		titleTop: WinTitleKey;
		amountPlaque: WinAmountKey;
		plaqueWidth: number;
		plaqueHeight: number;
		titleTopWidth: number;
		titleTopHeight: number;
	};

	const WIN_ART: Record<ArtKey, WinArt> = {
		winSweet: {
			plaque: 'winPlaqueSweetV2',
			titleTop: 'winTitleSweetTopV2',
			amountPlaque: 'winAmountSweetV2',
			plaqueWidth: 920,
			plaqueHeight: 321,
			titleTopWidth: 590,
			titleTopHeight: 211,
		},
		winWild: {
			plaque: 'winPlaqueWildV2',
			titleTop: 'winTitleWildV2',
			amountPlaque: 'winAmountWildV2',
			plaqueWidth: 920,
			plaqueHeight: 321,
			titleTopWidth: 540,
			titleTopHeight: 202,
		},
		winEpic: {
			plaque: 'winPlaqueEpicV2',
			titleTop: 'winTitleEpicV2',
			amountPlaque: 'winAmountEpicV2',
			plaqueWidth: 920,
			plaqueHeight: 321,
			titleTopWidth: 510,
			titleTopHeight: 223,
		},
		winMythic: {
			plaque: 'winPlaqueMythicV2',
			titleTop: 'winTitleMythicV2',
			amountPlaque: 'winAmountMythicV2',
			plaqueWidth: 920,
			plaqueHeight: 321,
			titleTopWidth: 600,
			titleTopHeight: 199,
		},
		winLegendary: {
			plaque: 'winPlaqueLegendaryV2',
			titleTop: 'winTitleLegendaryV2',
			amountPlaque: 'winAmountLegendaryV2',
			plaqueWidth: 920,
			plaqueHeight: 321,
			titleTopWidth: 690,
			titleTopHeight: 209,
		},
	};

	const context = getContext();
	const enter = new Tween(0);
	const flash = new Tween(0);
	const amount = new Tween(0);
	let shownOverlay = $state<OverlayData | null>(null);
	let clock = $state(0);
	let animationId = 0;
	let presentationStartedAt = 0;

	// Keep the outgoing overlay mounted until its shrink/fade finishes. State handlers can clear the
	// overlay immediately; the presentation still gets a real exit instead of one hard-cut frame.
	$effect(() => {
		const incoming = stateGame.overlay;
		const id = ++animationId;
		if (incoming) {
			shownOverlay = { ...incoming };
			clock = 0;
			presentationStartedAt = 0;
			const targetAmount = incoming.amount ?? untrack(() => stateGame.roundWin);
			enter.set(0, { duration: 0 });
			flash.set(0, { duration: 0 });
			amount.set(0, { duration: 0 });

			const startPresentation = () => {
				if (id !== animationId) return;
				presentationStartedAt = performance.now();
				clock = 0;
				flash.set(0.9, { duration: 0 });
				enter.set(1, { duration: 480, easing: backOut });
				flash.set(0, { duration: 420, easing: cubicOut });
				if (incoming.kind === 'win')
					amount.set(targetAmount, {
						duration: incoming.countDurationMs ?? 1050,
						easing: cubicOut,
					});
			};

			const isNamedWin =
				incoming.kind === 'win' && !incoming.bonusPresentation && incoming.title !== 'WIN';
			if (isNamedWin) {
				const timer = window.setTimeout(startPresentation, 180);
				return () => window.clearTimeout(timer);
			}

			startPresentation();
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
		const tick = (now: number) => {
			clock = presentationStartedAt ? (now - presentationStartedAt) / 1000 : 0;
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
			? ['pixelEggplant', 'pixelCarrot', 'pixelCauliflower', 'pixelRadish']
			: artKey === 'winWild'
				? ['pixelRadish', 'pixelCarrot', 'pixelEggplant', 'pixelTomato']
				: artKey === 'winEpic'
					? ['pixelCarrot', 'pixelEggplant', 'pixelTomato', 'pixelCorn']
					: artKey === 'winMythic'
						? ['pixelEggplant', 'pixelTomato', 'pixelCorn', 'pixelBroccoli']
						: ['pixelBroccoli', 'pixelCorn', 'pixelTomato', 'pixelBroccoli'],
	);
	const bonusEndVeggies: VeggieKey[] = [
		'pixelBroccoli',
		'pixelCorn',
		'pixelTomato',
		'pixelBroccoli',
	];
	const bonusEndVeggieX = [-220, -96, 96, 220];
	const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
	const timeline = (startSeconds: number, durationSeconds: number) =>
		clamp01((clock - startSeconds) / durationSeconds);
	const popIn = (startSeconds: number, durationSeconds: number) =>
		backOut(timeline(startSeconds, durationSeconds));
	const fadeIn = (startSeconds: number, durationSeconds: number) =>
		cubicOut(timeline(startSeconds, durationSeconds));
	// Vegetables launch clear of the plaque once, then settle with only their heads visible.
	const veggieJumpOffset = (startSeconds: number) => {
		const progress = timeline(startSeconds, 0.76);
		if (progress < 0.44) return 84 - cubicOut(progress / 0.44) * 188;
		return -104 + cubicOut((progress - 0.44) / 0.56) * 104;
	};
	const plaqueIn = $derived(popIn(0, 0.48));
	const titleTopIn = $derived(popIn(0.12, 0.5));
	const titleBottomIn = $derived(popIn(0.23, 0.46));
	const amountIn = $derived(popIn(0.4, 0.42));
	const bonusPlaqueIn = $derived(popIn(0, 0.44));
	const bonusTitleIn = $derived(popIn(0.1, 0.48));
	const bonusCopyIn = $derived(fadeIn(0.2, 0.38));
	const bonusSymbolIn = $derived(popIn(0.36, 0.44));
	const bonusTicketIn = $derived(popIn(0.5, 0.4));
	const namedWinIdleScale = $derived(1 + Math.sin(clock * (2.25 + tier * 0.1)) * 0.007);
	const countedWinText = $derived(
		bookEventAmountToCurrencyString(amount.current, overlay?.amount ?? stateGame.roundWin),
	);
	const amountFontSize = $derived(
		Math.max(25, Math.min(43, Math.floor(470 / Math.max(7, countedWinText.length * 0.68)))),
	);
	const starSlots = [
		{ x: -383, y: 20, size: 68, phase: 0 },
		{ x: 383, y: 20, size: 68, phase: Math.PI },
	];

	const breathe = $derived(1 + Math.sin(clock * (2.2 + tier * 0.08)) * (0.006 + tier * 0.002));
	const mainLayout = $derived(context.stateLayoutDerived.mainLayout());
	const presentationBounds = $derived(
		bonusPresentation === 'start'
			? { width: 600, height: 820 }
			: bonusPresentation === 'end'
				? { width: 980, height: 610 }
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
		fontFamily: 'Jersey 10, monospace',
		fontSize,
		fontWeight: '400' as const,
		fill,
		align: 'center' as const,
		stroke: { color: stroke, width: Math.max(3, Math.round(fontSize * 0.075)) },
		letterSpacing: 0,
	});
	const localizedStartTitle = $derived(stateI18nDerived.translate('CONGRATS!'));
	const localizedEndTitle = $derived(stateI18nDerived.translate('CONGRATULATIONS!'));
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
					<!-- Bonus intro/outro: authored pixel art split into independently animated plaque,
					     title, symbol/veggies, stars, ticket and live-copy layers. -->
					<Container y={plaqueY} scale={plaqueScale} alpha={plaqueAlpha}>
						{#if bonusPresentation === 'start'}
							<Container scale={0.92 + bonusPlaqueIn * 0.08} alpha={clamp01(bonusPlaqueIn)}>
								<Sprite key="bonusStartPlaqueV2" anchor={0.5} width={500} height={764} />
							</Container>

							<Container
								y={-286 - (1 - clamp01(bonusTitleIn)) * 46}
								scale={bonusTitleIn}
								rotation={Math.sin(clock * 2.15) * 0.006}
								alpha={clamp01(bonusTitleIn)}
							>
								<!-- Bitmap title stays live: language changes never require replacement art. -->
								<ResponsiveBitmapText
									anchor={0.5}
									y={7}
									maxWidth={440}
									text={localizedStartTitle}
									style={pixelText(70, 0x7d230d, 0x1c0903)}
								/>
								<ResponsiveBitmapText
									anchor={0.5}
									maxWidth={440}
									text={localizedStartTitle}
									style={pixelText(70, 0xffb632, 0x321505)}
								/>
							</Container>

							<Container alpha={bonusCopyIn} y={(1 - bonusCopyIn) * 18}>
								<BitmapText
									anchor={0.5}
									y={-210}
									text={stateI18nDerived.translate('YOU WON')}
									style={pixelText(36, 0xffbd34)}
								/>
								<ResponsiveBitmapText
									anchor={0.5}
									y={-154}
									maxWidth={430}
									text={bonusModeText}
									style={pixelText(46, 0xffffff)}
								/>
								<BitmapText
									anchor={0.5}
									y={-82}
									text={bonusIntroText}
									style={{
										...pixelText(25, 0xffffff),
										wordWrap: true,
										wordWrapWidth: 430,
										lineHeight: 32,
									}}
								/>
							</Container>

							<Container
								y={62 + (1 - clamp01(bonusSymbolIn)) * 54 + Math.sin(clock * 3) * 5}
								scale={bonusSymbolIn * (1 + Math.sin(clock * 2.6) * 0.018)}
								rotation={Math.sin(clock * 2.2) * 0.025}
								alpha={clamp01(bonusSymbolIn)}
							>
								<!-- Actual feature scatter. Never baked into the plaque. -->
								<Sprite key="pixelScatter" anchor={0.5} width={138} height={138} />
							</Container>

							<Container
								y={190 + (1 - clamp01(bonusTicketIn)) * 48}
								scale={bonusTicketIn}
								alpha={clamp01(bonusTicketIn)}
							>
								<Sprite key="bonusStartTicketV2" anchor={0.5} width={260} height={106} />
								<BitmapText
									anchor={0.5}
									y={-2}
									text={overlay.freeSpins ?? 0}
									style={pixelText(78, 0xffffff, 0x4c2008)}
								/>
								<ResponsiveBitmapText
									anchor={0.5}
									y={106}
									maxWidth={430}
									text={stateI18nDerived.translate('FREE SPINS')}
									style={pixelText(43, 0xffbd34)}
								/>
							</Container>
						{:else}
							{#each bonusEndVeggies as veggie, index}
								{@const veggieStart = 0.08 + index * 0.06}
								{@const veggieIn = popIn(veggieStart, 0.38)}
								{@const veggieRestY = -126 - (index === 1 || index === 2 ? 8 : 0)}
								<Container
									x={bonusEndVeggieX[index]}
									y={veggieRestY +
										veggieJumpOffset(veggieStart) +
										Math.sin(clock * 2.7 + index) * 5}
									scale={veggieIn * (1 + Math.sin(clock * 2.3 + index) * 0.02)}
									rotation={(index - 1.5) * 0.02 + Math.sin(clock * 2 + index) * 0.018}
									alpha={clamp01(veggieIn)}
								>
									<Sprite key={veggie} anchor={0.5} width={132} height={132} />
								</Container>
							{/each}

							<Container scale={0.9 + bonusPlaqueIn * 0.1} alpha={clamp01(bonusPlaqueIn)}>
								<Sprite key="bonusEndPlaqueV2" anchor={0.5} width={750} height={262} />
							</Container>

							{#each starSlots as star, index}
								{@const starIn = popIn(0.25 + index * 0.08, 0.36)}
								<Container
									x={star.x * 0.82}
									y={13}
									scale={starIn * (1 + Math.sin(clock * 3.2 + star.phase) * 0.08)}
									rotation={(index ? 1 : -1) * 0.1 + Math.sin(clock * 2.4 + index) * 0.05}
									alpha={clamp01(starIn)}
								>
									<Sprite key="winStarSweetV2" anchor={0.5} width={60} height={58} />
								</Container>
							{/each}

							<Container
								y={-33 - (1 - clamp01(bonusTitleIn)) * 44}
								scale={bonusTitleIn}
								rotation={Math.sin(clock * 1.9) * 0.006}
								alpha={clamp01(bonusTitleIn)}
							>
								<ResponsiveBitmapText
									anchor={0.5}
									y={7}
									maxWidth={610}
									text={localizedEndTitle}
									style={pixelText(63, 0x7d230d, 0x1c0903)}
								/>
								<ResponsiveBitmapText
									anchor={0.5}
									maxWidth={610}
									text={localizedEndTitle}
									style={pixelText(63, 0xffb632, 0x321505)}
								/>
							</Container>

							<BitmapText
								anchor={0.5}
								y={20 + (1 - bonusCopyIn) * 16}
								alpha={bonusCopyIn}
								text={stateI18nDerived.translate('YOU WON')}
								style={pixelText(42, 0xffffff)}
							/>

							<Container
								y={118 + (1 - clamp01(bonusTicketIn)) * 44}
								scale={bonusTicketIn}
								alpha={clamp01(bonusTicketIn)}
							>
								<Sprite key="winAmountLegendaryV2" anchor={0.5} width={410} height={139} />
								<ResponsiveBitmapText
									anchor={0.5}
									y={-5}
									maxWidth={330}
									text={bookEventAmountToCurrencyString(
										amount.current,
										overlay.amount ?? stateGame.roundWin,
									)}
									style={pixelText(amountFontSize + 34, 0xffffff, 0x4c2008)}
								/>
							</Container>
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
							{@const veggieStart = 0.1 + index * 0.055}
							{@const veggieIn = popIn(veggieStart, 0.38)}
							{@const veggieX = [-300, -105, 105, 300][index]}
							{@const veggieRestY = -189 - (index === 1 || index === 2 ? 12 : 0)}
							<Container
								x={veggieX}
								y={veggieRestY + veggieJumpOffset(veggieStart)}
								scale={veggieIn * (1 + Math.sin(clock * 2.7 + index * 0.9) * 0.025)}
								rotation={(index - 2) * 0.025 + Math.sin(clock * 2.1 + index) * 0.02}
								alpha={clamp01(veggieIn)}
							>
								<Sprite key={veggie} anchor={0.5} width={142} height={142} />
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

						<!-- Two fixed plaque stars: symmetric, centred in the authored side panels. -->
						{#each starSlots as star, index}
							{@const starIn = popIn(0.24 + index * 0.045, 0.34)}
							<Container
								x={star.x}
								y={star.y}
								scale={starIn * (0.97 + Math.sin(clock * 4.2 + star.phase) * 0.03)}
								rotation={Math.sin(clock * 2.7 + star.phase) * 0.035}
								alpha={clamp01(starIn)}
							>
								<Sprite
									key="winStarSweetV2"
									anchor={0.5}
									width={star.size}
									height={star.size * 0.965}
								/>
							</Container>
						{/each}

						<!-- Tier word and WIN land separately so every named screen shares one motion language. -->
						<Container
							y={-50 - (1 - clamp01(titleTopIn)) * 104 + Math.sin(clock * 2.8) * 2.5}
							scale={titleTopIn * (1 + Math.sin(clock * 2.45 + tier) * 0.0065)}
							rotation={(1 - clamp01(titleTopIn)) * -0.035 + Math.sin(clock * 1.8) * 0.003}
							alpha={clamp01(titleTopIn)}
						>
							<Sprite
								key={winArt.titleTop}
								anchor={0.5}
								width={winArt.titleTopWidth}
								height={winArt.titleTopHeight}
							/>
						</Container>
						<Container
							y={91 + (1 - clamp01(titleBottomIn)) * 76 + Math.sin(clock * 2.55 + 0.7) * 2}
							scale={titleBottomIn * (1 + Math.sin(clock * 2.3 + 0.8) * 0.006)}
							rotation={(1 - clamp01(titleBottomIn)) * 0.03 - Math.sin(clock * 1.9) * 0.0025}
							alpha={clamp01(titleBottomIn)}
						>
							<Sprite key="winTitleSweetBottomV2" anchor={0.5} width={390} height={165} />
						</Container>

						<!-- Amount ticket is a detached layer: no connector plank. -->
						<Container
							y={270 + (1 - clamp01(amountIn)) * 70}
							scale={amountIn}
							alpha={clamp01(amountIn)}
						>
							<Sprite key={winArt.amountPlaque} anchor={0.5} width={459} height={155} />
							<ResponsiveBitmapText
								anchor={0.5}
								y={-6}
								maxWidth={369}
								text={countedWinText}
								style={pixelText(amountFontSize + 30, 0xffffff, 0x4c2008)}
							/>
						</Container>
					</Container>
				{:else if isSmallWin}
					<!-- Under 20×: text-only pixel win. No fullscreen shade, plaque, vegetables, or coins. -->
					<Container y={plaqueY + 20} scale={plaqueScale} alpha={plaqueAlpha}>
						<BitmapText
							anchor={0.5}
							y={-34}
							text={smallWinText}
							style={pixelText(48, 0xffdf3f, 0x2b1605)}
						/>
						<BitmapText
							anchor={0.5}
							y={38}
							text={bookEventAmountToCurrencyString(
								amount.current,
								overlay.amount ?? stateGame.roundWin,
							)}
							style={pixelText(54, 0xffffff, 0x17380d)}
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
								fontFamily: 'Jersey 10, monospace',
								fontSize: 50,
								fontWeight: '400',
								fill: 0xffdf3f,
								stroke: { color: 0x2b0c38, width: 7 },
							}}
						/>
						<Text
							anchor={0.5}
							y={48}
							text={overlay.detail}
							style={{
								fontFamily: 'Jersey 10, monospace',
								fontSize: 27,
								fontWeight: '400',
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
