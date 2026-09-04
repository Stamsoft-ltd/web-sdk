<script lang="ts" module>
	// Bet-mode dialog art (HTML side, not pixi assets).
	const heroArt = './assets/components/backgrounds/visual_v2.webp';
	const bonusArt = './assets/components/backgrounds/splash.jpg';
	// Same URL (incl. ?v=) as CustomBuyBonusModal's iconBrief so the browser reuses one copy.
	// (The old bare symbols/scatter.webp path never existed — this dialog image 404'd silently.)
	const scatterArt = './assets/components/symbols/magnetic/special/scatter.webp?v=20260806';
	const uiRefArt = './assets/components/ui/scatter-panel-image.webp';
	const paytableArt = './assets/components/backgrounds/visual_v2.webp';

	// For LoadingController's HTML-image pass — built from the consts above so path edits stay in sync.
	export const GAME_DIALOG_IMAGES = [heroArt, bonusArt, scatterArt, uiRefArt, paytableArt];
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';

	import { EnablePixiExtension } from 'components-pixi';
	import { EnableHotkey } from 'components-shared';
	import { MainContainer } from 'components-layout';
	import { App } from 'pixi-svelte';
	import { stateMeta, stateUi } from 'state-shared';
	import { Modals } from 'components-ui-html';

	import { getContext } from '../game/context';
	import EnableSound from './EnableSound.svelte';
	import EnableGameActor from './EnableGameActor.svelte';
	import PendingRoundRecovery from './PendingRoundRecovery.svelte';
	import ResumeBet from './ResumeBet.svelte';
	import Sound from './Sound.svelte';
	import Background from './Background.svelte';
	import LoadingController from './LoadingController.svelte';
	import BoardFrame from './BoardFrame.svelte';
	import Board from './Board.svelte';
	import GameLogoFrame from './GameLogoFrame.svelte';
	import Win from './Win.svelte';
	import FreeSpinIntro from './FreeSpinIntro.svelte';
	import MysteryReveal from './MysteryReveal.svelte';
	import FreeSpinCounter from './FreeSpinCounter.svelte';
	import FreeSpinOutro from './FreeSpinOutro.svelte';
	import Transition from './Transition.svelte';
	import HudHtml from './HudHtml.svelte';
	import StakeSync from './StakeSync.svelte';
	import ReplayHud from './replay/ReplayHud.svelte';
	import SplashIntro from './SplashIntro.svelte';
	import CapsulePanel from './CapsulePanel.svelte';
	import RespinPanel from './RespinPanel.svelte';
	import PressPlayMark from './PressPlayMark.svelte';
	import PortraitTopBar from './PortraitTopBar.svelte';
	import LandscapeCapsule from './LandscapeCapsule.svelte';
	import AmbientDebris from './AmbientDebris.svelte';
	import BonusHandoffVeil from './BonusHandoffVeil.svelte';
	import InsufficientFundsModal from './InsufficientFundsModal.svelte';

	const context = getContext();

	// The splash overlay is up from the very first frame and covers BOTH phases: while the download
	// runs it shows the dimmed room + Press Play progress mark, and when LoadingController says the
	// game may start it undims into the splash proper. One component, one backdrop, no reload
	// between them. LoadingController defers its `proceed` callback to us via `oncanproceed` so
	// nothing actually starts until the player presses.
	let splashLoading = $state(true);
	let splashDone = $state(false);
	let loadProgress = $state(0);
	let splashPressHandler = $state<(() => void) | undefined>(undefined);
	// Visible from mount until `ondone`. Keyed off showLoadingScreen while still loading so the
	// storybook harness — which flips showLoadingScreen off itself the moment assets resolve, before
	// LoadingController can ever reach `canProceed` — is never left under a stuck overlay.
	const splashVisible = $derived(
		!splashDone && (context.stateLayout.showLoadingScreen || !splashLoading),
	);
	// The room is only actually LOOKED at once the splash is gone (it covers the stage for the whole
	// download and the logo hand-off). <Background> cues the ship's arrival flight off this.
	let mainScreenRevealed = $state(false);
	$effect(() => {
		if (!splashVisible) mainScreenRevealed = true;
	});
	const heroArtBackdrop = new URL(
		'../../static/assets/components/splash/room.webp',
		import.meta.url,
	).href;

	$effect(() => {
		stateMeta.betModeMeta = {
			BASE: {
				mode: 'BASE',
				costMultiplier: 1,
				type: 'default',
				parent: '',
				children: '',
				assets: {
					icon: '',
					volatility: '',
					button: '',
					dialogImage: heroArt,
					dialogVolatility: scatterArt,
				},
				text: {
					title: 'BASE',
					dialog: '7x7 cluster-win base game with natural clusters and random magnets.',
					button: 'PLAY',
					tickerIdle: 'MAGNETIC',
					tickerSpin: 'GOOD LUCK',
				},
				maxWin: 20000,
			},
			CHANCE: {
				mode: 'CHANCE',
				costMultiplier: 2,
				type: 'activate',
				parent: '',
				children: '',
				assets: {
					icon: '',
					volatility: '',
					button: '',
					dialogImage: bonusArt,
					dialogVolatility: uiRefArt,
				},
				text: {
					title: 'CHANCE SPIN',
					dialog: 'Each round plays for 2x the selected play amount with 3x bonus chance.',
					description: '2x play amount per spin, 3x bonus trigger odds.',
					button: 'ACTIVATE',
					tickerIdle: 'CHANCE ACTIVE',
					tickerSpin: 'GOOD LUCK',
				},
				maxWin: 20000,
			},
			FEATURE: {
				mode: 'FEATURE',
				costMultiplier: 50,
				type: 'activate',
				parent: '',
				children: '',
				assets: {
					icon: '',
					volatility: '',
					button: '',
					dialogImage: bonusArt,
					dialogVolatility: uiRefArt,
				},
				text: {
					title: 'FEATURE SPIN',
					dialog:
						'Can be played for 50x. One spin with a guaranteed magnet series and possible magnet multipliers.',
					description: 'Guaranteed magnet every feature spin.',
					button: 'ACTIVATE',
					tickerIdle: 'FEATURE ACTIVE',
					tickerSpin: 'FEATURE SPIN',
				},
				maxWin: 20000,
			},
			BONUS: {
				mode: 'BONUS',
				costMultiplier: 100,
				type: 'buy',
				parent: '',
				children: '',
				assets: {
					icon: '',
					volatility: '',
					button: '',
					dialogImage: bonusArt,
					dialogVolatility: scatterArt,
				},
				text: {
					title: 'GRAVITY BREACH',
					dialog:
						'10 free spins. Magnet chance is boosted; any magnet selects one target symbol for that active series.',
					description: 'Play the 10-spin Gravity Breach bonus for 100x the selected play amount.',
					button: 'PLAY',
					tickerIdle: 'COME AND PLAY',
					tickerSpin: 'BONUS ACTIVE',
				},
				maxWin: 20000,
			},
			MYSTERY: {
				mode: 'MYSTERY',
				costMultiplier: 300,
				type: 'buy',
				parent: '',
				children: '',
				assets: {
					icon: '',
					volatility: '',
					button: '',
					dialogImage: bonusArt,
					dialogVolatility: scatterArt,
				},
				text: {
					title: 'MYSTERY BONUS',
					dialog: 'A random bonus is selected before the free spins begin.',
					description: 'Play a random bonus for 300x the selected play amount.',
					button: 'PLAY',
					tickerIdle: 'COME AND PLAY',
					tickerSpin: 'MYSTERY ACTIVE',
				},
				maxWin: 20000,
			},
			SUPER: {
				mode: 'SUPER',
				costMultiplier: 500,
				type: 'buy',
				parent: '',
				children: '',
				assets: {
					icon: '',
					volatility: '',
					button: '',
					dialogImage: heroArt,
					dialogVolatility: scatterArt,
				},
				text: {
					title: 'CORE OVERLOAD',
					dialog:
						'10 free spins. First spin guarantees a magnet, and the same target cluster persists across the whole bonus.',
					description: 'Play the persistent Core Overload bonus for 500x the selected play amount.',
					button: 'PLAY',
					tickerIdle: 'COME AND PLAY',
					tickerSpin: 'SUPER ACTIVE',
				},
				maxWin: 20000,
			},
		};

		stateMeta.gameRuleMeta = {
			gameRules: [
				{
					title: 'GAME INFO',
					rows: 5,
					columns: 1,
					containers: [
						{
							title: 'MAGNETIC',
							text: 'Magnetic is a 7x7 cluster-win slot. Wins form when 5 or more matching symbols touch orthogonally. Diagonal touches do not count.',
							image: heroArt,
							row: 0,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: 'CLUSTERS',
							text: 'Natural winning clusters stay locked while all other positions respin. Only newly landed touching matches can extend that active cluster, and the round stops once a respin adds nothing new.',
							image: paytableArt,
							row: 1,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: 'MAGNETS',
							text: 'In base mode, a Magnetic Wild randomly selects one visible regular-symbol position. Each position has equal chance, so types shown more often are more likely. It attracts every visible symbol of that type and keeps the target for the active magnetic series.',
							image: scatterArt,
							row: 2,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: 'MAGNET MULTIPLIERS',
							text: 'Magnets may land with a multiplier. If more multiplier magnets land in the same active magnetic series, they multiply together: 2x × 3x × 4x = 24x total.',
							image: scatterArt,
							row: 3,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: 'BONUSES',
							text: '3 scatters trigger Gravity Breach with 10 free spins and boosted magnet chance. 4 scatters trigger Core Overload where the first spin guarantees a magnet and the target cluster persists across the full bonus.',
							image: bonusArt,
							row: 4,
							column: 0,
							imagePosition: 'left',
						},
					],
				},
			],
			payTable: [
				{
					title: 'WIN TABLE',
					rows: 3,
					columns: 2,
					containers: [
						{
							title: 'PREMIUMS',
							text: 'Horseshoe Magnet, Plasma Drill, Magnetic Core Cube, and Electromagnetic Device use the full 5 / 6 / 7 / 8 / 9 / 10+ / 12+ / 15+ / 20+ / 25+ / 30+ / 33+ cluster ladder.',
							image: heroArt,
							row: 0,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: 'LOW SYMBOLS',
							text: 'Bolt, Nut, Washer, and Energy Screw follow the same 12-tier cluster ladder with lower values and very high-volatility scaling.',
							image: heroArt,
							row: 0,
							column: 1,
							imagePosition: 'left',
						},
						{
							title: 'TOP WINS',
							text: 'Top premium: 33+ = 2,000x\nSecond premium: 33+ = 1,500x\nThird premium: 33+ = 1,200x\nFourth premium: 33+ = 900x',
							image: uiRefArt,
							row: 1,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: 'SPECIALS',
							text: 'Wild substitutes for all regular symbols except Scatter. Scatter triggers bonuses. Magnet starts the magnetic series and may also carry a multiplier that compounds with later multiplier magnets.',
							image: scatterArt,
							row: 1,
							column: 1,
							imagePosition: 'left',
						},
						{
							title: 'PLAY MODES',
							text: 'Gravity Breach: 100x\nCore Overload: 500x\nFeature Spin: 50x / spin\nChance Spin: 2x / spin',
							image: bonusArt,
							row: 2,
							column: 0,
							imagePosition: 'left',
						},
						{
							title: 'CORE OVERLOAD',
							text: 'The persistent Core Overload bonus locks the chosen magnetic symbol type, keeps its cluster on the grid, and awards the final large cluster result at the end of the 10-spin feature.',
							image: heroArt,
							row: 2,
							column: 1,
							imagePosition: 'left',
						},
					],
				},
			],
			splashScreen: [],
		};
	});

	onMount(() => (context.stateLayout.showLoadingScreen = true));
</script>

<div
	class="magnetic-shell"
	data-layout={context.stateLayoutDerived.layoutType()}
	style={`--magnetic-shell-bg:url('${heroArtBackdrop}')`}
>
	<div class="magnetic-stage">
		<!-- preloadWebFont={false}: fonts are self-hosted in app.html, so pixi must NOT await the
		     Typekit webfontloader before initialising (it can never resolve on Stake's CDN).
		     maxResolution=2 / antialias=false: uncapped devicePixelRatio meant up to 9x fill on
		     high-DPR phones, and MSAA on top of that; both were the Safari lag. -->
		<App preloadWebFont={false} maxResolution={2} antialias={false} rendererPreference="webgl">
			<EnableSound />
			<EnableHotkey />
			<EnableGameActor />
			<EnablePixiExtension />
			<StakeSync />

			<Background revealed={mainScreenRevealed} />

			{#if context.stateLayout.showLoadingScreen}
				<LoadingController
					onloaded={() => (context.stateLayout.showLoadingScreen = false)}
					oncanproceed={(handler) => {
						splashPressHandler = handler;
						splashLoading = false;
					}}
					onprogress={(progress) => (loadProgress = progress)}
				/>
			{:else}
				<ResumeBet />
				<Sound />

				<!-- Debris drifts in the room BEHIND the board, so it never crawls across the reels.
				     Stage layering here is MOUNT ORDER, not the zIndex props: MainContainer spreads
				     its props onto an INNER container, so every MainContainer's outer node — the one
				     the sorted stage actually sees — keeps zIndex 0 and ties are resolved by the
				     order components appear in this file. Moving a line here moves the layer. -->
				<AmbientDebris />

				<MainContainer zIndex={0}>
					<BoardFrame />
				</MainContainer>

				<MainContainer>
					<Board />
				</MainContainer>

				<GameLogoFrame />

				<!-- No GlobalMultiplier here: the hand-sign display is forest-theme art with no
				     magnetic redesign — the series multiplier reads from the multiplier wilds
				     on the board instead. The globalMultiplier* events still fire unheard. -->
				<Win />
				<!-- Directly under the congratulations screen and over the game scene: the veil has to
				     cover the room/board it is hiding the swap of, and the congrats has to sit on it. -->
				<BonusHandoffVeil />
				<FreeSpinIntro />
				<!-- The Mystery draw plays BEFORE the free-spins congratulations it announces, and
				     over the same veil, so it mounts alongside it rather than inside it. -->
				<MysteryReveal />
				<CapsulePanel />
				<RespinPanel />
				<PressPlayMark />
				<PortraitTopBar />
				<LandscapeCapsule />
				<FreeSpinOutro />
				<Transition />
			{/if}
		</App>

		{#if splashVisible}
			<!-- pointer-events:none on the wrapper: once the splash enters its logo-handoff phase it
			     makes ITSELF click-through, and this full-screen wrapper must not keep eating clicks.
			     This overlay is also what hides the pixi canvas during loading — it is opaque, so the
			     loader no longer needs a pixi-side backdrop fighting <Background /> for z-order. -->
			<div
				out:fade={{ duration: 350 }}
				style="position:absolute;inset:0;z-index:10;pointer-events:none;"
			>
				<SplashIntro
					loading={splashLoading}
					progress={loadProgress}
					onpress={() => splashPressHandler?.()}
					ondone={() => (splashDone = true)}
				/>
			</div>
		{/if}

		{#if !context.stateLayout.showLoadingScreen}
			{#if stateUi.config.mode !== 'replay'}
				<HudHtml />
				<InsufficientFundsModal />
			{/if}
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
		background: #060b16;
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
			linear-gradient(
				180deg,
				rgba(0, 0, 0, 0.48),
				rgba(0, 0, 0, 0.2) 22%,
				rgba(0, 0, 0, 0.35) 76%,
				rgba(0, 0, 0, 0.74)
			);
	}
	.magnetic-stage {
		position: relative;
		width: 100%;
		height: 100%;
		z-index: 1;
	}
</style>
