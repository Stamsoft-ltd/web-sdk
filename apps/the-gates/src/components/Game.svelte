<script lang="ts">
	import { onMount } from 'svelte';
	import { requestEndRound } from 'rgs-requests';
	import { finishUnfinishedRound } from '../game/finishUnfinished';
	import { dev } from '$app/environment';
	import { page } from '$app/state';
	import {
		stateBet,
		stateBetDerived,
		stateConfig,
		stateModal,
		stateUrlDerived,
	} from 'state-shared';
	import {
		formatWalletAmount,
		formatExactWinAmount as formatWinAmount,
		normalizeCurrency,
	} from 'utils-shared/currency';
	import { COSTS, SYMBOLS, type Mode, type Bet } from '../game/contract';
	import { gameActor } from '../game/actor';
	import { initMetadata } from '../game/metadata';
	import {
		runtime,
		playEvents,
		resetRound,
		cancelPlayback,
		continuePresentation,
		requestSkip,
		speedChanged,
	} from '../game/playback.svelte';
	import { gatesStakeState, gatesStakeDerived } from '../state/gatesStake.svelte';
	import { t } from '../i18n';
	import { playerErrorKey, autoplayMessageKey } from '../game/uiErrors';
	import { holdBetStep } from '../game/holdBetStep';
	import { normalizeGatesJurisdiction, stepRgsBetLevel } from '../game/platformConfig';
	import Board from './Board.svelte';
	import FitNumber from './FitNumber.svelte';
	import ButtonLabel from './ButtonLabel.svelte';
	import WinScreen from './WinScreen.svelte';
	import BonusScreen from './BonusScreen.svelte';
	import Rules from './Rules.svelte';
	import { hudBetAmount } from '../game/hudPresentation';
	import { winTier } from '../game/winPresentation';
	import { selectedSpeed, nextSpeed } from '../game/uiPolicy';
	import TempleGate from './TempleGate.svelte';
	import MotionStats from './MotionStats.svelte';
	import AssetAudit from './AssetAudit.svelte';
	import { loadAssetImage } from '../game/imageAssets';
	import Symbol from './Symbol.svelte';
	import Icon from './Icon.svelte';
	import OptionsIcon from './OptionsIcon.svelte';
	import Modal from './Modal.svelte';
	import { validAutoplayCount } from '../game/autoplayCounts';
	import AutoplayControls from './AutoplayControls.svelte';
	import ResumeRound from './ResumeRound.svelte';
	import ReplaySummary from './ReplaySummary.svelte';
	import { liveSpinWin } from '../game/tumbleLabels';
	import { PORTRAIT_ART_ROOT } from '../game/art';
	import { formatReplayMultiplier } from '../game/replayLayout';
	import Welcome from './Welcome.svelte';
	import GpuSurface from './GpuSurface.svelte';
	import { presentedReward } from '../game/rewardDelivery';
	import { stateSound } from 'state-shared';
	import { installGameAudio, syncGameAudio, setGameMusic } from '../game/audio';
	import { musicForScene } from '../game/music';
	$effect(() => {
		void stateSound.volumeValueSoundEffect;
		void stateSound.volumeValueMusic;
		syncGameAudio();
	});
	import { provideGpu, type GpuContext } from '../game/gpuContext';
	const gpu = $state<GpuContext>({ engine: null, presenting: false, error: '' });
	provideGpu(gpu);
	import { fitBuyMenu } from '../game/buyLayout';
	import { canAffordMode, modeOptionAvailable } from '../game/buyAvailability';
	import MainScene from './MainScene.svelte';
	import ScenePanels from './ScenePanels.svelte';
	import { LANDING_EXIT_MS } from '../game/entryMotion';
	import LoadingScene from './LoadingScene.svelte';
	import { fitFigmaLayout } from '../game/figmaLayout';
	import { PORTRAIT_LAYOUT } from '../game/panelLayout';
	import { isMobileDevice } from '../game/deviceType';
	import { ART_ROOT, UI_ART_ROOT, artTier } from '../game/art';
	let { demo = false }: { demo?: boolean } = $props();
	stateConfig.jurisdiction = normalizeGatesJurisdiction(
		stateConfig.jurisdiction,
		stateUrlDerived.social(),
	);
	$effect(() => initMetadata(t));
	let idle = $state(false),
		ready = $state(false),
		entered = $state(false),
		pending = $state(false);
	let modal = $state<null | 'features' | 'rules' | 'settings' | 'auto'>(null);
	let selected = $state<Mode | null>(null);
	let autoCount = $state(100);
	let wallClock = $state('');
	let sessionSeconds = $state(0),
		openingBalance = $state(0);
	let inFlight = $state(false);
	let stageViewport = $state<HTMLElement>();
	let sceneLogoHost = $state<HTMLElement>();
	let sceneStudioHost = $state<HTMLElement>();
	let sceneStageHost = $state<HTMLElement>();
	let sceneBoardHost = $state<HTMLElement>();
	let loadingProgress = $state(0),
		loadingMinDone = $state(false),
		landingReady = $state(false),
		entryLeavingAt = $state(0);
	let entryTimer: ReturnType<typeof setTimeout> | undefined;
	function enterGame() {
		if (entered || entryLeavingAt || !landingReady || !loadingMinDone) return;
		entryLeavingAt = performance.now();
		gpu.engine?.setEntryTransition({ startedAt: entryLeavingAt, reduced: runtime.reduced });
		entered = true;
		entryTimer = setTimeout(
			() => {
				entryLeavingAt = 0;
				gpu.engine?.setEntryTransition(null);
			},
			runtime.reduced ? 140 : LANDING_EXIT_MS,
		);
	}
	let layoutWidth = $state(1200),
		layoutHeight = $state(680);
	let menuOpen = $state(false);
	let stageScale = $state(1);
	let windowWidth = $state(1200),
		windowHeight = $state(800);
	const buyFit = $derived(fitBuyMenu(windowWidth, windowHeight, mode !== 'BASE'));
	const currentSpinWin = $derived(
		liveSpinWin(
			runtime.game.raw,
			shownGame.multiplier,
			shownGame.multiplierActive,
			runtime.game.spinWin,
			runtime.phase,
		),
	);
	const shownGame = $derived.by(() => presentedReward(runtime.game, runtime.rewardDelivery));
	const visualTier = $derived(
		runtime.sceneTierOverride ? runtime.sceneTierOverride.tier : runtime.game.tier,
	);
	$effect(() => {
		setGameMusic(musicForScene(entered, visualTier));
	});
	const scene = $derived(
		layoutWidth === 360
			? `${PORTRAIT_ART_ROOT}${visualTier ? artTier(visualTier) : 'base'}-background.png`
			: visualTier
				? `${ART_ROOT}backgrounds/${artTier(visualTier)}-original.png`
				: layoutWidth === 360 || layoutWidth === 800
					? `${UI_ART_ROOT}backgrounds/cloud-castle-original.png`
					: `${UI_ART_ROOT}28fc1.png`,
	);
	const speed = $derived(selectedSpeed(stateBet, stateConfig.jurisdiction));
	function changeSpeed() {
		if (!canChangeSpeed) return;
		const previous = speed;
		const next = nextSpeed(speed, stateConfig.jurisdiction);
		stateBet.isTurbo = next === 'fast';
		stateBet.isSuperTurbo = next === 'turbo';
		speedChanged(previous);
	}

	const replay = $derived(gatesStakeDerived.isReplayMode());
	const mode = $derived(
		(stateBet.activeBetModeKey.toUpperCase() in COSTS
			? stateBet.activeBetModeKey.toUpperCase()
			: 'BASE') as Mode,
	);
	const busy = $derived(!idle || runtime.busy || inFlight);
	const canPlay = $derived(
		!!gpu.engine &&
			!gpu.error &&
			!entryLeavingAt &&
			loadingMinDone &&
			ready &&
			entered &&
			!busy &&
			!pending &&
			!replay &&
			!modal &&
			!selected &&
			!runtime.overlay &&
			!runtime.error &&
			!stateModal.modal,
	);
	// A busy round locks wagers, not presentation controls. Bonus play uses the same HUD.
	const canChangeSpeed = $derived(
		ready &&
			entered &&
			!pending &&
			!modal &&
			!selected &&
			!runtime.overlay &&
			!runtime.error &&
			!stateModal.modal &&
			!stateConfig.jurisdiction.disabledTurbo,
	);
	const money = (n: number) => formatWalletAmount(stateBet.currency, n);
	const winnings = (n: number, target = n) =>
		formatWinAmount(
			stateBet.currency,
			(stateBet.wageredBetAmount * n) / 100,
			(stateBet.wageredBetAmount * target) / 100,
		);
	const errorMessage = $derived(
		gpu.error
			? t('GRAPHICS ERROR')
			: runtime.error
				? t(playerErrorKey(runtime.error))
				: stateModal.modal?.name === 'error'
					? t(playerErrorKey(stateModal.modal.error))
					: '',
	);
	const insufficientBalance = $derived(
		!demo && ready && entered && !replay && !busy && !stateBetDerived.isBetCostAvailable(),
	);
	const selectedCost = $derived(selected ? stateBet.betAmount * COSTS[selected] : 0);
	const rewardText = $derived.by(() => {
		const r = runtime.game.reward;
		if (!r) return '';
		if ('value' in r) return `${r.kind === 'addMultiplier' ? '+' : ''}${r.value}×`;
		if (r.kind === 'stickyWild') return `${r.positions.length}× ${t('STICKY WILD')}`;
		return `+${'spinsAdded' in r ? r.spinsAdded : 0} ${t('FREE SPINS')}`;
	});
	function reload() {
		location.reload();
	}
	function stepBet(direction: number) {
		if (
			!(canPlay || (modal === 'features' && !busy && !replay && !selected)) ||
			stateBet.autoSpinsCounter > 0
		)
			return;
		const next = stepRgsBetLevel(stateConfig.betAmountOptions, stateBet.betAmount, direction);
		if (next !== undefined) stateBetDerived.setBetAmount(next);
	}
	async function spin(force = false) {
		if (
			!gpu.engine ||
			gpu.error ||
			(!canPlay && !force) ||
			busy ||
			inFlight ||
			pending ||
			replay ||
			runtime.error ||
			stateModal.modal
		)
			return;
		if (!demo && !stateBetDerived.isBetCostAvailable()) return;
		menuOpen = false;
		inFlight = true;
		if (dev && demo) {
			stateBet.currency = normalizeCurrency(stateUrlDerived.currency() || stateBet.currency);
			try {
				stateBet.wageredBetAmount = stateBet.betAmount;
				resetRound();
				const { previewEvents, previewPresentationEvents } = await import('../game/preview');
				const artReview = previewPresentationEvents(
					new URLSearchParams(location.search).get('artPreview'),
				);
				await playEvents(artReview ?? previewEvents(mode), true);
				if (['BONUS', 'SUPER', 'MYSTERY'].includes(mode)) stateBet.activeBetModeKey = 'BASE';
			} catch (error) {
				runtime.error = String(error);
			} finally {
				inFlight = false;
			}
		} else {
			gameActor.send({ type: 'BET' });
			inFlight = false;
		}
	}
	const affordableMode = (key: Mode) =>
		canAffordMode(key, stateBet.betAmount, stateBet.balanceAmount);
	const availableMode = (key: Mode) =>
		modeOptionAvailable(key, mode, stateBet.betAmount, stateBet.balanceAmount);
	function choose(key: Mode) {
		if (
			busy ||
			pending ||
			replay ||
			stateConfig.jurisdiction.disabledBuyFeature ||
			!availableMode(key)
		)
			return;
		menuOpen = false;
		modal = null;
		if ((key === 'CHANCE' || key === 'FEATURE') && mode === key) {
			stateBet.activeBetModeKey = 'BASE';
		} else if (COSTS[key] <= 5) {
			stateBet.activeBetModeKey = key;
		} else {
			selected = key;
		}
	}
	function confirm() {
		if (
			!selected ||
			busy ||
			replay ||
			pending ||
			stateConfig.jurisdiction.disabledBuyFeature ||
			!affordableMode(selected)
		)
			return;
		const next = selected;
		stateBet.activeBetModeKey = next;
		selected = null;
		if (['BONUS', 'SUPER', 'MYSTERY'].includes(next)) void spin(true);
	}
	function resume() {
		if (busy || !stateBet.betToResume) return;
		pending = false;
		entered = true;
		stateBet.activeBetModeKey = String(stateBet.betToResume.mode || 'BASE');
		gameActor.send({ type: 'RESUME_BET' });
	}
	async function skipUnfinished() {
		if (busy || !pending || !stateBet.betToResume || replay) return;
		inFlight = true;
		stateBet.autoSpinsCounter = 0;
		try {
			if (!demo) {
				const data = await finishUnfinishedRound(() =>
					requestEndRound({
						sessionID: stateUrlDerived.sessionID(),
						rgsUrl: stateUrlDerived.rgsUrl(),
					}),
				);
				stateBet.balanceAmount = Number(data.balance!.amount) / 1_000_000;
			}
			stateBet.betToResume = null;
			pending = false;
			entered = true;
			inFlight = false;
			resetRound();
		} catch (error) {
			runtime.error = error instanceof Error ? error.message : String(error);
			inFlight = false;
		}
	}
	function startReplay() {
		if (busy || gatesStakeState.replayStartRequested || !gatesStakeState.replaySnapshot) return;
		const bet = gatesStakeDerived.cloneReplayBet(gatesStakeState.replaySnapshot);
		if (!bet) return;
		stateBet.betToResume = { ...bet, event: '0', active: true };
		if (!gatesStakeDerived.requestReplayStart()) return;
		entered = true;
		gameActor.send({ type: 'RESUME_BET' });
	}
	function autoStart() {
		if (
			busy ||
			replay ||
			demo ||
			pending ||
			!validAutoplayCount(autoCount) ||
			stateConfig.jurisdiction.disabledAutoplay
		)
			return;
		stateBet.autoSpinsCounter = autoCount;
		stateBet.autoSpinsLossLimitAmount = Infinity;
		stateBet.autoSpinsSingleWinLimitAmount = Infinity;
		modal = null;
		gameActor.send({ type: 'AUTO_BET' });
	}
	let spaceHeld = $state(false);
	let heldSpeed: { turbo: boolean; superTurbo: boolean } | null = null;
	function releaseSpace() {
		spaceHeld = false;
		if (heldSpeed) {
			stateBet.isTurbo = heldSpeed.turbo;
			stateBet.isSuperTurbo = heldSpeed.superTurbo;
			heldSpeed = null;
		}
	}
	$effect(() => {
		if (
			!spaceHeld ||
			!canPlay ||
			menuOpen ||
			replay ||
			stateBet.autoSpinsCounter > 0 ||
			runtime.error ||
			(!demo && !stateBetDerived.isBetCostAvailable())
		)
			return;
		const timer = setTimeout(() => {
			if (spaceHeld) void spin();
		}, 45);
		return () => clearTimeout(timer);
	});
	function keydown(e: KeyboardEvent) {
		if (e.code === 'Escape' && menuOpen) {
			menuOpen = false;
			return;
		}
		if (e.code !== 'Space') return;
		// Entry controls retain native keyboard activation; spin hotkeys start after Continue.
		if (!entered) return;
		// Like the studio hotkey: HUD button focus must not turn Space into another click.
		if ((e.target as HTMLElement).closest('input,select,textarea,[contenteditable="true"]')) return;
		if ((e.target as HTMLElement).closest('[role="dialog"]') && !runtime.overlay) return;
		e.preventDefault();
		if (stateConfig.jurisdiction.disabledSpacebar) return;
		if (
			e.repeat &&
			!replay &&
			!menuOpen &&
			!modal &&
			!selected &&
			!pending &&
			!runtime.error &&
			stateBet.autoSpinsCounter <= 0 &&
			!stateConfig.jurisdiction.disabledTurbo &&
			!stateConfig.jurisdiction.disabledSuperTurbo
		) {
			if (!heldSpeed) heldSpeed = { turbo: stateBet.isTurbo, superTurbo: stateBet.isSuperTurbo };
			const previous = speed;
			stateBet.isTurbo = false;
			stateBet.isSuperTurbo = true;
			speedChanged(previous);
			spaceHeld = true;
		}
		if (e.repeat && !spaceHeld) return;
		if (runtime.waiting) continuePresentation();
		else if (runtime.busy && !modal && !selected && !stateModal.modal) requestSkip();
		else if (canPlay && !menuOpen) void spin();
	}
	function screenFastForward(event: MouseEvent) {
		const target = event.target;
		if (
			!(target instanceof Element) ||
			event.button !== 0 ||
			event.defaultPrevented ||
			target.closest(
				'button,a,input,select,textarea,label,[role="button"],[contenteditable="true"]',
			) ||
			!entered ||
			pending ||
			modal ||
			selected ||
			menuOpen ||
			stateModal.modal ||
			runtime.error ||
			!runtime.busy ||
			runtime.waiting ||
			runtime.bonusTransition
		)
			return;
		requestSkip();
	}
	async function fullscreen() {
		try {
			if (document.fullscreenElement) await document.exitFullscreen();
			else await document.documentElement.requestFullscreen();
		} catch {
			/* Browser may not support fullscreen. */
		}
	}
	function toggleAudio(kind: 'sound' | 'music') {
		const key = kind === 'sound' ? 'volumeValueSoundEffect' : 'volumeValueMusic';
		stateSound[key] = stateSound[key] > 0 ? 0 : 75;
		try {
			localStorage.setItem(
				'gates-audio-v1',
				JSON.stringify({
					sound: stateSound.volumeValueSoundEffect > 0,
					music: stateSound.volumeValueMusic > 0,
				}),
			);
		} catch {}
	}
	onMount(() => {
		const loadingTimer = setTimeout(() => {
			loadingMinDone = true;
		}, 1500);
		try {
			const saved = JSON.parse(localStorage.getItem('gates-audio-v1') ?? '{}');
			if (saved.sound === false) stateSound.volumeValueSoundEffect = 0;
			if (saved.music === false) stateSound.volumeValueMusic = 0;
		} catch {}
		const visibilityStop = () => {
			if (document.visibilityState === 'hidden') releaseSpace();
		};
		document.addEventListener('visibilitychange', visibilityStop);
		const destroyAudio = installGameAudio(
			() => stateSound.volumeValueSoundEffect,
			() => stateSound.volumeValueMusic,
		);
		const pointerMedia = window.matchMedia('(pointer: coarse)');
		const fitStage = () => {
			if (!stageViewport) return;
			const mobileDevice = isMobileDevice({
				device: page.url.searchParams.get('device'),
				userAgent: navigator.userAgent,
				clientHintMobile: (navigator as Navigator & { userAgentData?: { mobile?: boolean } })
					.userAgentData?.mobile,
				maxTouchPoints: navigator.maxTouchPoints,
				coarsePointer: pointerMedia.matches,
			});
			const fitted = fitFigmaLayout(
				stageViewport.clientWidth,
				stageViewport.clientHeight,
				mobileDevice,
			);
			layoutWidth = fitted.width;
			layoutHeight = fitted.height;
			stageScale = fitted.scale;
		};
		const stageObserver = new ResizeObserver(fitStage);
		if (stageViewport) stageObserver.observe(stageViewport);
		fitStage();
		window.addEventListener('resize', fitStage);
		window.addEventListener('orientationchange', fitStage);
		window.visualViewport?.addEventListener('resize', fitStage);
		screen.orientation?.addEventListener('change', fitStage);
		pointerMedia.addEventListener('change', fitStage);
		const subscription = gameActor.subscribe({
			next: (snapshot) => {
				idle = snapshot.value === 'idle';
				gatesStakeDerived.syncReplayStatus(idle);
			},
			error: (error) => {
				runtime.error = String(error);
				stateBet.autoSpinsCounter = 0;
			},
		});
		gameActor.start();
		gameActor.send({ type: 'RENDERED' });
		if (dev && demo) {
			stateBet.balanceAmount = 10000;
			stateConfig.betAmountOptions = [0.1, 0.2, 0.5, 1, 2, 5, 10];
			stateBet.betAmount = 1;
			stateBet.wageredBetAmount = 1;
			// Explicit, dev-only display fixtures. Never affects RGS wagers or outcomes.
			const uiPreview = page.url.searchParams.get('uiPreview');
			if (uiPreview === 'auto' || uiPreview === 'replay') entered = true;
			if (uiPreview === 'auto') modal = 'auto';
			if (uiPreview === 'resume') pending = true;
			if (uiPreview === 'error') {
				entered = true;
				runtime.error = t('GRAPHICS ERROR');
			}
			const numberPreview = page.url.searchParams.get('numberPreview');
			if (numberPreview === 'large') {
				stateBet.balanceAmount = 4_999_990.85;
				stateConfig.betAmountOptions = [1, 10, 100, 1000, 100_000];
				stateBet.betAmount = stateBet.wageredBetAmount = 100_000;
				runtime.game.total = 2_500_000;
			} else if (numberPreview === 'precision' || numberPreview === 'plain') {
				stateConfig.betAmountOptions = [0.01, 0.1, 1, 10];
				stateBet.betAmount = stateBet.wageredBetAmount = 0.01;
				runtime.game.total = numberPreview === 'precision' ? 20_025 : 20_000;
			}
		}
		openingBalance = stateBet.balanceAmount;
		pending =
			!replay &&
			Boolean(
				stateBet.betToResume?.active ||
					(dev && demo && page.url.searchParams.get('uiPreview') === 'resume'),
			);
		if (replay) {
			entered = true;
			gatesStakeDerived.captureReplaySnapshot(stateBet.betToResume);
		}
		const motion = matchMedia('(prefers-reduced-motion: reduce)');
		runtime.reduced = motion.matches;
		const onMotion = () => {
			runtime.reduced = motion.matches;
		};
		motion.addEventListener('change', onMotion);
		const timer = stateConfig.jurisdiction.displaySessionTimer
			? setInterval(() => sessionSeconds++, 1000)
			: undefined;
		const updateClock = () => {
			wallClock = new Date().toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			});
		};
		updateClock();
		const clockTimer = setInterval(updateClock, 1000);
		let disposed = false;
		Promise.all(
			[
				`${UI_ART_ROOT}28fc1.png`,
				`${UI_ART_ROOT}backgrounds/cloud-castle-original.png`,
				`${UI_ART_ROOT}edb79.png`,
				`${UI_ART_ROOT}d7111.png`,
				`${ART_ROOT}symbols/gold-gem.png`,
			].map(async (src, _index, assets) => {
				const image = await loadAssetImage(src);
				if (!disposed) loadingProgress += 0.8 / assets.length;
				return image;
			}),
		)
			.then(() =>
				Promise.all([
					document.fonts.load('18px GatesCartoon'),
					document.fonts.load('900 16px GatesBody'),
				]),
			)
			.then(() => {
				if (!disposed) {
					loadingProgress = 1;
					ready = true;
				}
			})
			.catch((error) => {
				if (!disposed) runtime.error = String(error);
			});
		// Decorative idle arrangement; never evaluated or used to determine any outcome.
		runtime.game.board = Array.from({ length: 6 }, (_, c) =>
			Array.from({ length: 5 }, (_, r) => ({ name: SYMBOLS[(c * 3 + r * 2) % 10] })),
		);
		return () => {
			disposed = true;
			clearTimeout(loadingTimer);
			clearTimeout(entryTimer);
			destroyAudio();
			document.removeEventListener('visibilitychange', visibilityStop);
			if (timer !== undefined) clearInterval(timer);
			clearInterval(clockTimer);
			motion.removeEventListener('change', onMotion);
			releaseSpace();
			cancelPlayback();
			stateBet.autoSpinsCounter = 0;
			stageObserver.disconnect();
			window.removeEventListener('resize', fitStage);
			window.removeEventListener('orientationchange', fitStage);
			window.visualViewport?.removeEventListener('resize', fitStage);
			screen.orientation?.removeEventListener('change', fitStage);
			pointerMedia.removeEventListener('change', fitStage);
			subscription.unsubscribe();
			gameActor.stop();
		};
	});
</script>

<svelte:window
	onclick={screenFastForward}
	onkeydown={keydown}
	onkeyup={(e) => {
		if (e.code === 'Space') releaseSpace();
	}}
	onblur={releaseSpace}
	bind:innerWidth={windowWidth}
	bind:innerHeight={windowHeight}
/>
<svelte:head
	><meta
		name="description"
		content="The Gates — an ancient temple, cascading jewels and gates of power."
	/></svelte:head
>
{#if dev && demo && page.url.searchParams.has('motionStats')}<MotionStats />{/if}
{#if dev && page.url.searchParams.get('assetAudit') === '1'}<AssetAudit />{/if}
<main
	class="temple figma-temple"
	bind:this={stageViewport}
	class:reduced={runtime.reduced}
	class:quick={speed !== 'normal'}
	class:turbo={speed === 'turbo'}
	class:normal-tier={visualTier === 'normal'}
	class:super-tier={visualTier === 'super'}
	class:hidden-tier={visualTier === 'hidden'}
	class:mobile-scene={layoutWidth === 360 || layoutWidth === 800}
	class:scene-entry={!ready || !entered || !gpu.engine}
>
	<GpuSurface context={gpu} />
	<TempleGate {rewardText} />
	<MainScene
		src={scene}
		host={stageViewport}
		logoHost={sceneLogoHost}
		studioHost={sceneStudioHost}
	/>
	<div
		class="figma-layout"
		bind:this={sceneStageHost}
		class:portrait={layoutWidth === 360}
		class:compact={layoutWidth === 800}
		class:bonus-play={!!visualTier}
		class:entry-leaving={!!entryLeavingAt}
		style={`width:${layoutWidth}px;height:${layoutHeight}px;zoom:${stageScale};--portrait-board-top:${PORTRAIT_LAYOUT.boardTop}px;--portrait-hud-top:${PORTRAIT_LAYOUT.hudTop}px;--portrait-metrics-top:${PORTRAIT_LAYOUT.metricsTop}px;--stage-scale:${stageScale};--entry-lift:${-(layoutHeight + windowHeight / stageScale)}px`}
		data-design-node="11270:125205"
	>
		<div
			class="game-logo"
			bind:this={sceneLogoHost}
			style="width:197.58px;height:148px"
			role="img"
			aria-label={t('THE GATES')}
			data-renderer="pixi-webgl"
		></div>
		<header class="topbar">
			<div
				class="studio-mark"
				bind:this={sceneStudioHost}
				style="height:29px"
				role="img"
				aria-label="Press Play"
				data-renderer="pixi-webgl"
			></div>
		</header>
		<section class="game-stage" aria-label="The Gates game">
			<div class="stage-content">
				<ScenePanels
					stage={sceneStageHost}
					board={sceneBoardHost}
					panelState={{
						speed,
						width: layoutWidth,
						bonus: !!visualTier,
						progress: runtime.game.progress,
						reduced: runtime.reduced,
						positions: runtime.game.wins.flatMap((win) => win.positions),
						multiplier: shownGame.multiplier,
						multiplierActive: runtime.game.multiplierActive,
						freeSpin: runtime.game.freeSpin,
						totalFs: shownGame.totalFs,
						remaining: shownGame.remaining,
						bonusWin: winnings(
							Math.max(runtime.game.total, runtime.spinTotalBefore + currentSpinWin),
						),
						caption:
							runtime.phase === 'winning'
								? `${t('RAW WIN')} ${winnings(runtime.game.raw)}`
								: runtime.phase === 'settling' && runtime.game.spinWin
									? `${t('SPIN WIN')} ${winnings(runtime.game.spinWin)}`
									: '',
						inline: '',
						translate: t,
					}}
				/>
				<div class="board-area" bind:this={sceneBoardHost}>
					<Board
						mobile={layoutWidth !== 1200}
						paused={!ready ||
							!entered ||
							pending ||
							!!modal ||
							!!selected ||
							menuOpen ||
							!!stateModal.modal}
					/>
				</div>
			</div>
		</section>
		<footer class="control-deck">
			<div class="hud-button-rail">
				<div class="hud-left">
					<div class="hud-utilities">
						<button
							class="icon-button menu-button"
							aria-label={t('MENU')}
							aria-expanded={menuOpen}
							aria-controls="gates-utility-menu"
							disabled={!entered}
							onclick={() => (menuOpen = !menuOpen)}
						>
							<img src={`${ART_ROOT}hud/menu.png`} alt="" />
						</button>
						{#if menuOpen}<div
								class="utility-menu"
								id="gates-utility-menu"
								aria-label={t('OPTIONS')}
							>
								<button
									class="audio-toggle"
									aria-label={t('SOUND')}
									aria-pressed={stateSound.volumeValueSoundEffect > 0}
									onclick={() => toggleAudio('sound')}
								>
									<span class="option-icon" class:muted={stateSound.volumeValueSoundEffect === 0}
										><OptionsIcon name="sound" /></span
									><ButtonLabel text={t('SOUND').toUpperCase()} /></button
								>
								<button
									class="audio-toggle"
									aria-label={t('MUSIC')}
									aria-pressed={stateSound.volumeValueMusic > 0}
									onclick={() => toggleAudio('music')}
								>
									<span class="option-icon" class:muted={stateSound.volumeValueMusic === 0}
										><OptionsIcon name="music" /></span
									><ButtonLabel text={t('MUSIC').toUpperCase()} /></button
								>
								<button
									aria-label={t('INFO')}
									onclick={() => {
										menuOpen = false;
										modal = 'rules';
									}}
									><span class="option-icon"><OptionsIcon name="info" /></span><ButtonLabel
										text={t('INFO').toUpperCase()}
									/></button
								>
							</div>{/if}
					</div>
					<button
						class="feature-button"
						class:return-to-base={mode === 'CHANCE' || mode === 'FEATURE'}
						hidden={stateConfig.jurisdiction.disabledBuyFeature}
						disabled={!canPlay ||
							stateBet.autoSpinsCounter > 0 ||
							stateConfig.jurisdiction.disabledBuyFeature}
						onclick={() => {
							if (mode === 'CHANCE' || mode === 'FEATURE') stateBet.activeBetModeKey = 'BASE';
							else modal = 'features';
						}}
					>
						<span
							>{mode === 'CHANCE' || mode === 'FEATURE' ? t('DEACTIVATE') : t('BONUS BUTTON')}</span
						></button
					>
				</div>
				<div class="spin-actions">
					<button
						class="spin-button"
						title={insufficientBalance ? t('ERROR BALANCE') : t('SPIN')}
						aria-describedby={insufficientBalance ? 'balance-explanation' : undefined}
						aria-label={stateBet.autoSpinsCounter || busy ? t('STOP') : t('SPIN')}
						disabled={stateBet.autoSpinsCounter <= 0 &&
							!runtime.busy &&
							(!canPlay || (!demo && !stateBetDerived.isBetCostAvailable()))}
						onclick={() =>
							stateBet.autoSpinsCounter > 0
								? (stateBet.autoSpinsCounter = 0)
								: runtime.busy
									? runtime.waiting
										? continuePresentation()
										: requestSkip()
									: spin()}
						>{#if stateBet.autoSpinsCounter || busy}<img
								src="./assets/the-gates/hud/stop.svg"
								alt=""
							/>{#if stateBet.autoSpinsCounter > 0}<span>{stateBet.autoSpinsCounter}</span>{/if}
						{:else}<img
								src={layoutWidth === 1200
									? `${UI_ART_ROOT}f05f2.svg`
									: './assets/the-gates/hud/spin-mobile.svg'}
								alt=""
							/>{/if}</button
					>
					<button
						class="icon-button speed"
						hidden={stateConfig.jurisdiction.disabledTurbo}
						class:active={speed !== 'normal'}
						data-speed={speed}
						aria-label={`${t('SPEED')}: ${t('SPEED ' + speed.toUpperCase())}`}
						title={t('SPEED ' + speed.toUpperCase())}
						aria-pressed={speed !== 'normal'}
						disabled={!canChangeSpeed}
						onclick={changeSpeed}
						><img
							src={speed === 'turbo'
								? './assets/the-gates/hud/speed-3.svg'
								: speed === 'fast'
									? './assets/the-gates/hud/speed-2.svg'
									: `${UI_ART_ROOT}c8de1.svg`}
							alt=""
						/></button
					><button
						class="icon-button"
						aria-label={t('AUTO')}
						hidden={stateConfig.jurisdiction.disabledAutoplay}
						disabled={!canPlay ||
							stateBet.autoSpinsCounter > 0 ||
							demo ||
							stateConfig.jurisdiction.disabledAutoplay}
						onclick={() => {
							modal = 'auto';
						}}><img src={`${ART_ROOT}hud/autoplay-en.png`} alt="" /></button
					>
				</div>
			</div>
			<div class="bet-stepper">
				<button
					class="icon-button"
					aria-label={`${t('BET')} −`}
					disabled={!canPlay ||
						stateBet.autoSpinsCounter > 0 ||
						stateBet.betAmount <= stateConfig.betAmountOptions[0]}
					use:holdBetStep={() => stepBet(-1)}
					><img src={`${ART_ROOT}hud/bet-decrease.png`} alt="" /><span class="bet-step-label"
						><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg></span
					></button
				>
				<button
					class="icon-button"
					aria-label={`${t('BET')} +`}
					disabled={!canPlay ||
						stateBet.autoSpinsCounter > 0 ||
						stateBet.betAmount >= stateConfig.betAmountOptions.at(-1)!}
					use:holdBetStep={() => stepBet(1)}
					><img src={`${UI_ART_ROOT}19460.svg`} alt="" /><span class="bet-step-label"
						><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M12 5v14" /></svg></span
					></button
				>
			</div>
			<div class="hud-metrics">
				<div class="wallet">
					<span>{t('BALANCE')}</span><strong
						><FitNumber text={money(stateBet.balanceAmount)} /></strong
					>
				</div>
				<div class="win-display" aria-live="polite">
					<span>{t('WIN')}</span><strong
						><FitNumber
							text={winnings(
								runtime.game.tier
									? currentSpinWin
									: runtime.busy
										? currentSpinWin
										: runtime.game.total,
							)}
						/></strong
					>
				</div>
				<div class="bet-control" class:feature-cost={mode === 'FEATURE' || mode === 'CHANCE'}>
					<div>
						<span>{t('BET LABEL')}</span><strong
							><FitNumber
								text={replay
									? formatWinAmount(stateBet.currency, hudBetAmount(stateBet.betAmount, mode))
									: money(hudBetAmount(stateBet.betAmount, mode))}
							/></strong
						>
					</div>
				</div>
			</div>
		</footer>
	</div>
	<div class="status-line">
		<span class="game-clock">THE GATES | {wallClock}</span><span
			>{demo ? t('DEMO') : replay ? t('REPLAY') : ''}</span
		><span
			>{#if stateConfig.jurisdiction.displayRTP}{t('RTP')} 96.1%{/if}{#if stateConfig.jurisdiction.displaySessionTimer}
				· {t('SESSION')}
				{Math.floor(sessionSeconds / 60)}:{String(sessionSeconds % 60).padStart(
					2,
					'0',
				)}{/if}{#if stateConfig.jurisdiction.displayNetPosition}
				· {t('NET')} {money(stateBet.balanceAmount - openingBalance)}{/if}</span
		>
	</div>

	{#if insufficientBalance}<p class="balance-explanation" id="balance-explanation" role="status">
			{t('ERROR BALANCE')}
		</p>{/if}
</main>

{#if !errorMessage && ready && gpu.engine && (!entered || entryLeavingAt)}<Welcome
		active={loadingMinDone && landingReady}
		onready={() => (landingReady = true)}
		width={windowWidth}
		height={windowHeight}
		reduced={runtime.reduced}
		{demo}
		leavingAt={entryLeavingAt}
		logoTarget={sceneLogoHost}
		enter={enterGame}
	/>
{/if}

{#if errorMessage}<Modal title={t('ERROR')} close={() => {}} locked compact framed
		><p class="error-copy">{errorMessage}</p>
		<div class="confirmation-actions single-action">
			<button class="gold-button" onclick={reload}><ButtonLabel text={t('CONTINUE')} /></button>
		</div></Modal
	>
{:else if !ready || !gpu.engine || !loadingMinDone || (!entered && !landingReady) || (dev && demo && page.url.searchParams.get('uiPreview') === 'loading')}<LoadingScene
		progress={loadingProgress}
	/>
{:else if pending && entered && !entryLeavingAt}<ResumeRound
		{busy}
		{resume}
		skip={skipUnfinished}
	/>
{:else if runtime.overlay?.kind === 'win' && winTier(runtime.overlay.amount ?? 0)}
	{#key runtime.overlay}<WinScreen
			amount={runtime.overlay?.amount ?? 0}
			countMs={runtime.overlay?.countMs ?? 1050}
			format={winnings}
		/>{/key}
{:else if runtime.overlay?.kind === 'bonus' || runtime.overlay?.kind === 'summary'}
	{#key runtime.overlay}<BonusScreen
			kind={runtime.overlay?.kind === 'summary' ? 'summary' : 'bonus'}
			tier={runtime.overlay?.tier ?? 'normal'}
			spins={runtime.overlay?.spins ?? 0}
			amount={runtime.overlay?.amount ?? 0}
			format={winnings}
		/>{/key}
{:else if runtime.overlay?.kind === 'cap'}
	{#key runtime.overlay}<WinScreen
			capped
			amount={runtime.overlay?.amount ?? 0}
			countMs={1050}
			format={winnings}
		/>{/key}
{:else if dev && demo && !busy && page.url.searchParams.get('uiPreview') === 'replay'}<ReplaySummary
		mode={t('MODE SUPER TITLE')}
		eventId="preview-event-00042"
		gameId="the-gates"
		version="preview"
		bet={money(1)}
		cost={money(300)}
		costMultiplier="300×"
		payoutMultiplier="750×"
		win={formatWinAmount(stateBet.currency, 750)}
		ready
		played={false}
		play={() => {
			void spin();
		}}
	/>
{:else if replay && !busy}<ReplaySummary
		mode={gatesStakeDerived.modeTitle()}
		eventId={gatesStakeState.replayEventId}
		gameId={stateUrlDerived.game()}
		version={stateUrlDerived.version()}
		bet={formatWinAmount(stateBet.currency, gatesStakeDerived.replayBetAmount())}
		cost={formatWinAmount(stateBet.currency, gatesStakeDerived.replayCostAmount())}
		costMultiplier={formatReplayMultiplier(gatesStakeDerived.modeCostMultiplier())}
		payoutMultiplier={formatReplayMultiplier(gatesStakeDerived.replayPayoutMultiplier())}
		win={formatWinAmount(stateBet.currency, gatesStakeDerived.replayWinAmount())}
		played={gatesStakeState.replayHasPlayed}
		ready={!!gatesStakeState.replaySnapshot && !gatesStakeState.replayStartRequested}
		play={startReplay}
	/>
{:else if selected}<Modal title={t(selected)} close={() => (selected = null)} locked compact framed>
		<div class="confirmation-symbol">
			<Symbol
				name={selected === 'FEATURE'
					? 'KEY'
					: selected === 'BONUS'
						? 'SACRED_EYE'
						: selected === 'SUPER'
							? 'GUARDIAN_MASK'
							: 'CRYSTAL_ORB'}
				decorative
				fit
			/>
		</div>
		<p>{t(`${selected} DESC`)}</p>
		{#if !affordableMode(selected)}<p role="status">
				{t('ERROR BALANCE')}
			</p>{/if}
		<div class="confirm-price">
			<span>{t('TOTAL COST')}</span><strong><FitNumber text={money(selectedCost)} /></strong>
		</div>
		<p class="confirmation-note">
			{t(selected === 'FEATURE' ? 'FEATURE COST NOTE' : 'BALANCE DEBIT NOTE')}
		</p>
		<div class="confirmation-actions">
			<button class="quiet-button" onclick={() => (selected = null)}
				><ButtonLabel text={t('BACK')} /></button
			>
			<button class="gold-button" disabled={!affordableMode(selected)} onclick={confirm}
				><ButtonLabel text={t('OK')} /></button
			>
		</div></Modal
	>
{:else if modal === 'features'}<Modal
		title={t('FEATURES')}
		close={() => (modal = null)}
		wide
		fitted={buyFit}
		><div class="mode-cards">
			{#each ['CHANCE', 'FEATURE', 'BONUS', 'SUPER', 'MYSTERY'] as key}<button
					class="mode-card"
					class:rare={key === 'MYSTERY'}
					onclick={() => choose(key as Mode)}
					data-mode={key}
					title={!availableMode(key as Mode) ? t('ERROR BALANCE') : t(key)}
					aria-pressed={key === 'CHANCE' || key === 'FEATURE' ? mode === key : undefined}
					disabled={!availableMode(key as Mode)}
				>
					<div class="mode-art">
						<Symbol
							name={key === 'CHANCE'
								? 'RED_GEM'
								: key === 'FEATURE'
									? 'KEY'
									: key === 'BONUS'
										? 'SACRED_EYE'
										: key === 'SUPER'
											? 'GUARDIAN_MASK'
											: 'CRYSTAL_ORB'}
							decorative
							fit
						/>
					</div>
					<div>
						<h3>{t(key)}</h3>
						<p>{t(`${key} DESC`)}</p>
						<strong
							><span class="cost-tier"><FitNumber text={`${COSTS[key as Mode]}×`} /></span><span
								class="buy-price"
								><FitNumber text={money(stateBet.betAmount * COSTS[key as Mode])} /></span
							></strong
						>
						<span class="mode-action"
							>{!availableMode(key as Mode)
								? t('LOW BALANCE')
								: key === 'CHANCE' || key === 'FEATURE'
									? t(mode === key ? 'DEACTIVATE' : 'ACTIVATE')
									: t('BUY')}</span
						>
					</div></button
				>{/each}
		</div>
		<div class="buy-bet-adjuster" aria-label={t('BASE BET')}>
			<button
				class="icon-button"
				aria-label={`${t('BET')} −`}
				disabled={busy || stateBet.betAmount <= stateConfig.betAmountOptions[0]}
				use:holdBetStep={() => stepBet(-1)}
				><img src={`${ART_ROOT}hud/bet-decrease.png`} alt="" /></button
			>
			<div>
				<span>{t('BET LABEL')}</span><strong><FitNumber text={money(stateBet.betAmount)} /></strong>
			</div>
			<button
				class="icon-button"
				aria-label={`${t('BET')} +`}
				disabled={busy || stateBet.betAmount >= stateConfig.betAmountOptions.at(-1)!}
				use:holdBetStep={() => stepBet(1)}><img src={`${UI_ART_ROOT}19460.svg`} alt="" /></button
			>
		</div>
		{#if mode !== 'BASE'}<button
				class="quiet-button"
				onclick={() => {
					stateBet.activeBetModeKey = 'BASE';
					modal = null;
				}}>{t('DEACTIVATE')}</button
			>{/if}
	</Modal>
{:else if modal === 'rules'}<Modal title={t('PAYTABLE')} close={() => (modal = null)} wide rules>
		<Rules />
	</Modal>
{:else if modal === 'settings'}<Modal title={t('SETTINGS')} close={() => (modal = null)}
		><label class="setting-row"
			><span>{t('REDUCED MOTION')}</span><input
				type="checkbox"
				bind:checked={runtime.reduced}
			/></label
		>{#if !stateConfig.jurisdiction.disabledFullscreen}<button
				class="quiet-button"
				onclick={fullscreen}><ButtonLabel text={t('FULLSCREEN')} /></button
			>{/if}
	</Modal>
{:else if modal === 'auto'}<Modal title={t('AUTO')} close={() => (modal = null)} compact>
		<AutoplayControls preview={demo} bind:count={autoCount} start={autoStart} />
	</Modal>
{:else if stateModal.modal?.name === 'autoSpinMessage'}<Modal
		title={t('AUTO')}
		close={() => (stateModal.modal = null)}
		><p>{t(autoplayMessageKey(stateModal.modal.message))}</p>
		<button class="gold-button" onclick={() => (stateModal.modal = null)}
			><ButtonLabel text={t('CONTINUE')} /></button
		></Modal
	>{/if}

<style>
	/* Keep the base game out of every startup frame. Presentation canvas is a sibling,
	   so loader/landing remain visible while base GPU + HTML HUD stay concealed. */
	.scene-entry > :global(.gpu-surface),
	.scene-entry > .figma-layout {
		visibility: hidden;
	}
</style>
