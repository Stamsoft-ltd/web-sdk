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
	type ArtKey = 'winSweet' | 'winWild' | 'winEpic' | 'winMythic' | 'winLegendary' | 'winMax';
	type BannerArtKey = Exclude<ArtKey, 'winMax'>;
	type WinBannerKey =
		| 'winBannerSweetV3'
		| 'winBannerWildV3'
		| 'winBannerEpicV3'
		| 'winBannerMythicV3'
		| 'winBannerLegendaryV3';
	type WinTitleKey =
		| 'winTitleSweetTopV2'
		| 'winTitleEpicV2'
		| 'winTitleMythicV2'
		| 'winTitleLegendaryV2';
	type VeggieKey =
		| 'winVeggieCabbage'
		| 'winVeggiePepper'
		| 'winVeggieTomato'
		| 'winVeggieEggplant'
		| 'winVeggiePotato'
		| 'winVeggieRadish'
		| 'winVeggieGarlic';
	type WinArt = {
		banner: WinBannerKey;
		// WILD carries the design's own two-line word art. Every other tier stacks its tier word
		// (fitted into the same box, aspect kept) over the cream WIN, so all five read as one family.
		wordArt?: 'winWordArtWildV3';
		titleTop?: WinTitleKey;
		titleTopWidth?: number;
		titleTopHeight?: number;
		// Five symbols, one per VEGGIE_SLOTS entry, in draw order.
		veggies: [VeggieKey, VeggieKey, VeggieKey, VeggieKey, VeggieKey];
	};

	/* Named wins follow design 9242:190479, a 1200x670 mock of the whole window. Every number below
	   is that frame's own pixel value relative to its centre (600,335); the branch is drawn inside a
	   DESIGN_SCALE container so those values land in the 1422-wide desktop main layout at the same
	   proportion the mock shows. */
	const DESIGN_SCALE = 1422 / 1200;
	// Banner 9242:190694: a 989x374 box whose riveted sign fills 865x254 of it, centred at (600,325).
	const BANNER = { x: 0, y: -10, width: 869, height: 255 };
	// Word art 9242:190797: a 444x301 box, art 415x276 of it, centred at (600,314).
	const WORD_ART = { x: 0, y: -21, width: 415, height: 276 };
	// Tier word + WIN for the stacked tiers: the mock's WILD sits in 444x166 above a 290x123 WIN.
	// Pulled 15 and 18 closer than the mock's centres ("reduce space vertically between texts",
	// user 2026-09-17); WIN now rides the banner's bottom edge the way the mock's WILD art does.
	const TITLE_TOP_BOX = { y: -73, maxWidth: 420, maxHeight: 165 };
	const TITLE_WIN = { y: 45, width: 290, height: 123 };
	// The two title pieces enter from opposite screen edges and land in their stack: the tier
	// word drops in from above the window, WIN rises from below it. In 1200-frame units, so the
	// start points sit clear of a 670-tall window with the copy's own height to spare.
	const TITLE_TRAVEL = { top: 360, bottom: 380 };
	/* The titles fly in only once the banner has finished its own 480ms pop — before that the
	   whole composition is still scaling up from nothing and a slide inside it reads as part of
	   the pop. Every named win holds for at least 2.5s past its count, so the count can wait for
	   the plaque. */
	const NAMED_AMOUNT_DELAY_MS = 950;
	// star1 9242:192620 / 9242:192630: 84x79 boxes whose star is 49x47, centred at x=299 and 897.
	const STAR_SLOTS = [
		{ x: -301, y: -12, size: 52, phase: 0 },
		{ x: 297, y: -12, size: 52, phase: Math.PI },
	];
	// Amount plaque 9251:194931: 380x127 at (410,458) with the total in Jersey 10 at 73.65. Drawn
	// 12% larger than the mock so the amount is unmistakably the biggest text on the screen.
	const AMOUNT_PLAQUE = { y: 152, width: 407, height: 107, fontSize: 84, maxWidth: 350 };
	/* Component 25 instances — the game's own symbol art. Each is placed by its box centre and the
	   square the symbol texture is scaled into (164, 142, 178, 139, 175 — measured off the mock's
	   inner image boxes). Design 9242:184876 draws the same slots with the board's set: pepper,
	   potato, garlic, radish, tomato; SWEET uses exactly those, the other tiers vary the pick. */
	const VEGGIE_SLOTS = [
		// Sunk 10-17 units below the mock so more of each body sits behind the banner ("hide a
		// little more the veggies behind the plate", user 2026-09-24) — no further, or the word art
		// starts covering the faces; the wing pair also comes in a little.
		{ x: -364, y: -146, size: 164, rotation: -24.43, start: 0.1 },
		{ x: -184, y: -164, size: 142, rotation: -20.09, start: 0.16 },
		{ x: 10, y: -192, size: 178, rotation: 0, start: 0.22 },
		{ x: 180, y: -160, size: 139, rotation: 0, start: 0.28 },
		{ x: 362, y: -120, size: 175, rotation: 24.69, start: 0.34 },
	];
	/* MAX WIN, design 9428:64173: no banner. The word art (9428:64660, 684x429 with its top at 71)
	   sits over the dimmed board, the total on the same orange plaque (9428:64494, 380x127 at 487,
	   its amount at Jersey 73.65), and six symbols are flung around the frame — the mock hangs its
	   cauliflower and broccoli half off the 1200-wide window. Each slot keeps the mock's rotation
	   and the square the texture is scaled into so the texture's content matches the mock's inner
	   image box (content bounds measured off the webp files), but the mock's centres are pulled
	   in to the word art's edge so each symbol peeks out from behind the letters and its flight
	   (MAX_WIN_FLIGHT) carries it in and out of cover ("show from behind the text partially",
	   user 2026-09-21). The six are the board's set (see pixelAssets.ts), not the mock's older one. */
	const MAX_WIN_WORD_ART = { y: -50, width: 684, height: 429 };
	const MAX_WIN_AMOUNT_Y = 214;
	// `stack` is the portrait fallback (see maxWinVeggiePlace): a row of three above the word art
	// and three below the plaque, each at `stackX` of the visible half-width.
	const MAX_WIN_VEGGIE_SLOTS: {
		key: VeggieKey;
		x: number;
		y: number;
		size: number;
		rotation: number;
		start: number;
		stack: 'top' | 'bottom';
		stackX: number;
	}[] = [
		{
			key: 'winVeggieRadish',
			x: -372,
			y: -40,
			size: 193,
			rotation: 0,
			start: 0.1,
			stack: 'top',
			stackX: -0.62,
		},
		{
			key: 'winVeggiePotato',
			x: -300,
			y: -218,
			size: 210,
			rotation: 12.9,
			start: 0.16,
			stack: 'top',
			stackX: 0,
		},
		{
			key: 'winVeggiePepper',
			x: -318,
			y: 74,
			size: 205,
			rotation: -37.94,
			start: 0.22,
			stack: 'bottom',
			stackX: -0.62,
		},
		{
			key: 'winVeggieTomato',
			x: 348,
			y: -226,
			size: 165,
			rotation: -37,
			start: 0.28,
			stack: 'top',
			stackX: 0.62,
		},
		{
			key: 'winVeggieGarlic',
			x: 300,
			y: 92,
			size: 213,
			rotation: 33.25,
			start: 0.34,
			stack: 'bottom',
			stackX: 0,
		},
		{
			key: 'winVeggieCabbage',
			x: 378,
			y: -46,
			size: 184,
			rotation: 32.31,
			start: 0.4,
			stack: 'bottom',
			stackX: 0.62,
		},
	];
	/* The slot sizes were measured against the old symbol set, whose art filled 0.876 of its square
	   on average; the board sprites share one pixel size on a padded 267 canvas and fill 0.786. One
	   factor for all keeps the board's own proportions between vegetables. */
	const VEGGIE_SCALE = 0.876 / 0.786;
	const fitBox = (width: number, height: number, maxWidth: number, maxHeight: number) => {
		const scale = Math.min(maxWidth / width, maxHeight / height);
		return { width: width * scale, height: height * scale };
	};

	const WIN_ART: Record<BannerArtKey, WinArt> = {
		winSweet: {
			banner: 'winBannerSweetV3',
			titleTop: 'winTitleSweetTopV2',
			titleTopWidth: 1607,
			titleTopHeight: 574,
			veggies: [
				'winVeggiePepper',
				'winVeggiePotato',
				'winVeggieGarlic',
				'winVeggieRadish',
				'winVeggieTomato',
			],
		},
		winWild: {
			banner: 'winBannerWildV3',
			wordArt: 'winWordArtWildV3',
			veggies: [
				'winVeggieEggplant',
				'winVeggieRadish',
				'winVeggieCabbage',
				'winVeggiePotato',
				'winVeggiePepper',
			],
		},
		winEpic: {
			banner: 'winBannerEpicV3',
			titleTop: 'winTitleEpicV2',
			titleTopWidth: 1614,
			titleTopHeight: 706,
			veggies: [
				'winVeggieGarlic',
				'winVeggieEggplant',
				'winVeggieTomato',
				'winVeggiePepper',
				'winVeggieRadish',
			],
		},
		winMythic: {
			banner: 'winBannerMythicV3',
			titleTop: 'winTitleMythicV2',
			titleTopWidth: 2057,
			titleTopHeight: 684,
			veggies: [
				'winVeggiePotato',
				'winVeggieTomato',
				'winVeggiePepper',
				'winVeggieCabbage',
				'winVeggieGarlic',
			],
		},
		winLegendary: {
			banner: 'winBannerLegendaryV3',
			titleTop: 'winTitleLegendaryV2',
			titleTopWidth: 2082,
			titleTopHeight: 633,
			veggies: [
				'winVeggieCabbage',
				'winVeggiePepper',
				'winVeggieTomato',
				'winVeggieEggplant',
				'winVeggieRadish',
			],
		},
	};

	const context = getContext();
	// Dev-only: lets a headless check force any presentation without replaying a whole book.
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		(
			window as unknown as { __veggieOverlay?: (next: typeof stateGame.overlay) => void }
		).__veggieOverlay = (next) => {
			stateGame.overlay = next;
		};
	}
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

			const isNamedWin =
				incoming.kind === 'win' && !incoming.bonusPresentation && incoming.title !== 'WIN';
			const startPresentation = () => {
				if (id !== animationId) return;
				presentationStartedAt = performance.now();
				clock = 0;
				flash.set(0.9, { duration: 0 });
				enter.set(1, { duration: 480, easing: backOut });
				flash.set(0, { duration: 420, easing: cubicOut });
				if (incoming.kind === 'win')
					amount.set(targetAmount, {
						// A named win's plaque lands after the title slide; count from when it shows.
						delay: isNamedWin ? NAMED_AMOUNT_DELAY_MS : 0,
						duration: incoming.countDurationMs ?? 1050,
						easing: cubicOut,
					});
			};

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
			: title === 'MAX WIN'
				? 'winMax'
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
	// The bonus outro is a flat sign on the board in design 9044:16622 — no coin fountain over it.
	const showCoins = $derived(showAmount && bonusPresentation !== 'end');
	const isSmallWin = $derived(showAmount && title === 'WIN');
	const showBackdrop = $derived(!isSmallWin);
	const winArt = $derived(artKey && artKey !== 'winMax' ? WIN_ART[artKey] : null);

	const tier = $derived(
		artKey === 'winMax'
			? 6
			: artKey === 'winLegendary'
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
		artKey === 'winMax'
			? 0xff7a1a
			: artKey === 'winSweet'
				? 0x2c9dff
				: artKey === 'winWild' || bonusPresentation === 'start'
					? 0x72e622
					: artKey === 'winEpic'
						? 0xff3d27
						: artKey === 'winMythic'
							? 0xc43cff
							: 0xffc52c,
	);
	const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
	const timeline = (startSeconds: number, durationSeconds: number) =>
		clamp01((clock - startSeconds) / durationSeconds);
	const popIn = (startSeconds: number, durationSeconds: number) =>
		backOut(timeline(startSeconds, durationSeconds));
	const fadeIn = (startSeconds: number, durationSeconds: number) =>
		cubicOut(timeline(startSeconds, durationSeconds));
	// A long slide wants a landing, not a pop: svelte's backOut overshoots ~10%, which over a
	// 360-unit flight would sail 36 past the mark. Same curve with s=1 overshoots 3.7% (13 units).
	const settle = (t: number) => {
		const s = 1;
		const u = t - 1;
		return u * u * ((s + 1) * u + s) + 1;
	};
	const slideIn = (startSeconds: number, durationSeconds: number) =>
		settle(timeline(startSeconds, durationSeconds));
	// Vegetables launch clear of the plaque once, then settle with only their heads visible.
	const veggieJumpOffset = (startSeconds: number) => {
		const progress = timeline(startSeconds, 0.76);
		if (progress < 0.44) return 84 - cubicOut(progress / 0.44) * 188;
		return -104 + cubicOut((progress - 0.44) / 0.56) * 104;
	};
	/* ── Congrats perch ─────────────────────────────────────────────────────────────────────────
	   Design 9044:16622 (updated 2026-09-24) drops the basket: five of the board's own vegetables
	   perch along the sign's top edge — pepper leaning off the left wing, potato, garlic in the
	   middle and a head taller, radish, tomato tipping off the right wing — each half hidden behind
	   the sign. Positions are the art's centre measured off the design render, in this branch's
	   units (the sign is 750 wide here, 650 in the design, so design px x 1.154) relative to the
	   sign's centre; `h` is the art's visible height. The sprites are the win banner's winVeggie*
	   keys (267px board canvases), so eyes come for free. Each is pivoted on its foot, found by
	   rotating the half-height down from the centre, so a hop lifts it off the sign edge. */
	const VEG_CANVAS = 267;
	const perch = (
		cx: number,
		cy: number,
		h: number,
		deg: number,
		bbox: [number, number, number, number],
	) => {
		const rotation = (deg * Math.PI) / 180;
		const size = (h / (bbox[3] - bbox[1])) * VEG_CANVAS;
		const half = h * 0.5;
		return {
			x: cx - Math.sin(rotation) * half,
			y: cy + Math.cos(rotation) * half,
			rotation,
			anchor: { x: (bbox[0] + bbox[2]) / 2 / VEG_CANVAS, y: bbox[3] / VEG_CANVAS },
			size,
		};
	};
	// Painted back to front: the middle three first, the two wing leaners over them.
	const BASKET_VEG: {
		key: VeggieKey;
		rect: ReturnType<typeof perch>;
		start: number;
		period: number;
		hop: number;
		tilt: number;
	}[] = [
		{
			key: 'winVeggiePotato',
			rect: perch(-157, -130, 104, -4.1, [48, 30, 216, 238]),
			start: 0.2,
			period: 3.4,
			hop: 9,
			tilt: -0.05,
		},
		{
			key: 'winVeggieRadish',
			rect: perch(175, -133, 111, 0, [54, 15, 207, 258]),
			start: 0.32,
			period: 4.1,
			hop: 10,
			tilt: 0.06,
		},
		{
			key: 'winVeggieGarlic',
			rect: perch(0, -152, 155, 0, [36, 30, 228, 238]),
			start: 0.26,
			period: 3.7,
			hop: 11,
			tilt: 0.04,
		},
		{
			key: 'winVeggiePepper',
			rect: perch(-306, -76, 144, -24.4, [11, 6, 258, 262]),
			start: 0.14,
			period: 4.4,
			hop: 8,
			tilt: -0.06,
		},
		{
			key: 'winVeggieTomato',
			rect: perch(322, -80, 127, 30, [0, 9, 267, 261]),
			start: 0.44,
			period: 4.8,
			hop: 8,
			tilt: 0.06,
		},
	];
	/* ── The intro card's king: the splash rig ─────────────────────────────────────────────────
	   The same layered king and the same keyframes as PixelSplashScreen.svelte's CSS, sampled here
	   because the card is drawn in Pixi. Every part runs on the hop's 3.4s clock (crouch to 62%,
	   apex 72%, landing 84%, rebound 90%); the whole rig tilts on its own 5.1s period. A frame is
	   [percent, translateY (% of the layer), rotate (deg), scaleX, scaleY]; `origin` is the CSS
	   transform-origin, a point on the 451px canvas. Between frames: ease-in-out, as in the CSS. */
	type RigFrame = [number, number, number, number, number];
	const REST = (p: number): RigFrame => [p, 0, 0, 1, 1];
	const KING_RIG: { key: string; origin: [number, number]; frames: RigFrame[] }[] = [
		{
			key: 'kingSprout',
			origin: [0.5, 0.24],
			frames: [
				REST(0),
				[20, 0, -3, 1, 1],
				[40, 0, 3, 1, 1],
				REST(54),
				[62, 3.2, 0, 1, 1],
				[67, -2, 6, 1, 1],
				[74, -3, -7, 1, 1],
				[84, 4.5, 8, 1, 1],
				[88, -2, -5, 1, 1],
				[93, 0, 3, 1, 1],
				[97, 0, -1, 1, 1],
				REST(100),
			],
		},
		{
			key: 'kingBody',
			origin: [0.5, 0.89],
			frames: [
				REST(0),
				REST(54),
				[62, 0, 0, 1.05, 0.95],
				[67, 0, 0, 0.96, 1.05],
				REST(74),
				[84, 0, 0, 1.07, 0.93],
				[88, 0, 0, 0.97, 1.03],
				[93, 0, 0, 1.02, 0.98],
				REST(100),
			],
		},
		{
			key: 'kingCrown',
			origin: [0.5, 0.41],
			frames: [
				REST(0),
				[28, 0, -1, 1, 1],
				[42, 0, 1, 1, 1],
				REST(54),
				[62, 2.4, 0, 1, 1],
				[67, -1, 1, 1, 1],
				[74, -3.5, -3, 1, 1],
				[80, -1, 1, 1, 1],
				[84, 4.5, 2.5, 1, 1],
				[88, -2.5, -2, 1, 1],
				[93, 1, 1, 1, 1],
				REST(100),
			],
		},
		{
			key: 'kingFeetL',
			origin: [0.4, 0.86],
			frames: [
				REST(0),
				REST(18),
				[22, -2.5, -8, 1, 1],
				REST(26),
				REST(62),
				[67, 3, 0, 1, 1],
				[74, 2.5, -10, 1, 1],
				[80, 1, -4, 1, 1],
				REST(84),
				REST(100),
			],
		},
		{
			key: 'kingFeetR',
			origin: [0.6, 0.86],
			frames: [
				REST(0),
				REST(36),
				[40, -2.5, 8, 1, 1],
				REST(44),
				REST(62),
				[67, 3, 0, 1, 1],
				[74, 2.5, 10, 1, 1],
				[80, 1, 4, 1, 1],
				REST(84),
				REST(100),
			],
		},
		{
			key: 'kingCapeL',
			origin: [0.44, 0.6],
			frames: [
				REST(0),
				[30, 0, 1, 1, 1],
				REST(54),
				[62, 1.5, -2, 1, 1],
				[67, -1.5, -5, 1, 1],
				[74, 0, 9, 1, 1],
				[80, 0, 6, 1, 1],
				[84, 2, -5, 1, 1],
				[88, 0, 3, 1, 1],
				[93, 0, -1.5, 1, 1],
				REST(100),
			],
		},
		{
			key: 'kingCapeR',
			origin: [0.56, 0.6],
			frames: [
				REST(0),
				[30, 0, -1, 1, 1],
				REST(54),
				[62, 1.5, 2, 1, 1],
				[67, -1.5, 5, 1, 1],
				[74, 0, -9, 1, 1],
				[80, 0, -6, 1, 1],
				[84, 2, 5, 1, 1],
				[88, 0, -3, 1, 1],
				[93, 0, 1.5, 1, 1],
				REST(100),
			],
		},
	];
	const KING_HOP: RigFrame[] = [
		REST(0),
		REST(62),
		[72, -9, 0, 1, 1],
		REST(84),
		[90, -3, 0, 1, 1],
		REST(100),
	];
	const KING_TILT: RigFrame[] = [
		[0, 0, -2.4, 1, 1],
		[50, 0, 2.4, 0.99, 1.012],
		[100, 0, -2.4, 1, 1],
	];
	const KING_HOP_S = 3.4;
	const KING_TILT_S = 5.1;
	// The rig's canvas in card units: its art then spans the ~104 units the single sprite did.
	const KING_RIG_SIZE = 120;
	const sampleRig = (frames: RigFrame[], seconds: number, period: number) => {
		const pct = ((((seconds / period) % 1) + 1) % 1) * 100;
		let i = 0;
		while (i < frames.length - 2 && frames[i + 1][0] <= pct) i++;
		const [p0, ...a] = frames[i];
		const [p1, ...b] = frames[i + 1];
		const u = p1 > p0 ? Math.min(1, Math.max(0, (pct - p0) / (p1 - p0))) : 0;
		const e = u * u * (3 - 2 * u);
		const [ty, rot, sx, sy] = a.map((v, k) => v + (b[k] - v) * e);
		return { ty, rot: (rot * Math.PI) / 180, sx, sy };
	};

	/* How a basket vegetable moves: it SITS. A slow breath squashes it from its foot (wider as it
	   settles, taller as it fills), and once a period it hops — a quick lift with a lean, a squash
	   on landing — on its own clock, so the bunch takes turns instead of all bobbing on sine waves
	   ("they move a bit unreal", user 2026-09-24). */
	const HOP_SHARE = 0.16;
	const LAND_SHARE = 0.08;
	const basketMotion = (item: (typeof BASKET_VEG)[number], time: number) => {
		const breath = Math.sin(time * 2.1 + item.start * 11);
		const t = ((((time + item.start * 7) / item.period) % 1) + 1) % 1;
		let lift = 0;
		let squash = 0;
		let lean = 0;
		if (t < HOP_SHARE) {
			const u = t / HOP_SHARE;
			lift = Math.sin(Math.PI * u) * item.hop;
			lean = Math.sin(Math.PI * u) * item.tilt;
			squash = -0.05 * Math.sin(Math.PI * u);
		} else if (t < HOP_SHARE + LAND_SHARE) {
			squash = 0.07 * Math.sin((Math.PI * (t - HOP_SHARE)) / LAND_SHARE);
		}
		return {
			lift,
			lean,
			sx: 1 + breath * 0.012 + squash,
			sy: 1 - breath * 0.018 - squash,
		};
	};
	// Eye blinks, splash-style: open at rest, shut for ~170ms at random 2.4–5.6s gaps, now and then
	// a double. The king blinks on the intro card; on the outro every basket vegetable runs its own
	// timer with a staggered first blink, so the bunch never shuts its eyes in unison. Off entirely
	// under prefers-reduced-motion.
	let kingBlinking = $state(false);
	const rand = (min: number, max: number) => min + Math.random() * (max - min);
	const runBlinker = (set: (shut: boolean) => void, firstDelayMs: number) => {
		const timers = new Set<number>();
		const at = (ms: number, fn: () => void) => {
			const id = window.setTimeout(() => {
				timers.delete(id);
				fn();
			}, ms);
			timers.add(id);
		};
		const blink = (again: number) => {
			set(true);
			at(170, () => {
				set(false);
				if (again > 0) at(170, () => blink(again - 1));
				else at(rand(2400, 5600), () => blink(Math.random() < 0.3 ? 1 : 0));
			});
		};
		at(firstDelayMs, () => blink(0));
		return () => {
			for (const id of timers) window.clearTimeout(id);
			set(false);
		};
	};
	// The five banner symbols on a named win: splash-style eyes (blink or a one-pixel glance) on
	// independent timers, each with its own float period and phase so the bunch never bobs or
	// blinks in step. Sizes here are design px; the container scale applies on top.
	type EyeBeat = 'rest' | 'blink' | 'look-l' | 'look-r';
	const WIN_VEGGIE_IDLE = [
		{ bob: 2.35, sway: 1.7, amp: 5.5, tilt: 0.045, phase: 0.0 },
		{ bob: 2.85, sway: 2.2, amp: 4.5, tilt: 0.04, phase: 1.9 },
		{ bob: 2.05, sway: 1.5, amp: 6, tilt: 0.035, phase: 3.7 },
		{ bob: 2.65, sway: 2.0, amp: 4.8, tilt: 0.042, phase: 5.1 },
		{ bob: 2.5, sway: 1.85, amp: 5.2, tilt: 0.048, phase: 2.6 },
		// Sixth channel: the MAX WIN screen throws one more symbol in.
		{ bob: 2.2, sway: 1.95, amp: 5.8, tilt: 0.038, phase: 4.4 },
	];
	let winVeggieEyes = $state<EyeBeat[]>(['rest', 'rest', 'rest', 'rest', 'rest', 'rest']);
	let basketEyes = $state<EyeBeat[]>(['rest', 'rest', 'rest', 'rest', 'rest']);
	const eyeFrameKey = (veggie: VeggieKey, beat: EyeBeat) =>
		beat === 'rest'
			? veggie
			: `${veggie}${beat === 'blink' ? 'Blink' : beat === 'look-l' ? 'LookL' : 'LookR'}`;
	const runEyes = (set: (beat: EyeBeat) => void, firstDelayMs: number) => {
		const timers = new Set<number>();
		const at = (ms: number, fn: () => void) => {
			const id = window.setTimeout(() => {
				timers.delete(id);
				fn();
			}, ms);
			timers.add(id);
		};
		const next = () => at(rand(1800, 4200), beat);
		const blink = (again: number) => {
			set('blink');
			at(rand(130, 170), () => {
				set('rest');
				if (again > 0) at(150, () => blink(again - 1));
				else next();
			});
		};
		const glance = () => {
			set(Math.random() < 0.5 ? 'look-l' : 'look-r');
			at(rand(400, 800), () => {
				set('rest');
				next();
			});
		};
		const beat = () => (Math.random() < 0.45 ? glance() : blink(Math.random() < 0.3 ? 1 : 0));
		at(firstDelayMs, beat);
		return () => {
			for (const id of timers) window.clearTimeout(id);
			set('rest');
		};
	};
	$effect(() => {
		if (!shownOverlay || !artKey) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const stops = WIN_VEGGIE_IDLE.map((_, index) =>
			runEyes(
				(beat) => {
					winVeggieEyes = winVeggieEyes.map((current, at) => (at === index ? beat : current));
				},
				rand(700, 1600) + index * 380,
			),
		);
		return () => stops.forEach((stop) => stop());
	});
	$effect(() => {
		const presentation = shownOverlay?.bonusPresentation;
		if (!presentation) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		if (presentation === 'start')
			return runBlinker((shut) => (kingBlinking = shut), rand(1200, 3000));
		const stops = BASKET_VEG.map((_, index) =>
			runEyes(
				(beat) => {
					basketEyes = basketEyes.map((current, at) => (at === index ? beat : current));
				},
				rand(900, 2200) + index * 420,
			),
		);
		return () => stops.forEach((stop) => stop());
	});

	const plaqueIn = $derived(popIn(0, 0.48));
	const titleTopIn = $derived(slideIn(0.46, 0.55));
	const titleBottomIn = $derived(slideIn(0.6, 0.55));
	const amountIn = $derived(popIn(NAMED_AMOUNT_DELAY_MS / 1000, 0.42));
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

	const breathe = $derived(1 + Math.sin(clock * (2.2 + tier * 0.08)) * (0.006 + tier * 0.002));
	const mainLayout = $derived(context.stateLayoutDerived.mainLayout());
	const presentationBounds = $derived(
		// Design-unit branches (intro card, named wins) are measured in the 1200 frame and scaled.
		bonusPresentation === 'start'
			? { width: 480 * DESIGN_SCALE, height: 615 * DESIGN_SCALE }
			: bonusPresentation === 'end'
				? { width: 980, height: 610 }
				: artKey === 'winMax'
					? { width: 700 * DESIGN_SCALE, height: 560 * DESIGN_SCALE }
					: artKey
						? { width: 900 * DESIGN_SCALE, height: 545 * DESIGN_SCALE }
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
	/* The mock spreads the MAX WIN symbols beside the word art across a 1200-wide frame, two of
	   them half off it. A portrait phone has no room beside the words at all — pulled in to the
	   edge they only hid behind the art — so once the visible half-width (in frame units) can't
	   hold the word art plus a symbol, the six slide into two rows instead: three above the
	   words, three under the plaque, a quarter smaller. The blend is continuous so a resize
	   never snaps them. */
	const maxWinEdgeX = $derived((mainLayout.width * 0.5) / (presentationFit * DESIGN_SCALE));
	const lerp = (from: number, to: number, t: number) => from + (to - from) * t;
	const maxWinVeggiePlace = (slot: (typeof MAX_WIN_VEGGIE_SLOTS)[number]) => {
		const stacked = clamp01(
			(MAX_WIN_WORD_ART.width * 0.5 + slot.size * 0.5 - maxWinEdgeX) / (slot.size * 0.35),
		);
		if (stacked <= 0) return { x: slot.x, y: slot.y, scale: 1, stacked: 0 };
		const stackedX = slot.stackX * Math.min(maxWinEdgeX - slot.size * 0.3, 360);
		const stackedY =
			slot.stack === 'top'
				? MAX_WIN_WORD_ART.y - MAX_WIN_WORD_ART.height * 0.5 - slot.size * 0.34
				: MAX_WIN_AMOUNT_Y + AMOUNT_PLAQUE.height * 0.5 + slot.size * 0.34;
		return {
			x: lerp(slot.x, stackedX, stacked),
			y: lerp(slot.y, stackedY, stacked),
			scale: 1 - stacked * 0.25,
			stacked,
		};
	};
	/* The MAX WIN symbols fly rather than sit ("make the animals fly around", user 2026-09-21):
	   each rides a slow figure-of-eight around its slot (two unrelated periods per axis, so the
	   loop never repeats visibly), banks into the turn and tumbles a little either way. The
	   amplitudes are frame units; the stacked portrait rows halve them so the rows stay rows. */
	const MAX_WIN_FLIGHT = [
		{ ax: 46, ay: 34, wx: 0.62, wy: 0.91, wr: 0.74, roll: 0.24, phase: 0.0 },
		{ ax: 54, ay: 30, wx: 0.55, wy: 0.83, wr: 0.68, roll: 0.2, phase: 1.7 },
		{ ax: 42, ay: 38, wx: 0.7, wy: 0.97, wr: 0.8, roll: 0.26, phase: 3.3 },
		{ ax: 50, ay: 32, wx: 0.58, wy: 0.87, wr: 0.71, roll: 0.22, phase: 4.6 },
		{ ax: 44, ay: 36, wx: 0.66, wy: 0.79, wr: 0.77, roll: 0.25, phase: 2.4 },
		{ ax: 52, ay: 30, wx: 0.53, wy: 0.93, wr: 0.65, roll: 0.21, phase: 5.5 },
	];
	const maxWinFlight = (index: number, damp: number) => {
		const f = MAX_WIN_FLIGHT[index];
		const t = clock + f.phase * 3;
		const x = Math.sin(t * f.wx) * f.ax * damp;
		const y = Math.sin(t * f.wy + f.phase) * f.ay * damp;
		// Bank with the horizontal velocity, and tumble on its own slower beat.
		const bank = Math.cos(t * f.wx) * 0.12;
		const roll = Math.sin(t * f.wr + f.phase * 0.5) * f.roll;
		return { x, y, rotation: (bank + roll) * (0.4 + damp * 0.6) };
	};
	// The mock compositions already sit above the HUD; only the outro sign needs lifting.
	const plaqueRestY = $derived(bonusPresentation === 'start' || artKey ? 0 : -44);
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
	// The spout is the banner's own centre, so every coin is born behind the main plate and only
	// shows once it has climbed out over its top edge. A fixed 210 below centre (inside the amount
	// plaque in landscape) put the spout under the number on a phone, where the whole card is a
	// third the size ("they should start behind the main plate", user 2026-09-21). The coins
	// shrink with the card too, floored so they stay readable: full-size coins were wider than
	// the phone plaque and their lower halves hung out under it.
	const coinFit = $derived(Math.max(0.55, presentationFit));
	const coinOriginY = $derived(BANNER.y * DESIGN_SCALE * presentationFit);
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
			start: (0.095 + coinTier * 0.008) * coinFit,
			end: (0.078 + coinTier * 0.005) * coinFit,
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

	const pixelText = (
		fontSize: number,
		fill = 0xffffff,
		stroke = 0x321505,
		strokeWidth = Math.max(3, Math.round(fontSize * 0.075)),
	) => ({
		fontFamily: 'Jersey 10, monospace',
		fontSize,
		fontWeight: '400' as const,
		fill,
		align: 'center' as const,
		stroke: { color: stroke, width: strokeWidth },
		letterSpacing: 0,
	});
	/* Small-win read-out, design 9050:19929. The total is shown on the board's own brown plaque, not
	   as gold WIN over a white amount. Measured off that frame's fourth screen (a 1214px crop of the
	   1200-wide design, so ~1:1): the plaque is 339x132 with a 5px #844A0D border around a #2C1901
	   field and a 15x24 stair chamfer at each corner, and the amount's glyph box is 58 tall — Jersey
	   10 sets digits at 0.65 of its size, so the face is ~88. */
	const SMALL_WIN_W = 336;
	const SMALL_WIN_H = 130;
	const SMALL_WIN_BORDER = 5;
	const SMALL_WIN_CHAMFER_X = 15;
	const SMALL_WIN_CHAMFER_Y = 24;
	const smallWinSlab = (inset: number) => {
		const w = SMALL_WIN_W * 0.5 - inset;
		const h = SMALL_WIN_H * 0.5 - inset;
		const cx = SMALL_WIN_CHAMFER_X;
		const cy = SMALL_WIN_CHAMFER_Y;
		return [
			-w + cx,
			-h,
			w - cx,
			-h,
			w,
			-h + cy,
			w,
			h - cy,
			w - cx,
			h,
			-w + cx,
			h,
			-w,
			h - cy,
			-w,
			-h + cy,
		];
	};

	/* Bonus-intro card, design 9050:17100 as redrawn 2026-09-17: the cream pixel frame with corner
	   bolts (9363:60176) shows 431x611 of art in the 1200-wide frame, centred at (599.5,336.5),
	   with the copy stack centred on it. Every number in the start branch is a design pixel
	   relative to the card's centre; the branch is drawn inside a DESIGN_SCALE container like
	   the named wins. */
	const CARD_W = 431;
	const CARD_H = 611;
	const localizedStartTitle = $derived(stateI18nDerived.translate('CONGRATS!'));
	const localizedEndTitle = $derived(stateI18nDerived.translate('CONGRATS!'));
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
							<!-- Design 9050:17100. Plank, then the copy stack at the mock's rows: CONGRATS!
							     (Jersey 81, amber) at -184, YOU WON at -138, the tier name in the copy face at
							     -98, the blurb at -40, the scatter king at +52, the orange free-spin pill at
							     +155 and FREE SPINS at +213 — all relative to the plank's centre. -->
							<Container scale={DESIGN_SCALE}>
								<Container scale={0.92 + bonusPlaqueIn * 0.08} alpha={clamp01(bonusPlaqueIn)}>
									<Sprite key="bonusStartCardV5" anchor={0.5} width={CARD_W} height={CARD_H} />
								</Container>

								<Container
									y={-184 - (1 - clamp01(bonusTitleIn)) * 46}
									scale={bonusTitleIn}
									rotation={Math.sin(clock * 2.15) * 0.006}
									alpha={clamp01(bonusTitleIn)}
								>
									<!-- Bitmap title stays live: language changes never require replacement art. -->
									<ResponsiveBitmapText
										anchor={0.5}
										maxWidth={385}
										text={localizedStartTitle}
										style={pixelText(81, 0xffa10e, 0x3a1a05)}
									/>
								</Container>

								<Container alpha={bonusCopyIn} y={(1 - bonusCopyIn) * 18}>
									<BitmapText
										anchor={0.5}
										y={-138}
										text={stateI18nDerived.translate('YOU WON')}
										style={pixelText(30, 0xffa10e)}
									/>
									<!-- The mock sets the tier name and the blurb in a sans face, but every text on
									     this card is asked to share the CONGRATULATIONS screen's pixel face, so both
									     are Jersey 10 too — sized up from the mock's 28/14 to keep the pixel face as
									     legible as the sans was, still readable at 900x600. -->
									<ResponsiveBitmapText
										anchor={0.5}
										y={-98}
										maxWidth={395}
										text={bonusModeText}
										style={pixelText(36, 0xffffff, 0x3a1a05)}
									/>
									<BitmapText
										anchor={0.5}
										y={-38}
										text={bonusIntroText}
										style={{
											...pixelText(24, 0xffffff, 0x3a1a05, 2),
											wordWrap: true,
											wordWrapWidth: 395,
											lineHeight: 26,
										}}
									/>
								</Container>

								{@const hop = sampleRig(KING_HOP, clock, KING_HOP_S)}
								{@const tilt = sampleRig(KING_TILT, clock, KING_TILT_S)}
								<!-- The splash king, rig and all: hop on the outer container, the 5.1s tilt about
								     his feet (CSS origin 50% 85%), then each part on the hop's clock. Open-eyed
								     at rest, blinking like the splash king. -->
								<Container
									y={52 + (1 - clamp01(bonusSymbolIn)) * 54 + (hop.ty / 100) * KING_RIG_SIZE}
									scale={bonusSymbolIn}
									alpha={clamp01(bonusSymbolIn)}
								>
									<Container
										y={KING_RIG_SIZE * 0.35}
										rotation={tilt.rot}
										scale={{ x: tilt.sx, y: tilt.sy }}
									>
										{#each KING_RIG as part (part.key)}
											{@const pose = sampleRig(part.frames, clock, KING_HOP_S)}
											<Sprite
												key={part.key === 'kingBody' && !kingBlinking ? 'kingBodyOpen' : part.key}
												anchor={{ x: part.origin[0], y: part.origin[1] }}
												x={(part.origin[0] - 0.5) * KING_RIG_SIZE}
												y={(part.origin[1] - 0.85) * KING_RIG_SIZE +
													(pose.ty / 100) * KING_RIG_SIZE}
												rotation={pose.rot}
												scale={{
													x: (pose.sx * KING_RIG_SIZE) / 451,
													y: (pose.sy * KING_RIG_SIZE) / 451,
												}}
											/>
										{/each}
									</Container>
								</Container>

								<Container
									y={155 + (1 - clamp01(bonusTicketIn)) * 48}
									scale={bonusTicketIn}
									alpha={clamp01(bonusTicketIn)}
								>
									<!-- A flat rounded slab in the design (147x63, radius 20), not the bordered ticket art. -->
									<Graphics
										draw={(g) => {
											g.roundRect(-74, -32, 148, 64, 20).fill(0xe38b01);
										}}
									/>
									<BitmapText
										anchor={0.5}
										y={1}
										text={overlay.freeSpins ?? 0}
										style={pixelText(61, 0xffffff, 0x4c2008)}
									/>
									<ResponsiveBitmapText
										anchor={0.5}
										y={58}
										maxWidth={320}
										text={stateI18nDerived.translate('FREE SPINS')}
										style={pixelText(30, 0xffba3e)}
									/>
								</Container>
							</Container>
						{:else}
							<!-- Design 9044:16622: the five perched vegetables go down BEFORE the sign, so its
							     top edge hides their lower halves. -->
							{@const basketIn = popIn(0.08, 0.42)}
							<Container y={veggieJumpOffset(0.08)} alpha={clamp01(basketIn)}>
								{#each BASKET_VEG as item, index (item.key)}
									{@const vegIn = popIn(item.start, 0.4)}
									{@const move = basketMotion(item, clock)}
									<!-- Pivoted on its own foot: the breath, the hop's lean and the landing squash
									     all swing from where the vegetable sits, so it never slides. -->
									<Container
										x={item.rect.x}
										y={item.rect.y - move.lift + (1 - clamp01(vegIn)) * 60}
										scale={{ x: vegIn * move.sx, y: vegIn * move.sy }}
										rotation={item.rect.rotation + move.lean}
										alpha={clamp01(vegIn)}
									>
										<Sprite
											key={eyeFrameKey(item.key, basketEyes[index])}
											anchor={item.rect.anchor}
											width={item.rect.size}
											height={item.rect.size}
										/>
									</Container>
								{/each}
							</Container>

							<Container scale={0.9 + bonusPlaqueIn * 0.1} alpha={clamp01(bonusPlaqueIn)}>
								<Sprite key="bonusEndPlaqueV2" anchor={0.5} width={750} height={262} />
							</Container>

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
				{:else if artKey === 'winMax'}
					{@const wordIn = popIn(0, 0.5)}
					<!-- Design 9428:64173: the MAX WIN word art stamps down over the dimmed board, six of
					     the game's symbols hop in around it, and the total lands on the orange plaque
					     below. The symbols sit behind the word art (the mock layers them over it, but on
					     a phone they are pulled in to the edge and would cover the words). -->
					<Container
						y={namedWinY}
						scale={Math.max(0, enter.current) * presentationFit * namedWinIdleScale * DESIGN_SCALE}
						rotation={plaqueRotation}
						alpha={plaqueAlpha}
					>
						<Container y={MAX_WIN_WORD_ART.y} scale={0.92 + Math.sin(clock * 2.1) * 0.035}>
							<Graphics
								blendMode="add"
								draw={(graphics) => {
									for (let glowIndex = 7; glowIndex >= 1; glowIndex -= 1) {
										graphics.ellipse(0, 0, 300 + glowIndex * 34, 200 + glowIndex * 24);
										graphics.fill({
											color: glowColor,
											alpha: 0.014 + (7 - glowIndex) * 0.007,
										});
									}
								}}
							/>
						</Container>

						{#each sparks as spark, index}
							{@const progress = (clock * spark.speed + spark.phase) % 1}
							{@const radius = 330 + progress * 190}
							<Rectangle
								x={Math.cos(spark.angle) * radius}
								y={MAX_WIN_WORD_ART.y + Math.sin(spark.angle) * radius * 0.62}
								width={spark.size + 2}
								height={spark.size + 2}
								anchor={0.5}
								rotation={spark.angle + clock}
								backgroundColor={index % 3 === 0 ? 0xffffff : glowColor}
								alpha={(1 - progress) * 0.85 * fadeIn(0.08, 0.4)}
							/>
						{/each}

						{#each MAX_WIN_VEGGIE_SLOTS as slot, index}
							{@const idle = WIN_VEGGIE_IDLE[index]}
							{@const veggieIn = popIn(slot.start, 0.38)}
							{@const place = maxWinVeggiePlace(slot)}
							{@const flight = maxWinFlight(index, 1 - place.stacked * 0.5)}
							<Container
								x={place.x + flight.x}
								y={place.y + veggieJumpOffset(slot.start) * 0.45 + flight.y}
								scale={veggieIn *
									place.scale *
									(1 + Math.sin(clock * idle.bob * 1.15 + idle.phase) * 0.03)}
								rotation={(slot.rotation * Math.PI) / 180 + flight.rotation}
								alpha={clamp01(veggieIn)}
							>
								<Sprite
									key={eyeFrameKey(slot.key, winVeggieEyes[index])}
									anchor={0.5}
									width={slot.size * VEGGIE_SCALE}
									height={slot.size * VEGGIE_SCALE}
								/>
							</Container>
						{/each}

						<!-- The word art lands like a stamp: from half again its size down onto the board,
						     with the same overshoot the banners use, then a slow breathe. -->
						<Container
							y={MAX_WIN_WORD_ART.y + Math.sin(clock * 2.6) * 3}
							scale={(1.5 - wordIn * 0.5) * (1 + Math.sin(clock * 2.4) * 0.008)}
							rotation={(1 - wordIn) * -0.04 + Math.sin(clock * 1.8) * 0.004}
							alpha={clamp01(wordIn * 2)}
						>
							<Sprite
								key="winWordArtMaxV1"
								anchor={0.5}
								width={MAX_WIN_WORD_ART.width}
								height={MAX_WIN_WORD_ART.height}
							/>
						</Container>

						<Container
							y={MAX_WIN_AMOUNT_Y + (1 - clamp01(amountIn)) * 70}
							scale={amountIn}
							alpha={clamp01(amountIn)}
						>
							<Sprite
								key="winAmountPlaqueV3"
								anchor={0.5}
								width={AMOUNT_PLAQUE.width}
								height={AMOUNT_PLAQUE.height}
							/>
							<ResponsiveBitmapText
								anchor={0.5}
								y={-4}
								maxWidth={AMOUNT_PLAQUE.maxWidth}
								text={countedWinText}
								style={pixelText(AMOUNT_PLAQUE.fontSize, 0xffffff, 0x4c2008)}
							/>
						</Container>
					</Container>
				{:else if artKey && winArt}
					<!-- Design 9242:190479: the riveted banner with a star on each wing, the two-line word art
					     over it, five of the game's own symbols floating above, and the total on the orange
					     plaque below. Every layer keeps its own entrance, idle loop and exit. -->
					<Container
						y={namedWinY}
						scale={Math.max(0, enter.current) * presentationFit * namedWinIdleScale * DESIGN_SCALE}
						rotation={plaqueRotation}
						alpha={plaqueAlpha}
					>
						<Container y={BANNER.y} scale={0.92 + Math.sin(clock * 2.1) * 0.035}>
							<Graphics
								blendMode="add"
								draw={(graphics) => {
									for (let glowIndex = 7; glowIndex >= 1; glowIndex -= 1) {
										graphics.circle(0, 0, 235 + glowIndex * 28);
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
							{@const radius = 225 + progress * (105 + tier * 12)}
							<Rectangle
								x={Math.cos(spark.angle) * radius}
								y={BANNER.y + Math.sin(spark.angle) * radius * 0.56}
								width={spark.size}
								height={spark.size}
								anchor={0.5}
								rotation={spark.angle + clock}
								backgroundColor={index % 3 === 0 ? 0xffffff : glowColor}
								alpha={(1 - progress) * (0.42 + tier * 0.07) * fadeIn(0.08, 0.4)}
							/>
						{/each}

						<!-- The game's own symbols at the mock's placements, hopping in behind the sign. -->
						{#each VEGGIE_SLOTS as slot, index}
							{@const veggie = winArt.veggies[index]}
							{@const idle = WIN_VEGGIE_IDLE[index]}
							{@const veggieIn = popIn(slot.start, 0.38)}
							<!-- Each one floats on its own period and phase (a slow bob with a slower sideways
							     drift and a small tilt) and blinks or glances on its own clock. -->
							<Container
								x={slot.x + Math.sin(clock * idle.sway + idle.phase) * 2.5}
								y={slot.y +
									veggieJumpOffset(slot.start) * 0.45 +
									Math.sin(clock * idle.bob + idle.phase) * idle.amp}
								scale={veggieIn * (1 + Math.sin(clock * idle.bob * 1.15 + idle.phase) * 0.022)}
								rotation={(slot.rotation * Math.PI) / 180 +
									Math.sin(clock * idle.sway * 1.3 + idle.phase) * idle.tilt}
								alpha={clamp01(veggieIn)}
							>
								<Sprite
									key={eyeFrameKey(veggie, winVeggieEyes[index])}
									anchor={0.5}
									width={slot.size * VEGGIE_SCALE}
									height={slot.size * VEGGIE_SCALE}
								/>
							</Container>
						{/each}

						<!-- Banner: short squash on impact, then a restrained idle float. -->
						<Container
							y={BANNER.y + (1 - clamp01(plaqueIn)) * 82}
							scale={{ x: plaqueIn, y: 0.72 + plaqueIn * 0.28 }}
							alpha={clamp01(plaqueIn)}
						>
							<Graphics
								y={30}
								draw={(graphics) =>
									graphics
										.ellipse(0, 0, BANNER.width * 0.43, BANNER.height * 0.42)
										.fill({ color: 0x130702, alpha: 0.42 })}
							/>
							<Sprite
								key={winArt.banner}
								anchor={0.5}
								width={BANNER.width}
								height={BANNER.height}
							/>
						</Container>

						<!-- One star per wing, where the mock rivets them. -->
						{#each STAR_SLOTS as star, index}
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
									height={star.size * 0.955}
								/>
							</Container>
						{/each}

						{#if winArt.wordArt}
							<!-- WILD WIN: the design's own word art, one piece. -->
							<Container
								y={WORD_ART.y - (1 - titleTopIn) * TITLE_TRAVEL.top + Math.sin(clock * 2.8) * 2.5}
								scale={(0.9 + titleTopIn * 0.1) * (1 + Math.sin(clock * 2.45 + tier) * 0.0065)}
								rotation={(1 - titleTopIn) * -0.06 + Math.sin(clock * 1.8) * 0.003}
								alpha={clamp01(titleTopIn * 3)}
							>
								<Sprite
									key={winArt.wordArt}
									anchor={0.5}
									width={WORD_ART.width}
									height={WORD_ART.height}
								/>
							</Container>
						{:else if winArt.titleTop}
							{@const top = fitBox(
								winArt.titleTopWidth ?? 1,
								winArt.titleTopHeight ?? 1,
								TITLE_TOP_BOX.maxWidth,
								TITLE_TOP_BOX.maxHeight,
							)}
							<!-- Tier word drops in from above the window, WIN rises from below it, and each
							     settles into the stack with a short overshoot ("mythic to come from top and
							     win from bottom", user 2026-09-17). -->
							<Container
								y={TITLE_TOP_BOX.y -
									(1 - titleTopIn) * TITLE_TRAVEL.top +
									Math.sin(clock * 2.8) * 2.5}
								scale={(0.9 + titleTopIn * 0.1) * (1 + Math.sin(clock * 2.45 + tier) * 0.0065)}
								rotation={(1 - titleTopIn) * -0.06 + Math.sin(clock * 1.8) * 0.003}
								alpha={clamp01(titleTopIn * 3)}
							>
								<Sprite key={winArt.titleTop} anchor={0.5} width={top.width} height={top.height} />
							</Container>
							<Container
								y={TITLE_WIN.y +
									(1 - titleBottomIn) * TITLE_TRAVEL.bottom +
									Math.sin(clock * 2.55 + 0.7) * 2}
								scale={(0.9 + titleBottomIn * 0.1) * (1 + Math.sin(clock * 2.3 + 0.8) * 0.006)}
								rotation={(1 - titleBottomIn) * 0.05 - Math.sin(clock * 1.9) * 0.0025}
								alpha={clamp01(titleBottomIn * 3)}
							>
								<Sprite
									key="winTitleSweetBottomV2"
									anchor={0.5}
									width={TITLE_WIN.width}
									height={TITLE_WIN.height}
								/>
							</Container>
						{/if}

						<!-- Amount on the design's orange plaque: a detached layer, and the biggest text here. -->
						<Container
							y={AMOUNT_PLAQUE.y + (1 - clamp01(amountIn)) * 70}
							scale={amountIn}
							alpha={clamp01(amountIn)}
						>
							<Sprite
								key="winAmountPlaqueV3"
								anchor={0.5}
								width={AMOUNT_PLAQUE.width}
								height={AMOUNT_PLAQUE.height}
							/>
							<ResponsiveBitmapText
								anchor={0.5}
								y={-4}
								maxWidth={AMOUNT_PLAQUE.maxWidth}
								text={countedWinText}
								style={pixelText(AMOUNT_PLAQUE.fontSize, 0xffffff, 0x4c2008)}
							/>
						</Container>
					</Container>
				{:else if isSmallWin}
					<!-- Under 20×: the design's brown plaque, centred on the board. No fullscreen shade,
					     vegetables or coins, and no WIN word — the amount alone sits on the slab. -->
					<Container y={plaqueY + 20} scale={plaqueScale} alpha={plaqueAlpha}>
						<Graphics
							draw={(g) => {
								g.poly(smallWinSlab(0)).fill(0x844a0d);
								g.poly(smallWinSlab(SMALL_WIN_BORDER)).fill(0x2c1901);
							}}
						/>
						<!-- Jersey 10's digits sit high in its em box, and anchor 0.5 centres the box, not the
						     glyphs: measured 6 units low at y=2 (plaque rows 278-393 vs text 317-365 at 1280). -->
						<BitmapText
							anchor={0.5}
							y={-4}
							text={bookEventAmountToCurrencyString(
								amount.current,
								overlay.amount ?? stateGame.roundWin,
							)}
							style={{
								fontFamily: 'Jersey 10, monospace',
								fontSize: 88,
								fontWeight: '400' as const,
								fill: 0xe38b01,
								align: 'center' as const,
								letterSpacing: 0,
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
