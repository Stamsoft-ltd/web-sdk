<script lang="ts">
	import { onMount } from 'svelte';

	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { MainContainer } from 'components-layout';
	import { App } from 'pixi-svelte';
	import { stateBet, stateMeta, stateModal } from 'state-shared';

	import { GameVersion, Modals } from 'components-ui-html';

	import { getContext } from '../game/context';
	import EnableSound from './EnableSound.svelte';
	import EnableGameActor from './EnableGameActor.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import Sound from './Sound.svelte';
	import Background from './Background.svelte';
	import LoadingScreen from './LoadingScreen.svelte';
	import BoardFrame from './BoardFrame.svelte';
	import Board from './Board.svelte';
	import Anticipations from './Anticipations.svelte';
	import Win from './Win.svelte';
	import FreeSpinIntroHtml from './FreeSpinIntroHtml.svelte';
	import FreeSpinCounter from './FreeSpinCounter.svelte';
	import FreeSpinOutro from './FreeSpinOutro.svelte';
	import Transition from './Transition.svelte';
	import FeatureOverlay from './FeatureOverlay.svelte';
	import PaylineOverlay from './PaylineOverlay.svelte';
	import HudHtml from './HudHtml.svelte';
	import SplashIntro from './SplashIntro.svelte';
	import { fade } from 'svelte/transition';
	import { warmArt, ap } from '../lib/preloadArt';

	// Press Play studio wordmark + McSchmutzo logo — shown on the (dark) loading screen while assets
	// stream in (the leftover template title-screen spine was removed).
	const pressPlayLogo = ap('/assets/components/ui/press_play_logo.webp');
	const loadingLogo = ap('/assets/mcschmutzo/splash/logo.webp');

	const context = getContext();

	// The designed splash (logo + character + feature cards) shows once assets are ready; pressing it
	// runs the loading screen's proceed handler (transition → game).
	let splashIntroVisible = $state(false);
	let splashPressHandler = $state<(() => void) | undefined>(undefined);
	const modeImage = './assets/mcschmutzo/background-base.png';
	const symbolImage = (name: string) => `./assets/mcschmutzo/symbols/${name}.png`;

	const modeMeta = (
		mode: string,
		costMultiplier: number,
		type: 'default' | 'activate' | 'buy',
		title: string,
	) => ({
		mode,
		costMultiplier,
		type,
		parent: '',
		children: '',
		assets: {
			icon: '',
			volatility: '',
			button: '',
			dialogImage: modeImage,
			dialogVolatility: modeImage,
		},
		text: {
			title,
			dialog: title,
			description: title,
			button: type === 'buy' ? 'BUY' : type === 'activate' ? 'ACTIVATE' : 'PLAY',
			tickerIdle: title,
			tickerSpin: title,
		},
		maxWin: 25000,
	});

	$effect(() => {
		stateMeta.betModeMeta = {
			BASE: modeMeta('base', 1, 'default', 'BASE GAME'),
			ENHANCER1: modeMeta('enhancer1', 2, 'activate', 'EXTRA CHANCE'),
			FEATURESPIN: modeMeta('featureSpin', 20, 'activate', 'LOCK FEATURE SPIN'),
			BONUS1: modeMeta('bonus1', 100, 'buy', 'NORMAL BONUS'),
			BONUS2: modeMeta('bonus2', 500, 'buy', 'SUPER BONUS'),
		};
		stateMeta.gameRuleMeta = {
			gameRules: [
				{
					title: 'HOW TO PLAY',
					rows: 4,
					columns: 1,
					containers: [
						{
							title: 'BASE GAME',
							text: 'Wins pay left to right on 50 fixed paylines. The same paytable applies in every mode. Maximum win is 25,000x.',
							image: modeImage,
							row: 0,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: 'LOCK & RE-SPIN',
							text: 'Every spin with at least one paying line locks its winning symbol and starts the re-spin feature. New matching wins add locked positions.',
							image: './assets/mcschmutzo/lock-respin.png',
							row: 1,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: 'NORMAL BONUS',
							text: 'Three Scatter symbols trigger the Normal Bonus. It can also be bought for 100x bet.',
							image: symbolImage('S'),
							row: 2,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: 'SUPER BONUS',
							text: 'Four Scatter symbols trigger the Super Bonus. No spin can land more than four Scatters. It can also be bought for 500x bet.',
							image: './assets/mcschmutzo/bonus-wheel.png',
							row: 3,
							column: 0,
							imagePosition: 'left',
						},
					],
				},
			],
			payTable: [
				{
					title: 'PAYTABLE',
					rows: 6,
					columns: 2,
					containers: [
						...[
							['H1', '5: 5x · 4: 2x · 3: 0.5x'],
							['H2', '5: 2.5x · 4: 1x · 3: 0.3x'],
							['H3', '5: 2.5x · 4: 1x · 3: 0.3x'],
							['H4', '5: 2x · 4: 0.8x · 3: 0.2x'],
							['H5', '5: 2x · 4: 0.8x · 3: 0.2x'],
							['L1', '5: 1x · 4: 0.4x · 3: 0.1x'],
							['L2', '5: 1x · 4: 0.4x · 3: 0.1x'],
							['L3', '5: 1x · 4: 0.4x · 3: 0.1x'],
							['L4', '5: 1x · 4: 0.4x · 3: 0.1x'],
							['L5', '5: 1x · 4: 0.4x · 3: 0.1x'],
							['W', 'Wild substitutes for regular paying symbols.'],
							['S', 'Three Scatters trigger Normal Bonus; four trigger Super Bonus.'],
						].map(([name, text], index) => ({
							title: name,
							text,
							image: symbolImage(name),
							row: Math.floor(index / 2),
							column: index % 2,
							imagePosition: 'left' as const,
						})),
					],
				},
			],
			splashScreen: [],
			infoPages: [],
			infoAssets: {
				navArrowLeft: '',
				navArrowRight: '',
				navButton: '',
				statCard: '',
				featureCard: '',
				specialFrame: '',
			},
		};
	});

	$effect(() => {
		if (stateBet.activeBetModeKey === 'BASE') stateBet.activeBetModeKey = 'base';
	});

	onMount(() => {
		context.stateLayout.showLoadingScreen = true;
		warmArt();
	});

	context.eventEmitter.subscribeOnMount({
		buyBonusConfirm: () => {
			stateModal.modal = { name: 'buyBonusConfirm' };
		},
	});
</script>

<div
	class="mcschmutzo-shell"
	data-layout={context.stateLayoutDerived.layoutType()}
	style={`--mcschmutzo-shell-bg:url('${modeImage}')`}
>
	<div class="mcschmutzo-stage">
		<App preloadWebFont={false} maxResolution={2} antialias={false} rendererPreference="webgl">
			<EnableSound />
			<EnableHotkey />
			<EnableGameActor />
			<EnablePixiExtension />

			<Background />

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

				<MainContainer>
					<BoardFrame />
				</MainContainer>

				<MainContainer>
					<Board />
					<Anticipations />
					<FeatureOverlay />
					{#if context.stateGame.paylineWins.length > 0}
						<PaylineOverlay wins={context.stateGame.paylineWins} />
					{/if}
				</MainContainer>

				<Win />
				{#if ['desktop', 'landscape'].includes(context.stateLayoutDerived.layoutType())}
					<FreeSpinCounter />
				{/if}
				<FreeSpinOutro />
				<Transition />
			{/if}
		</App>

		{#if context.stateLayout.showLoadingScreen && !splashIntroVisible}
			<img class="mcs-loading-logo" src={loadingLogo} alt="McSchmutzo" />
			<img class="pp-loading-mark" src={pressPlayLogo} alt="Press Play" />
		{/if}

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
			<HudHtml />
			<FreeSpinIntroHtml />
		{/if}
	</div>
</div>

<Modals>
	{#snippet version()}
		<GameVersion version="0.1.0" />
	{/snippet}
</Modals>

<style>
	.mcschmutzo-shell {
		position: relative;
		width: 100%;
		height: 100dvh;
		overflow: hidden;
		background: #190a04;
	}

	.mcschmutzo-shell::before {
		content: '';
		position: absolute;
		inset: -6%;
		background: var(--mcschmutzo-shell-bg) center / cover no-repeat;
		filter: blur(18px) brightness(0.38) saturate(0.9);
		transform: scale(1.12);
		opacity: 0.95;
	}

	.mcschmutzo-stage {
		position: relative;
		z-index: 1;
		width: 100%;
		height: 100%;
	}

	/* McSchmutzo logo on the loading screen — sits above the (pixi) progress bar. */
	.mcs-loading-logo {
		position: absolute;
		left: 50%;
		top: 30%;
		transform: translate(-50%, -50%);
		width: min(420px, 46%);
		height: auto;
		z-index: 11;
		pointer-events: none;
		filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.5));
	}

	/* Press Play studio wordmark on the loading screen — white mark on the dark loader bg. */
	.pp-loading-mark {
		position: absolute;
		left: 50%;
		bottom: 5%;
		transform: translateX(-50%);
		width: min(190px, 24%);
		height: auto;
		z-index: 11;
		pointer-events: none;
		filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.6));
		animation: pp-fade-in 0.6s ease-out;
	}
	@keyframes pp-fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	:global(html),
	:global(body) {
		overflow: hidden;
	}
</style>
