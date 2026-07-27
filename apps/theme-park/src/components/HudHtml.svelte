<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const navMenu = ap('/assets/hud/icon-menu.svg');
	const navSound = ap('/assets/hud/icon-volume.svg');
	const navArrowLeft = ap('/assets/theme-park/v2/controls/arrow-left.png');
	const navArrowLeftDisabled = ap('/assets/theme-park/v2/controls/arrow-left-disabled.png');
	const navArrowRight = ap('/assets/theme-park/v2/controls/arrow-right.png');
	const navArrowRightDisabled = ap('/assets/theme-park/v2/controls/arrow-right-disabled.png');
	const navAuto = ap('/assets/hud/icon-autoplay.svg');
	const navTurbo1 = ap('/assets/hud/icon-lightning-1.png');
	const navTurbo2 = ap('/assets/hud/icon-lightning-2.png');
	const navTurbo3 = ap('/assets/hud/icon-lightning-3.png');
	const navSpinDefault = ap('/assets/theme-park/v2/controls/spin-default.png');
	const navSpinDefaultMobile = ap('/assets/theme-park/v2/controls/spin-default-mobile.png');
	const navSpinActive = ap('/assets/theme-park/v2/controls/spin-active.png');
	const navSpinStop = ap('/assets/theme-park/v2/controls/spin-stop.png');
	const navCoins = ap('/assets/hud/icon-coins.png');
	const gameLogo = ap('/assets/theme-park/v2/logo.png');
</script>

<script lang="ts">
	import { OnHotkey } from 'components-shared';
	import { stateBet, stateBetDerived, stateConfig, stateModal, stateSound } from 'state-shared';
	import { onDestroy } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { templateStakeDerived } from '../state/templateStake.svelte';
	import CustomBuyBonusModal from './CustomBuyBonusModal.svelte';
	import CustomAutoSpinModal from './CustomAutoSpinModal.svelte';

	const context = getContext();

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isLandscapeMobile = $derived(layoutType === 'landscape');
	const isMobileLayout = $derived(layoutType === 'portrait' || layoutType === 'landscape');
	const canInteract = $derived(context.stateXstateDerived.isIdle());
	const congratsBlocking = $derived(context.stateGame.freeSpinPopupShowing);
	const hasAuto = $derived(stateBetDerived.hasAutoBetCounter());
	const isSpinStop = $derived(!context.stateXstateDerived.isIdle() || hasAuto);
	const canAffordBet = $derived(stateBetDerived.isBetCostAvailable());

	// Stop autoplay and disable spin when balance drops below bet cost
	$effect(() => {
		if (canInteract && hasAuto && !canAffordBet) {
			stateBet.autoSpinsCounter = 0;
		}
	});

	const turboImg = $derived(
		// Match Forest Gang: outline = normal, solid = fast, double = super.
		stateBet.isSuperTurbo ? navTurbo3 : stateBet.isTurbo ? navTurbo1 : navTurbo2,
	);
	const speedMode = $derived(
		stateBet.isSuperTurbo ? 'super' : stateBet.isTurbo ? 'fast' : 'normal',
	);
	const isMuted = $derived(stateSound.volumeValueMaster === 0);
	const betOptions = $derived(stateConfig.betAmountOptions);
	const smallestBet = $derived(stateConfig.betAmountOptions[0]);
	const biggestBet = $derived(
		stateConfig.betAmountOptions[stateConfig.betAmountOptions.length - 1],
	);
	const currentBetIndex = $derived.by(() => {
		const exact = betOptions.indexOf(stateBet.betAmount);
		if (exact >= 0) return exact;
		let idx = 0;
		for (let i = 0; i < betOptions.length; i += 1) {
			if (betOptions[i] <= stateBet.betAmount) idx = i;
			else break;
		}
		return idx;
	});
	const activeCostMultiplier = $derived(
		({ ANTE: 3, FSPIN1: 20, FSPIN2: 60 } as Record<string, number>)[stateBet.activeBetModeKey] ?? 1,
	);
	const formattedBalance = $derived(
		templateStakeDerived.formatCurrencyAmount(stateBet.balanceAmount),
	);
	const formattedBet = $derived(
		templateStakeDerived.formatCurrencyAmount(stateBet.betAmount * activeCostMultiplier),
	);
	const winTween = new Tween(0);
	$effect(() => {
		const target = context.stateGame.roundWin;
		winTween.set(target, { duration: target === 0 ? 0 : 650 });
	});
	const formattedWin = $derived(bookEventAmountToCurrencyString(winTween.current));
	const autoSpinsRemainingText = $derived(
		stateBet.autoSpinsCounter === Infinity ? '∞' : `${stateBet.autoSpinsCounter}`,
	);
	const disableDecrease = $derived(!canInteract || stateBet.betAmount === smallestBet);
	const disableIncrease = $derived(!canInteract || stateBet.betAmount === biggestBet);
	const disableAuto = $derived.by(() => {
		if (stateBet.isSpaceHold) return true;
		if (!canInteract && !hasAuto) return true;
		if (!stateBetDerived.isBetCostAvailable()) return true;
		return false;
	});

	// Persistent per-spin toggles. Bonus buys remain one-shot.
	type ToggleMode = 'ANTE' | 'FSPIN1' | 'FSPIN2';
	const TOGGLE_MODES = new Set<ToggleMode>(['ANTE', 'FSPIN1', 'FSPIN2']);
	const activeToggleMode = $derived(
		TOGGLE_MODES.has(stateBet.activeBetModeKey as ToggleMode)
			? (stateBet.activeBetModeKey as ToggleMode)
			: null,
	);
	const isAnyModeActive = $derived(activeToggleMode !== null);
	const buyLabel = $derived(isAnyModeActive ? i18nDerived.translate('DEACTIVATE') : i18nDerived.buyBonus());
	const isInBonus = $derived(
		context.stateGame.bonusMode !== null ||
			context.stateGame.bonusType !== null ||
			context.stateGame.duckPicks !== null,
	);
	const disableBuy = $derived((!canInteract || isInBonus) && !isAnyModeActive);
	const spinModeKey = () => activeToggleMode ?? 'BASE';
	const toggleMode = (mode: ToggleMode) => {
		stateBet.activeBetModeKey = activeToggleMode === mode ? 'BASE' : mode;
	};
	const deactivateMode = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateBet.activeBetModeKey = 'BASE';
	};

	let holdTimeout: ReturnType<typeof setTimeout> | null = null;
	let holdInterval: ReturnType<typeof setInterval> | null = null;
	let suppressNextClick = false;

	const clearHoldRepeat = () => {
		if (holdTimeout) {
			clearTimeout(holdTimeout);
			holdTimeout = null;
		}
		if (holdInterval) {
			clearInterval(holdInterval);
			holdInterval = null;
		}
	};

	const runHoldAction = (action: () => void, repeatAction?: () => void) => {
		action();
		holdTimeout = setTimeout(() => {
			holdInterval = setInterval(repeatAction ?? action, 90);
		}, 260);
	};

	const startHoldRepeat = (event: PointerEvent, action: () => void, repeatAction?: () => void) => {
		if (event.button !== 0) return;
		clearHoldRepeat();
		suppressNextClick = true;
		runHoldAction(action, repeatAction);
	};

	const maybeRunClickAction = (event: MouseEvent, action: () => void) => {
		if (suppressNextClick) {
			suppressNextClick = false;
			event.preventDefault();
			return;
		}
		action();
	};

	const toggleSound = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateSound.volumeValueMaster = stateSound.volumeValueMaster === 0 ? 50 : 0;
	};

	const openRules = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateModal.modal = { name: 'gameRules' };
	};

	let showBuyModal = $state(false);
	let showAutoModal = $state(false);
	$effect(() => {
		context.stateGame.buyModalOpen = showBuyModal;
	});

	const openBuyBonus = () => {
		if (disableBuy) return;
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		showBuyModal = true;
	};

	const stepBet = (direction: -1 | 1, { playSound = true } = {}) => {
		if (direction < 0 && disableDecrease) return;
		if (direction > 0 && disableIncrease) return;
		if (playSound) context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		const nextIndex = Math.min(betOptions.length - 1, Math.max(0, currentBetIndex + direction));
		const nextBet = betOptions[nextIndex];
		if (typeof nextBet !== 'number' || nextBet === stateBet.betAmount) return;
		stateBetDerived.setBetAmount(nextBet);
	};

	const onDecrease = () => stepBet(-1);
	const onIncrease = () => stepBet(1);
	const broadcastStop = () => {
		const anticipationActive = context.stateGame.board.some((reel) => reel.reelState.anticipating);
		if (context.stateGame.hasAnticipationPending && !anticipationActive) {
			context.stateGame.hasAnticipationPending = false;
			context.eventEmitter.broadcast({ type: 'skipToAnticipation' });
			return;
		}
		context.eventEmitter.broadcast({ type: 'stopButtonClick' });
	};

	const onSpinButton = () => {
		if (congratsBlocking || context.stateGame.resumeModalOpen) return;
		context.eventEmitter.broadcast({ type: 'soundPressBet' });

		if (hasAuto) {
			stateBet.autoSpinsCounter = 0;
			return;
		}

		if (context.stateXstateDerived.isIdle()) {
			stateBet.activeBetModeKey = spinModeKey();
			context.eventEmitter.broadcast({ type: 'bet' });
			return;
		}

		// Buffer stop only during the initial bet-loading window (first event only)
		if (context.stateGame.awaitingFirstReveal) {
			context.stateGame.pendingStop = true;
		} else {
			broadcastStop();
		}
	};

	const onSpinHotkey = () => {
		if (
			showBuyModal ||
			showAutoModal ||
			stateModal.modal !== null ||
			context.stateGame.resumeModalOpen ||
			congratsBlocking
		) return;
		if (hasAuto) {
			if (context.stateXstateDerived.isIdle()) return;
			context.eventEmitter.broadcast({ type: 'soundPressBet' });
			context.eventEmitter.broadcast({ type: 'stopButtonClick' });
			return;
		}

		context.eventEmitter.broadcast({ type: 'soundPressBet' });

		if (context.stateXstateDerived.isIdle()) {
			stateBet.activeBetModeKey = spinModeKey();
			context.eventEmitter.broadcast({ type: 'bet' });
			return;
		}

		// Buffer stop only during the initial bet-loading window (first event only)
		if (context.stateGame.awaitingFirstReveal) {
			context.stateGame.pendingStop = true;
		} else {
			broadcastStop();
		}
	};

	const onTurbo = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		if (!stateBet.isTurbo && !stateBet.isSuperTurbo) {
			stateBet.isTurbo = true;
			stateBet.isSuperTurbo = false;
			return;
		}
		if (stateBet.isTurbo && !stateBet.isSuperTurbo) {
			stateBet.isSuperTurbo = true;
			return;
		}
		stateBet.isTurbo = false;
		stateBet.isSuperTurbo = false;
	};

	const onAuto = () => {
		if (disableAuto) return;
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		if (hasAuto) {
			stateBet.autoSpinsCounter = 0;
			return;
		}
		showAutoModal = true;
	};

	onDestroy(() => {
		clearHoldRepeat();
	});

	function fitText(node: HTMLElement, _value: unknown) {
		void _value;
		node.style.display = 'inline-block';
		const fit = () => {
			const slot = node.parentElement;
			if (!slot) return;
			node.style.transform = 'none';
			node.style.transformOrigin = 'left center';
			const style = getComputedStyle(slot);
			const available =
				slot.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
			const full = node.offsetWidth;
			const scale = full > available && available > 0 ? available / full : 1;
			node.style.transform = scale < 1 ? `scale(${scale})` : 'none';
		};
		const schedule = () => requestAnimationFrame(fit);
		const observer = new ResizeObserver(schedule);
		observer.observe(node);
		if (node.parentElement) observer.observe(node.parentElement);
		document.fonts?.ready.then(schedule);
		schedule();
		return { update: schedule, destroy: () => observer.disconnect() };
	}
</script>

<OnHotkey
	hotkey="Space"
	disabled={!stateConfig.jurisdiction ? false : stateConfig.jurisdiction.disabledSpacebar}
	onpress={onSpinHotkey}
/>

<div class="hud-shell" class:hud-shell--blocked={congratsBlocking} data-layout={layoutType}>
	<img class="game-logo" src={gameLogo} alt={i18nDerived.gameTitle()} />
	<div class="hud-bottom">
		<div class="hud-left">
			<div class="hud-system">
				<button class="nav-btn" type="button" onclick={openRules} aria-label={i18nDerived.gameRules()}>
					<img src={navMenu} alt="" />
				</button>
				<button class="nav-btn" type="button" onclick={toggleSound} aria-label={i18nDerived.translate('SOUND')}>
					<img src={navSound} alt="" class:is-muted={isMuted} />
				</button>
			</div>

			<div class="hud-buy">
				<button
					class="buy-btn"
					type="button"
					disabled={disableBuy}
					onclick={isAnyModeActive ? deactivateMode : openBuyBonus}
					aria-label={buyLabel}
				>
					<span class="buy-btn__label">{buyLabel}</span>
				</button>
			</div>
		</div>

		<div class="hud-stats">
			<div class="value-pill value-pill--balance">
				<div class="label label--balance">
					<span class="label-text">{i18nDerived.balance()}</span>
				</div>
				<span class="value" use:fitText={formattedBalance}>{formattedBalance}</span>
			</div>

			<div class="value-pill value-pill--win">
				<div class="label">
					<span class="label-text">{i18nDerived.win()}</span>
				</div>
				<span class="value" use:fitText={formattedWin}>{formattedWin}</span>
			</div>

			<div
				class="value-pill value-pill--bet bet-pill"
				role="button"
				tabindex="0"
				onkeydown={(e) => e.key === 'Enter' && (stateModal.modal = { name: 'betAmountMenu' })}
				onclick={() => (stateModal.modal = { name: 'betAmountMenu' })}
			>
				<span class="bet-coin" aria-hidden="true">
					<img src={navCoins} alt="" />
				</span>
				<div class="bet-values">
					<span class="label">{i18nDerived.betLabel()}</span>
					<span class="value" use:fitText={formattedBet}>{formattedBet}</span>
				</div>
			</div>
		</div>

		<div class="hud-controls">
			<div class="stepper">
				{#if isLandscapeMobile}
					<button class="nav-btn" type="button" onclick={openRules} aria-label={i18nDerived.gameRules()}>
						<img src={navMenu} alt="" />
					</button>
					<button class="nav-btn" type="button" onclick={toggleSound} aria-label={i18nDerived.translate('SOUND')}>
						<img src={navSound} alt="" class:is-muted={isMuted} />
					</button>
				{/if}
				<button
					class="nav-btn nav-btn--step"
					type="button"
					onpointerdown={(event) =>
						startHoldRepeat(event, onDecrease, () => stepBet(-1, { playSound: false }))}
					onpointerup={clearHoldRepeat}
					onpointercancel={clearHoldRepeat}
					onpointerleave={clearHoldRepeat}
					onclick={(event) => maybeRunClickAction(event, onDecrease)}
					disabled={disableDecrease}
					aria-label={i18nDerived.translate('DECREASE BET')}
				>
					<img src={disableDecrease ? navArrowLeftDisabled : navArrowLeft} alt="" />
				</button>
				<button
					class="nav-btn nav-btn--step"
					type="button"
					onpointerdown={(event) =>
						startHoldRepeat(event, onIncrease, () => stepBet(1, { playSound: false }))}
					onpointerup={clearHoldRepeat}
					onpointercancel={clearHoldRepeat}
					onpointerleave={clearHoldRepeat}
					onclick={(event) => maybeRunClickAction(event, onIncrease)}
					disabled={disableIncrease}
					aria-label={i18nDerived.translate('INCREASE BET')}
				>
					<img src={disableIncrease ? navArrowRightDisabled : navArrowRight} alt="" />
				</button>
			</div>

			<div class="play-cluster">
				<button
					class="spin-btn"
					type="button"
					onclick={onSpinButton}
					aria-label={i18nDerived.translate('SPIN')}
					disabled={canInteract && !hasAuto && !canAffordBet}
				>
					{#if isSpinStop}
						<img src={navSpinStop} alt="" class="spin-btn__img spin-btn__img--stop" />
					{:else}
						<img
							src={isMobileLayout ? navSpinDefaultMobile : navSpinDefault}
							alt=""
							class="spin-btn__img spin-btn__img--default"
						/>
						<img src={navSpinActive} alt="" class="spin-btn__img spin-btn__img--active" />
					{/if}
					{#if hasAuto}
						<span
							class="spin-btn__count"
							aria-label={i18nDerived.translateVars('REMAINING AUTO SPINS', {
								count: autoSpinsRemainingText,
							})}
							>{autoSpinsRemainingText}</span
						>
					{/if}
				</button>
			</div>

			<div class="action-cluster">
				<button
					class="nav-btn nav-btn--turbo"
					class:turbo-fast={stateBet.isTurbo && !stateBet.isSuperTurbo}
					class:turbo-super={stateBet.isSuperTurbo}
					data-speed={speedMode}
					type="button"
					onclick={onTurbo}
					aria-label={i18nDerived.turboLabel()}
					title={`${i18nDerived.turboLabel()}: ${speedMode}`}
				>
					<img src={turboImg} alt="" />
				</button>
				<button
					class="nav-btn"
					class:active={hasAuto}
					type="button"
					onclick={onAuto}
					disabled={disableAuto}
					aria-label={i18nDerived.autoplayLabel()}
				>
					<img src={navAuto} alt="" />
				</button>
			</div>
		</div>
	</div>
</div>

{#if showBuyModal}
	<CustomBuyBonusModal
		onclose={() => (showBuyModal = false)}
		{activeToggleMode}
		onToggleMode={toggleMode}
	/>
{/if}

{#if showAutoModal}
	<CustomAutoSpinModal onclose={() => (showAutoModal = false)} />
{/if}

<style>
	.hud-shell {
		position: absolute;
		inset: 0;
		pointer-events: none;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 8px;
		z-index: 20;
		font-family: 'Cinzel', serif;
		/* Forest Gang HUD rule: one design unit scales the complete control
		   cluster uniformly. No right-side clipping on laptop/popout widths. */
		--hud-u: calc(min(97vw, 1380px) / 1380);
	}

	.hud-shell--blocked,
	.hud-shell--blocked * {
		pointer-events: none !important;
	}

	.hud-shell::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 120px;
		z-index: 5;
		pointer-events: none;
		background: linear-gradient(to top, #08041d 0%, #08041d 78%, rgba(8, 4, 29, 0) 100%);
	}

	.game-logo {
		position: absolute;
		left: 50%;
		top: 10px;
		width: clamp(190px, 22vw, 330px);
		height: auto;
		transform: translateX(-50%);
		filter: drop-shadow(0 6px 11px rgba(0, 0, 0, 0.7));
		animation: game-logo-idle 3.4s ease-in-out infinite;
		z-index: 4;
	}

	@keyframes game-logo-idle {
		0%,
		100% {
			transform: translate(-50%, 0) scale(1);
		}
		50% {
			transform: translate(-50%, -3px) scale(1.02);
		}
	}

	.hud-bottom {
		pointer-events: auto;
	}

	.hud-bottom {
		position: relative;
		z-index: 6;
		align-self: center;
		margin-top: auto;
		width: calc(var(--hud-u) * 1380);
		height: auto;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(var(--hud-u) * 16);
		padding: calc(var(--hud-u) * 8) calc(var(--hud-u) * 24);
		background: linear-gradient(180deg, rgba(28, 8, 57, 0.98), rgba(7, 5, 29, 0.98));
		border: 2px solid rgba(255, 193, 47, 0.72);
		border-radius: 999px;
		box-shadow:
			0 0 22px rgba(255, 79, 216, 0.24),
			0 14px 30px rgba(0, 0, 0, 0.45);
	}

	.hud-bottom > * {
		position: relative;
		z-index: 1;
	}

	.hud-left {
		display: flex;
		align-items: center;
		gap: calc(var(--hud-u) * 18);
		flex: 0 0 auto;
	}

	.hud-buy {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		flex: 0 0 auto;
		padding-top: 0;
	}

	.hud-stats {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0;
		flex: 0 0 auto;
		min-width: 0;
	}

	.hud-controls {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: calc(var(--hud-u) * 22);
		flex: 0 0 auto;
		padding-top: 0;
	}

	.value-pill {
		min-width: 0;
		padding: 0 calc(var(--hud-u) * 5);
		border-left: 1px solid rgba(255, 255, 255, 0.15);
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
	}

	.value-pill--balance {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		padding: 0 calc(var(--hud-u) * 16);
		flex: 0 0 auto;
		min-width: calc(var(--hud-u) * 150);
		border-left: none;
	}

	.value-pill--win {
		align-items: flex-start;
		padding: 0 calc(var(--hud-u) * 16);
		flex: 0 1 calc(var(--hud-u) * 150);
		width: calc(var(--hud-u) * 150);
		overflow: hidden;
	}

	.value-pill--balance .label--balance {
		line-height: 1;
		justify-content: flex-start;
	}

	.value-pill--balance .value {
		line-height: 1;
	}

	.value-pill--bet {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: calc(var(--hud-u) * 6);
		padding: 0 calc(var(--hud-u) * 16);
		border-left: 1px solid rgba(255, 255, 255, 0.3);
		flex: 0 0 auto;
	}

	.bet-values {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: calc(var(--hud-u) * 2);
	}

	.value-pill--bet .label {
		line-height: 1;
	}

	.value-pill--bet .value {
		line-height: 1;
	}

	.bet-coin {
		pointer-events: none;
		width: calc(var(--hud-u) * 44);
		height: calc(var(--hud-u) * 44);
		display: grid;
		place-items: center;
		flex: 0 0 auto;
	}

	.bet-coin img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}

	.bet-pill {
		cursor: pointer;
	}

	.label {
		font-family: 'Cinzel', serif;
		font-size: calc(var(--hud-u) * 0.7rem);
		font-weight: 700;
		color: #ff7de3;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.label--balance {
		gap: 6px;
		align-items: center;
		justify-content: flex-start;
		width: 100%;
	}

	.label-text {
		display: inline-block;
	}

	.value {
		font-family: 'Cinzel', serif;
		font-size: calc(var(--hud-u) * 1.25rem);
		font-weight: 700;
		color: #fff;
		white-space: nowrap;
	}

	.stepper,
	.action-cluster {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(var(--hud-u) * 15);
		padding-top: 0;
	}

	.nav-btn {
		width: calc(var(--hud-u) * 60);
		height: calc(var(--hud-u) * 60);
		border: 2px solid rgba(255, 193, 47, 0.68);
		border-radius: 50%;
		background: radial-gradient(circle, #52238a 0%, #17062f 72%);
		padding: 0;
		outline: none;
		cursor: pointer;
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}

	.nav-btn img {
		width: 58%;
		height: 58%;
		object-fit: contain;
		display: block;
		pointer-events: none;
	}

	.nav-btn:not(:disabled):hover {
		transform: translateY(-1px);
		filter: brightness(1.12);
	}

	.nav-btn:not(:disabled):active {
		transform: translateY(1px) scale(0.94);
	}

	.nav-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}

	.nav-btn img.is-muted {
		opacity: 0.4;
	}

	.nav-btn.active {
		filter: drop-shadow(0 0 7px rgba(255, 216, 74, 0.9));
	}

	.nav-btn--turbo.turbo-fast {
		filter: drop-shadow(0 0 4px rgba(255, 200, 80, 0.6));
	}

	.nav-btn--turbo.turbo-super {
		filter: drop-shadow(0 0 6px #ffd84a) drop-shadow(0 0 12px rgba(255, 216, 74, 0.5));
	}

	.nav-btn--turbo {
		position: relative;
		z-index: 2;
		flex: 0 0 auto;
	}

	.hud-system {
		display: flex;
		align-items: center;
		gap: calc(var(--hud-u) * 8);
		flex: 0 0 auto;
	}

	.spin-btn {
		width: calc(var(--hud-u) * 132);
		height: calc(var(--hud-u) * 132);
		margin: calc(var(--hud-u) * -22) 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		box-shadow: none;
		padding: 0;
		outline: none;
		cursor: pointer;
		display: grid;
		place-items: center;
		transform: translateY(calc(var(--hud-u) * -10));
		position: relative;
		z-index: 3;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
		color: #fff;
	}

	.spin-btn__img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		pointer-events: none;
		transition: opacity 0.12s ease;
		filter: drop-shadow(0 0 12px rgba(255, 79, 216, 0.35));
	}

	.spin-btn__img--active {
		opacity: 0;
	}

	.spin-btn:not(:disabled):hover .spin-btn__img--default,
	.spin-btn:not(:disabled):active .spin-btn__img--default {
		opacity: 0;
	}

	.spin-btn:not(:disabled):hover .spin-btn__img--active,
	.spin-btn:not(:disabled):active .spin-btn__img--active {
		opacity: 1;
	}

	.nav-btn--step {
		border: 0;
		background: transparent;
		box-shadow: none;
		overflow: visible;
	}

	.nav-btn--step img {
		width: 112%;
		height: 112%;
	}

	.spin-btn:not(:disabled):hover {
		transform: translateY(-12px);
		filter: brightness(1.08);
	}

	.spin-btn:not(:disabled):active {
		transform: translateY(-8px) scale(0.96);
	}

	.spin-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.spin-btn__count {
		position: absolute;
		top: 50%;
		left: 50%;
		width: 56%;
		height: 56%;
		transform: translate(-50%, -50%);
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(70, 20, 110, 0.96) 60%, rgba(70, 20, 110, 0) 100%);
		color: #fff;
		font-family: Cinzel, serif;
		font-weight: 900;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
		pointer-events: none;
	}

	.spin-btn__count {
		font-size: 1.5rem;
	}

	.buy-btn {
		width: calc(var(--hud-u) * 130);
		height: auto;
		aspect-ratio: 3065 / 1084;
		border: 2px solid rgba(255, 193, 47, 0.8);
		border-radius: 14px;
		background: linear-gradient(180deg, #7426a8, #2a084b);
		box-shadow: 0 0 14px rgba(255, 79, 216, 0.3);
		padding: 0 calc(var(--hud-u) * 14);
		outline: none;
		cursor: pointer;
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		flex: 0 0 auto;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}

	.buy-btn:not(:disabled):hover {
		transform: translateY(-1px);
		filter: brightness(1.1);
	}

	.buy-btn:not(:disabled):active {
		transform: translateY(1px) scale(0.95);
	}

	.buy-btn__label {
		font-family: 'Cinzel', serif;
		font-size: calc(var(--hud-u) * 0.82rem);
		font-weight: 900;
		color: #ffd84a;
		letter-spacing: 0.08em;
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
		line-height: 1;
		pointer-events: none;
	}

	.buy-btn:disabled {
		opacity: 0.45;
		cursor: default;
		filter: grayscale(0.35);
	}

	.hud-shell[data-layout='landscape'] {
		padding: 8px 12px;
	}

	.hud-shell[data-layout='landscape'] .hud-bottom {
		position: absolute;
		top: 58px;
		left: 12px;
		right: 12px;
		bottom: auto;
		width: auto;
		height: auto;
		display: flex;
		align-content: center;
		align-items: center;
		justify-content: center;
		gap: 4px;
		padding: 0;
		background: none;
		box-shadow: none;
		border-radius: 0;
		overflow: visible;
	}

	.hud-shell[data-layout='landscape'] .hud-buy {
		justify-self: start;
		align-self: center;
	}

	.hud-shell[data-layout='landscape'] .hud-buy .buy-btn {
		width: clamp(110px, 15vw, 150px);
		align-self: center;
	}

	.hud-shell[data-layout='landscape'] .buy-btn__label {
		font-size: 0.52rem;
	}

	.hud-shell[data-layout='landscape'] .hud-stats {
		flex: 0 0 auto;
		gap: 8px;
	}

	.hud-shell[data-layout='landscape'] .hud-controls {
		gap: 8px;
	}

	.hud-shell[data-layout='landscape'] .value-pill {
		width: fit-content;
		min-width: min(98px, 13vw);
		max-width: 100%;
		padding: 1px 5px;
		border-left: none;
		border-radius: 12px;
		background: rgba(24, 7, 48, 0.82);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.22);
		backdrop-filter: blur(4px);
	}

	.hud-shell[data-layout='landscape'] .label {
		font-size: 0.55rem;
	}

	.hud-shell[data-layout='landscape'] .value {
		font-size: 0.68rem;
	}

	.hud-shell[data-layout='landscape'] .stepper {
		flex-direction: column;
		align-self: center;
		justify-self: start;
		justify-content: flex-start;
		gap: 2px;
	}

	.hud-shell[data-layout='landscape'] .stepper .nav-btn {
		width: clamp(44px, 6.4vh, 56px);
		height: clamp(44px, 6.4vh, 56px);
	}

	.hud-shell[data-layout='landscape'] .hud-system {
		display: none;
	}

	.hud-shell[data-layout='landscape'] .action-cluster {
		flex-direction: column;
		justify-self: end;
		align-self: center;
		justify-content: end;
		gap: 2px;
		max-height: 100%;
	}

	.hud-shell[data-layout='landscape'] .action-cluster .nav-btn {
		width: clamp(42px, 6vh, 50px);
		height: clamp(42px, 6vh, 50px);
	}

	/* Forest Gang mobile principle: controls keep readable fixed proportions;
	   only the complete group reflows. The old desktop row was uniformly
	   shrunk to ~27% on portrait, making turbo effectively disappear. */
	.hud-shell[data-layout='portrait'] {
		--hud-u: 1;
		padding: 0 4px calc(8px + env(safe-area-inset-bottom, 0px));
	}

	.hud-shell[data-layout='portrait']::after {
		height: 205px;
	}

	.hud-shell[data-layout='portrait'] .hud-bottom {
		width: min(97vw, 440px);
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 6px 10px;
		border-radius: 30px;
	}

	.hud-shell[data-layout='portrait'] .hud-controls {
		order: 0;
		width: 100%;
		justify-content: center;
		gap: 8px;
	}

	.hud-shell[data-layout='portrait'] .stepper,
	.hud-shell[data-layout='portrait'] .action-cluster {
		gap: 5px;
	}

	.hud-shell[data-layout='portrait'] .nav-btn {
		width: 38px;
		height: 38px;
	}

	.hud-shell[data-layout='portrait'] .spin-btn {
		width: 78px;
		height: 78px;
		margin: -7px 0;
		transform: none;
	}

	.hud-shell[data-layout='portrait'] .hud-stats {
		order: 1;
		width: 100%;
		justify-content: center;
	}

	.hud-shell[data-layout='portrait'] .value-pill--balance,
	.hud-shell[data-layout='portrait'] .value-pill--win {
		flex: 1 1 0;
		width: auto;
		min-width: 0;
		padding: 0 6px;
	}

	.hud-shell[data-layout='portrait'] .value-pill--bet {
		flex: 1.3 1 0;
		padding: 0 6px;
	}

	.hud-shell[data-layout='portrait'] .bet-coin {
		width: 30px;
		height: 30px;
	}

	.hud-shell[data-layout='portrait'] .label {
		font-size: 0.58rem;
	}

	.hud-shell[data-layout='portrait'] .value {
		font-size: 0.9rem;
	}

	.hud-shell[data-layout='portrait'] .hud-left {
		order: 2;
		width: 100%;
		justify-content: center;
		gap: 10px;
	}

	.hud-shell[data-layout='portrait'] .hud-system {
		gap: 6px;
	}

	.hud-shell[data-layout='portrait'] .hud-system .nav-btn {
		width: 34px;
		height: 34px;
	}

	.hud-shell[data-layout='portrait'] .buy-btn {
		width: 104px;
	}

	.hud-shell[data-layout='portrait'] .buy-btn__label {
		font-size: 0.67rem;
	}
</style>
