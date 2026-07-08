<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { MainContainer } from 'components-layout';
	import { App } from 'pixi-svelte';
	import { stateMeta } from 'state-shared';
	import { Modals } from 'components-ui-html';

	import { getContext } from '../game/context';
	import EnableSound from './EnableSound.svelte';
	import EnableGameActor from './EnableGameActor.svelte';
	import PendingRoundRecovery from './PendingRoundRecovery.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import Sound from './Sound.svelte';
	import Background from './Background.svelte';
	import LoadingScreen from './LoadingScreen.svelte';
	import BoardFrame from './BoardFrame.svelte';
	import Board from './Board.svelte';
	import GameLogoFrame from './GameLogoFrame.svelte';
	import Win from './Win.svelte';
	import FreeSpinIntro from './FreeSpinIntro.svelte';
	import FreeSpinCounter from './FreeSpinCounter.svelte';
	import FreeSpinOutro from './FreeSpinOutro.svelte';
	import Transition from './Transition.svelte';
	import GlobalMultiplier from './GlobalMultiplier.svelte';
	import TempMultiplierBanner from './TempMultiplierBanner.svelte';
	import HudHtml from './HudHtml.svelte';
	import StakeSync from './StakeSync.svelte';
	import ReplayHud from './replay/ReplayHud.svelte';
	import MagnetStatus from './MagnetStatus.svelte';
	import SplashIntro from './SplashIntro.svelte';

	const context = getContext();

	// Splash intro overlay: shown once assets have loaded, dismissed on first press. The loading
	// screen defers its `proceed` callback to us via `oncanproceed` so nothing starts until pressed.
	let splashIntroVisible = $state(false);
	let splashPressHandler = $state<(() => void) | undefined>(undefined);

	const heroArt = './assets/components/backgrounds/visual_v2.png';
	const bonusArt = './assets/components/backgrounds/splash.jpg';
	const scatterArt = './assets/components/symbols/scatter.png';
	const uiRefArt = './assets/components/ui/scatter-panel-image.png';
	const paytableArt = './assets/components/backgrounds/visual_v2.png';
	const heroArtBackdrop = new URL('../../static/assets/components/backgrounds/visual_v2.png', import.meta.url).href;

	$effect(() => {
		stateMeta.betModeMeta = {
			BASE: {
				mode: 'BASE', costMultiplier: 1, type: 'default', parent: '', children: '', assets: { icon: '', volatility: '', button: '', dialogImage: heroArt, dialogVolatility: scatterArt },
				text: { title: 'BASE', dialog: '7x7 cluster-pay base game with natural clusters and random magnets.', button: 'PLAY', tickerIdle: 'MAGNETIC', tickerSpin: 'GOOD LUCK' },
				maxWin: 20000,
			},
			CHANCE: {
				mode: 'CHANCE', costMultiplier: 2, type: 'activate', parent: '', children: '', assets: { icon: '', volatility: '', button: '', dialogImage: bonusArt, dialogVolatility: uiRefArt },
				text: { title: 'CHANCE SPIN', dialog: '2x cost. Base game with 3x higher bonus chance.', description: '2x cost per spin, 3x bonus trigger odds.', button: 'ACTIVATE', tickerIdle: 'CHANCE ACTIVE', tickerSpin: 'GOOD LUCK' },
				maxWin: 20000,
			},
			FEATURE: {
				mode: 'FEATURE', costMultiplier: 50, type: 'activate', parent: '', children: '', assets: { icon: '', volatility: '', button: '', dialogImage: bonusArt, dialogVolatility: uiRefArt },
				text: { title: 'FEATURE SPIN', dialog: '50x cost. One paid spin with a guaranteed magnet series and possible magnet multipliers.', description: 'Guaranteed magnet every paid feature spin.', button: 'ACTIVATE', tickerIdle: 'FEATURE ACTIVE', tickerSpin: 'FEATURE SPIN' },
				maxWin: 20000,
			},
			BONUS: {
				mode: 'BONUS', costMultiplier: 100, type: 'buy', parent: '', children: '', assets: { icon: '', volatility: '', button: '', dialogImage: bonusArt, dialogVolatility: scatterArt },
				text: { title: 'DROP-O-MAGNET', dialog: '10 free spins. Magnet chance is boosted; any magnet selects one target symbol for that active series.', description: 'Buy the 10-spin Drop-O-Magnet bonus for 100x bet.', button: 'BUY', tickerIdle: 'PLACE YOUR BET', tickerSpin: 'BONUS ACTIVE' },
				maxWin: 20000,
			},
			SUPER: {
				mode: 'SUPER', costMultiplier: 500, type: 'buy', parent: '', children: '', assets: { icon: '', volatility: '', button: '', dialogImage: heroArt, dialogVolatility: scatterArt },
				text: { title: 'MEGA CHAIN', dialog: '10 free spins. First spin guarantees a magnet, and the same target cluster persists across the whole bonus.', description: 'Buy the persistent Magnetic Mega Chain bonus for 500x bet.', button: 'BUY', tickerIdle: 'PLACE YOUR BET', tickerSpin: 'SUPER ACTIVE' },
				maxWin: 20000,
			},
		};

		stateMeta.gameRuleMeta = {
			gameRules: [
				{
					title: 'GAME INFO', rows: 5, columns: 1,
					containers: [
						{ title: 'MAGNETIC', text: 'Magnetic is a 7x7 cluster-pay slot. Wins form when 5 or more matching symbols touch orthogonally. Diagonal touches do not count.', image: heroArt, row: 0, column: 0, imagePosition: 'left' },
						{ title: 'CLUSTERS', text: 'Natural winning clusters stay locked while all other positions respin. Only newly landed touching matches can extend that active cluster, and the round stops once a respin adds nothing new.', image: paytableArt, row: 1, column: 0, imagePosition: 'left' },
						{ title: 'MAGNETS', text: 'A visible magnet can appear in base game, normal bonus, or super bonus. It selects one pay symbol, and only that target can keep growing during the active magnetic series.', image: scatterArt, row: 2, column: 0, imagePosition: 'left' },
						{ title: 'MAGNET MULTIPLIERS', text: 'Magnets may land with a multiplier. If more multiplier magnets land in the same active magnetic series, they multiply together: 2x × 3x × 4x = 24x total.', image: scatterArt, row: 3, column: 0, imagePosition: 'left' },
						{ title: 'BONUSES', text: '3 scatters trigger Drop-O-Magnet with 10 free spins and boosted magnet chance. 4 scatters trigger Magnetic Mega Chain where the first spin guarantees a magnet and the target cluster persists across the full bonus.', image: bonusArt, row: 4, column: 0, imagePosition: 'left' },
					],
				},
			],
			payTable: [
				{
					title: 'PAYTABLE', rows: 3, columns: 2,
					containers: [
						{ title: 'PREMIUMS', text: 'Horseshoe Magnet, Plasma Drill, Magnetic Core Cube, and Electromagnetic Device use the full 5 / 6 / 7 / 8 / 9 / 10+ / 12+ / 15+ / 20+ / 25+ / 30+ / 33+ cluster ladder.', image: heroArt, row: 0, column: 0, imagePosition: 'left' },
						{ title: 'LOW SYMBOLS', text: 'Bolt, Nut, Washer, and Energy Screw follow the same 12-tier cluster ladder with lower values and very high-volatility scaling.', image: heroArt, row: 0, column: 1, imagePosition: 'left' },
						{ title: 'TOP PAYS', text: 'Top premium: 33+ = 2,000x\nSecond premium: 33+ = 1,500x\nThird premium: 33+ = 1,200x\nFourth premium: 33+ = 900x', image: uiRefArt, row: 1, column: 0, imagePosition: 'left' },
						{ title: 'SPECIALS', text: 'Wild substitutes for all pay symbols except Scatter. Scatter triggers bonuses. Magnet starts the magnetic series and may also carry a multiplier that compounds with later multiplier magnets.', image: scatterArt, row: 1, column: 1, imagePosition: 'left' },
						{ title: 'BUY MODES', text: 'Drop-O-Magnet: 100x\nMagnetic Mega Chain: 500x\nFeature Spin: 50x / spin\nChance Spin: 2x / spin', image: bonusArt, row: 2, column: 0, imagePosition: 'left' },
						{ title: 'MEGA CHAIN', text: 'The persistent Mega Chain bonus locks the chosen magnetic symbol type, keeps its cluster on the grid, and awards the final large cluster result at the end of the 10-spin feature.', image: heroArt, row: 2, column: 1, imagePosition: 'left' },
					],
				},
			],
			splashScreen: [],
		};
	});

	onMount(() => (context.stateLayout.showLoadingScreen = true));
</script>

<div class="magnetic-shell" data-layout={context.stateLayoutDerived.layoutType()} style={`--magnetic-shell-bg:url('${heroArtBackdrop}')`}>
	<div class="magnetic-stage">
		<App>
			<EnableSound />
			<EnableHotkey />
			<EnableGameActor />
			<EnablePixiExtension />
			<StakeSync />

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

				<MainContainer zIndex={0}>
					<BoardFrame />
				</MainContainer>

				<MainContainer>
					<Board />
				</MainContainer>

				<GameLogoFrame />

				<GlobalMultiplier />
				<TempMultiplierBanner />
				<Win />
				<FreeSpinIntro />
				{#if ['desktop', 'landscape'].includes(context.stateLayoutDerived.layoutType())}
					<FreeSpinCounter />
				{/if}
				<FreeSpinOutro />
				<Transition />
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
			<MagnetStatus />
			<HudHtml />
			<ReplayHud />
			<PendingRoundRecovery />
		{/if}
	</div>
</div>

<Modals>
	{#snippet version()}{/snippet}
</Modals>

<style>
	.magnetic-shell {
		position: relative;
		width: 100%;
		height: 100dvh;
		background: #081008;
		overflow: hidden;
	}
	.magnetic-shell::before,
	.magnetic-shell::after {
		content: '';
		position: absolute;
		inset: -6%;
		pointer-events: none;
	}
	.magnetic-shell::before {
		background: var(--magnetic-shell-bg) center 22% / cover no-repeat;
		filter: blur(22px) brightness(0.28) saturate(0.82);
		transform: scale(1.12);
		opacity: 0.96;
	}
	.magnetic-shell::after {
		background:
			radial-gradient(circle at center, rgba(0, 0, 0, 0.08), rgba(0, 0, 0, 0.68) 76%),
			linear-gradient(180deg, rgba(0, 0, 0, 0.48), rgba(0, 0, 0, 0.2) 22%, rgba(0,0,0,0.35) 76%, rgba(0,0,0,0.74));
	}
	.magnetic-stage {
		position: relative;
		width: 100%;
		height: 100%;
		z-index: 1;
	}
</style>
