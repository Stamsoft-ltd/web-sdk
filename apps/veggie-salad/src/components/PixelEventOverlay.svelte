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
		| 'pixelBroccoli'
		| 'pixelCorn'
		| 'pixelTomato'
		| 'pixelEggplant'
		| 'pixelCarrot'
		| 'pixelCauliflower'
		| 'pixelRadish';
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
	   square the symbol texture is scaled into (corn 164, carrot 142, cauliflower 178, radish 139,
	   tomato 175 — measured off the mock's inner image boxes against the textures' content). */
	const VEGGIE_SLOTS = [
		{ x: -358, y: -126, size: 164, rotation: -24.43, start: 0.1 },
		{ x: -184, y: -181, size: 142, rotation: -20.09, start: 0.16 },
		{ x: 10, y: -202, size: 178, rotation: 0, start: 0.22 },
		{ x: 180, y: -175, size: 139, rotation: 0, start: 0.28 },
		{ x: 369, y: -133, size: 175, rotation: 24.69, start: 0.34 },
	];
	/* MAX WIN, design 9428:64173: no banner. The word art (9428:64660, 684x429 with its top at 71)
	   sits over the dimmed board, the total on the same orange plaque (9428:64494, 380x127 at 487,
	   its amount at Jersey 73.65), and six symbols are flung around the frame — the mock hangs its
	   cauliflower and broccoli half off the 1200-wide window. Each slot keeps the mock's rotation
	   and the square the texture is scaled into so the texture's content matches the mock's inner
	   image box (content bounds measured off the webp files), but the mock's centres are pulled
	   in to the word art's edge so each symbol peeks out from behind the letters and its flight
	   (MAX_WIN_FLIGHT) carries it in and out of cover ("show from behind the text partially",
	   user 2026-09-21). Keys follow the FILES: cauliflower.webp holds the radish art and
	   radish.webp the cauliflower. */
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
			key: 'pixelRadish',
			x: -372,
			y: -40,
			size: 193,
			rotation: 0,
			start: 0.1,
			stack: 'top',
			stackX: -0.62,
		},
		{
			key: 'pixelCarrot',
			x: -300,
			y: -218,
			size: 210,
			rotation: 12.9,
			start: 0.16,
			stack: 'top',
			stackX: 0,
		},
		{
			key: 'pixelCorn',
			x: -318,
			y: 74,
			size: 205,
			rotation: -37.94,
			start: 0.22,
			stack: 'bottom',
			stackX: -0.62,
		},
		{
			key: 'pixelTomato',
			x: 348,
			y: -226,
			size: 165,
			rotation: -37,
			start: 0.28,
			stack: 'top',
			stackX: 0.62,
		},
		{
			key: 'pixelCauliflower',
			x: 300,
			y: 92,
			size: 213,
			rotation: 33.25,
			start: 0.34,
			stack: 'bottom',
			stackX: 0,
		},
		{
			key: 'pixelBroccoli',
			x: 378,
			y: -46,
			size: 184,
			rotation: 32.31,
			start: 0.4,
			stack: 'bottom',
			stackX: 0.62,
		},
	];
	// Every symbol texture is square except the cauliflower (276x284).
	const VEGGIE_ASPECT: Record<VeggieKey, number> = {
		pixelBroccoli: 1,
		pixelCorn: 1,
		pixelTomato: 1,
		pixelEggplant: 1,
		pixelCarrot: 1,
		pixelCauliflower: 284 / 276,
		pixelRadish: 1,
	};
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
			veggies: ['pixelEggplant', 'pixelCarrot', 'pixelCauliflower', 'pixelRadish', 'pixelBroccoli'],
		},
		winWild: {
			banner: 'winBannerWildV3',
			wordArt: 'winWordArtWildV3',
			veggies: ['pixelCorn', 'pixelCarrot', 'pixelCauliflower', 'pixelRadish', 'pixelTomato'],
		},
		winEpic: {
			banner: 'winBannerEpicV3',
			titleTop: 'winTitleEpicV2',
			titleTopWidth: 1614,
			titleTopHeight: 706,
			veggies: ['pixelCarrot', 'pixelEggplant', 'pixelTomato', 'pixelCorn', 'pixelRadish'],
		},
		winMythic: {
			banner: 'winBannerMythicV3',
			titleTop: 'winTitleMythicV2',
			titleTopWidth: 2057,
			titleTopHeight: 684,
			veggies: ['pixelEggplant', 'pixelTomato', 'pixelCorn', 'pixelBroccoli', 'pixelCauliflower'],
		},
		winLegendary: {
			banner: 'winBannerLegendaryV3',
			titleTop: 'winTitleLegendaryV2',
			titleTopWidth: 2082,
			titleTopHeight: 633,
			veggies: ['pixelBroccoli', 'pixelCorn', 'pixelTomato', 'pixelEggplant', 'pixelCarrot'],
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
	/* ── Congrats basket ───────────────────────────────────────────────────────────────────────
	   Design 9044:16622 ships the basket as one rasterised image, which is exactly what it looked
	   like on screen: a single still block of vegetables. It is cut here into the leafy bed, the
	   six vegetables and the crate that stands in front of them, so each one can breathe on its
	   own timing. The boxes are that cut's own bounding boxes in the 1234x522 source; the basket
	   draws at 617x260, so a source pixel is half an overlay unit.
	   The bed is painted UNDER the vegetables with their footprints filled in from the nearest
	   surviving leaf, so a vegetable can lift clear without tearing a hole in what was behind it,
	   and the crate is painted last because it stands in front of every stalk. */
	const BASKET_SCALE = 0.5;
	const BASKET_X = -308.5;
	const BASKET_Y = -255;
	const basketRect = (x: number, y: number, w: number, h: number) => ({
		cx: BASKET_X + (x + w * 0.5) * BASKET_SCALE,
		by: BASKET_Y + (y + h) * BASKET_SCALE,
		w: w * BASKET_SCALE,
		h: h * BASKET_SCALE,
	});
	/* Painted back to front. Every vegetable gets its own start, bob rate and lean so the bunch
	   reads as seven things sitting together rather than one drawing — the rates are deliberately
	   unrelated numbers so the group never falls into step with itself. */
	const BASKET_BED = basketRect(40, 15, 1161, 369);
	const BASKET_VEG = [
		{
			key: 'congratsEggplant',
			rect: basketRect(395, 37, 180, 247),
			start: 0.2,
			bob: 2.05,
			lean: 1.7,
			amp: 4.5,
			tilt: 0.03,
		},
		{
			key: 'congratsCarrot',
			rect: basketRect(629, 15, 189, 298),
			start: 0.32,
			bob: 1.64,
			lean: 2.3,
			amp: 3.8,
			tilt: 0.022,
		},
		{
			key: 'congratsCorn',
			rect: basketRect(779, 95, 139, 221),
			start: 0.44,
			bob: 2.41,
			lean: 1.45,
			amp: 4.2,
			tilt: 0.034,
		},
		{
			key: 'congratsTomato',
			rect: basketRect(208, 167, 232, 196),
			start: 0.14,
			bob: 1.83,
			lean: 2.6,
			amp: 5,
			tilt: 0.026,
		},
		{
			key: 'congratsCauliflower',
			rect: basketRect(466, 207, 189, 151),
			start: 0.5,
			bob: 2.72,
			lean: 1.9,
			amp: 3.4,
			tilt: 0.038,
		},
		{
			key: 'congratsBroccoli',
			rect: basketRect(897, 192, 196, 187),
			start: 0.26,
			bob: 2.18,
			lean: 2.9,
			amp: 4.6,
			tilt: 0.031,
		},
	];
	// Eye blinks, splash-style: open at rest, shut for ~170ms at random 2.4–5.6s gaps, now and then
	// a double. The king blinks on the intro card; on the outro every basket vegetable runs its own
	// timer with a staggered first blink, so the bunch never shuts its eyes in unison. Off entirely
	// under prefers-reduced-motion.
	let kingBlinking = $state(false);
	let basketBlinking = $state<Record<string, boolean>>({});
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
		const stops = BASKET_VEG.map((item, index) =>
			runBlinker(
				(shut) => {
					basketBlinking = { ...basketBlinking, [item.key]: shut };
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

								<Container
									y={52 + (1 - clamp01(bonusSymbolIn)) * 54 + Math.sin(clock * 3) * 5}
									scale={bonusSymbolIn * (1 + Math.sin(clock * 2.6) * 0.018)}
									rotation={Math.sin(clock * 2.2) * 0.025}
									alpha={clamp01(bonusSymbolIn)}
								>
									<!-- The design's own vector king (pixelAssets: congratsKing), open-eyed at rest and
									     blinking like the splash king. -->
									<Sprite
										key={kingBlinking ? 'congratsKing' : 'congratsKingOpen'}
										anchor={0.5}
										width={119}
										height={119}
									/>
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
							<!-- Design 9044:16622 sets one bunch of vegetables BEHIND the sign. There is no
							     wooden crate in it — the sign's own top edge is what cuts the bunch off — so
							     the crate layer is never drawn, but the leafy `bed` is: it is the greenery
							     packed between the vegetables, and without it they read as six loose symbols
							     floating apart. The sign's top edge sits at y-131, and the group is placed so
							     that edge crosses the bunch about two thirds of the way down it (bunch top
							     -251, bottom -67). Drawn before the plaque, so the plaque paints over
							     everything below its edge. -->
							{@const basketIn = popIn(0.08, 0.42)}
							<Container
								y={-4 + veggieJumpOffset(0.08) + Math.sin(clock * 2.3) * 4}
								scale={basketIn * (1 + Math.sin(clock * 2.3) * 0.012)}
								alpha={clamp01(basketIn)}
							>
								<Sprite
									key="congratsBed"
									anchor={{ x: 0.5, y: 1 }}
									x={BASKET_BED.cx}
									y={BASKET_BED.by}
									width={BASKET_BED.w}
									height={BASKET_BED.h}
								/>
								{#each BASKET_VEG as item (item.key)}
									{@const vegIn = popIn(item.start, 0.4)}
									<!-- Pivoted on its own base: the bob and the lean both swing from where the
									     vegetable meets the crate, so its feet stay planted while its head moves. -->
									<Container
										x={item.rect.cx}
										y={item.rect.by + Math.sin(clock * item.bob + item.start * 9) * item.amp}
										scale={vegIn}
										rotation={Math.sin(clock * item.lean + item.start * 5) * item.tilt}
										alpha={clamp01(vegIn)}
									>
										<Sprite
											key={basketBlinking[item.key] ? `${item.key}Blink` : item.key}
											anchor={{ x: 0.5, y: 1 }}
											width={item.rect.w}
											height={item.rect.h}
										/>
									</Container>
								{/each}
							</Container>

							<Container scale={0.9 + bonusPlaqueIn * 0.1} alpha={clamp01(bonusPlaqueIn)}>
								<Sprite key="bonusEndPlaqueV2" anchor={0.5} width={750} height={262} />
							</Container>

							{#each STAR_SLOTS as star, index}
								{@const starIn = popIn(0.25 + index * 0.08, 0.36)}
								<Container
									x={star.x * 1.05}
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
									width={slot.size}
									height={slot.size * VEGGIE_ASPECT[slot.key]}
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
									width={slot.size}
									height={slot.size * VEGGIE_ASPECT[veggie]}
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
