<script lang="ts">
	import { Container, FillGradient, Sprite, Text, PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { WIN_CARD_COIN_ASPECT, WIN_CARD_TIERS, tierFromBoardKey } from '../game/winCardParts';
	import WinCardLights from './WinCardLights.svelte';

	// The big-win card, assembled from its separate Figma parts and choreographed.
	//
	// It used to be one pre-rendered sprite sheet per tier — 36 flat frames, 3.4 MB each, and the
	// motion baked in. The Figma redesign (6089:434 and the four frames beside it) keeps every
	// element as its own image, so the card is now built live and each piece gets its own entrance:
	// the wordmark drops in from above the card, the coins fly in from the sides spinning, the P
	// badge punches in past its final size and settles back, and the marquee bulbs light.
	//
	// Everything is a pure function of `elapsed`, one clock reset per win, rather than a Tween per
	// element — with this many pieces on overlapping delays, reading the timeline in one place is
	// worth more than the per-property interpolation Tween would give.

	type Props = {
		boardKey: string;
		winId: number;
		boardSize: number;
		amountText: string;
		fontSize: number;
		breatheScale: number;
		/**
		 * Whether the card is on screen. It stays MOUNTED between wins — <Win> keeps the last win's
		 * data and fades the container — so without this the clock would keep ticking and keep
		 * re-alphaing a couple of hundred bulb sprites through every ordinary spin.
		 */
		active: boolean;
	};

	const { boardKey, winId, boardSize, amountText, fontSize, breatheScale, active }: Props =
		$props();
	const context = getContext();

	const tier = $derived(WIN_CARD_TIERS[tierFromBoardKey(boardKey)]);
	/** winSweet + 'Panel' -> winCardSweetPanel, matching the keys registered in assets.ts. */
	const assetKey = (role: string) => `winCard${boardKey.replace(/^win/, '')}${role}`;
	/** The flat one-piece card, shown until the deferred parts land. Same art, no choreography. */
	const partsReady = $derived(!!context.stateApp.loadedAssets?.[assetKey('Panel')]);

	// === TIMELINE (ms from the card appearing) ===
	// Overlapping on purpose: the panel is still settling as the first coins arrive, and the badge
	// lands last so the eye finishes on the middle of the card.
	const PANEL = { at: 0, dur: 420 };
	const COINS = { at: 200, dur: 700, stagger: 90 };
	const TEXT = { at: 300, dur: 1100 };
	const RING = { at: 380, dur: 620 };
	const BADGE = { at: 900, dur: 900 };
	const LIGHTS = { at: 260, dur: 620 };

	/** Where the wordmark starts, in card heights above its resting place. */
	const TEXT_FROM = -1.35;

	let elapsed = $state(0);
	let seenWinId = -1;

	// One clock for the whole card, off the application ticker rather than a private rAF — the same
	// reason <PanelBorderLights> does: a private rAF runs out of phase with the frames
	// <SceneAnimationDriver> actually renders, and the card would judder against everything else.
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		const tick = () => {
			if (active) elapsed += app.ticker.deltaMS / 1000;
		};
		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
		return () => app.ticker.remove(tick, null);
	});

	// A new win restarts the choreography. Reading winId is what subscribes this effect.
	$effect(() => {
		if (winId === seenWinId) return;
		seenWinId = winId;
		elapsed = 0;
	});

	const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
	const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
	/** Progress through a stage, 0-1. */
	const at = (stage: { at: number; dur: number }, offset = 0) =>
		clamp01((elapsed * 1000 - stage.at - offset) / stage.dur);

	/** Overshoot ease. `s` sets how far past the target it goes; 1.70158 is the standard 10%. */
	const backOut = (s: number) => (t: number) => {
		const u = t - 1;
		return 1 + (s + 1) * u ** 3 + s * u ** 2;
	};
	const softBack = backOut(1.6);

	/**
	 * A fall, not an ease-in-out. backOut spends nearly all its travel in the first fifth of its
	 * duration, which for something dropping in from off-card means it has already arrived before
	 * the eye finds it — the drop reads as a cut. This accelerates like gravity instead, lands 7%
	 * past the target and springs back with one damped wobble.
	 */
	const FALL = 0.66;
	const OVERSHOOT = 0.07;
	const gravityDrop = (t: number) => {
		if (t <= 0) return 0;
		if (t < FALL) return (1 + OVERSHOOT) * (t / FALL) ** 2;
		const u = (t - FALL) / (1 - FALL);
		return 1 + OVERSHOOT * (1 - u) ** 2 * Math.cos(u * Math.PI * 1.5);
	};

	/**
	 * "Zoom in from very small to a little bigger than now and bounce back to current position" —
	 * so this returns the SCALE, not a 0-1 ease: it grows from almost nothing to 24% over, then
	 * settles. Splitting it in two keeps the peak where it was asked for; feeding a big-overshoot
	 * backOut a 0.06-to-1 range would put the peak wherever the arithmetic landed.
	 */
	const PEAK = 1.24;
	const RISE = 0.45;
	const punchScale = (t: number) => {
		if (t <= 0) return 0.06;
		if (t < RISE) return lerp(0.06, PEAK, 1 - (1 - t / RISE) ** 3);
		return lerp(PEAK, 1, 1 - (1 - (t - RISE) / (1 - RISE)) ** 3);
	};

	// === PANEL ===
	// The panel's own entrance only — `breatheScale` is applied to the WHOLE card by the outermost
	// container. Applied here it pulsed the panel while the wordmark, coins and badge sat still, and
	// the card visibly came apart.
	const panelIn = $derived(softBack(at(PANEL)));
	const panelScale = $derived(lerp(0.62, 1, panelIn));
	const panelAlpha = $derived(clamp01(at(PANEL) * 3.5));
	/**
	 * A second copy of the panel drawn additively. Additive blending scales with source brightness,
	 * so this blooms the bulbs, the neon strip and the gold and leaves the dark field alone — the
	 * whole card breathes light for the cost of one sprite, and unlike the per-bulb glows it cannot
	 * land in the wrong place.
	 */
	const panelBloom = $derived(0.1 + 0.075 * Math.sin(elapsed * 2.2) * clamp01(at(LIGHTS)));

	// === WORDMARK ===
	// "Come from up and move down to the position": it starts above the top of the card and lands
	// with a stretch on the way down and a squash on impact.
	const textIn = $derived(gravityDrop(at(TEXT)));
	const textY = $derived(lerp(tier.text.y + TEXT_FROM, tier.text.y, textIn) * boardSize);
	const textSquash = $derived(Math.max(0, textIn - 1) * 2.2);
	const textStretch = $derived((1 - at(TEXT)) ** 2 * 0.2);
	const textScale = $derived({
		x: 1 + textSquash - textStretch,
		y: 1 - textSquash + textStretch,
	});

	// === MEDALLION RING ===
	const ringIn = $derived(softBack(at(RING)));

	// === P BADGE ===
	const badgeIdle = $derived(1 + 0.03 * Math.sin(elapsed * 2.4) * clamp01(at(BADGE) * 10 - 9));
	const badgeScale = $derived(punchScale(at(BADGE)) * badgeIdle);

	// === COINS ===
	// "Come from left and right and rotate". They start outside the card on their own side and
	// unwind their spin as they arrive; the column is staggered so they read as six coins, not one
	// row. After landing they keep a slow bob so the card never goes completely still.
	const COIN_SPINS = 1.75;
	const coins = $derived(
		tier.coins.map((rect, index) => {
			const side = index < 3 ? -1 : 1;
			const progress = at(COINS, (index % 3) * COINS.stagger);
			const eased = softBack(progress);
			const settled = clamp01(progress * 4 - 3);
			return {
				index,
				x: lerp(side * 0.92, rect.x, eased) * boardSize,
				y: (rect.y + Math.sin(elapsed * 1.6 + index) * 0.006 * settled) * boardSize,
				w: rect.w * boardSize,
				// Height from the ART's aspect, not the node box's: the coin's Figma fill is cropped,
				// so its box is a fraction taller than the disc and sizing to it made the coin an
				// ellipse.
				h: ((rect.w * boardSize) / WIN_CARD_COIN_ASPECT),
				// Unwound from a curve of its own rather than from `eased`: the positional ease is
				// nearly finished a fifth of the way in, which would put the whole spin in the
				// first 100 ms and leave the coin gliding the rest of the way already still.
				rotation:
					(1 - progress) ** 2 * -side * COIN_SPINS * Math.PI * 2 +
					Math.sin(elapsed * 1.9 + index * 1.7) * 0.05 * settled,
				alpha: clamp01(progress * 4),
			};
		}),
	);

	// === AMOUNT ===
	let amountWidth = $state(0);
	const amountScale = $derived(amountWidth > 0 ? Math.min(1, (boardSize * 0.62) / amountWidth) : 1);

	// Figma 6541:4136: Lilita One 64px at 3% tracking, over
	// linear-gradient(181deg, #E2D981 17.62%, #FBC503 60.04%, #D98503 102.47%).
	const amountFill = new FillGradient({
		type: 'linear',
		start: { x: 0.52, y: 0 },
		end: { x: 0.48, y: 1 },
		colorStops: [
			{ offset: 0.1762, color: 0xe2d981 },
			{ offset: 0.6004, color: 0xfbc503 },
			{ offset: 1, color: 0xd98503 },
		],
		textureSpace: 'local',
	});
</script>

<!-- Every layer stays mounted for the life of the card and is driven by alpha. Mounting one on
     demand would append it to the TOP of the container, which is how the panel ended up painted
     over the amount the first time round. -->
<!-- `breatheScale` belongs on the WHOLE card, amount included, so it pulses as one object. -->
<Container scale={breatheScale}>
	<!-- The flat one-piece card, holding the place until the deferred parts arrive. Same art, so
	     the swap is invisible; it just cannot be taken apart and animated. -->
	<Container alpha={partsReady ? 0 : 1}>
		<Sprite key={boardKey} anchor={0.5} width={boardSize} height={boardSize} />
	</Container>

	<Container alpha={partsReady ? 1 : 0}>
		<Container scale={panelScale}>
			<Sprite
				key={assetKey('Panel')}
				anchor={0.5}
				x={tier.panel.x * boardSize}
				y={tier.panel.y * boardSize}
				width={tier.panel.w * boardSize}
				height={tier.panel.h * boardSize}
				alpha={panelAlpha}
			/>
			<Sprite
				key={assetKey('Panel')}
				anchor={0.5}
				blendMode="add"
				x={tier.panel.x * boardSize}
				y={tier.panel.y * boardSize}
				width={tier.panel.w * boardSize}
				height={tier.panel.h * boardSize}
				alpha={panelBloom * panelAlpha}
			/>
			<WinCardLights
				bulbs={tier.panelBulbs}
				size={boardSize}
				colour={tier.panelBulbColour}
				radius={0.034}
				intensity={clamp01(at(LIGHTS))}
				{elapsed}
			/>
		</Container>

		{#each coins as c (c.index)}
			<Sprite
				key="winCardCoin"
				anchor={0.5}
				x={c.x}
				y={c.y}
				width={c.w}
				height={c.h}
				rotation={c.rotation}
				alpha={c.alpha}
			/>
		{/each}

		<Container
			x={tier.ring.x * boardSize}
			y={tier.ring.y * boardSize}
			scale={lerp(0.3, 1, ringIn)}
			rotation={(1 - ringIn) * -0.6}
			alpha={clamp01(at(RING) * 3.5)}
		>
			<Sprite
				key={assetKey('Ring')}
				anchor={0.5}
				width={tier.ring.w * boardSize}
				height={tier.ring.h * boardSize}
			/>
			<WinCardLights
				bulbs={tier.ringBulbs}
				size={boardSize}
				origin={{ x: tier.ring.x, y: tier.ring.y }}
				colour={tier.ringBulbColour}
				radius={0.03}
				cycles={3}
				speed={0.3}
				intensity={clamp01(at(LIGHTS))}
				{elapsed}
			/>
		</Container>

		<Container
			x={tier.badge.x * boardSize}
			y={tier.badge.y * boardSize}
			scale={badgeScale}
			alpha={clamp01(at(BADGE) * 6)}
		>
			<Sprite
				key={assetKey('Badge')}
				anchor={0.5}
				width={tier.badge.w * boardSize}
				height={tier.badge.h * boardSize}
			/>
		</Container>

		<Container x={tier.text.x * boardSize} y={textY} scale={textScale}>
			<Sprite
				key={assetKey('Text')}
				anchor={0.5}
				width={tier.text.w * boardSize}
				height={tier.text.h * boardSize}
				alpha={clamp01(at(TEXT) * 3.5)}
			/>
		</Container>
	</Container>

	<!-- The amount sits centred in the card's bottom marquee plate, whose height differs a little
	     per tier (winCardParts.amountY). Style per Figma: Cinzel 900, gold gradient fill, 1px black
	     stroke and 3% letter-spacing at the 64px design size. -->
	<Container y={tier.amountY * boardSize} scale={amountScale}>
		<Text
			anchor={0.5}
			text={amountText}
			onresize={({ width }) => (amountWidth = width)}
			style={{
				fontFamily: 'Lilita One',
				fontWeight: '400',
				fontSize,
				align: 'center',
				fill: amountFill,
				letterSpacing: fontSize * 0.03,
				stroke: { color: 0x000000, width: Math.max(1, Math.round(fontSize / 64)) },
			}}
		/>
	</Container>
</Container>
