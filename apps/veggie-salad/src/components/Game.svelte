<script lang="ts">
	import { GameVersion, Modals } from 'components-ui-html';
	import { EnablePixiExtension } from 'components-pixi';
	import { App } from 'pixi-svelte';
	import { EnableHotkey } from 'components-shared';
	import { stateI18nDerived, stateMeta, stateUi } from 'state-shared';

	import EnableGameActor from './EnableGameActor.svelte';
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

	let loading = $state(true);
	let splashVisible = $state(false);
	let started = $state(false);

	const finishLoading = () => {
		loading = false;
		// Replay URLs must resume directly; the marketing splash would obscure the replay result.
		if (stateUi.config.mode === 'replay') started = true;
		else splashVisible = true;
	};

	const startGame = () => {
		splashVisible = false;
		started = true;
	};

	const acknowledgePresentation = () => stateGameDerived.continuePresentation();
	const acknowledgeWithKeyboard = (event: KeyboardEvent) => {
		if (!stateGame.continueGate || (event.key !== 'Enter' && event.code !== 'Space')) return;
		event.preventDefault();
		acknowledgePresentation();
	};

	const symbol = (name: string) => `./assets/veggie-salad/pixel/${name}.png`;
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
				maxWin: 25000,
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
				maxWin: 25000,
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
				maxWin: 25000,
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
				maxWin: 25000,
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
				maxWin: 25000,
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
				maxWin: 25000,
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
						title: t('BROCCOLI'),
						text: t('PAYS BROCCOLI'),
						image: symbol('broccoli'),
						row: 0,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('CORN'),
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
						title: t('CARROT'),
						text: t('PAYS CARROT'),
						image: symbol('carrot'),
						row: 4,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('CAULIFLOWER'),
						text: t('PAYS PEPPER'),
						image: symbol('cauliflower'),
						row: 5,
						column: 0,
						imagePosition: 'left',
					},
					{
						title: t('RADISH'),
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
	});
</script>

<svelte:window onkeydown={acknowledgeWithKeyboard} />

{#if started}
	<EnableGameActor />
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
	<PixelSplashScreen onstart={startGame} />
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
		padding: 0 16px max(24px, 5vh);
		border: 0;
		background: transparent;
		color: #fff1a8;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
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
