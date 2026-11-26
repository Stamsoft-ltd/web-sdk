<script lang="ts" module>
	// Module scope so ap() registers every URL at app bootstrap — warmArt() then fetches them
	// during the loading screen, before the HUD (or the modals it opens) first renders.
	import { ap } from '../lib/preloadArt';

	// The Press Play bar's glyphs (2026-11-26), shared with Blob Split (its public/base/bar/*.svg) so
	// the studio's games wear one bottom bar: outline bolt = normal, filled = turbo, two = super.
	// The wooden bar art (bar.webp, btn_bg_*, landscape right_bar / stepper_pad, the mobile pads)
	// is no longer drawn by the HUD.
	const barMenu = ap('/assets/hud/bar/menu.svg');
	const barSpin = ap('/assets/hud/bar/spin.svg');
	const barAuto = ap('/assets/hud/bar/auto.svg');
	const barArrow = ap('/assets/hud/bar/arrow.svg');
	const barBonusMark = ap('/assets/hud/bar/bonus-mark.svg');
	const barTurboOff = ap('/assets/hud/bar/turbo-off.svg');
	const barTurbo = ap('/assets/hud/bar/turbo.svg');
	const barTurboSuper = ap('/assets/hud/bar/turbo-super.svg');
	const barMinus = ap('/assets/hud/bar/minus.svg');
	const barPlus = ap('/assets/hud/bar/plus.svg');
	const barMenuSound = ap('/assets/hud/bar/menu-sound.svg');
	const barMenuInfo = ap('/assets/hud/bar/menu-info.svg');
</script>

<script lang="ts">
	import { OnHotkey } from 'components-shared';
	import { stateBet, stateBetDerived, stateConfig, stateModal, stateSound, stateUrlDerived } from 'state-shared';
	import { onDestroy } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { forestStakeDerived } from '../state/forestStake.svelte';
	import CustomBuyBonusModal from './CustomBuyBonusModal.svelte';
	import CustomAutoSpinModal from './CustomAutoSpinModal.svelte';

	const context = getContext();

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait');
	const isLandscapeMobile = $derived(layoutType === 'landscape');
	const canInteract = $derived(context.stateXstateDerived.isIdle());
	// While a free-spin congrats screen (intro/outro) is up, make the whole HUD non-interactive so
	// the popup reads as a fullscreen modal; taps then fall through to the press-anywhere handler.
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
	const isFeatureActive = $derived(stateBet.activeBetModeKey === 'FEATURE');
	const isChanceActive = $derived(stateBet.activeBetModeKey === 'CHANCE');
	const isAnyModeActive = $derived(isFeatureActive || isChanceActive);
	// The buy button's caption, in one place: the portrait badge splits it per word for its
	// two-line layout, so it needs the string itself rather than the inline ternary.
	const buyLabelText = $derived(
		isAnyModeActive ? i18nDerived.deactivate() : i18nDerived.buyBonus(),
	);
	// Buying a bonus is not allowed while a multi-spin bonus round is in progress.
	// Feature mode keeps its selected-symbol badge after the round, but should not lock the HUD.
	const isInBonus = $derived(context.stateGame.bonusMode !== null && context.stateGame.bonusMode !== 'feature');
	// BUY BONUS availability: blocked while a spin is running (incl. the bought bonus's own
	// trigger-spin reel animation, when bonusMode isn't set yet) and inside the bonus.
	const disableBuy = $derived((!canInteract || isInBonus) && !isAnyModeActive);
	// Bolder icon = faster: Normal shows the outline bolt, Turbo the solid bolt, Super turbo the double.
	const turboIcon = $derived(
		stateBet.isSuperTurbo ? barTurboSuper : stateBet.isTurbo ? barTurbo : barTurboOff,
	);
	const isMuted = $derived(stateSound.volumeValueMaster === 0);
	// Social-casino jurisdictions can't surface "bet" wording — swap the +/- screen-reader
	// labels to "play amount" so assistive tech matches the on-screen social terminology.
	const isSocial = $derived(stateConfig.jurisdiction.socialCasino || stateUrlDerived.social());
	const decBetLabel = $derived(isSocial ? 'Decrease play amount' : 'Decrease bet');
	const incBetLabel = $derived(isSocial ? 'Increase play amount' : 'Increase bet');
	const betOptions = $derived(stateConfig.betAmountOptions);
	const smallestBet = $derived(stateConfig.betAmountOptions[0]);
	const biggestBet = $derived(
		stateConfig.betAmountOptions[stateConfig.betAmountOptions.length - 1],
	);
	const currentBetIndex = $derived.by(() => {
		const exact = betOptions.indexOf(stateBet.betAmount);
		if (exact >= 0) return exact;
		// Not an exact option (e.g. balance-clamped bet) → step from the nearest option at or below
		// the current bet, so − / + don't jump back to the first value.
		let idx = 0;
		for (let i = 0; i < betOptions.length; i += 1) {
			if (betOptions[i] <= stateBet.betAmount) idx = i;
			else break;
		}
		return idx;
	});
	const formattedBalance = $derived(
		forestStakeDerived.formatCurrencyAmount(stateBet.balanceAmount),
	);
	const formattedBet = $derived(
		isFeatureActive
			? forestStakeDerived.formatCurrencyAmount(stateBet.betAmount * 20)
			: isChanceActive
				? forestStakeDerived.formatCurrencyAmount(stateBet.betAmount * 2)
				: forestStakeDerived.formatCurrencyAmount(stateBet.betAmount),
	);
	const autoSpinsRemainingText = $derived(
		stateBet.autoSpinsCounter === Infinity ? '∞' : `${stateBet.autoSpinsCounter}`,
	);
	// A 3-digit run (autoplay goes to 500) is shrunk so it stays inside the disc's centre.
	const autoSpinsCountScale = $derived(autoSpinsRemainingText.length >= 3 ? 0.8 : 1);
	// `setBetAmount` refuses to leave a bet level the balance can't cover, so + would otherwise sit
	// enabled but do nothing once the next level up is unaffordable. Disable it at that ceiling.
	const highestAffordableBet = $derived.by(() => {
		const costMultiplier = stateBetDerived.betCostMultiplier();
		if (costMultiplier <= 0) return biggestBet;
		const affordable = betOptions.filter((option) => option * costMultiplier <= stateBet.balanceAmount);
		return affordable.length ? affordable[affordable.length - 1] : smallestBet;
	});
	const disableDecrease = $derived(!canInteract || stateBet.betAmount === smallestBet);
	const disableIncrease = $derived(
		!canInteract || stateBet.betAmount >= Math.min(biggestBet, highestAffordableBet),
	);
	const disableAuto = $derived.by(() => {
		if (stateBet.isSpaceHold) return true;
		if (!canInteract && !hasAuto) return true;
		if (!stateBetDerived.isBetCostAvailable()) return true;
		return false;
	});

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

	// The menu bars (every layout) open a small popover holding Sound + Info — Blob's bar has no
	// separate sound / rules buttons. A transparent full-screen backdrop closes it.
	let menuOpen = $state(false);
	const toggleMenu = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		menuOpen = !menuOpen;
	};

	const openRules = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		menuOpen = false;
		stateModal.modal = { name: 'gameRules' };
	};

	// Portrait WIN readout: this spin's win (per round) — during a bonus it shows each round's win,
	// NOT the cumulative total (that's EARNED). Set to the grand total at bonus end, cleared each
	// spin. Count-up on a win, snap on the spin-start clear.
	const winTween = new Tween(0);
	$effect(() => {
		const target = context.stateGame.roundWin;
		winTween.set(target, { duration: target === 0 ? 0 : 650 });
	});
	const winValue = $derived(bookEventAmountToCurrencyString(winTween.current));

	// Amounts sit in FIXED-width boxes (the Press Play bar's BALANCE / WIN / BET, the phone boxes), so a
	// long amount shrinks its type instead of re-laying the bar. Sized from the string itself, not by
	// an observer: in this HUD neither a ResizeObserver nor a MutationObserver fired for the value
	// swap, and Svelte 5 never calls an action's update(). Tabular figures are uniform, so a per-glyph
	// estimate is dependable.
	const glyphEm = (c: string) => {
		if (c >= '0' && c <= '9') return 0.6; // tabular figure
		if (c === ',' || c === '.' || c === ' ') return 0.32;
		if (c === '$') return 0.6;
		return 0.66; // letters / other currency glyphs (conservative)
	};
	// Each box publishes the width left for its value (--fit-avail) and the value's font-size becomes
	// min(designSize, avail / --bet-em). Publishing the string's em width as a custom property keeps
	// it reactive — Svelte rewrites the style attribute on every change.
	const betEmStyle = (s: string) => {
		let em = 0;
		for (const c of s) em += glyphEm(c);
		// /0.9 leaves ~10% headroom for letter-spacing and glyph-estimate error.
		return `--bet-em:${(Math.max(em, 0.01) / 0.9).toFixed(3)};`;
	};

	const openPaytable = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateModal.modal = { name: 'payTable' };
	};

	let showBuyModal = $state(false);
	let showAutoModal = $state(false);
	// Mirror the Buy Bonus modal state to shared game state so the board can freeze its animations
	// behind the blurred backdrop while the dialog is open.
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

	const handleToggleFeature = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateBet.activeBetModeKey = isFeatureActive ? 'BASE' : 'FEATURE';
	};

	const handleToggleChance = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateBet.activeBetModeKey = isChanceActive ? 'BASE' : 'CHANCE';
	};

	const handleDeactivate = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateBet.activeBetModeKey = 'BASE';
	};

	const onSpinButton = () => {
		context.eventEmitter.broadcast({ type: 'soundPressBet' });

		if (hasAuto) {
			stateBet.autoSpinsCounter = 0;
			return;
		}

		if (context.stateXstateDerived.isIdle()) {
			if (!canAffordBet) return;
			// Always reset to BASE before a new spin (unless feature toggle is on)
			stateBet.activeBetModeKey = isFeatureActive ? 'FEATURE' : isChanceActive ? 'CHANCE' : 'BASE';
			context.eventEmitter.broadcast({ type: 'bet' });
			return;
		}

		// Buffer stop only during the initial bet-loading window (first event only)
		if (context.stateGame.awaitingFirstReveal) {
			context.stateGame.pendingStop = true;
		} else {
			context.eventEmitter.broadcast({ type: 'stopButtonClick' });
		}
	};

	const broadcastStop = () => {
		const anticipationActive = context.stateGame.board.some((r) => r.reelState.anticipating);
		if (context.stateGame.hasAnticipationPending && !anticipationActive) {
			// First press: skip non-anticipation reels, let anticipation begin
			context.stateGame.hasAnticipationPending = false;
			context.eventEmitter.broadcast({ type: 'skipToAnticipation' });
		} else {
			// Second press or no anticipation: stop everything
			context.eventEmitter.broadcast({ type: 'stopButtonClick' });
		}
	};

	const onSpinHotkey = () => {
		// Ignore Space while the "Unfinished Round" resume dialog is open — the player
		// must choose Play/End there; a stray spin would launch the game and throw.
		if (context.stateGame.resumeModalOpen) return;

		if (hasAuto) {
			if (context.stateXstateDerived.isIdle()) return;
			context.eventEmitter.broadcast({ type: 'soundPressBet' });
			// Match manual-spin skip behavior. During autoplay the first Space can arrive while
			// the next bet is still in the pre-spin/loading window; broadcasting stop here
			// interrupts pre-spin directly and looks different. Buffer it until reveal starts.
			if (context.stateGame.awaitingFirstReveal) {
				context.stateGame.pendingStop = true;
			} else {
				broadcastStop();
			}
			return;
		}

		context.eventEmitter.broadcast({ type: 'soundPressBet' });

		if (context.stateXstateDerived.isIdle()) {
			if (!canAffordBet) return;
			stateBet.activeBetModeKey = isFeatureActive ? 'FEATURE' : isChanceActive ? 'CHANCE' : 'BASE';
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

	// Tap-anywhere on touch layouts SKIPS the presentation — it hurries the current round along, the
	// same as pressing stop. It must NEVER place a bet: the whole screen is a tap target, so betting
	// from here would let a stray touch spend the player's money with no button press. When the game
	// is idle there is nothing to skip and the tap does nothing; starting a round stays deliberate,
	// via the spin button (or Space, which keeps its own bet-when-idle behaviour).
	//
	// A tap only counts when it lands on the Pixi CANVAS, and that single test is what keeps this
	// off the UI: controls, modals, the menu and the splash overlay all take pointer events, so a
	// tap on them targets that element instead. Meanwhile .hud-shell / .ls-hud are pointer-events:
	// none, so taps over empty HUD space fall through and DO target the canvas — "anywhere" really
	// is anywhere, with no selector blacklist to keep in sync as the HUD changes.
	const onTapSkip = () => {
		// The "Unfinished Round" dialog owns the screen — the player must choose there.
		if (context.stateGame.resumeModalOpen) return;
		// Idle = nothing to skip. This is the guard that keeps a tap from ever costing a bet.
		if (context.stateXstateDerived.isIdle()) return;
		context.eventEmitter.broadcast({ type: 'soundPressBet' });
		// Same skip path as the stop button: buffer during the initial bet-loading window (so the
		// press isn't swallowed before any event has drawn), otherwise stop right now.
		if (context.stateGame.awaitingFirstReveal) {
			context.stateGame.pendingStop = true;
			return;
		}
		broadcastStop();
	};

	const TAP_SLOP_PX = 12;
	let tapStart: { x: number; y: number } | null = null;
	$effect(() => {
		// Touch layouts only — desktop keeps mouse + Space.
		if (layoutType === 'desktop') return;
		const onPointerDown = (event: PointerEvent) => {
			tapStart = event.isPrimary ? { x: event.clientX, y: event.clientY } : null;
		};
		const onPointerUp = (event: PointerEvent) => {
			const start = tapStart;
			tapStart = null;
			if (!start || !event.isPrimary) return;
			// A drag or swipe across the board is not a tap.
			if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > TAP_SLOP_PX) return;
			if (!(event.target instanceof HTMLCanvasElement)) return;
			// Dialogs don't always cover the whole screen — ignore canvas showing beside one.
			if (stateModal.modal || menuOpen || showAutoModal || showBuyModal) return;
			onTapSkip();
		};
		// Capture phase so this still sees the tap if something downstream stops propagation.
		document.addEventListener('pointerdown', onPointerDown, true);
		document.addEventListener('pointerup', onPointerUp, true);
		return () => {
			document.removeEventListener('pointerdown', onPointerDown, true);
			document.removeEventListener('pointerup', onPointerUp, true);
		};
	});

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
</script>

<OnHotkey
	hotkey="Space"
	disabled={!stateConfig.jurisdiction ? false : stateConfig.jurisdiction.disabledSpacebar}
	onpress={onSpinHotkey}
/>

<div
	class="hud-shell"
	class:hud-shell--blocked={congratsBlocking}
	data-layout={layoutType}
>
	{#snippet bonusFace(showTag: boolean)}
		<!-- The Press Play square (Blob Split's BONUS). The desktop bar, where a press turns an active
		     mode off, shows a DEACTIVATE tag while one is on. -->
		<img class="bonus-mark" src={barBonusMark} alt="" />
		{#if showTag}
			<span class="bonus-tag">{buyLabelText}</span>
		{/if}
	{/snippet}

	{#snippet bonusButton(extraClass: string, showTag: boolean)}
		<button
			class={`bonus-square ${extraClass}`}
			class:is-active={isAnyModeActive}
			type="button"
			disabled={disableBuy}
			onclick={isAnyModeActive ? handleDeactivate : openBuyBonus}
			aria-label={isAnyModeActive ? 'Disable' : i18nDerived.buyBonus()}
		>
			{@render bonusFace(showTag)}
		</button>
	{/snippet}

	<!-- SOUND / INFO popover, opened by the menu bars in every layout (Blob's bar has no separate
	     sound or rules buttons). A full-screen transparent backdrop closes it. -->
	{#snippet menuPopup()}
		<button
			class="menu-popup-backdrop"
			type="button"
			aria-label="Close menu"
			onclick={() => (menuOpen = false)}
		></button>
		<div class="menu-popup" role="menu">
			<button class="menu-row" type="button" role="menuitem" onclick={toggleSound}>
				<span class="menu-row__icon">
					<span class="menu-row__glyph" class:is-off={isMuted} style={`--icon:url('${barMenuSound}')`}
					></span>
				</span>
				<span class="menu-row__label">SOUND</span>
			</button>
			<div class="menu-divider"></div>
			<button class="menu-row" type="button" role="menuitem" onclick={openRules}>
				<span class="menu-row__icon">
					<span class="menu-row__glyph" style={`--icon:url('${barMenuInfo}')`}></span>
				</span>
				<span class="menu-row__label">INFO</span>
			</button>
		</div>
	{/snippet}

	{#snippet menuToggle()}
		<button
			class="nav-btn nav-btn--framed nav-btn--menu"
			class:nav-btn--open={menuOpen}
			data-menu-toggle
			type="button"
			onclick={toggleMenu}
			aria-label="Menu"
			aria-expanded={menuOpen}
		>
			{#if menuOpen}
				<span class="nav-close-x" aria-hidden="true"></span>
			{:else}
				<img class="nav-icon bar-menu" src={barMenu} alt="menu" />
			{/if}
		</button>
		{#if menuOpen}{@render menuPopup()}{/if}
	{/snippet}

	<!-- The spin button doubles as STOP / skip while a round runs (a black square over the faded
	     arrows) and shows the remaining count during autoplay. -->
	{#snippet spinButton(extraClass: string)}
		<button
			class={`spin-btn ${extraClass}`}
			class:spin-btn--busy={isSpinStop}
			type="button"
			onclick={onSpinButton}
			aria-label="Spin"
			disabled={canInteract && !hasAuto && !canAffordBet}
		>
			<img class="spin-btn__icon" src={barSpin} alt="" />
			{#if hasAuto}
				<span
					class="spin-btn__count"
					style={`--spin-count-scale:${autoSpinsCountScale}`}
					aria-label={`Remaining auto spins ${autoSpinsRemainingText}`}>{autoSpinsRemainingText}</span
				>
			{:else if isSpinStop}
				<span class="spin-btn__stop" aria-hidden="true"></span>
			{/if}
		</button>
	{/snippet}

	{#snippet turboButton()}
		<button
			class="nav-btn nav-btn--framed nav-btn--turbo"
			class:turbo-fast={stateBet.isTurbo && !stateBet.isSuperTurbo}
			class:turbo-super={stateBet.isSuperTurbo}
			type="button"
			onclick={onTurbo}
			aria-label={i18nDerived.turboLabel()}
		>
			<img class="nav-icon turbo-glyph" src={turboIcon} alt="turbo" />
		</button>
	{/snippet}

	{#snippet autoButton()}
		<button
			class="nav-btn nav-btn--framed nav-btn--auto"
			class:active={hasAuto}
			type="button"
			onclick={onAuto}
			disabled={disableAuto}
			aria-label={i18nDerived.autoplayLabel()}
		>
			<img class="nav-icon auto-glyph" src={barAuto} alt="auto" />
		</button>
	{/snippet}

	{#snippet stepButton(direction: -1 | 1, cls: string, glyph: 'chevron' | 'sign')}
		<button
			class={cls}
			type="button"
			onpointerdown={(event) =>
				startHoldRepeat(event, direction < 0 ? onDecrease : onIncrease, () =>
					stepBet(direction, { playSound: false }),
				)}
			onpointerup={clearHoldRepeat}
			onpointercancel={clearHoldRepeat}
			onpointerleave={clearHoldRepeat}
			onclick={(event) => maybeRunClickAction(event, direction < 0 ? onDecrease : onIncrease)}
			disabled={direction < 0 ? disableDecrease : disableIncrease}
			aria-label={direction < 0 ? decBetLabel : incBetLabel}
		>
			{#if glyph === 'chevron'}
				<img class={direction < 0 ? 'step-chevron step-chevron--down' : 'step-chevron'} src={barArrow} alt="" />
			{:else}
				<img class="nav-icon" src={direction < 0 ? barMinus : barPlus} alt={direction < 0 ? 'minus' : 'plus'} />
			{/if}
		</button>
	{/snippet}

	<!-- ── Desktop + tablet: Blob Split's Press Play bar (Figma 11395:4052) ── -->
	<div class="hud-bottom">
		<div class="hud-left">
			<div class="hud-system">
				{@render menuToggle()}
			</div>

			<div class="hud-buy">
				{@render bonusButton('', true)}
			</div>

			<div class="value-pill value-pill--balance">
				<div class="label label--balance">
					<span class="label-text">{i18nDerived.balance()}</span>
				</div>
				<span class="value" style={betEmStyle(formattedBalance)}>{formattedBalance}</span>
			</div>
		</div>

		<div class="hud-divider" aria-hidden="true"></div>

		<div class="hud-controls">
			<div class="value-pill value-pill--balance value-pill--win">
				<div class="label label--balance">
					<span class="label-text">{i18nDerived.win()}</span>
				</div>
				<span class="value" style={betEmStyle(winValue)}>{winValue}</span>
			</div>

			<div class="value-pill value-pill--bet bet-pill">
				<div class="bet-values">
					<span class="label">{i18nDerived.betLabel()}</span>
					<span class="value" class:value--feature={isAnyModeActive} style={betEmStyle(formattedBet)}
						>{formattedBet}</span
					>
				</div>
			</div>

			<div class="stepper">
				{@render stepButton(1, 'nav-btn nav-btn--step nav-btn--up', 'chevron')}
				{@render stepButton(-1, 'nav-btn nav-btn--step', 'chevron')}
			</div>

			<div class="play-cluster">
				{@render spinButton('')}
			</div>

			<div class="action-cluster">
				{@render turboButton()}
				{@render autoButton()}
			</div>
		</div>
	</div>

	{#if isPortrait}
		<!-- ── Portrait: spin-centred control row + BALANCE / BET / WIN row, in the bar's look ── -->
		<div class="pt-hud">
			<div class="pt-controls">
				<div class="pt-grp pt-grp--left">
					{@render menuToggle()}
					{@render bonusButton('pt-bonus', false)}
				</div>

				{@render spinButton('pt-spin')}

				<div class="pt-grp">
					{@render turboButton()}
					{@render autoButton()}
				</div>
			</div>

			<div class="pt-stats">
				<div class="value-pill value-pill--balance pt-balance">
					<div class="label label--balance">
						<span class="label-text">{i18nDerived.balance()}</span>
					</div>
					<span class="value" style={betEmStyle(formattedBalance)}>{formattedBalance}</span>
				</div>

				<div class="pt-bet">
					{@render stepButton(-1, 'nav-btn nav-btn--framed pt-step', 'sign')}
					<div class="pt-bet-val">
						<span class="value" class:value--feature={isAnyModeActive} style={betEmStyle(formattedBet)}
							>{formattedBet}</span
						>
					</div>
					{@render stepButton(1, 'nav-btn nav-btn--framed pt-step', 'sign')}
				</div>

				<div class="value-pill value-pill--balance pt-balance pt-win">
					<div class="label label--balance">
						<span class="label-text">{i18nDerived.win()}</span>
					</div>
					<span class="value" style={betEmStyle(winValue)}>{winValue}</span>
				</div>
			</div>
		</div>
	{/if}

	{#if isLandscapeMobile}
		<!-- ── Phone landscape: Blob Split's rail (Figma 11318:45947) — rail = menu, turbo, spin, auto;
		     a vertical chevron bet stepper over the Press Play square, left of the rail; BALANCE over
		     WIN bottom-left. ── -->
		<div class="ls-hud">
			<div class="ls-stats">
				<div class="value-pill value-pill--balance ls-balance">
					<div class="label label--balance">
						<span class="label-text">{i18nDerived.balance()}</span>
					</div>
					<span class="value" style={betEmStyle(formattedBalance)}>{formattedBalance}</span>
				</div>
				<div class="value-pill value-pill--balance ls-balance ls-win-box">
					<div class="label label--balance">
						<span class="label-text">{i18nDerived.win()}</span>
					</div>
					<span class="value" style={betEmStyle(winValue)}>{winValue}</span>
				</div>
			</div>

			<div class="ls-side">
				<div class="ls-bet">
					{@render stepButton(1, 'ls-chev', 'chevron')}
					<div class="ls-bet-val">
						<span class="value" class:value--feature={isAnyModeActive} style={betEmStyle(formattedBet)}
							>{formattedBet}</span
						>
					</div>
					{@render stepButton(-1, 'ls-chev', 'chevron')}
				</div>
				{@render bonusButton('ls-bonus', false)}
			</div>

			<div class="ls-nav">
				{@render menuToggle()}
				{@render turboButton()}
				{@render spinButton('ls-spin')}
				{@render autoButton()}
			</div>
		</div>
	{/if}
</div>


{#if showBuyModal}
	<CustomBuyBonusModal
		onclose={() => (showBuyModal = false)}
		{isFeatureActive}
		{isChanceActive}
		onToggleFeature={handleToggleFeature}
		onToggleChance={handleToggleChance}
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
		transition: opacity 0.25s ease;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 8px;
		z-index: 20;
		font-family: 'Poppins', sans-serif;
	}

	/* A congratulations screen is up. The HUD is DOM ABOVE the canvas, so the popup's pixi dim
	   cannot reach it — without this the bright bottom bar sits on top of the celebration, and it
	   also swallows the press that is meant to dismiss it. */
	.hud-shell--celebrating {
		opacity: 0.12;
	}
	.hud-shell--celebrating * {
		pointer-events: none !important;
	}

	/* NOTE: there used to be a 120px opaque shelf here (a forest-gang carry-over that masked a gray
	   full-width element below the HUD). Magnetic has no such element — elementsFromPoint at the
	   bottom edge returns the pixi canvas directly — so all the shelf did was black out the bottom
	   of the room background. The bar carries its own plate, so it reads fine without it. */

	.hud-bottom,
	.scatter-card {
		pointer-events: auto;
	}

	.stage-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}

	.scatter-card {
		position: absolute;
		left: max(18px, calc(50% - 702px));
		top: 114px;
		width: clamp(138px, 10.8vw, 154px);
		aspect-ratio: 218 / 444;
		padding: 16px 12px 18px;
		border: 0;
		border-radius: 8px;
		background: var(--scatter-frame-bg) center / contain no-repeat;
		color: #f5c84f;
		text-align: center;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		z-index: 2;
	}

	.scatter-card img {
		width: 100%;
		max-width: 112px;
		height: auto;
		margin: 8px auto 12px;
		display: block;
	}

	.scatter-card__title {
		font-family: 'Poppins', sans-serif;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: 0.1em;
	}

	.scatter-card__text {
		font-family: 'Poppins', sans-serif;
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1.3;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.65);
	}

	.scatter-card__text--hot {
		color: #ff4b4b;
	}


	.hud-bottom {
		position: relative;
		z-index: 6;
		align-self: center;
		margin-top: auto;
		/* Hug the (now compact) content so the bar frame has no empty ends, capped on narrow screens. */
		width: fit-content;
		max-width: calc(100% - 16px);
		height: auto;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		padding: 8px 16px;
		/* Sit low; just enough lift that the centred spin's lower edge clears the canvas edge. */
		margin-bottom: 20px;
		background: transparent;
		border-radius: 22px;
		box-shadow: none;
	}

	/* Version2 bottom bar: flat navy panel with a thick steel-blue border (Figma 2503:7839). */
	.hud-bottom::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		background: #364970;
		border: 4px solid #4e78b8;
		border-radius: 10px;
		box-sizing: border-box;
		pointer-events: none;
	}

	.hud-bottom > * {
		position: relative;
		z-index: 1;
	}

	.hud-left {
		display: flex;
		align-items: center;
		gap: 10px;
		flex: 0 0 auto;
	}

	.hud-buy {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		flex: 0 0 auto;
		padding-top: 0;
	}
	.hud-bottom .nav-btn {
		width: 42px;
		height: 42px;
	}

	.hud-stats {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		flex: 0 0 auto;
		min-width: 0;
	}

	.stepper {
		display: flex;
		align-items: center;
		gap: 7px;
		flex: 0 0 auto;
	}

	.hud-controls {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 9px;
		flex: 0 0 auto;
		padding-top: 0;
	}

	/* Screens 1200px and wider: lengthen the bar so it isn't a tiny centred cluster; the two groups
	   spread toward the ends to fill it. Narrower screens keep the compact, content-hugging bar. */
	@media (min-width: 1200px) {
		.hud-shell[data-layout='desktop'] .hud-bottom {
			width: min(1060px, calc(100% - 64px));
			justify-content: space-between;
		}
	}

	.value-pill {
		min-width: 0;
		padding: 0 5px;
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
		padding: 0 10px;
		flex: 0 0 auto;
		min-width: 96px;
		border-left: none;
	}

	.value-pill--balance .label--balance {
		line-height: 1;
		justify-content: flex-start;
	}

	.value-pill--balance .value {
		line-height: 1;
	}

	/* WIN pill (between balance and bet) — same look as balance, a touch narrower. */
	.value-pill--win {
		min-width: 60px;
	}

	.value-pill--bet {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		padding: 0 12px;
		border-left: none;
		flex: 0 0 auto;
	}

	/* Central "pipe" divider sitting in the big middle gap between the two control groups. */
	.hud-divider {
		flex: 0 0 auto;
		align-self: center;
		width: 2px;
		height: 30px;
		border-radius: 2px;
		background: #1e3a8a80;
	}

	.bet-values {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
	}

	.value-pill--bet .label {
		line-height: 1;
	}

	.value-pill--bet .value {
		line-height: 1;
	}

	.label {
		font-family: 'Poppins', sans-serif;
		font-size: 10px;
		font-weight: 700;
		line-height: 1.5;
		letter-spacing: 2px;
		text-transform: uppercase;
		color: #60a5facc;
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

	/* Bottom-bar amounts (Figma 7103:5300). line-height and letter-spacing are kept as RATIOS of the
	   font size (32/24 = 133.333%, 0.07/24em) rather than the literal px: the compact desktop and
	   mobile-landscape rules below override font-size only, so fixed px would leave those bars
	   carrying desktop leading around 0.68rem text. */
	.value {
		font-family: 'Poppins', sans-serif;
		font-size: 24px;
		font-weight: 700;
		line-height: 1.3333;
		letter-spacing: 0.0029em;
		color: #fff;
	}

	.value--feature {
		color: #ffd84a;
	}

	.stepper,
	.action-cluster {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 15px;
		padding-top: 0;
	}

	.circle-btn,
	.spin-btn {
		border: none;
		color: #ffffff;
		box-shadow: none;
		background: none;
		outline: none;
	}

	.circle-btn {
		width: 58px;
		height: 58px;
		border-radius: 50%;
		font-size: 1.1rem;
		font-weight: 800;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}

	.circle-btn:not(:disabled):hover {
		filter: brightness(1.12) drop-shadow(0 0 3px #0d89c6);
	}

	.circle-btn:not(:disabled):active {
		filter: brightness(0.92);
	}

	.circle-btn,
	.spin-btn {
		display: grid;
		place-items: center;
	}

	.circle-btn:focus,
	.spin-btn:focus {
		outline: none;
	}

	/* Image buttons — icon-less frame background + gold icon layered on top */
	.nav-btn {
		width: 46px;
		height: 46px;
		border: none;
		background: none;
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
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
		pointer-events: none;
	}

	/* Version2 utility buttons: flat CSS circle (#22365B disc, #2391C1 ring) with a bare white
	   glyph inside — the old per-state baked-button PNGs are gone. */
	.nav-btn--framed {
		background: #22365b;
		border: 1px solid #2391c1;
		border-radius: 50%;
	}

	.nav-btn--framed .nav-icon {
		width: 40%;
		height: 40%;
	}

	/* The bolt is tall and narrow, so the shared 40% square under-renders it — but 58% overshot
	   the reference (user round-trip): the design's outline bolt sits at ~47% of the button. */
	.nav-btn--framed .nav-icon[alt='turbo'] {
		width: 48%;
		height: 48%;
	}

	.nav-btn--framed:disabled .nav-icon {
		opacity: 0.35;
	}

	.nav-btn:not(:disabled):hover {
		filter: brightness(1.12) drop-shadow(0 0 3px #0d89c6);
	}

	.nav-btn:not(:disabled):active {
		filter: brightness(0.9);
	}

	.nav-btn:disabled {
		/* The disabled ICON asset already conveys the state — don't double-dim it. */
		cursor: default;
	}

	.nav-btn.active {
		filter: drop-shadow(0 0 7px rgba(255, 216, 74, 0.9));
	}

	/* Turbo states are conveyed by the ICON alone (design ref: the button keeps its dark circle
	   in every state) — outline bolt = off, solid = fast, double = super. A filled-background
	   active state was tried and rejected against the Figma. */

	/* Menu + sound buttons, docked at the left of the bottom bar */
	.hud-system {
		display: flex;
		align-items: center;
		gap: 6px;
		flex: 0 0 auto;
		position: relative; /* anchor for the menu popover */
	}

	/* ---- Menu popover (SOUND / MUSIC / INFO) — blue tech panel above the menu button ---- */
	.menu-popup-backdrop {
		position: fixed;
		inset: 0;
		background: transparent;
		border: none;
		padding: 0;
		z-index: 59;
		cursor: default;
	}
	.menu-popup {
		position: absolute;
		left: -24px; /* align with the bottom bar's left frame edge (.hud-bottom padding) */
		bottom: calc(100% + 14px);
		width: 200px;
		height: 200px;
		box-sizing: border-box;
		padding: 18px 20px;
		/* Version2 flat panel (Figma 7041-8978) — same navy/border language as the bottom bar. */
		background: #364970;
		border: 4px solid #4e78b8;
		border-radius: 10px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		z-index: 60;
	}
	.menu-row {
		display: flex;
		align-items: center;
		gap: 14px;
		background: none;
		border: none;
		padding: 0;
		cursor: pointer;
	}
	.menu-row__icon {
		flex: 0 0 auto;
		width: 39px;
		height: 39px;
		border-radius: 50%;
		/* Matches the bottom bar's framed circle buttons on the Version2 navy panel. */
		border: 1px solid #2391c1;
		background: #22365b;
		display: grid;
		place-items: center;
		transition: opacity 0.12s ease, filter 0.12s ease;
	}
	.menu-row__glyph {
		width: 20px;
		height: 20px;
		background: #ffffff;
		mask: var(--icon) center / contain no-repeat;
		-webkit-mask: var(--icon) center / contain no-repeat;
		transition: background 0.12s ease;
	}
	/* SOUND row shows the full bottom-bar button art (its own ring), so drop the wrapper ring/fill. */
	.menu-row__icon--full {
		border: none;
		background: none;
	}
	.menu-row__fullimg {
		width: 52%;
		height: 52%;
		object-fit: contain;
		display: block;
	}
	.menu-row__fullimg.is-muted {
		opacity: 0.4;
	}
	/* The "off" (struck-through) icons are .webp exports with no internal padding, so at `contain`
	   they fill the glyph box where the padded .svg on-state icons only reach ~80% of theirs.
	   Scale is set against the NOTE, not the bounding box: the off art's box is squared off by the
	   diagonal slash, which reaches well past the note it crosses, so equalising boxes (0.78-0.80)
	   shrank the note itself to 87% of the on-state's. Measured off a 400px render of both masks —
	   note-head diameter 128px on / 143px off — so 128/143 lands the two notes the same size and
	   lets the slash overhang, which is what the design does. */
	.menu-row__glyph.is-off {
		transform: scale(0.895);
	}
	.menu-row__label {
		font-family: 'Poppins', sans-serif;
		font-weight: 600;
		font-size: 15px;
		letter-spacing: 0.04em;
		color: #ffffff;
		transition: color 0.12s ease;
	}
	/* Hover (Figma 4553-9528): icon turns cyan, button ring gets a soft cyan glow — and the label
	   turns the same cyan so the whole row highlights together. */
	.menu-row:hover .menu-row__glyph {
		background: #00fcff;
	}
	.menu-row:hover .menu-row__label {
		color: #00fcff;
	}
	.menu-row:hover .menu-row__icon {
		box-shadow: 0 0 6px 1px rgba(13, 137, 198, 0.9);
	}
	.menu-divider {
		height: 1px;
		background: rgba(255, 255, 255, 0.18);
		margin: 0 4px;
	}

	.btn-icon {
		width: 22px;
		height: 22px;
		pointer-events: none;
		display: block;
		margin: 0;
		object-fit: contain;
	}

	.btn-face {
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		transform: none;
		line-height: 0;
	}

	.btn-face--icon {
		transform: none;
		line-height: 0;
	}

	.btn-icon--wide {
		width: 18px;
		height: 18px;
	}

	.btn-icon--lightning {
		width: 14px;
		height: 14px;
	}

	.btn-icon--auto {
		width: 16px;
		height: 14px;
	}

	.btn-icon--play {
		width: 52px;
		height: 52px;
		display: block;
		margin: 0;
		transform: translateY(2px);
	}

	.label-icon-frame {
		border: none;
		padding: 0;
		width: 52px;
		height: 52px;
		display: grid;
		place-items: center;
		background: var(--small-btn-bg) center / cover no-repeat;
		flex: 0 0 auto;
		appearance: none;
		cursor: default;
	}


	.label-icon-frame:disabled {
		opacity: 1;
	}

	.label-icon-frame.circle-btn:disabled {
		opacity: 1;
	}

	.pill-icon {
		width: 16px;
		height: 16px;
		vertical-align: middle;
		margin-right: 4px;
	}

	.circle-btn--small {
		width: 52px;
		height: 52px;
		font-size: 1.5rem;
		background: var(--small-btn-bg) center / cover no-repeat;
	}

	.circle-btn--icon {
		font-size: 0.95rem;
	}


	.circle-btn.active,
	.circle-btn:disabled {
		opacity: 0.65;
	}

	/* Turbo states — same Version2 toggle vocabulary as the bottom-bar button (see above). */
	.circle-btn--turbo.turbo-fast,
	.circle-btn--turbo.turbo-super {
		opacity: 1;
	}

	.spin-btn {
		width: 128px;
		height: 128px;
		/* Negative margins keep the big button from inflating the bar height;
		   it protrudes above/below the bar as the focal control. */
		margin: -32px 0;
		border: none;
		background: none;
		padding: 0;
		outline: none;
		cursor: pointer;
		display: grid;
		place-items: center;
		position: relative;
		z-index: 3;
		transition: filter 0.12s ease;
	}

	/* The ring lives on its own layer so it can rotate on hover while the arrow stays put.
	   Both assets are re-centred on their measured circle centres (untrimmed canvases), so the
	   rotation pivots exactly on the ring's axis. */
	.spin-btn::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--btn-spin-bg) center / 108% 108% no-repeat;
		transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
		will-change: transform;
	}

	.spin-btn__icon {
		/* Untrimmed arrow canvas; the glyph fills ~90% of it, centred on the ring.
		   46% -> 54%: the autoplay counter sits INSIDE the arrow's circle, and at 46% the arrow's
		   hole was narrower than a two-digit count — "99" overlapped the stroke and "100" had
		   nowhere to go. 62% was tried first and crowded the metal ring (user round). */
		width: 54%;
		height: 54%;
		object-fit: contain;
		display: block;
		pointer-events: none;
		/* Above the ::before ring layer — an absolutely-positioned pseudo paints over
		   non-positioned inline content, which would bury the arrow under the disc. */
		position: relative;
		z-index: 1;
	}

	/* While busy the count / stop overlay is the message — fade the arrow behind it. */
	.spin-btn--busy .spin-btn__icon {
		opacity: 0.25;
	}

	.spin-btn:not(:disabled):hover {
		filter: brightness(1.08) drop-shadow(0 0 5px #0d89c6);
	}

	/* Hover flourish: the metal ring cranks a few degrees with a springy overshoot (pointer
	   devices only — on touch, :hover sticks after tap and the ring would stay cocked). */
	@media (hover: hover) {
		.spin-btn:not(:disabled):hover::before {
			transform: rotate(24deg);
		}
	}

	.spin-btn:not(:disabled):active {
		filter: brightness(0.92);
	}

	.spin-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* While a spin is running: swap to the dedicated stop-state button asset (square baked in). */
	.spin-btn.spin-btn--busy::before {
		background-image: var(--btn-spin-stop-bg);
	}

	.spin-btn.spin-btn--busy:disabled {
		opacity: 1;
	}

	/* Held for continuous spins: the ring spins for as long as the button is down, so the player can
	   see the hold registered — the button itself never changes state while chaining. */
	.spin-btn--holding::before {
		animation: spin-hold-turn 900ms linear infinite;
	}
	.spin-btn--holding .spin-btn__icon {
		filter: drop-shadow(0 0 6px #4bd6ff);
	}
	@keyframes spin-hold-turn {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.spin-btn--holding::before {
			animation: none;
		}
	}

	/* Stop / autospin-count overlays sit on the green disc, over the spin icon */
	.spin-btn__glyph,
	.spin-btn__count {
		position: absolute;
		/* match the disc center (slightly below box center) like .spin-btn__icon */
		top: 50%;
		left: 50%;
		/* 56% -> 48%: the backing now sits INSIDE the enlarged arrow's hole instead of covering the
		   arrow, so the count reads as the arrow's centre rather than a disc pasted over it. */
		width: 48%;
		height: 48%;
		transform: translate(-50%, -50%);
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(8, 20, 46, 0.96) 62%, rgba(8, 20, 46, 0) 100%);
		color: #fff;
		font-family: 'Poppins', sans-serif;
		font-weight: 900;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
		pointer-events: none;
	}

	.spin-btn__glyph {
		font-size: 2rem;
	}

	.spin-btn__count {
		/* --spin-count-scale is set per-render from the digit count (see script). */
		font-size: calc(1.25rem * var(--spin-count-scale, 1));
		line-height: 1;
	}

	@media (max-width: 1100px) {
		.scatter-card {
			display: none;
		}

		.hud-bottom {
			width: min(calc(100% - 16px), 1120px);
		}
	}

	@media (max-width: 900px) {
		.hud-bottom {
			grid-template-columns: minmax(150px, 210px) 1fr 1fr 1.1fr auto auto;
			gap: 12px;
			padding: 12px 14px;
		}

		.circle-btn {
			width: 54px;
			height: 54px;
		}

		.circle-btn--small {
			width: 48px;
			height: 48px;
		}

		.spin-btn {
			width: 78px;
			height: 78px;
			font-size: 2rem;
		}
	}

	@media (max-width: 700px) {
		.hud-shell {
			padding: 12px;
		}

		.hud-bottom {
			grid-template-columns: 1fr 1fr;
			grid-template-areas:
				'buy buy'
				'balance bet'
				'mode mode'
				'stepper actions';
			gap: 10px;
			padding: 12px;
		}

		.stepper {
			grid-area: stepper;
		}
		.action-cluster {
			grid-area: actions;
			justify-content: flex-end;
		}

		.label {
			font-size: 0.72rem;
		}

		.value {
			font-size: 0.92rem;
		}

		.circle-btn {
			width: 50px;
			height: 50px;
		}

		.circle-btn--small {
			width: 46px;
			height: 46px;
			font-size: 1.35rem;
		}

		.spin-btn {
			width: 82px;
			height: 82px;
			font-size: 2rem;
		}
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
		background: rgba(17, 12, 10, 0.72);
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

	/* Landscape mobile keeps its own menu/sound inside the stepper column */
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
	/* ══ Portrait (mobile) HUD ══ */
	.hud-shell[data-layout='portrait'] {
		padding: 0;
	}
	/* Hide the desktop single-row bar; the portrait two-row HUD replaces it. */
	.hud-shell[data-layout='portrait'] .hud-bottom {
		display: none;
	}

	.pt-hud {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 6;
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		/* The big spin disc overflows the nav bar downward (~26px), so the gap to the bet row must clear
		   it — 10px left the disc touching/overlapping the − / + and bet box on short portrait screens. */
		gap: clamp(20px, 7vw, 30px);
		padding: 10px 8px calc(14px + env(safe-area-inset-bottom, 0px));
	}
	/* Control row sits on the mobile nav bar (the bg-border) — narrower than the screen. */
	.pt-controls {
		position: relative;
		width: min(82%, 332px);
		height: clamp(54px, 15.5vw, 66px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 clamp(12px, 4.5vw, 22px);
	}
	.pt-controls::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--pt-navbar) center / 100% 100% no-repeat;
		z-index: -1;
	}
	/* Balance pinned left, buy-bonus pinned right, and the bet box absolutely centred on the
	   screen — so the differing balance / buy widths never pull it off-centre. */
	.pt-stats {
		position: relative;
		width: 100%;
		max-width: 410px;
		display: flex;
		align-items: center;
		justify-content: space-between;
	}
	.pt-stats .pt-bet {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
	}
	.pt-grp {
		display: flex;
		align-items: center;
		gap: clamp(6px, 2.4vw, 12px);
	}
	.pt-hud .nav-btn {
		width: clamp(34px, 9.8vw, 42px);
		height: clamp(34px, 9.8vw, 42px);
	}
	/* Focal spin button — absolutely centred on the bar (= screen centre) so the differing left
	   (menu + buy) vs right (turbo + auto) group widths never pull it off-centre. The side groups
	   stay in the flex flow and spread to the edges; only the spin's transparent art padding grazes
	   the buy button's glow, never the visible pill. */
	.pt-spin {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: clamp(98px, 30vw, 118px);
		height: clamp(98px, 30vw, 118px);
		margin: 0;
		z-index: 1;
	}
	.pt-spin .spin-btn__count {
		font-size: calc(1.05rem * var(--spin-count-scale, 1));
	}

	/* Balance in its own container asset — left-aligned white label + value, sized to fit content. */
	.pt-balance {
		flex: 0 0 auto;
		background: var(--pt-balance-bg) center / 100% 100% no-repeat;
		align-items: flex-start;
		justify-content: center;
		gap: clamp(1px, 0.6vw, 3px);
		width: fit-content;
		min-width: 0;
		padding: clamp(10px, 2.8vw, 14px) clamp(18px, 5vw, 26px);
		text-align: left;
	}
	.pt-balance .label--balance {
		justify-content: flex-start;
	}
	.pt-balance .value {
		font-size: clamp(0.66rem, 3.2vw, 0.84rem);
		white-space: nowrap;
		color: #fff;
	}
	.pt-balance .label-text {
		font-size: clamp(0.46rem, 2.2vw, 0.56rem);
		color: #fff;
	}
	/* Bet stepper: small round −/+ (desktop icon buttons) flanking the value, centred
	   inside the neon bet container. */
	.pt-bet {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(4px, 1.6vw, 9px);
		flex: 0 0 auto;
		background: var(--pt-bet-bg) center / 100% 100% no-repeat;
		padding: clamp(8px, 2.4vw, 12px) clamp(8px, 2.4vw, 12px);
	}
	.pt-bet .pt-step {
		width: clamp(24px, 7vw, 30px);
		height: clamp(24px, 7vw, 30px);
	}
	.pt-bet-val {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: clamp(42px, 12.5vw, 54px);
		padding: 0 clamp(1px, 0.6vw, 3px);
	}
	.pt-bet-val .value {
		font-size: clamp(0.76rem, 3.7vw, 0.96rem);
		font-weight: 700;
		color: #fff;
		white-space: nowrap;
		line-height: 1.1;
		text-shadow: 0 0 6px rgba(80, 190, 255, 0.35);
	}

	/* WIN takes the buy-bonus slot in the stats row — mirror the balance pill but right-aligned. */
	.pt-win {
		align-items: flex-end;
		text-align: right;
	}
	.pt-win .label--balance {
		justify-content: flex-end;
	}

	/* ── Landscape (mobile horizontal) HUD: vertical nav bar (right) + balance/bet (bottom-left) ── */
	.hud-shell[data-layout='landscape'] .hud-bottom {
		display: none;
	}
	.ls-hud {
		position: absolute;
		inset: 0;
		z-index: 6;
		pointer-events: none;
	}
	.ls-hud > * {
		pointer-events: auto;
	}
	/* Right vertical nav column on the tall nav-bar panel. */
	.ls-nav {
		position: absolute;
		/* Tighter to the right edge (user pass 2026-08-10 — the bar floated too far inboard). */
		right: clamp(6px, 1.2vw, 16px);
		top: 54%;
		transform: translateY(-50%);
		/* Slim panel, tall enough to space the buttons out. Width is decoupled from height (the art is a
		   plain rounded panel, so the mild horizontal stretch is invisible) so it can be narrow AND tall.
		   The big spin disc overflows its sides as the focal control (mirrors the desktop spin button,
		   which protrudes past the bar via negative margins). */
		/* Sized against BOTH axes (user pass 2026-08-10, popout S: the bar ate a third of the width and
		   crowded the tube). vw alone kept the 36px floor on a small window, where 36px is a large
		   FRACTION of it; the vh term pulls it in on short windows too. */
		width: clamp(26px, min(4.8vw, 8.4vh), 48px);
		/* Slightly shorter (was 78vh / 348) to leave room for the buy-bonus + WIN column under the capsule. */
		height: clamp(140px, 64vh, 300px);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 0;
		padding: clamp(5px, 2.8vh, 20px) 0;
		background: var(--ls-navbar) center / 100% 100% no-repeat;
		box-sizing: border-box;
		overflow: visible;
	}
	.ls-nav .nav-btn {
		width: clamp(14px, min(6.6vh, 4.3vw), 38px);
		height: clamp(14px, min(6.6vh, 4.3vw), 38px);
	}
	/* Focal spin — big disc that overflows the slim nav panel on both sides (negative side margins so
	   it protrudes past the panel edges without widening the flex column), centred. */
	.ls-nav .ls-spin {
		/* Sized against BOTH axes: vh alone let a tall-but-narrow popout grow the disc past the
		   right screen edge (user report, twice) — the vw term caps it on narrow windows. */
		width: clamp(40px, min(14vh, 7vw), 78px);
		height: clamp(40px, min(14vh, 7vw), 78px);
		margin: clamp(1px, 0.4vh, 4px) calc(-1 * clamp(8px, 2.5vh, 16px));
		flex: 0 0 auto;
	}
	.ls-nav .ls-spin .spin-btn__count {
		font-size: calc(0.8rem * var(--spin-count-scale, 1));
	}
	/* Balance + bet, bottom-left. */
	.ls-stats {
		position: absolute;
		left: clamp(8px, 2vw, 26px);
		bottom: clamp(8px, 4vh, 30px);
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: clamp(6px, 2vh, 12px);
	}
	/* Balance: label + value on one line in a dark rounded box with generous padding. Scoped under the
	   layout attribute so it outranks the generic `[data-layout='landscape'] .value-pill` rule (which
	   otherwise forces padding:1px 5px + a brown fill onto this pill). */
	.hud-shell[data-layout='landscape'] .ls-balance {
		flex-direction: row;
		align-items: center;
		justify-content: flex-start;
		gap: clamp(2px, 0.6vw, 9px);
		width: fit-content;
		min-width: 0;
		/* Roomier padding so the black container box reads as a proper box (was a thin ~20px sliver). */
		padding: clamp(4px, 2.7vh, 12px) clamp(8px, 2.2vw, 20px);
		border-left: none;
		/* Match the portrait balance — the designed black-box container art (was a plain CSS dark box). */
		background: var(--pt-balance-bg) center / 100% 100% no-repeat;
		border: none;
		text-align: left;
	}
	.ls-balance .label--balance {
		justify-content: flex-start;
	}
	.ls-balance .value {
		font-size: clamp(0.24rem, 1.85vh, 0.5rem);
		white-space: nowrap;
		color: #fff;
	}
	.ls-balance .label-text {
		font-size: clamp(0.17rem, 1.3vh, 0.34rem);
		letter-spacing: 0.04em;
		color: #cfe0f5;
	}
	/* Bet: the bet-box art with round − / + steppers inside. */
	.ls-bet {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(1px, 0.4vw, 4px);
		background: var(--ls-betbox) center / 100% 100% no-repeat;
		padding: clamp(2px, 1.4vh, 9px) clamp(3px, 1.6vw, 18px);
	}
	.ls-bet-val {
		display: flex;
		align-items: center;
		justify-content: center;
		min-width: clamp(20px, 5vw, 50px);
		cursor: pointer;
	}
	.ls-bet-val .value {
		font-size: clamp(0.28rem, 2.5vh, 0.72rem);
		font-weight: 700;
		color: #fff;
		white-space: nowrap;
	}

	/* ── Landscape (mirrors portrait): menu opens the SOUND/MUSIC/INFO popover (sound lives there now),
	   the buy-bonus moves into the vertical nav where sound was, and the last-round WIN takes the buy's
	   old slot under the capsule. ── */
	.hud-shell[data-layout='landscape'] .menu-popup {
		right: calc(100% + 4px);
		left: auto;
		top: 0;
		bottom: auto;
	}
	/* Compact SOUND/MUSIC/INFO popup on mobile (portrait + landscape) — the desktop 200px box is oversized
	   on phones. (Very small landscape shrinks it further in the max-height media query below.) */
	.hud-shell[data-layout='portrait'] .menu-popup,
	.hud-shell[data-layout='landscape'] .menu-popup {
		width: 152px;
		height: 152px;
		padding: 15px 15px 17px;
	}
	.hud-shell[data-layout='portrait'] .menu-row,
	.hud-shell[data-layout='landscape'] .menu-row {
		gap: 10px;
	}
	.hud-shell[data-layout='portrait'] .menu-row__icon,
	.hud-shell[data-layout='landscape'] .menu-row__icon {
		width: 30px;
		height: 30px;
	}
	.hud-shell[data-layout='portrait'] .menu-row__glyph,
	.hud-shell[data-layout='landscape'] .menu-row__glyph {
		width: 15px;
		height: 15px;
	}
	.hud-shell[data-layout='portrait'] .menu-row__label,
	.hud-shell[data-layout='landscape'] .menu-row__label {
		font-size: 12px;
	}
	/* Portrait: anchor the popup to the START (left frame edge) of the nav bar instead of overhanging
	   left of it (the base -24px is tuned for the desktop bottom bar, not the centred portrait nav). */
	.hud-shell[data-layout='portrait'] .menu-popup {
		left: 0;
		bottom: calc(100% + 4px);
	}
	/* Desktop: anchor the popup to the far-left edge of the nav bar. hud-system (the popup's positioned
	   ancestor) sits ~16px inside hud-bottom's left frame edge, so pull the popup left by that much. */
	.hud-shell[data-layout='desktop'] .menu-popup {
		left: -16px;
	}
	/* Smallest portrait phones (e.g. 375×667): shrink the popup + rows further. */
	@media (max-height: 680px) {
		.hud-shell[data-layout='portrait'] .menu-popup {
			width: 120px;
			height: 120px;
			padding: 12px 12px 13px;
		}
		.hud-shell[data-layout='portrait'] .menu-row {
			gap: 8px;
		}
		.hud-shell[data-layout='portrait'] .menu-row__icon {
			width: 24px;
			height: 24px;
		}
		.hud-shell[data-layout='portrait'] .menu-row__glyph {
			width: 12px;
			height: 12px;
		}
		.hud-shell[data-layout='portrait'] .menu-row__label {
			font-size: 10px;
		}
	}

	/* Very small landscape screens (e.g. 400×225): the balance / bet / buy text is set by its vh term
	   (above the pixel mins), so shrink those vh sizes here to make the text-heavy HUD a lot smaller
	   without touching normal-size landscape screens. */
	@media (max-height: 300px) {
		.hud-shell[data-layout='landscape'] .ls-balance .value {
			font-size: clamp(0.24rem, 2vh, 0.42rem);
		}
		.hud-shell[data-layout='landscape'] .ls-balance .label-text {
			font-size: clamp(0.2rem, 1.5vh, 0.32rem);
		}
		.hud-shell[data-layout='landscape'] .ls-bet-val .value {
			font-size: clamp(0.24rem, 2vh, 0.42rem);
		}
		/* Menu popup: shrink further on this tiny screen (it otherwise nearly fills a 225px height). */
		.hud-shell[data-layout='landscape'] .menu-popup {
			width: clamp(80px, 42vh, 115px);
			height: clamp(80px, 42vh, 115px);
			padding: clamp(7px, 3.4vh, 14px) clamp(7px, 3.4vh, 14px) clamp(8px, 3.8vh, 16px);
		}
		.hud-shell[data-layout='landscape'] .menu-row {
			gap: clamp(4px, 2.5vh, 9px);
		}
		.hud-shell[data-layout='landscape'] .menu-row__icon {
			width: clamp(17px, 8.5vh, 26px);
			height: clamp(17px, 8.5vh, 26px);
		}
		.hud-shell[data-layout='landscape'] .menu-row__glyph {
			width: clamp(9px, 4.2vh, 14px);
			height: clamp(9px, 4.2vh, 14px);
		}
		.hud-shell[data-layout='landscape'] .menu-row__label {
			font-size: clamp(7px, 3.2vh, 11px);
		}
	}

	/* ===== Press Play bar — the studio bottom bar Blob Split, Theme Park, McSchmutzo, Veggie Salad and
	   both magnetics wear (Blob Split's Figma 11395:4052), asked for here 2026-11-26 =================
	   A black 47% plate, white round buttons with black rims and black glyphs, a white spin disc with a
	   black rim, the Press Play square as BONUS, accent labels over white amounts. Desktop + tablet also
	   take Blob Split's placements; portrait keeps its own and wears the look; phone landscape takes
	   Blob's rail. Later in the sheet than the Version2 navy rules it overrides, so it wins by source order. */
	.hud-shell {
		--bar-fill: rgb(0 0 0 / 0.47);
		--bar-hover: #efeaff;
		/* Forest Gang's own gold (the old bar's labels / menu X), not Blob Split's pink. */
		--bar-accent: #f1c14a;
		--bar-hover: #fff6dc;
	}

	/* -- round buttons, every layout -- */
	.nav-btn--framed {
		box-sizing: border-box;
		border: 2.75px solid #000;
		border-radius: 50%;
		background: #fff;
		box-shadow: none;
		filter: none;
		transition:
			scale 0.12s ease,
			background-color 0.15s ease;
	}
	.pt-step {
		border-width: 2px;
	}
	.nav-btn--framed .nav-icon {
		filter: brightness(0);
	}
	.nav-btn--framed:not(:disabled):hover {
		filter: none;
		background: var(--bar-hover);
	}
	.nav-btn--framed:not(:disabled):active {
		filter: none;
		scale: 0.93;
	}
	.nav-btn--framed:disabled {
		opacity: 0.5;
	}
	.nav-btn--framed:disabled .nav-icon {
		opacity: 1;
	}
	/* Turbo (any speed-up) and running autoplay go the accent, and stay it under the pointer so a tap
	   on a phone, which leaves :hover latched, never reads as "off". */
	.nav-btn--turbo.turbo-fast,
	.nav-btn--turbo.turbo-super,
	.nav-btn--framed.active,
	.nav-btn--turbo.turbo-fast:not(:disabled):hover,
	.nav-btn--turbo.turbo-super:not(:disabled):hover,
	.nav-btn--framed.active:not(:disabled):hover {
		filter: none;
		background: var(--bar-accent);
	}
	/* Glyph sizes off Blob Split's 44 button: the bolt 25 tall (the double bolt takes its own width),
	   the autoplay arrows 27.5 wide. */
	.nav-btn--framed .nav-icon.turbo-glyph {
		width: auto;
		height: 57%;
	}
	.nav-btn--framed .nav-icon.auto-glyph {
		width: 62.5%;
		height: auto;
	}

	/* -- menu: bare white bars, every layout; open = a white disc with a black X -- */
	.hud-shell [data-menu-toggle],
	.hud-shell [data-menu-toggle]:not(:disabled):hover {
		border: 0;
		background: none;
	}
	.hud-shell [data-menu-toggle]:not(:disabled):hover {
		scale: 1.06;
	}
	.hud-shell [data-menu-toggle] .nav-icon.bar-menu {
		width: 100%;
		height: auto;
		filter: none;
	}
	.hud-shell [data-menu-toggle].nav-btn--open,
	.hud-shell [data-menu-toggle].nav-btn--open:not(:disabled):hover {
		aspect-ratio: 1;
		height: auto;
		border: 2.75px solid #000;
		background: #fff;
	}
	.hud-shell [data-menu-toggle] .nav-close-x::before,
	.hud-shell [data-menu-toggle] .nav-close-x::after {
		background: #000;
	}

	/* -- spin: a white disc with a black rim, Blob Split's black double arrow -- */
	.spin-btn {
		box-sizing: border-box;
		border: 4px solid #000;
		border-radius: 50%;
		background: #fff;
		transition:
			scale 0.12s ease,
			background-color 0.15s ease;
	}
	.spin-btn::before,
	.ls-nav .ls-spin::before {
		content: none;
	}
	.pt-spin {
		border-width: 3px;
	}
	.spin-btn:not(:disabled):hover {
		filter: none;
		background: var(--bar-hover);
	}
	.spin-btn:not(:disabled):active {
		filter: none;
		scale: 0.96;
	}
	.spin-btn:disabled {
		opacity: 1;
	}
	.spin-btn:disabled .spin-btn__icon {
		opacity: 0.35;
	}
	/* Absolutely centred: a % height on a grid item in an auto track falls back to the SVG's own size,
	   which pushes the arrow out of a small disc. `translate`, not transform, so the hover crank and
	   the hold spin (both transforms) still apply. */
	.spin-btn__icon {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		width: auto;
		height: 79.5%;
	}
	.spin-btn--holding .spin-btn__icon {
		filter: none;
	}
	.spin-btn__count {
		width: 52%;
		height: 52%;
		background: #fff;
		color: #000;
		text-shadow: none;
	}

	/* -- BONUS: the 102 x 101 Press Play square, a black rim inset in it, the tilted mark -- */
	.bonus-square {
		position: relative;
		display: block;
		flex: 0 0 auto;
		box-sizing: border-box;
		padding: 0;
		margin: 0;
		border: 0;
		background: var(--bar-accent);
		cursor: pointer;
		aspect-ratio: 102 / 101;
		height: auto;
		border-radius: 8.8%;
		/* The rim's width is a share of the square; cq units on the square's OWN properties would
		   resolve against an ancestor, so the rim is a child (::before). */
		container-type: inline-size;
		transition: scale 0.12s ease;
	}
	.bonus-square::before {
		content: '';
		position: absolute;
		inset: 3.92%;
		border: max(1.5px, 2.94cqw) solid #000;
		border-radius: 6%;
		pointer-events: none;
	}
	.bonus-square .bonus-mark {
		position: absolute;
		left: 21.3%;
		top: 2.97%;
		width: 65.7%;
		height: 83.2%;
		margin: 0;
		pointer-events: none;
		transition: rotate 0.25s cubic-bezier(0.3, 1.6, 0.5, 1);
	}
	.bonus-square:not(:disabled):hover .bonus-mark {
		rotate: -6deg;
	}
	.bonus-square:not(:disabled):active {
		scale: 0.95;
	}
	.bonus-square:disabled {
		opacity: 0.55;
		cursor: default;
	}
	.bonus-tag {
		position: absolute;
		left: 50%;
		bottom: 0;
		translate: -50% 45%;
		padding: 0.25em 0.7em 0.15em;
		border-radius: 0.7em;
		background: #000;
		color: #9bf715;
		font-family: 'Audiowide', 'Poppins', sans-serif;
		font-size: max(8px, 10cqw);
		line-height: 1.25;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		white-space: nowrap;
		pointer-events: none;
	}
	.bonus-square:not(.is-active) .bonus-tag {
		clip-path: inset(50%);
		opacity: 0;
	}
	.bonus-square.is-active {
		box-shadow:
			0 0 0 3px #9bf715,
			0 0 16px #9bf71599;
	}
	.pt-bonus.bonus-square {
		width: clamp(36px, 11vw, 48px);
	}

	/* -- labels in the accent, amounts white -- */
	.hud-shell .label,
	.hud-shell .label-text {
		color: var(--bar-accent);
	}

	/* -- portrait: the control row and the three readouts on the bar's fill -- */
	.pt-controls::before {
		border: 0;
		background: var(--bar-fill);
	}
	.pt-balance,
	.pt-bet {
		border: 0;
		background: var(--bar-fill);
	}

	/* -- desktop + tablet: Blob Split's placements ------------------------------------------------
	   Its desktop bar, in its 1280-wide stage px measured from the square's top-left at (136, 552):
	   square 102 x 101 at (0, 8), plate 817 x 83 at (111, 18), menu bars at 129.67, BALANCE at 198,
	   WIN at 353, BET ending at 671 with chevrons at 690, the 112 disc at 743, auto over turbo (44)
	   at 866. --bs is one of those px: Blob's stage fitted to the window (min of width / 1280 and
	   height / 760), so the bar is Blob's ~72% of the width, never the whole window. The markup's
	   group wrappers dissolve (display: contents) so each control is placed directly. Portrait and
	   landscape hide .hud-bottom. */
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom {
		--bs: min(100vw / 1280, 100dvh / 760);
		display: block;
		width: calc(var(--bs) * 928);
		max-width: none;
		height: calc(var(--bs) * 112);
		padding: 0;
		margin-bottom: calc(var(--bs) * 10);
		border-radius: 0;
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom::before {
		inset: auto;
		left: calc(var(--bs) * 111);
		top: calc(var(--bs) * 18);
		width: calc(var(--bs) * 817);
		height: calc(var(--bs) * 83);
		border: 0;
		border-radius: calc(var(--bs) * 10);
		background: var(--bar-fill);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape'])
		.hud-bottom
		:is(.hud-left, .hud-controls, .stepper, .play-cluster, .action-cluster) {
		display: contents;
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape'])
		.hud-bottom
		.hud-divider {
		display: none;
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .hud-buy,
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .hud-system,
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .value-pill,
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .nav-btn--step,
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .spin-btn,
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .nav-btn--turbo,
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .nav-btn--auto {
		position: absolute;
		margin: 0;
		z-index: 1;
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .hud-buy {
		left: 0;
		top: calc(var(--bs) * 8);
		padding: 0;
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .bonus-square {
		width: calc(var(--bs) * 102);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .hud-system {
		left: calc(var(--bs) * 129.67);
		top: calc(var(--bs) * 40);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom [data-menu-toggle] {
		width: calc(var(--bs) * 46.67);
		height: calc(var(--bs) * 40);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape'])
		.hud-bottom
		[data-menu-toggle].nav-btn--open {
		width: calc(var(--bs) * 40);
		height: calc(var(--bs) * 40);
		margin-left: calc(var(--bs) * 3.33);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .menu-popup {
		left: calc(var(--bs) * -18.67);
	}
	/* BALANCE and WIN with Blob Split's 6.67 padding and no rules between; BET's amount is a fixed
	   box ending at 671 with its label centred over it. All three keep a FIXED width (fitAmount steps
	   a long amount's type down to it), so a count-up never re-lays the bar. */
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .value-pill {
		top: calc(var(--bs) * 34);
		height: calc(var(--bs) * 49);
		min-width: 0;
		box-sizing: border-box;
		padding: 0 calc(var(--bs) * 6.67);
		border-left: 0;
		justify-content: center;
		gap: calc(var(--bs) * 2);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .value-pill--balance {
		left: calc(var(--bs) * 198);
		width: calc(var(--bs) * 155);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .value-pill--win {
		left: calc(var(--bs) * 353);
		width: calc(var(--bs) * 170);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .value-pill--bet {
		left: calc(var(--bs) * 531);
		width: calc(var(--bs) * 140);
		padding: 0;
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .bet-values {
		width: 100%;
		align-items: center;
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .label {
		font-size: calc(var(--bs) * 10);
		line-height: calc(var(--bs) * 15);
		letter-spacing: calc(var(--bs) * 2);
	}
	/* The chevrons: up at (690, 31), down at (690, 67), 34 x 19, white and bare. */
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .nav-btn--step {
		left: calc(var(--bs) * 690);
		top: calc(var(--bs) * 67);
		width: calc(var(--bs) * 34);
		height: calc(var(--bs) * 19);
		border: 0;
		border-radius: calc(var(--bs) * 4);
		background: none;
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .nav-btn--up {
		top: calc(var(--bs) * 31);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape'])
		.hud-bottom
		.nav-btn--step:not(:disabled):hover {
		filter: none;
		background: none;
		scale: 1.12;
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .nav-btn--step:disabled {
		opacity: 0.3;
	}
	.step-chevron {
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.step-chevron--down {
		rotate: 180deg;
	}
	/* The 112 disc, overhanging the plate 18 above and 11 below. */
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .spin-btn {
		left: calc(var(--bs) * 743);
		top: 0;
		width: calc(var(--bs) * 112);
		height: calc(var(--bs) * 112);
		border-width: calc(var(--bs) * 4);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .spin-btn__count {
		font-size: calc(var(--bs) * 30 * var(--spin-count-scale, 1));
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .nav-btn--auto,
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .nav-btn--turbo {
		width: calc(var(--bs) * 44);
		height: calc(var(--bs) * 44);
		border-width: calc(var(--bs) * 2.75);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .nav-btn--auto {
		left: calc(var(--bs) * 866);
		top: calc(var(--bs) * 12);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .nav-btn--turbo {
		left: calc(var(--bs) * 867);
		top: calc(var(--bs) * 61);
	}

	/* -- phone landscape: Blob Split's rail (Figma 11318:45947, the reference Veggie Salad was moved
	   onto 2026-11-25) ---------------------------------------------------------------------------
	   In its 800 x 360 frame: rail 65 x 285 with its right edge at 786.5 and its foot at 320 — menu,
	   turbo, an 84 spin disc overhanging both sides, auto. Left of it, 14 apart, a 46-wide column: the
	   bet stepper (137 tall, bare chevrons around the amount) over the Press Play square, 8 apart, on
	   the rail's foot line. --lu is one of those px. The capsule tube keeps clear of this column
	   (LS_SIDE_FROM_RIGHT_LU in stateGame — keep the two in step). BALANCE over WIN bottom-left, where
	   BALANCE / BET sat. Plates at 60%: 47% reads too thin over a busy backdrop (user, Veggie). */
	.hud-shell[data-layout='landscape'] .ls-hud {
		--lu: min(100vw / 800, 100dvh / 360);
		--bar-fill: rgb(0 0 0 / 0.6);
	}
	.hud-shell[data-layout='landscape'] .ls-nav {
		top: auto;
		transform: none;
		right: calc(var(--lu) * 13.5);
		bottom: calc(var(--lu) * 40);
		width: calc(var(--lu) * 65);
		height: calc(var(--lu) * 285);
		padding: calc(var(--lu) * 18) 0;
		justify-content: space-between;
		border: 0;
		border-radius: calc(var(--lu) * 10);
		background: var(--bar-fill);
	}
	.hud-shell[data-layout='landscape'] .ls-nav .nav-btn {
		width: calc(var(--lu) * 42);
		height: calc(var(--lu) * 42);
		border-width: max(1.5px, calc(var(--lu) * 2.5));
	}
	.hud-shell[data-layout='landscape'] .ls-nav [data-menu-toggle] {
		width: calc(var(--lu) * 40);
		height: calc(var(--lu) * 34);
	}
	.hud-shell[data-layout='landscape'] .ls-nav [data-menu-toggle].nav-btn--open {
		width: calc(var(--lu) * 40);
		height: calc(var(--lu) * 40);
	}
	.hud-shell[data-layout='landscape'] .ls-nav .ls-spin {
		width: calc(var(--lu) * 84);
		height: calc(var(--lu) * 84);
		margin: 0 calc(var(--lu) * -9.5);
		border-width: max(2px, calc(var(--lu) * 3.5));
	}
	.hud-shell[data-layout='landscape'] .ls-nav .ls-spin .spin-btn__count {
		font-size: calc(var(--lu) * 22 * var(--spin-count-scale, 1));
	}
	/* The popover opens left of the stepper column, not over it. */
	.hud-shell[data-layout='landscape'] .menu-popup {
		top: 0;
		right: calc(100% + var(--lu) * 70);
	}
	.ls-side {
		position: absolute;
		right: calc(var(--lu) * 92.5);
		bottom: calc(var(--lu) * 40);
		width: calc(var(--lu) * 46);
		display: flex;
		flex-direction: column;
		gap: calc(var(--lu) * 8);
	}
	.hud-shell[data-layout='landscape'] .ls-side .ls-bet {
		width: 100%;
		height: calc(var(--lu) * 137);
		box-sizing: border-box;
		padding: calc(var(--lu) * 8) calc(var(--lu) * 3);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 0;
		border: 0;
		border-radius: calc(var(--lu) * 8);
		background: var(--bar-fill);
	}
	.ls-chev {
		width: calc(var(--lu) * 32);
		height: calc(var(--lu) * 19);
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		transition: scale 0.12s ease;
	}
	.ls-chev:not(:disabled):hover {
		scale: 1.12;
	}
	.ls-chev:disabled {
		opacity: 0.3;
		cursor: default;
	}
	.hud-shell[data-layout='landscape'] .ls-side .ls-bet-val {
		width: 100%;
	}
	/* fitAmount steps a long bet down to the column's width from here. */
	.hud-shell[data-layout='landscape'] .ls-side .ls-bet-val .value {
		font-size: clamp(11px, calc(var(--lu) * 15), 20px);
		line-height: 1;
	}
	.hud-shell[data-layout='landscape'] .ls-side .ls-bonus.bonus-square {
		width: 100%;
	}
	/* BALANCE over WIN, both the design's black-50% boxes, label over amount, one fixed width so a
	   count-up never resizes them (fitAmount steps a long amount down instead). */
	.hud-shell[data-layout='landscape'] .ls-stats {
		left: calc(var(--lu) * 14);
		bottom: calc(var(--lu) * 40);
		gap: calc(var(--lu) * 8);
	}
	.hud-shell[data-layout='landscape'] .ls-balance {
		width: calc(var(--lu) * 120);
		box-sizing: border-box;
		flex-direction: column;
		align-items: flex-start;
		gap: calc(var(--lu) * 2);
		padding: calc(var(--lu) * 7) calc(var(--lu) * 11);
		border-radius: calc(var(--lu) * 8);
		background: rgb(0 0 0 / 0.5);
		box-shadow: none;
		backdrop-filter: none;
	}
	.hud-shell[data-layout='landscape'] .ls-balance .label-text {
		font-size: max(8px, calc(var(--lu) * 9));
		letter-spacing: 0.12em;
	}
	.hud-shell[data-layout='landscape'] .ls-balance .value {
		font-size: max(11px, calc(var(--lu) * 16));
		line-height: 1.1;
	}
	.hud-shell[data-layout='landscape'] .ls-balance .label-text {
		color: var(--bar-accent);
	}
	.hud-shell[data-layout='landscape'] .ls-bet-val {
		cursor: pointer;
	}
	.pt-controls::before {
		border-radius: 12px;
	}
	.pt-balance,
	.pt-bet {
		border-radius: 10px;
	}

	/* Menu open: Blob's bar has no art for it — a black X drawn on the white disc. */
	.nav-close-x {
		position: relative;
		display: block;
		width: 40%;
		height: 40%;
		pointer-events: none;
	}
	.nav-close-x::before,
	.nav-close-x::after {
		content: '';
		position: absolute;
		left: 50%;
		top: 50%;
		width: 130%;
		height: 2.5px;
		border-radius: 2px;
		transform: translate(-50%, -50%) rotate(45deg);
	}
	.nav-close-x::after {
		transform: translate(-50%, -50%) rotate(-45deg);
	}

	/* ===== Forest Gang on the Press Play bar ============================================== */
	/* Free-spin congrats (intro/outro) up: force every HUD control non-interactive so the popup
	   reads as a fullscreen modal. The shell is already pointer-events:none but its buttons opt
	   back in, so override all descendants; taps then fall through to the press-anywhere handler. */
	.hud-shell--blocked,
	.hud-shell--blocked * {
		pointer-events: none !important;
	}

	/* Amount fitting: each box publishes --fit-avail, the value carries --bet-em (see betEmStyle). */
	.hud-shell .value {
		font-family: 'Poppins', sans-serif;
		font-weight: 700;
		white-space: nowrap;
		font-size: min(var(--fit-base, 24px), calc(var(--fit-avail, 1000px) / var(--bet-em, 1)));
	}
	.value--feature {
		color: #ffd84a;
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .value {
		--fit-base: calc(var(--bs) * 22);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .value-pill--balance {
		--fit-avail: calc(var(--bs) * 141);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .value-pill--win {
		--fit-avail: calc(var(--bs) * 156);
	}
	.hud-shell:not([data-layout='portrait'], [data-layout='landscape']) .hud-bottom .value-pill--bet {
		--fit-avail: calc(var(--bs) * 136);
	}
	.hud-shell .label,
	.hud-shell .label-text {
		font-family: 'Poppins', sans-serif;
	}
	/* Phone landscape: the stepper column and the BALANCE / WIN boxes. */
	.hud-shell[data-layout='landscape'] .ls-side .ls-bet-val {
		--fit-avail: calc(var(--lu) * 40);
		cursor: default;
	}
	.hud-shell[data-layout='landscape'] .ls-side .ls-bet-val .value {
		--fit-base: clamp(11px, calc(var(--lu) * 15), 20px);
		font-size: min(var(--fit-base), calc(var(--fit-avail) / var(--bet-em, 1)));
	}
	.hud-shell[data-layout='landscape'] .ls-balance {
		--fit-avail: calc(var(--lu) * 98);
	}
	.hud-shell[data-layout='landscape'] .ls-balance .value {
		--fit-base: max(11px, calc(var(--lu) * 16));
		font-size: min(var(--fit-base), calc(var(--fit-avail) / var(--bet-em, 1)));
	}
	/* Portrait: fixed boxes so a count-up never shifts the row. */
	.hud-shell[data-layout='portrait'] .pt-balance {
		width: clamp(92px, 27vw, 112px);
		box-sizing: border-box;
		padding: 8px 12px;
		--fit-avail: calc(clamp(92px, 27vw, 112px) - 24px);
	}
	.hud-shell[data-layout='portrait'] .pt-balance .value {
		--fit-base: clamp(13px, 3.8vw, 16px);
	}
	.hud-shell[data-layout='portrait'] .pt-bet-val {
		width: clamp(56px, 17vw, 72px);
		min-width: 0;
		--fit-avail: clamp(56px, 17vw, 72px);
	}
	.hud-shell[data-layout='portrait'] .pt-bet-val .value {
		--fit-base: clamp(14px, 4.2vw, 17px);
	}

	/* STOP while a round runs: a black square over the faded arrows. */
	.spin-btn__stop {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		width: 26%;
		height: 26%;
		border-radius: 12%;
		background: #000;
		pointer-events: none;
	}

	/* The SOUND / INFO popover on the bar's black, not the old navy plaque. Two rows, so it hugs
	   them instead of the 3-row 200px box. */
	.hud-shell .menu-popup {
		height: auto;
		gap: 12px;
		border: 0;
		border-radius: 12px;
		background: rgb(0 0 0 / 0.8);
	}
	.hud-shell[data-layout='portrait'] .menu-popup,
	.hud-shell[data-layout='landscape'] .menu-popup {
		height: auto;
		justify-content: flex-start;
		gap: 10px;
	}
	.hud-shell .menu-row__icon {
		border: 2px solid #000;
		background: #fff;
	}
	.hud-shell .menu-row__glyph {
		background: #000;
	}
	.hud-shell .menu-row__glyph.is-off {
		transform: none;
		opacity: 0.35;
	}
	.hud-shell .menu-row__label {
		font-family: 'Poppins', sans-serif;
		color: #fff;
	}
	.hud-shell .menu-row:hover .menu-row__label {
		color: var(--bar-accent);
	}
	.hud-shell .menu-row:hover .menu-row__glyph {
		background: #000;
	}
	.hud-shell .menu-row:hover .menu-row__icon {
		box-shadow: 0 0 0 2px var(--bar-accent);
	}
</style>
