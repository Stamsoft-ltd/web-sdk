<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { MainContainer } from 'components-layout';
	import { App, Container } from 'pixi-svelte';
	import { stateMeta, stateUi } from 'state-shared';

	import { Modals } from 'components-ui-html';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import EnableSound from './EnableSound.svelte';
	import SceneAnimationDriver from './SceneAnimationDriver.svelte';
	import EnableGameActor from './EnableGameActor.svelte';
	import PendingRoundRecovery from './PendingRoundRecovery.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import Sound from './Sound.svelte';
	import Background from './Background.svelte';
	import Clouds from './Clouds.svelte';
	import LoadingScreen from './LoadingScreen.svelte';
	import BoardFrame from './BoardFrame.svelte';
	import Board from './Board.svelte';
	import Anticipations from './Anticipations.svelte';
	import Win from './Win.svelte';
	import FreeSpinIntro from './FreeSpinIntro.svelte';
	import FreeSpinCounter from './FreeSpinCounter.svelte';
	import FreeSpinOutro from './FreeSpinOutro.svelte';
	import Transition from './Transition.svelte';
	import NeonPaylines from './NeonPaylines.svelte';
	import PersistentWildBadges from './PersistentWildBadges.svelte';
	import RollerWildsOverlay from './RollerWildsOverlay.svelte';
	import DuckCollectPresenter from './DuckCollectPresenter.svelte';
	import CoasterSetupPresenter from './CoasterSetupPresenter.svelte';
	import DuckPondBonus from './DuckPondBonus.svelte';
	import HudHtml from './HudHtml.svelte';
	import PressAnywhereCaption from './PressAnywhereCaption.svelte';
	import StakeSync from './StakeSync.svelte';
	import ReplayHud from './replay/ReplayHud.svelte';
	import SplashIntro from './SplashIntro.svelte';
	import { BOARD_GRID_OFFSET_Y } from '../game/constants';
	import { registerArtDeep, warmArt } from '../lib/preloadArt';

	const context = getContext();

	let splashIntroVisible = $state(false);
	let splashPressHandler = $state<(() => void) | undefined>(undefined);

	const heroArt = './assets/theme-park/v2/background-blur.webp';
	const bonusArt = './assets/theme-park/coaster-bonus.webp';
	const scatterArt = './assets/theme-park/symbols-concept.webp';
	const uiRefArt = './assets/components/reference/controls_reference.png';
	const paylinesArt = './assets/components/reference/paylines_reference.png';
	const heroArtBackdrop = heroArt;

	const MAX_WIN = 25000;

	// The win presentation sits above everything else on the stage. Without this it sorts at zIndex 0
	// like the rest, and since pixi's sort is stable that leaves draw order down to MOUNT order — the
	// payline layer only mounts once there are wins, i.e. after <Win>, so the vines came out on top
	// of the win box. Board-space layers are deliberately left at 0: the vines are drawn after the
	// wild badges there and should stay that way, or a wild's cell patch cuts the line in half.
	const PRESENTATION_Z = 10;
	// Above every board-space feature, below win/bonus presentation. The border is visual containment;
	// it never participates in board sizing or reel placement.
	const BOARD_BORDER_Z = 6;

	const t = (key: string) => i18nDerived.translate?.(key) ?? key;

	const betModeAssets = {
		icon: '',
		volatility: '',
		button: '',
		dialogImage: bonusArt,
		dialogVolatility: uiRefArt,
	};

	// 7 bet modes per the Theme Park contract:
	// BASE 1x (default) · ANTE/FSPIN1/FSPIN2 are persistent per-spin toggles ·
	// DUCK/ROLLER/COASTER are one-time bonus buys.
	$effect(() => {
		const betModeMeta: typeof stateMeta.betModeMeta = {
			BASE: {
				mode: 'BASE',
				costMultiplier: 1,
				type: 'default',
				parent: '',
				children: '',
				assets: { ...betModeAssets, dialogImage: heroArt },
				text: {
					title: t('BET MODE BASE TITLE'),
					dialog: t('BET MODE BASE DIALOG'),
					button: t('BET MODE BASE BUTTON'),
					tickerIdle: t('BET MODE BASE TICKER IDLE'),
					tickerSpin: t('BET MODE BASE TICKER SPIN'),
				},
				maxWin: MAX_WIN,
			},
			ANTE: {
				mode: 'ANTE',
				costMultiplier: 3,
				type: 'activate',
				parent: '',
				children: '',
				assets: betModeAssets,
				text: {
					title: t('BET MODE ANTE TITLE'),
					dialog: t('BET MODE ANTE DIALOG'),
					description: t('BET MODE ANTE DESCRIPTION'),
					button: t('BET MODE ANTE BUTTON'),
					tickerIdle: t('BET MODE ANTE TICKER IDLE'),
					tickerSpin: t('BET MODE ANTE TICKER SPIN'),
				},
				maxWin: MAX_WIN,
			},
			FSPIN1: {
				mode: 'FSPIN1',
				costMultiplier: 20,
				type: 'activate',
				parent: '',
				children: '',
				assets: betModeAssets,
				text: {
					title: t('BET MODE FSPIN1 TITLE'),
					dialog: t('BET MODE FSPIN1 DIALOG'),
					description: t('BET MODE FSPIN1 DESCRIPTION'),
					button: t('BET MODE FSPIN1 BUTTON'),
					tickerIdle: t('BET MODE FSPIN1 TICKER IDLE'),
					tickerSpin: t('BET MODE FSPIN1 TICKER SPIN'),
				},
				maxWin: MAX_WIN,
			},
			FSPIN2: {
				mode: 'FSPIN2',
				costMultiplier: 60,
				type: 'activate',
				parent: '',
				children: '',
				assets: betModeAssets,
				text: {
					title: t('BET MODE FSPIN2 TITLE'),
					dialog: t('BET MODE FSPIN2 DIALOG'),
					description: t('BET MODE FSPIN2 DESCRIPTION'),
					button: t('BET MODE FSPIN2 BUTTON'),
					tickerIdle: t('BET MODE FSPIN2 TICKER IDLE'),
					tickerSpin: t('BET MODE FSPIN2 TICKER SPIN'),
				},
				maxWin: MAX_WIN,
			},
			DUCK: {
				mode: 'DUCK',
				costMultiplier: 100,
				type: 'buy',
				parent: '',
				children: '',
				assets: betModeAssets,
				text: {
					title: t('BET MODE DUCK TITLE'),
					dialog: t('BET MODE DUCK DIALOG'),
					description: t('BET MODE DUCK DESCRIPTION'),
					button: t('BET MODE DUCK BUTTON'),
					tickerIdle: t('BET MODE DUCK TICKER IDLE'),
					tickerSpin: t('BET MODE DUCK TICKER SPIN'),
				},
				maxWin: MAX_WIN,
			},
			ROLLER: {
				mode: 'ROLLER',
				costMultiplier: 200,
				type: 'buy',
				parent: '',
				children: '',
				assets: betModeAssets,
				text: {
					title: t('BET MODE ROLLER TITLE'),
					dialog: t('BET MODE ROLLER DIALOG'),
					description: t('BET MODE ROLLER DESCRIPTION'),
					button: t('BET MODE ROLLER BUTTON'),
					tickerIdle: t('BET MODE ROLLER TICKER IDLE'),
					tickerSpin: t('BET MODE ROLLER TICKER SPIN'),
				},
				maxWin: MAX_WIN,
			},
			COASTER: {
				mode: 'COASTER',
				costMultiplier: 500,
				type: 'buy',
				parent: '',
				children: '',
				assets: betModeAssets,
				text: {
					title: t('BET MODE COASTER TITLE'),
					dialog: t('BET MODE COASTER DIALOG'),
					description: t('BET MODE COASTER DESCRIPTION'),
					button: t('BET MODE COASTER BUTTON'),
					tickerIdle: t('BET MODE COASTER TICKER IDLE'),
					tickerSpin: t('BET MODE COASTER TICKER SPIN'),
				},
				maxWin: MAX_WIN,
			},
		};

		const gameRuleMeta: typeof stateMeta.gameRuleMeta = {
			gameRules: [
				{
					title: t('RULE SECTION GAME INFO'),
					rows: 4,
					columns: 1,
					containers: [
						{
							title: t('RULE GAME TITLE'),
							text: t('RULE GAME TEXT'),
							image: heroArt,
							row: 0,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('RULE WILD TITLE'),
							text: t('RULE WILD TEXT'),
							image: heroArt,
							row: 1,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('RULE SCATTER TITLE'),
							text: t('RULE SCATTER TEXT'),
							image: scatterArt,
							row: 2,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('PAYTABLE TITLE PAYLINES'),
							text: t('PAYTABLE TEXT PAYLINES'),
							image: paylinesArt,
							row: 3,
							column: 0,
							imagePosition: 'left',
						},
					],
				},
				{
					title: t('RULE SECTION FEATURES'),
					rows: 4,
					columns: 1,
					containers: [
						{
							title: t('FEATURE DUCK COLLECT TITLE'),
							text: t('FEATURE DUCK COLLECT TEXT'),
							image: scatterArt,
							row: 0,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('FEATURE DUCK LUCK TITLE'),
							text: t('FEATURE DUCK LUCK TEXT'),
							image: scatterArt,
							row: 1,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('FEATURE ROLLER TITLE'),
							text: t('FEATURE ROLLER TEXT'),
							image: bonusArt,
							row: 2,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('FEATURE COASTER TITLE'),
							text: t('FEATURE COASTER TEXT'),
							image: bonusArt,
							row: 3,
							column: 0,
							imagePosition: 'left',
						},
					],
				},
				{
					title: t('RULE SECTION HOW TO PLAY'),
					rows: 5,
					columns: 1,
					containers: [
						{
							title: t('HOWTO SPIN TITLE'),
							text: t('HOWTO SPIN TEXT'),
							image: uiRefArt,
							row: 0,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('HOWTO BET TITLE'),
							text: t('HOWTO BET TEXT'),
							image: uiRefArt,
							row: 1,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('HOWTO BUY TITLE'),
							text: t('HOWTO BUY TEXT'),
							image: bonusArt,
							row: 2,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('HOWTO TURBO TITLE'),
							text: t('HOWTO TURBO TEXT'),
							image: uiRefArt,
							row: 3,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('HOWTO AUTOPLAY TITLE'),
							text: t('HOWTO AUTOPLAY TEXT'),
							image: uiRefArt,
							row: 4,
							column: 0,
							imagePosition: 'left',
						},
					],
				},
				{
					title: t('RULE SECTION DISCLAIMER'),
					rows: 1,
					columns: 1,
					containers: [
						{
							title: '',
							text: t('DISCLAIMER TEXT'),
							image: '',
							row: 0,
							column: 0,
							imagePosition: 'top',
						},
					],
				},
			],
			payTable: [
				{
					title: i18nDerived.paytable(),
					rows: 2,
					columns: 2,
					containers: [
						{
							title: t('PAYTABLE PREMIUM TITLE'),
							text: t('PAYTABLE H1_H2'),
							image: heroArt,
							row: 0,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('PAYTABLE PREMIUM TITLE'),
							text: t('PAYTABLE H3_H5'),
							image: heroArt,
							row: 0,
							column: 1,
							imagePosition: 'left',
						},
						{
							title: t('PAYTABLE LOW TITLE'),
							text: t('PAYTABLE LOWS'),
							image: uiRefArt,
							row: 1,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: t('PAYTABLE SPECIAL TITLE'),
							text: t('PAYTABLE SPECIAL_TEXT'),
							image: scatterArt,
							row: 1,
							column: 1,
							imagePosition: 'left',
						},
					],
				},
			],
			splashScreen: [],
		};
		registerArtDeep(betModeMeta);
		registerArtDeep(gameRuleMeta);
		stateMeta.betModeMeta = betModeMeta;
		stateMeta.gameRuleMeta = gameRuleMeta;
	});

	onMount(() => {
		context.stateLayout.showLoadingScreen = true;
		warmArt();
		// Force-fetch the fonts that only ever render on CANVAS (pixi Text). A @font-face is
		// downloaded when DOM text first uses it; canvas fillText never triggers the fetch, it
		// just falls back — the win-card amount rendered in Times because Cinzel was declared
		// but never loaded (all DOM text is Poppins/Inter).
		document.fonts?.load('900 64px Cinzel').catch(() => {});
		// Inter Bold is fetched by the HUD's DOM text on most paths, but the duck-pond panels draw
		// it on canvas — make its load unconditional too.
		document.fonts?.load('700 38px Inter').catch(() => {});
		// The design's two faces (Figma 6541:4136 and the buy menu): Lilita One carries every
		// heading, amount and badge drawn on canvas, Nunito Sans the captions beside them.
		document.fonts?.load('400 64px "Lilita One"').catch(() => {});
		document.fonts?.load('700 18px "Nunito Sans"').catch(() => {});
		document.fonts?.load('400 18px "Nunito Sans"').catch(() => {});
	});
</script>

<div
	class="game-shell"
	data-layout={context.stateLayoutDerived.layoutType()}
	style={`--game-shell-bg:url('${heroArtBackdrop}')`}
>
	<div class="game-stage">
		<App preloadWebFont={false} maxResolution={2} antialias={false} rendererPreference="webgl">
			<SceneAnimationDriver />
			<EnableSound />
			<EnableHotkey />
			<EnableGameActor />
			<EnablePixiExtension />
			<StakeSync />

			<Background />
			<!-- Straight after the backdrop and before every <MainContainer>: they all sort at zIndex
			     0, so insertion order is what keeps the sky behind the board. -->
			<Clouds />

			{#if context.stateLayout.showLoadingScreen}
				<LoadingScreen
					onloaded={() => (context.stateLayout.showLoadingScreen = false)}
					oncanproceed={(handler) => {
						splashPressHandler = handler;
						splashIntroVisible = true;
					}}
				/>
			{:else}
				<ResumeBet />
				<Sound />

				<MainContainer zIndex={0}>
					<BoardFrame layer="base" />
				</MainContainer>

				<MainContainer>
					<Board />
					<Anticipations />
				</MainContainer>

				<!-- Settled Mega Wild reels sit above the authored grid/frame but below paylines.
				     During their intro the overlay raises its own z-index over the whole board. -->
				<RollerWildsOverlay />

				<!-- Independent top rail: same authored look as the original board, with current cell/grid
				     geometry untouched. It also covers edge-reel art at the rounded board corners. -->
				<Container zIndex={BOARD_BORDER_Z}>
					<MainContainer>
						<BoardFrame layer="border" />
					</MainContainer>
				</Container>

				{#if context.stateGame.paylineWins.length > 0}
					<MainContainer>
						{@const bl = context.stateGameDerived.boardLayout()}
						<Container
							x={bl.x}
							y={bl.y + BOARD_GRID_OFFSET_Y}
							pivot={bl.pivot}
							scale={bl.boardScale}
						>
							<NeonPaylines wins={context.stateGame.paylineWins} />
						</Container>
					</MainContainer>
				{/if}

				<!-- Theme Park overlays (board-space first, then full-screen) -->
				<PersistentWildBadges />
				<DuckCollectPresenter />
				<CoasterSetupPresenter />
				<DuckPondBonus />
				<!-- The wrapper is what carries the layer, not the components inside: MainContainer
				     spreads its props onto an INNER container, so a zIndex handed to it never reaches
				     the node the stage actually sorts. -->
				<Container zIndex={PRESENTATION_Z}>
					<Win />
					<FreeSpinIntro />
					{#if ['desktop', 'landscape'].includes(context.stateLayoutDerived.layoutType())}
						<FreeSpinCounter />
					{/if}
					<FreeSpinOutro />
					<Transition />
				</Container>
			{/if}
		</App>

		{#if splashIntroVisible}
			<div transition:fade={{ duration: 350 }} style="position:absolute;inset:0;z-index:10;">
				<SplashIntro
					onpress={() => {
						splashIntroVisible = false;
						splashPressHandler?.();
					}}
				/>
			</div>
		{/if}

		{#if !context.stateLayout.showLoadingScreen}
			{#if stateUi.config.mode !== 'replay'}
				<HudHtml />
			{/if}
			<!-- After the HUD so it paints over the bar, which is where the design puts it. -->
			<PressAnywhereCaption />
			<ReplayHud />
			<PendingRoundRecovery />
		{/if}
	</div>
</div>

<Modals>
	{#snippet version()}{/snippet}
</Modals>

<style>
	.game-shell {
		position: relative;
		width: 100%;
		height: 100dvh;
		background: #081008;
		overflow: hidden;
	}

	.game-shell::before,
	.game-shell::after {
		content: '';
		position: absolute;
		inset: -6%;
		pointer-events: none;
	}

	.game-shell::before {
		background: var(--game-shell-bg) center 22% / cover no-repeat;
		filter: blur(20px) brightness(0.28) saturate(0.8);
		transform: scale(1.12);
		opacity: 0.95;
	}

	.game-shell::after {
		background:
			radial-gradient(circle at center, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.65) 74%),
			linear-gradient(
				180deg,
				rgba(0, 0, 0, 0.48),
				rgba(0, 0, 0, 0.2) 22%,
				rgba(0, 0, 0, 0.35) 76%,
				rgba(0, 0, 0, 0.72)
			);
	}

	.game-stage {
		position: relative;
		width: 100%;
		height: 100%;
		z-index: 1;
	}

	:global(html),
	:global(body) {
		overflow: hidden;
	}
</style>
