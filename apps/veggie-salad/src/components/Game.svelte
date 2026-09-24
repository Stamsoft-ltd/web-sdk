<script lang="ts">
	import { tick } from 'svelte';
	import { GameVersion, Modals } from 'components-ui-html';
	import { EnablePixiExtension } from 'components-pixi';
	import { App } from 'pixi-svelte';
	import { EnableHotkey } from 'components-shared';
	import { stateI18nDerived, stateMeta, stateUi } from 'state-shared';

	import EnableGameActor from './EnableGameActor.svelte';
	import EnableSound from './EnableSound.svelte';
	import Sound from './Sound.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import VeggieSaladPrototype from './prototype/VeggieSaladPrototype.svelte';
	import PixelEventOverlay from './PixelEventOverlay.svelte';
	import PixelLoadingScreen from './PixelLoadingScreen.svelte';
	import PixelSplashScreen from './PixelSplashScreen.svelte';
	import EnablePixelTextureMode from './EnablePixelTextureMode.svelte';
	import StakeSync from './StakeSync.svelte';
	import ReplayHud from './replay/ReplayHud.svelte';
	import PendingRoundRecovery from './PendingRoundRecovery.svelte';
	import { stateGame, stateGameDerived } from '../game/stateGame.svelte';
	import { MAX_WIN_MULTIPLIER } from '../game/constants';
	import { playBookEvents } from '../game/utils';
	import type { BookEvent } from '../game/typesBookEvent';

	// Dev-only: lets a headless check play a hand-written book (a tumble, a bonus entry) through
	// the real handlers without an RGS — the mock RGS has no veggie route.
	if (import.meta.env.DEV && typeof window !== 'undefined') {
		(window as unknown as { __veggieBook?: (events: BookEvent[]) => Promise<void> }).__veggieBook =
			(events) => playBookEvents(events);
		// The same, with the spin's trap-door exit in front, as the bet machine would play it.
		(
			window as unknown as {
				__veggieSpin?: (events: BookEvent[], holdMs?: number) => Promise<void>;
			}
		).__veggieSpin = async (events, holdMs = 0) => {
			stateGameDerived.resetRound();
			// holdMs stands in for the RGS round trip.
			await new Promise((resolve) => setTimeout(resolve, holdMs));
			stateGameDerived.startExit();
			await stateGameDerived.waitMotion(() => stateGameDerived.exitDurationMs() * 0.35);
			await playBookEvents(events);
		};
	}

	let loading = $state(true);
	let splashVisible = $state(false);
	let started = $state(false);

	const finishLoading = () => {
		loading = false;
		// Replay URLs must resume directly; the marketing splash would obscure the replay result.
		if (stateUi.config.mode === 'replay') started = true;
		else splashVisible = true;
	};

	/* Splash → game. The game mounts under the splash, the splash fades away (its own `leaving`
	   styles), and the wordmark FLIES from its splash box into the game's header plate: a copy of
	   it is laid over the page at the splash box and animated onto the header logo's box, which is
	   measured live because the header sits differently in every layout. The header's own logo is
	   hidden for the flight and shown the moment the copy lands on it. */
	let splashLeaving = $state(false);
	const LOGO_FLIGHT_MS = 950;
	const nextFrame = () => new Promise((resolve) => requestAnimationFrame(resolve));
	const headerLogo = async () => {
		// The game's first frames are still laying out; wait for the header logo to have a box.
		for (let frame = 0; frame < 90; frame++) {
			const img = document.querySelector<HTMLImageElement>('.brand img');
			const box = img?.getBoundingClientRect();
			if (img?.complete && box && box.width > 0) return img;
			await nextFrame();
		}
		return null;
	};
	const flyLogo = async (from: DOMRect | null) => {
		if (!from || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		await tick();
		const target = await headerLogo();
		if (!target) return;
		// One more frame so the header has settled into its final place before it is measured.
		await nextFrame();
		const to = target.getBoundingClientRect();
		const flyer = target.cloneNode() as HTMLImageElement;
		Object.assign(flyer.style, {
			position: 'fixed',
			left: `${from.left}px`,
			top: `${from.top}px`,
			width: `${from.width}px`,
			height: `${from.height}px`,
			margin: '0',
			zIndex: '130',
			pointerEvents: 'none',
			transformOrigin: '0 0',
			imageRendering: 'pixelated',
		});
		document.body.appendChild(flyer);
		target.style.visibility = 'hidden';
		const dx = to.left - from.left;
		const dy = to.top - from.top;
		const scale = to.width / from.width;
		const flight = flyer.animate(
			[
				{ transform: 'translate(0, 0) scale(1)', offset: 0 },
				// A breath in place first — the logo swells as the splash drops away from under it.
				{
					transform: 'translate(0, -1%) scale(1.06)',
					offset: 0.18,
					easing: 'cubic-bezier(0.5, 0, 0.2, 1)',
				},
				{
					transform: `translate(${dx}px, ${dy - 18}px) scale(${scale * 1.08})`,
					offset: 0.78,
					easing: 'cubic-bezier(0.3, 0, 0.4, 1)',
				},
				// Lands on the plate with a small settle.
				{ transform: `translate(${dx}px, ${dy + 3}px) scale(${scale * 0.97})`, offset: 0.9 },
				{ transform: `translate(${dx}px, ${dy}px) scale(${scale})`, offset: 1 },
			],
			{ duration: LOGO_FLIGHT_MS, fill: 'forwards' },
		);
		try {
			await flight.finished;
		} finally {
			target.style.visibility = '';
			flyer.remove();
		}
	};

	const startGame = async (logo: DOMRect | null) => {
		started = true;
		splashLeaving = true;
		await Promise.all([flyLogo(logo), new Promise((resolve) => setTimeout(resolve, 850))]);
		splashVisible = false;
		splashLeaving = false;
	};

	const acknowledgePresentation = () => stateGameDerived.continuePresentation();
	const acknowledgeWithKeyboard = (event: KeyboardEvent) => {
		if (!stateGame.continueGate || (event.key !== 'Enter' && event.code !== 'Space')) return;
		event.preventDefault();
		acknowledgePresentation();
	};

	// The info screens name symbols by the old art's files; the board now draws the design's newer
	// set (veggieAssets.ts), so each old file resolves to the board sprite that took its slot.
	const BOARD_ART: Record<string, string> = {
		broccoli: 'board/cabbage-shades',
		corn: 'board/pepper-shades',
		tomato: 'board/tomato-shades',
		eggplant: 'board/eggplant',
		carrot: 'board/potato',
		cauliflower: 'board/radish',
		radish: 'board/garlic',
	};
	const symbol = (name: string) => `./assets/veggie-salad/pixel/${BOARD_ART[name] ?? name}.webp`;
	const infoDir = './assets/veggie-salad/pixel/info';
	const infoFrame = `${infoDir}/overview_frame.webp`;
	const infoPanel = `${infoDir}/panel_wood_bg.webp`;
	const infoIcon = (name: string) => `${infoDir}/${name}.webp`;
	const t = (key: string) => {
		try {
			return stateI18nDerived.translate(key);
		} catch {
			return key;
		}
	};

	// Rebuild localized metadata when language/social terminology changes.
	$effect(() => {
		stateMeta.betModeMeta = {
			BASE: {
				mode: 'BASE',
				costMultiplier: 1,
				type: 'default',
				parent: '',
				children: '',
				maxWin: MAX_WIN_MULTIPLIER,
				assets: {
					icon: symbol('tomato'),
					volatility: '',
					button: '',
					dialogImage: symbol('tomato'),
					dialogVolatility: symbol('corn'),
				},
				text: {
					title: t('BET MODE BASE TITLE'),
					dialog: t('BET MODE BASE DIALOG'),
					button: t('PLAY'),
					tickerIdle: t('PLACE YOUR BET'),
					tickerSpin: t('GOOD LUCK'),
				},
			},
			CHANCE: {
				mode: 'CHANCE',
				costMultiplier: 2,
				type: 'activate',
				parent: '',
				children: '',
				maxWin: MAX_WIN_MULTIPLIER,
				assets: {
					icon: symbol('scatter'),
					volatility: '',
					button: '',
					dialogImage: symbol('scatter'),
					dialogVolatility: symbol('carrot'),
				},
				text: {
					title: t('MODE CHANCE TITLE'),
					dialog: t('BET MODE CHANCE DIALOG'),
					description: t('MODE CHANCE TAG'),
					button: t('ACTIVATE'),
					tickerIdle: t('EXTRA CHANCE ACTIVE'),
					tickerSpin: t('GOOD LUCK'),
				},
			},
			FEATURE: {
				mode: 'FEATURE',
				costMultiplier: 20,
				type: 'activate',
				parent: '',
				children: '',
				maxWin: MAX_WIN_MULTIPLIER,
				assets: {
					icon: symbol('broccoli'),
					volatility: '',
					button: '',
					dialogImage: symbol('broccoli'),
					dialogVolatility: symbol('carrot'),
				},
				text: {
					title: t('MODE FEATURE TITLE'),
					dialog: t('BET MODE FEATURE DIALOG'),
					description: t('MODE FEATURE TAG'),
					button: t('ACTIVATE'),
					tickerIdle: t('FEATURE SPIN'),
					tickerSpin: t('FEATURE ACTIVE'),
				},
			},
			BONUS: {
				mode: 'BONUS',
				costMultiplier: 100,
				type: 'buy',
				parent: '',
				children: '',
				maxWin: MAX_WIN_MULTIPLIER,
				assets: {
					icon: symbol('tomato'),
					volatility: '',
					button: '',
					dialogImage: symbol('scatter'),
					dialogVolatility: symbol('tomato'),
				},
				text: {
					title: t('MODE BONUS TITLE'),
					dialog: t('BET MODE BONUS DIALOG'),
					description: t('MODE BONUS TAG'),
					button: t('BUY'),
					tickerIdle: t('MODE BONUS TITLE'),
					tickerSpin: t('BONUS ACTIVE'),
				},
			},
			MYSTERY: {
				mode: 'MYSTERY',
				costMultiplier: 300,
				type: 'buy',
				parent: '',
				children: '',
				maxWin: MAX_WIN_MULTIPLIER,
				assets: {
					icon: symbol('scatter'),
					volatility: '',
					button: '',
					dialogImage: symbol('scatter'),
					dialogVolatility: symbol('onion'),
				},
				text: {
					title: t('MODE MYSTERY TITLE'),
					dialog: t('BET MODE MYSTERY DIALOG'),
					description: t('MODE MYSTERY TAG'),
					button: t('BUY'),
					tickerIdle: t('MODE MYSTERY TITLE'),
					tickerSpin: t('MYSTERY ACTIVE'),
				},
			},
			SUPER: {
				mode: 'SUPER',
				costMultiplier: 400,
				type: 'buy',
				parent: '',
				children: '',
				maxWin: MAX_WIN_MULTIPLIER,
				assets: {
					icon: symbol('corn'),
					volatility: '',
					button: '',
					dialogImage: symbol('corn'),
					dialogVolatility: symbol('scatter'),
				},
				text: {
					title: t('MODE SUPER TITLE'),
					dialog: t('BET MODE SUPER DIALOG'),
					description: t('MODE SUPER TAG'),
					button: t('BUY'),
					tickerIdle: t('MODE SUPER TITLE'),
					tickerSpin: t('SUPER ACTIVE'),
				},
			},
		};

		stateMeta.gameRuleMeta.gameRules = [
			{
				title: t('GAME RULES'),
				rows: 5,
				columns: 1,
				containers: [
					{
						title: t('RULE CLUSTER TITLE'),
						text: t('RULE CLUSTER TEXT'),
						image: symbol('broccoli'),
						row: 0,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('RULE TUMBLE TITLE'),
						text: t('RULE TUMBLE TEXT'),
						image: symbol('tomato'),
						row: 1,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('RULE MULTIPLIER TITLE'),
						text: t('RULE MULTIPLIER TEXT'),
						image: symbol('corn'),
						row: 2,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('BONUSES'),
						text: t('RULE BONUS TEXT'),
						image: symbol('scatter'),
						row: 3,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('RTP AND MAX WIN'),
						text: t('RTP AND MAX WIN TEXT'),
						image: symbol('corn'),
						row: 4,
						column: 0,
						imagePosition: 'left',
					},
				],
			},
			{
				title: t('CONTROLS'),
				rows: 3,
				columns: 1,
				containers: [
					{
						title: t('SPIN AND BET'),
						text: t('SPIN AND BET TEXT'),
						image: symbol('tomato'),
						row: 0,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('FEATURES AND AUTOPLAY'),
						text: t('FEATURES AND AUTOPLAY TEXT'),
						image: symbol('broccoli'),
						row: 1,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('DISCLAIMER'),
						text: t('DISCLAIMER TEXT'),
						image: symbol('carrot'),
						row: 2,
						column: 0,
						imagePosition: 'left',
					},
				],
			},
		];

		stateMeta.gameRuleMeta.payTable = [
			{
				title: t('CLUSTER PAYOUTS'),
				rows: 7,
				columns: 1,
				containers: [
					{
						title: t('CABBAGE'),
						text: t('PAYS BROCCOLI'),
						image: symbol('broccoli'),
						row: 0,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('PEPPER'),
						text: t('PAYS CORN'),
						image: symbol('corn'),
						row: 1,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('TOMATO'),
						text: t('PAYS TOMATO'),
						image: symbol('tomato'),
						row: 2,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('EGGPLANT'),
						text: t('PAYS EGGPLANT'),
						image: symbol('eggplant'),
						row: 3,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('POTATO'),
						text: t('PAYS CARROT'),
						image: symbol('carrot'),
						row: 4,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('RADISH'),
						text: t('PAYS PEPPER'),
						image: symbol('cauliflower'),
						row: 5,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('GARLIC'),
						text: t('PAYS ONION'),
						image: symbol('radish'),
						row: 6,
						column: 0,
						imagePosition: 'left',
					},
				],
			},
			{
				title: t('FEATURES'),
				rows: 3,
				columns: 2,
				containers: [
					{
						title: t('MODE CHANCE TITLE'),
						text: t('PAYTABLE CHANCE TEXT'),
						image: symbol('scatter'),
						row: 0,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('MODE FEATURE TITLE'),
						text: t('PAYTABLE FEATURE TEXT'),
						image: symbol('broccoli'),
						row: 0,
						column: 1,
						imagePosition: 'left',
					},
					{
						title: t('MODE BONUS TITLE'),
						text: t('PAYTABLE BONUS TEXT'),
						image: symbol('tomato'),
						row: 1,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('MODE SUPER TITLE'),
						text: t('PAYTABLE SUPER TEXT'),
						image: symbol('corn'),
						row: 1,
						column: 1,
						imagePosition: 'left',
					},
					{
						title: t('MODE MYSTERY TITLE'),
						text: t('PAYTABLE MYSTERY TEXT'),
						image: symbol('onion'),
						row: 2,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('MAX WIN'),
						text: t('PAYTABLE MAX TEXT'),
						image: symbol('carrot'),
						row: 2,
						column: 1,
						imagePosition: 'left',
					},
				],
			},
		];

		stateMeta.gameRuleMeta.infoAssets = {
			navArrowLeft: `${infoDir}/nav_arrow_right.svg`,
			navArrowRight: `${infoDir}/nav_arrow_right.svg`,
			navButton: `${infoDir}/nav_btn_bg.webp`,
			statCard: `${infoDir}/stat_card.webp`,
			featureCard: `${infoDir}/feature_card.webp`,
			specialFrame: `${infoDir}/special_frame.webp`,
			framePortrait: `${infoDir}/portrait_frame.webp`,
		};

		stateMeta.gameRuleMeta.infoPages = [
			{
				kind: 'overview',
				frame: infoFrame,
				background: './assets/veggie-salad/pixel/background.webp',
				title: t('INFO OVERVIEW'),
				// Design 9025:7456 (2026-09-16): one intro paragraph, the max-win and RTP rows, and two
				// feature cards. The stat icons are not drawn; they only satisfy the shared type.
				body: t('INFO OV BODY'),
				stats: [
					{
						icon: infoIcon('icon_maxwin'),
						value: t('INFO OV MAXWIN VALUE'),
						label: t('INFO OV MAXWIN LABEL'),
					},
					{ icon: infoIcon('icon_rtp'), value: '96.10%', label: t('INFO OV RTP LABEL') },
				],
				cards: [
					{ title: t('INFO OV MULT TITLE'), text: t('INFO OV MULT TEXT') },
					{ title: t('INFO OV BONUS TITLE'), text: t('INFO OV BONUS TEXT') },
				],
			},
			{
				kind: 'paytable',
				frame: infoFrame,
				background: infoPanel,
				title: t('INFO PAYTABLE'),
				payoutHead: {
					symbol: t('SYMBOL'),
					cols: ['5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15+'],
				},
				payouts: [
					{
						icon: symbol('broccoli'),
						name: t('CABBAGE'),
						premium: true,
						x3: '1×',
						x4: '1.5×',
						x5: '1.75×',
						values: [
							'1×',
							'1.5×',
							'1.75×',
							'2×',
							'2.5×',
							'5×',
							'7.5×',
							'15×',
							'35×',
							'70×',
							'150×',
						],
					},
					{
						icon: symbol('corn'),
						name: t('PEPPER'),
						premium: true,
						x3: '0.75×',
						x4: '1×',
						x5: '1.25×',
						values: [
							'0.75×',
							'1×',
							'1.25×',
							'1.5×',
							'2×',
							'4×',
							'6×',
							'12.5×',
							'30×',
							'60×',
							'100×',
						],
					},
					{
						icon: symbol('tomato'),
						name: t('TOMATO'),
						premium: true,
						x3: '0.5×',
						x4: '0.75×',
						x5: '1×',
						values: [
							'0.5×',
							'0.75×',
							'1×',
							'1.25×',
							'1.5×',
							'3×',
							'4.5×',
							'10×',
							'25×',
							'50×',
							'90×',
						],
					},
					{
						icon: symbol('eggplant'),
						name: t('EGGPLANT'),
						premium: true,
						x3: '0.4×',
						x4: '0.5×',
						x5: '0.75×',
						values: ['0.4×', '0.5×', '0.75×', '1×', '1.25×', '2×', '3×', '5×', '20×', '40×', '80×'],
					},
					{
						icon: symbol('carrot'),
						name: t('POTATO'),
						premium: true,
						x3: '0.3×',
						x4: '0.4×',
						x5: '0.5×',
						values: [
							'0.3×',
							'0.4×',
							'0.5×',
							'0.75×',
							'1×',
							'1.5×',
							'2.5×',
							'3.5×',
							'15×',
							'30×',
							'60×',
						],
					},
					{
						icon: symbol('cauliflower'),
						name: t('RADISH'),
						premium: true,
						x3: '0.25×',
						x4: '0.3×',
						x5: '0.4×',
						values: [
							'0.25×',
							'0.3×',
							'0.4×',
							'0.5×',
							'0.75×',
							'1.25×',
							'2×',
							'3×',
							'10×',
							'20×',
							'40×',
						],
					},
					{
						icon: symbol('radish'),
						name: t('GARLIC'),
						premium: true,
						x3: '0.2×',
						x4: '0.25×',
						x5: '0.3×',
						values: [
							'0.2×',
							'0.25×',
							'0.3×',
							'0.4×',
							'0.5×',
							'1×',
							'1.5×',
							'2.5×',
							'5×',
							'10×',
							'20×',
						],
					},
				],
				// The scatter card beside the table (9043:11918) carries the design's own copy verbatim.
				cards: [
					{
						icon: symbol('scatter'),
						title: t('INFO PT SCATTER TITLE'),
						text: t('INFO PT SCATTER TEXT'),
					},
				],
			},
			{
				kind: 'features',
				frame: infoFrame,
				background: infoPanel,
				title: t('FEATURES'),
				cards: [
					{ title: t('INFO FEAT CLUSTER TITLE'), text: t('INFO FEAT CLUSTER TEXT') },
					{ title: t('INFO FEAT TUMBLE TITLE'), text: t('INFO FEAT TUMBLE TEXT') },
					{ title: t('INFO FEAT MULT TITLE'), text: t('INFO FEAT MULT TEXT') },
					{ title: t('BONUS TIER NORMAL'), text: t('INFO FEAT NORMAL TEXT') },
					{ title: t('BONUS TIER SUPER'), text: t('INFO FEAT SUPER TEXT') },
					{ title: t('BONUS TIER HIDDEN'), text: t('INFO FEAT HIDDEN TEXT') },
				],
			},
			{
				kind: 'ways',
				frame: infoFrame,
				background: infoPanel,
				title: t('INFO WAYS TO WIN'),
				cards: [
					{ title: t('INFO FEAT CLUSTER TITLE'), text: t('INFO WTW CLUSTER TEXT') },
					{ title: t('INFO WTW TUMBLES TITLE'), text: t('INFO WTW TUMBLES TEXT') },
					{ title: t('INFO WTW TRIGGERS TITLE'), text: t('INFO WTW TRIGGERS TEXT') },
					{ title: t('INFO WTW RETRIGGERS TITLE'), text: t('INFO WTW RETRIGGERS TEXT') },
					{ title: t('MAX WIN'), text: t('INFO WTW MAXWIN TEXT') },
				],
			},
			{
				kind: 'featurebuy',
				frame: infoFrame,
				background: infoPanel,
				title: t('INFO FEATURE BUY'),
				cards: [
					{
						icon: `${infoDir}/fb_normal.svg`,
						title: t('INFO FB NORMAL TITLE'),
						text: t('INFO FB NORMAL TEXT'),
					},
					{
						icon: `${infoDir}/fb_super.svg`,
						title: t('INFO FB SUPER TITLE'),
						text: t('INFO FB SUPER TEXT'),
					},
					{
						icon: infoIcon('fb_mystery'),
						title: t('INFO FB MYSTERY TITLE'),
						text: t('INFO FB MYSTERY TEXT'),
					},
				],
			},
			{
				kind: 'general',
				frame: infoFrame,
				background: infoPanel,
				title: t('INFO GENERAL INFO'),
				cards: [
					{
						icon: `${infoDir}/icon_interrupted.svg`,
						title: t('INFO GI INTERRUPTED TITLE'),
						text: t('INFO GI INTERRUPTED TEXT'),
					},
					{
						icon: `${infoDir}/icon_legal.svg`,
						title: t('INFO GI LEGAL TITLE'),
						text: t('DISCLAIMER TEXT'),
					},
				],
			},
			{
				kind: 'uiguide',
				frame: infoFrame,
				background: infoPanel,
				title: t('INFO UI GUIDE'),
				// Design 9044:15707 draws each control as a light glyph on a dark disc; the spin
				// button alone keeps its amber face (theme 'gold').
				cards: [
					{
						icon: infoIcon('ui_glyph_spin'),
						theme: 'gold',
						title: t('INFO CTRL SPIN'),
						text: t('INFO CTRL SPIN DESC'),
					},
					{
						icon: `${infoDir}/ui_glyph_auto.svg`,
						title: t('INFO CTRL AUTO'),
						text: t('INFO CTRL AUTO DESC'),
					},
					{
						icon: infoIcon('ui_glyph_turbo'),
						title: t('INFO CTRL TURBO'),
						text: t('INFO CTRL TURBO DESC'),
					},
					{
						icon: `${infoDir}/ui_glyph_betplus.svg`,
						title: t('INFO CTRL PLUS'),
						text: t('INFO CTRL PLUS DESC'),
					},
					{
						icon: `${infoDir}/ui_glyph_betminus.svg`,
						title: t('INFO CTRL MINUS'),
						text: t('INFO CTRL MINUS DESC'),
					},
					{
						icon: `${infoDir}/ui_glyph_info.svg`,
						title: t('INFO CTRL INFO'),
						text: t('INFO CTRL INFO DESC'),
					},
					{
						icon: `${infoDir}/ui_glyph_sound.svg`,
						title: t('INFO CTRL SOUND'),
						text: t('INFO CTRL SOUND DESC'),
					},
					{
						icon: `${infoDir}/ui_glyph_arrow.svg`,
						title: t('INFO CTRL PREV'),
						text: t('INFO CTRL PREV DESC'),
					},
					{
						icon: `${infoDir}/ui_glyph_arrow_next.svg`,
						title: t('INFO CTRL NEXT'),
						text: t('INFO CTRL NEXT DESC'),
					},
					{
						icon: `${infoDir}/ui_glyph_close.svg`,
						title: t('INFO CTRL CLOSE'),
						text: t('INFO CTRL CLOSE DESC'),
					},
					{
						icon: `${infoDir}/ui_glyph_menu.svg`,
						title: t('INFO CTRL MENU'),
						text: t('INFO CTRL MENU DESC'),
					},
					{
						icon: `${infoDir}/ui_glyph_music.svg`,
						title: t('INFO CTRL MUSIC'),
						text: t('INFO CTRL MUSIC DESC'),
					},
				],
			},
		];
	});
</script>

<svelte:window onkeydown={acknowledgeWithKeyboard} />

{#if started}
	<EnableGameActor />
	<!-- Audio mounts with play, after the splash click: the first user gesture the Web Audio
	     context needs has happened by then, so the base loop starts straight away. -->
	<EnableSound />
	<Sound />
	<StakeSync />
	<EnableHotkey />
	<VeggieSaladPrototype />
	<ResumeBet />
	<ReplayHud />
	<PendingRoundRecovery />
{/if}

<!-- App stays mounted from first paint through play. Only loader assets block initial render; the
     remaining manifest streams while PixelLoadingScreen displays real progress. -->
<div class="pixi-overlay-layer" class:loading aria-hidden={!loading}>
	<App preloadWebFont={false} maxResolution={2} rendererPreference="webgl" antialias={false}>
		<EnablePixiExtension />
		<EnablePixelTextureMode />
		{#if loading}
			<PixelLoadingScreen onloaded={finishLoading} />
		{:else if started}
			<PixelEventOverlay />
		{/if}
	</App>
</div>

{#if splashVisible}
	<PixelSplashScreen onstart={startGame} leaving={splashLeaving} />
{/if}

{#if stateGame.continueGate}
	<button
		type="button"
		class="continue-gate"
		aria-label={t('CLICK ANYWHERE TO CONTINUE')}
		onclick={acknowledgePresentation}
	>
		<span>{t('CLICK ANYWHERE TO CONTINUE')}</span>
	</button>
{/if}

<Modals>
	{#snippet version()}
		<GameVersion version="0.0.0" />
	{/snippet}
</Modals>

<style>
	.pixi-overlay-layer {
		position: fixed;
		inset: 0;
		z-index: 40;
		pointer-events: none;
	}
	.pixi-overlay-layer.loading {
		z-index: 100;
	}
	.continue-gate {
		position: fixed;
		inset: 0;
		z-index: 105;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: 0 16px max(8px, 1.5vh);
		border: 0;
		background: transparent;
		color: #fff1a8;
		font-family: 'Jersey 10', monospace;
		font-size: clamp(12px, 1.7vw, 24px);
		font-weight: 900;
		letter-spacing: 0.1em;
		text-shadow: 3px 3px 0 #351a07;
		cursor: pointer;
	}
	.continue-gate span {
		animation: continue-blink 1.2s steps(2, end) infinite;
	}
	@keyframes continue-blink {
		50% {
			opacity: 0.45;
		}
	}
</style>
