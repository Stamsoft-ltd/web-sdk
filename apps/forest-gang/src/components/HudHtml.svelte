<script lang="ts">
	import { OnHotkey } from 'components-shared';
	import { stateBet, stateBetDerived, stateConfig, stateModal, stateSound } from 'state-shared';
	import { onDestroy } from 'svelte';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitLabel } from '../lib/fitLabel';
	import { forestStakeDerived } from '../state/forestStake.svelte';
	import CustomBuyBonusModal from './CustomBuyBonusModal.svelte';
	import CustomAutoSpinModal from './CustomAutoSpinModal.svelte';

	const context = getContext();

	// Converts absolute /path to ./path so it resolves relative to the page URL at any deploy sub-path
	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;

	const heroCardBg = ap('/assets/components/backgrounds/visual_v2.jpg');
	const controlsBg = ap('/assets/components/reference/controls_reference.png');
	const buyBonusBg = ap('/assets/components/reference/buy_bonus_reference.png');

	// Frame backgrounds — passed as CSS vars because url() in style blocks can't use runtime paths
	const menuBtnFrame = ap('/assets/components/frames/top_menu-button_frame.png');
	const soundBtnFrame = ap('/assets/components/frames/top_sound_button_frame.png');
	const menuBarFrame = ap('/assets/components/navbar/bar.png');

	// Button backgrounds (icon-less frames) — icons are layered on top in markup
	const btnRoundBg = ap('/assets/components/navbar/btn_bg_round.png'); // wooden round — utility buttons
	const btnSpinBg = ap('/assets/components/navbar/btn_bg_spin.png'); // green round — spin
	const btnWideBg = ap('/assets/components/navbar/btn_bg_wide.png'); // wide green — buy bonus
	// Portrait/mobile pads (Figma 2792-4133)
	// Mobile-landscape HUD art (Figma 2682-3639)
	const lsRightBar = ap('/assets/components/symbols/landscape/right_bar.png'); // vertical control bar
	const lsBetPad = ap('/assets/components/symbols/landscape/stepper_pad.png'); // − value + bottom pad
	const lsBuyBonus = ap('/assets/components/symbols/landscape/buy_bonus.png'); // round green badge
	const navPadMobile = ap('/assets/components/navbar/nav_pad_mobile.png'); // control-bar pill
	const betPadMobile = ap('/assets/components/navbar/bet_pad_mobile.png'); // − value + pill
	const buyBonusMobile = ap('/assets/components/navbar/buy_bonus_mobile.png'); // round green badge
	const spinMobile = ap('/assets/components/navbar/spin_mobile.png'); // green spin w/ leaves

	// Gold icons layered over the button backgrounds
	const iconMenu = ap('/assets/hud/icon-menu.png');
	const iconSound = ap('/assets/hud/icon-volume.png');
	const iconMinus = ap('/assets/hud/icon-minus.png');
	const iconPlus = ap('/assets/hud/icon-plus.png');
	const iconAuto = ap('/assets/hud/icon-autoplay.png');
	const iconSpin = ap('/assets/hud/icon-spin.png');
	const iconStop = ap('/assets/hud/icon-stop.png');
	const iconTurbo1 = ap('/assets/hud/icon-lightning-1.png');
	const iconTurbo2 = ap('/assets/hud/icon-lightning-2.png');
	const iconTurbo3 = ap('/assets/hud/icon-lightning-3.png');
	const iconCoins = ap('/assets/hud/icon-coins.png');

	const scatterFrame = ap('/assets/components/frames/scatter_frame.png');
	const hudFrame = ap('/assets/components/frames/hud_frame.png');
	const smallBtnFrame = ap('/assets/components/frames/lower_hud_button_frame.png');
	const playBtnFrame = ap('/assets/components/frames/play_button-frame.png');

	const scatterImg = ap('/assets/components/ui/scatter-panel-image.png');

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait');
	const isLandscapeMobile = $derived(layoutType === 'landscape');
	const canInteract = $derived(context.stateXstateDerived.isIdle());
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
	// Buying a bonus is not allowed while a bonus round is in progress.
	const isInBonus = $derived(context.stateGame.bonusMode !== null);
	// Bolder icon = faster: Normal shows the outline bolt, Turbo the solid bolt, Super turbo the double.
	const turboIcon = $derived(
		stateBet.isSuperTurbo ? iconTurbo3 : stateBet.isTurbo ? iconTurbo1 : iconTurbo2,
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
	const disableDecrease = $derived(!canInteract || stateBet.betAmount === smallestBet);
	const disableIncrease = $derived(!canInteract || stateBet.betAmount === biggestBet);
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

	const openRules = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateModal.modal = { name: 'gameRules' };
	};

	const openPaytable = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateModal.modal = { name: 'payTable' };
	};

	let showBuyModal = $state(false);
	let showAutoModal = $state(false);

	const openBuyBonus = () => {
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
			broadcastStop();
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

	// Scale the balance text down to fit its slot so a very long balance can't
	// widen the HUD and push the navigation off the bar. Only ever shrinks; all
	// digits stay visible. Re-runs when the text changes and when the slot resizes.
	function fitText(node: HTMLElement, _value: unknown) {
		const fit = () => {
			const slot = node.parentElement;
			if (!slot) return;
			node.style.transformOrigin = 'left center';
			node.style.transform = 'none';
			const avail = slot.clientWidth;
			const full = node.scrollWidth;
			const scale = full > avail && avail > 0 ? avail / full : 1;
			node.style.transform = scale < 1 ? `scale(${scale})` : 'none';
		};
		const raf = () => requestAnimationFrame(fit);
		const ro = new ResizeObserver(raf);
		if (node.parentElement) ro.observe(node.parentElement);
		raf();
		return { update: raf, destroy: () => ro.disconnect() };
	}

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
	data-layout={layoutType}
	style={`--forest-card-bg:url('${heroCardBg}');--forest-controls-bg:url('${controlsBg}');--forest-buy-bg:url('${buyBonusBg}');--menu-btn-bg:url('${menuBtnFrame}');--sound-btn-bg:url('${soundBtnFrame}');--menu-bar-bg:url('${menuBarFrame}');--scatter-frame-bg:url('${scatterFrame}');--hud-frame-bg:url('${hudFrame}');--buy-btn-bg:url('${btnWideBg}');--small-btn-bg:url('${smallBtnFrame}');--play-btn-bg:url('${playBtnFrame}');--btn-round-bg:url('${btnRoundBg}');--btn-spin-bg:url('${btnSpinBg}');--pt-navpad:url('${navPadMobile}');--pt-betpad:url('${betPadMobile}');--pt-buybonus:url('${buyBonusMobile}');--pt-spin:url('${spinMobile}');--ls-rightbar:url('${lsRightBar}');--ls-betpad:url('${lsBetPad}');--ls-buybonus:url('${lsBuyBonus}');--ls-spin:url('${btnSpinBg}')`}
>
	{#if isPortrait}
		<!-- Dedicated portrait HUD (Figma mobile 2792-4133). Desktop/landscape markup below is untouched. -->
		<div class="pt-hud">
			<div class="pt-controls">
				<div class="pt-grp">
					<button class="pt-round" type="button" onclick={openRules} aria-label="Game rules">
						<img class="pt-icon" src={iconMenu} alt="menu" />
					</button>
					<button class="pt-round" type="button" onclick={toggleSound} aria-label="Sound">
						<img class="pt-icon" src={iconSound} alt="sound" class:is-muted={isMuted} />
					</button>
				</div>

				<button
					class="pt-spin"
					type="button"
					onclick={onSpinButton}
					aria-label="Spin"
					disabled={canInteract && !hasAuto && !canAffordBet}
				>
					{#if !isSpinStop}
						<img src={iconSpin} alt="" class="pt-spin__icon" />
					{/if}
					{#if hasAuto}
						<span class="pt-spin__count">{autoSpinsRemainingText}</span>
					{:else if isSpinStop}
						<img src={iconStop} alt="" class="pt-spin__stop" aria-hidden="true" />
					{/if}
				</button>

				<div class="pt-grp">
					<button
						class="pt-round pt-round--turbo"
						class:turbo-fast={stateBet.isTurbo && !stateBet.isSuperTurbo}
						class:turbo-super={stateBet.isSuperTurbo}
						type="button"
						onclick={onTurbo}
						aria-label={i18nDerived.turboLabel()}
					>
						<img class="pt-icon" src={turboIcon} alt="turbo" />
					</button>
					<button
						class="pt-round"
						class:active={hasAuto}
						type="button"
						onclick={onAuto}
						disabled={disableAuto}
						aria-label={i18nDerived.autoplayLabel()}
					>
						<img class="pt-icon" src={iconAuto} alt="auto" />
					</button>
				</div>
			</div>

			<div class="pt-stats">
				<div class="pt-balance">
					<span class="pt-balance__label">{i18nDerived.balance()}</span>
					<span class="pt-balance__value" use:fitText={formattedBalance}>{formattedBalance}</span>
				</div>

				<div class="pt-bet">
					<button
						class="pt-round pt-round--sm"
						type="button"
						onclick={onDecrease}
						disabled={disableDecrease}
						aria-label="Decrease bet"
					>
						<img class="pt-icon" src={iconMinus} alt="minus" />
					</button>
					<span
						class="pt-bet__value"
						class:value--feature={isAnyModeActive}
						use:fitText={formattedBet}
					>{formattedBet}</span>
					<button
						class="pt-round pt-round--sm"
						type="button"
						onclick={onIncrease}
						disabled={disableIncrease}
						aria-label="Increase bet"
					>
						<img class="pt-icon" src={iconPlus} alt="plus" />
					</button>
				</div>

				<button
					class="pt-buy"
					type="button"
					onclick={isAnyModeActive ? handleDeactivate : openBuyBonus}
					aria-label={isAnyModeActive ? 'Deactivate' : i18nDerived.buyBonus()}
				>
					<span class="pt-buy__label" use:fitLabel={{ dep: isAnyModeActive ? i18nDerived.deactivate() : i18nDerived.buyBonus(), maxFraction: 0.58 }}>{isAnyModeActive ? i18nDerived.deactivate() : i18nDerived.buyBonus()}</span>
				</button>
			</div>
		</div>
	{/if}
	{#if isLandscapeMobile}
		<!-- Dedicated mobile-landscape HUD (Figma 2682-3639). Desktop markup below is untouched
		     and hidden via CSS in landscape. -->
		<div class="ls-hud">
			<!-- Left rail: BALANCE only (logo is drawn separately by GameLogoFrame) -->
			<div class="ls-left">
				<div class="ls-balance">
					<span class="ls-balance__label">{i18nDerived.balance()}</span>
					<span class="ls-balance__value" use:fitText={formattedBalance}>{formattedBalance}</span>
				</div>
			</div>

			<!-- BUY BONUS: bottom-centre, just left of the bet pad (Figma design) -->
			<button
				class="ls-buy"
				type="button"
				disabled={isInBonus && !isAnyModeActive}
				onclick={isAnyModeActive ? handleDeactivate : openBuyBonus}
				aria-label={isAnyModeActive ? 'Deactivate' : i18nDerived.buyBonus()}
			>
				<span class="ls-buy__label" use:fitLabel={{ dep: isAnyModeActive ? i18nDerived.deactivate() : i18nDerived.buyBonus(), maxFraction: 0.6 }}>{isAnyModeActive ? i18nDerived.deactivate() : i18nDerived.buyBonus()}</span>
			</button>

			<!-- Bottom-centre bet pad: − value + -->
			<div class="ls-bet">
				<button
					class="ls-step"
					type="button"
					onclick={onDecrease}
					disabled={disableDecrease}
					aria-label="Decrease bet"
				>
					<img class="ls-icon" src={iconMinus} alt="minus" />
				</button>
				<span
					class="ls-bet__value"
					class:value--feature={isAnyModeActive}
					use:fitText={formattedBet}
				>{formattedBet}</span>
				<button
					class="ls-step"
					type="button"
					onclick={onIncrease}
					disabled={disableIncrease}
					aria-label="Increase bet"
				>
					<img class="ls-icon" src={iconPlus} alt="plus" />
				</button>
			</div>

			<!-- Right rail: menu, sound, spin, turbo, autospin -->
			<div class="ls-right">
				<button class="ls-round" type="button" onclick={openRules} aria-label="Game rules">
					<img class="ls-icon" src={iconMenu} alt="menu" />
				</button>
				<button class="ls-round" type="button" onclick={toggleSound} aria-label="Sound">
					<img class="ls-icon" src={iconSound} alt="sound" class:is-muted={isMuted} />
				</button>
				<button
					class="ls-spin"
					type="button"
					onclick={onSpinButton}
					aria-label="Spin"
					disabled={canInteract && !hasAuto && !canAffordBet}
				>
					{#if !isSpinStop}
						<img src={iconSpin} alt="" class="ls-spin__icon" />
					{/if}
					{#if hasAuto}
						<span class="ls-spin__count">{autoSpinsRemainingText}</span>
					{:else if isSpinStop}
						<img src={iconStop} alt="" class="ls-spin__stop" aria-hidden="true" />
					{/if}
				</button>
				<button
					class="ls-round ls-round--turbo"
					class:turbo-fast={stateBet.isTurbo && !stateBet.isSuperTurbo}
					class:turbo-super={stateBet.isSuperTurbo}
					type="button"
					onclick={onTurbo}
					aria-label={i18nDerived.turboLabel()}
				>
					<img class="ls-icon" src={turboIcon} alt="turbo" />
				</button>
				<button
					class="ls-round"
					class:active={hasAuto}
					type="button"
					onclick={onAuto}
					disabled={disableAuto}
					aria-label={i18nDerived.autoplayLabel()}
				>
					<img class="ls-icon" src={iconAuto} alt="auto" />
				</button>
			</div>
		</div>
	{/if}
	<div class="hud-bottom">
		<div class="hud-left">
			<div class="hud-system">
				<button
					class="nav-btn nav-btn--framed"
					type="button"
					onclick={openRules}
					aria-label="Game rules"
				>
					<img class="nav-icon" src={iconMenu} alt="menu" />
				</button>
				<button
					class="nav-btn nav-btn--framed"
					type="button"
					onclick={toggleSound}
					aria-label="Sound"
				>
					<img class="nav-icon" src={iconSound} alt="sound" class:is-muted={isMuted} />
				</button>
			</div>

			<div class="hud-buy">
				<button
					class="buy-btn"
					type="button"
					disabled={isInBonus && !isAnyModeActive}
					onclick={isAnyModeActive ? handleDeactivate : openBuyBonus}
					aria-label={isAnyModeActive ? 'Deactivate' : i18nDerived.buyBonus()}
				>
					<span class="buy-btn__label" use:fitLabel={isAnyModeActive ? i18nDerived.deactivate() : i18nDerived.buyBonus()}>{isAnyModeActive ? i18nDerived.deactivate() : i18nDerived.buyBonus()}</span>
				</button>
			</div>
		</div>

		<div class="hud-stats">
			<div class="value-pill value-pill--balance">
				<div class="label label--balance">
					<span class="label-text">{i18nDerived.balance()}</span>
				</div>
				<div class="value-fit">
					<span class="value" use:fitText={formattedBalance}>{formattedBalance}</span>
				</div>
			</div>

			<div
				class="value-pill value-pill--bet bet-pill"
			>
				<span class="bet-coin" aria-hidden="true">
					<img src={iconCoins} alt="" />
				</span>
				<div class="bet-values">
					<span class="label">{i18nDerived.betLabel()}</span>
					<div class="value-fit value-fit--bet">
						<span class="value" class:value--feature={isAnyModeActive} use:fitText={formattedBet}>{formattedBet}</span>
					</div>
				</div>
			</div>
		</div>

		<div class="hud-controls">
			<div class="stepper">
				{#if isLandscapeMobile}
					<button
						class="nav-btn nav-btn--framed"
						type="button"
						onclick={openRules}
						aria-label="Game rules"
					>
						<img class="nav-icon" src={iconMenu} alt="menu" />
					</button>
					<button
						class="nav-btn nav-btn--framed"
						type="button"
						onclick={toggleSound}
						aria-label="Sound"
					>
						<img class="nav-icon" src={iconSound} alt="sound" class:is-muted={isMuted} />
					</button>
				{/if}
				<button
					class="nav-btn nav-btn--framed"
					type="button"
					onpointerdown={(event) =>
						startHoldRepeat(event, onDecrease, () => stepBet(-1, { playSound: false }))}
					onpointerup={clearHoldRepeat}
					onpointercancel={clearHoldRepeat}
					onpointerleave={clearHoldRepeat}
					onclick={(event) => maybeRunClickAction(event, onDecrease)}
					disabled={disableDecrease}
					aria-label="Decrease bet"
				>
					<img class="nav-icon" src={iconMinus} alt="minus" />
				</button>
				<button
					class="nav-btn nav-btn--framed"
					type="button"
					onpointerdown={(event) =>
						startHoldRepeat(event, onIncrease, () => stepBet(1, { playSound: false }))}
					onpointerup={clearHoldRepeat}
					onpointercancel={clearHoldRepeat}
					onpointerleave={clearHoldRepeat}
					onclick={(event) => maybeRunClickAction(event, onIncrease)}
					disabled={disableIncrease}
					aria-label="Increase bet"
				>
					<img class="nav-icon" src={iconPlus} alt="plus" />
				</button>
			</div>

			<div class="play-cluster">
				<button
					class="spin-btn"
					type="button"
					onclick={onSpinButton}
					aria-label="Spin"
					disabled={canInteract && !hasAuto && !canAffordBet}
				>
					{#if !isSpinStop}
						<img src={iconSpin} alt="" class="spin-btn__icon" />
					{/if}
					{#if hasAuto}
						<span
							class="spin-btn__count"
							aria-label={`Remaining auto spins ${autoSpinsRemainingText}`}
							>{autoSpinsRemainingText}</span
						>
					{:else if isSpinStop}
						<img src={iconStop} alt="" class="spin-btn__stop" aria-hidden="true" />
					{/if}
				</button>
			</div>

			<div class="action-cluster">
				<button
					class="nav-btn nav-btn--framed nav-btn--turbo"
					class:turbo-fast={stateBet.isTurbo && !stateBet.isSuperTurbo}
					class:turbo-super={stateBet.isSuperTurbo}
					type="button"
					onclick={onTurbo}
					aria-label={i18nDerived.turboLabel()}
				>
					<img class="nav-icon" src={turboIcon} alt="turbo" />
				</button>
				<button
					class="nav-btn nav-btn--framed"
					class:active={hasAuto}
					type="button"
					onclick={onAuto}
					disabled={disableAuto}
					aria-label={i18nDerived.autoplayLabel()}
				>
					<img class="nav-icon" src={iconAuto} alt="auto" />
				</button>
			</div>
		</div>
	</div>
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
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 8px;
		z-index: 20;
		font-family: 'Cinzel', serif;
	}

	/* Dark shelf behind the bottom bar — masks the gray full-width element that
	   sits below the HUD (proven by diagnostic that a z5 layer fully covers it),
	   blending up into the forest. The bar (z6) renders on top. */
	.hud-shell::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		height: 120px;
		z-index: 5;
		pointer-events: none;
		background: linear-gradient(to top, #070b06 0%, #070b06 78%, rgba(7, 11, 6, 0) 100%);
	}

	/* Landscape has no wooden bottom bar — drop the dark shelf so the forest shows behind
	   the bottom controls (Figma 2682-3639) instead of a black band. */
	.hud-shell[data-layout='landscape']::after {
		display: none;
	}

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
		font-family: 'Cinzel', serif;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: 0.1em;
	}

	.scatter-card__text {
		font-family: 'Cinzel', serif;
		font-size: 0.8rem;
		font-weight: 700;
		line-height: 1.3;
		text-shadow: 0 2px 8px rgba(0, 0, 0, 0.65);
	}

	.scatter-card__text--hot {
		color: #ff4b4b;
	}

	.scatter-card__text .space {
		height: 12px;
	}

	.hud-bottom {
		position: relative;
		z-index: 6;
		align-self: center;
		margin-top: auto;
		width: min(calc(100% - 16px), 1180px);
		height: auto;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		/* Tighter side padding so the icon clusters sit nearer the bar ends,
		   leaving more room in the middle for long balance/bet values. */
		padding: 8px 48px;
		/* Dark stadium base fills the whole box so no white bleeds through
		   the transparent areas around the 9-sliced wooden pill on top. */
		background: #0f0b06;
		border-radius: 999px;
		box-shadow: none;
	}

	/* Wooden bar background, 9-sliced so the rounded caps stay crisp */
	.hud-bottom::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		box-sizing: border-box;
		border-style: solid;
		border-color: transparent;
		border-width: 26px 70px;
		border-image-source: var(--menu-bar-bg);
		border-image-slice: 120 380 fill;
		border-image-width: 26px 70px;
		border-image-repeat: stretch;
		pointer-events: none;
	}

	.hud-bottom > * {
		position: relative;
		z-index: 1;
	}

	.hud-left {
		display: flex;
		align-items: center;
		gap: 18px;
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
		gap: 22px;
		flex: 0 0 auto;
		padding-top: 0;
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
		padding: 0 16px;
		/* Fixed footprint: a long balance scales to fit the slot (see fitText)
		   instead of widening the pill, so it can never push the navigation. */
		flex: 0 0 auto;
		width: 150px;
		border-left: none;
	}

	.value-pill--balance .label--balance {
		line-height: 1;
		justify-content: flex-start;
	}

	.value-pill--balance .value {
		line-height: 1;
	}

	/* Fixed slots that the balance/bet are scaled to fit (see fitText) so a long
	   value can never widen the bar and push the navigation. */
	.value-fit {
		max-width: 150px;
		overflow: hidden;
	}

	.value-fit--bet {
		max-width: 132px;
	}

	.value-fit .value {
		display: inline-block;
		white-space: nowrap;
	}

	.value-pill--bet {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 6px;
		padding: 0 16px;
		border-left: 1px solid rgba(255, 255, 255, 0.3);
		flex: 0 0 auto;
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

	.bet-coin {
		pointer-events: none;
		width: 44px;
		height: 44px;
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

	.label {
		font-family: 'Poppins', sans-serif;
		font-size: 0.8125rem; /* 13px */
		font-weight: 500;
		letter-spacing: 0.03em;
		/* Golden gradient clipped to the BALANCE / BET label text */
		background: linear-gradient(184deg, #ffa90e 15.26%, #ee960b 69.74%, #d18005 92.88%);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
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
		font-family: 'Poppins', sans-serif;
		font-size: 1.125rem; /* 18px */
		font-weight: 500;
		letter-spacing: 0.03em; /* 0.54px @ 18px */
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

	.circle-btn:not(:disabled):hover,
	.buy-btn:not(:disabled):hover {
		transform: translateY(-1px);
		filter: brightness(1.1);
	}

	.circle-btn:not(:disabled):active,
	.buy-btn:not(:disabled):active {
		transform: translateY(1px) scale(0.95);
	}

	.buy-btn {
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}

	.circle-btn,
	.spin-btn,
	.buy-btn {
		display: grid;
		place-items: center;
	}

	.circle-btn:focus,
	.spin-btn:focus,
	.buy-btn:focus {
		outline: none;
	}

	/* Image buttons — icon-less frame background + gold icon layered on top */
	.nav-btn {
		width: 60px;
		height: 60px;
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

	/* Round wooden frame behind utility buttons */
	.nav-btn--framed {
		background: var(--btn-round-bg) center / contain no-repeat;
	}

	/* Gold icon sized to sit inside the frame */
	.nav-btn--framed .nav-icon {
		width: 46%;
		height: 46%;
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

	/* Menu + sound buttons, docked at the left of the bottom bar */
	.hud-system {
		display: flex;
		align-items: center;
		gap: 8px;
		flex: 0 0 auto;
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

	.label-icon-frame .pill-icon {
		width: 20px;
		height: 20px;
		margin-right: 0;
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

	.action-cluster .circle-btn--icon .btn-icon {
		width: 18px;
		height: 18px;
	}

	.circle-btn.active,
	.circle-btn:disabled {
		opacity: 0.65;
	}

	/* Fast mode: slightly lit, warm hint */
	.circle-btn--turbo.turbo-fast {
		opacity: 1;
		filter: drop-shadow(0 0 3px rgba(255, 200, 80, 0.5));
	}
	.circle-btn--turbo.turbo-fast .btn-icon {
		filter: brightness(1.15) sepia(0.15) saturate(1.5);
	}

	/* Turbo mode: bright gold glow */
	.circle-btn--turbo.turbo-super {
		opacity: 1;
		filter: drop-shadow(0 0 6px #ffd84a) drop-shadow(0 0 12px rgba(255, 216, 74, 0.5));
	}
	.circle-btn--turbo.turbo-super .btn-icon {
		filter: brightness(1.5) sepia(0.3) saturate(2.5) hue-rotate(5deg);
	}

	.spin-btn {
		width: 122px;
		height: 122px;
		/* Negative margins keep the big button from inflating the bar height;
		   it protrudes above the wooden bar as the focal control. */
		margin: -22px 0;
		border: none;
		background: var(--btn-spin-bg) center / contain no-repeat;
		padding: 0;
		outline: none;
		cursor: pointer;
		display: grid;
		place-items: center;
		/* Centered vertically within the wooden bar (no upward lift). */
		transform: translateY(0);
		position: relative;
		z-index: 3;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}

	.spin-btn__icon {
		width: 42%;
		height: 42%;
		object-fit: contain;
		display: block;
		pointer-events: none;
		/* The green disc sits slightly below the asset's box center, so nudge the icon
		   down to center it on the disc. */
		transform: translateY(7%);
	}

	.spin-btn:not(:disabled):hover {
		transform: translateY(-2px);
		filter: brightness(1.08);
	}

	.spin-btn:not(:disabled):active {
		transform: translateY(0) scale(0.96);
	}

	.spin-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* Stop / autospin-count overlays sit on the green disc, over the spin icon */
	.spin-btn__glyph,
	.spin-btn__count {
		position: absolute;
		/* match the disc center (slightly below box center) like .spin-btn__icon */
		top: 50%;
		left: 50%;
		width: 56%;
		height: 56%;
		transform: translate(-50%, -50%);
		display: grid;
		place-items: center;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(20, 48, 8, 0.96) 60%, rgba(20, 48, 8, 0) 100%);
		color: #fff;
		font-family: Cinzel, serif;
		font-weight: 900;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
		pointer-events: none;
	}

	.spin-btn__glyph {
		font-size: 2rem;
	}

	/* Gold stop tile shown over the green disc while spinning (replaces the ■ glyph). */
	.spin-btn__stop {
		position: absolute;
		/* Anchor to the green disc's visual center in btn_bg_spin.png (slightly right of
		   and above the button box center) so the square sits centered on the disc. */
		top: 48.5%;
		left: 51.2%;
		width: 30%;
		aspect-ratio: 1;
		transform: translate(-50%, -50%);
		object-fit: contain;
		pointer-events: none;
		filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.55));
	}

	.spin-btn__count {
		font-size: 1.5rem;
	}

	.buy-btn {
		width: 130px;
		height: auto;
		aspect-ratio: 730 / 267;
		border: 0;
		background: var(--buy-btn-bg) center / 100% 100% no-repeat;
		padding: 0 14px;
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

	.buy-btn:disabled {
		opacity: 0.45;
		cursor: default;
		filter: grayscale(0.35);
	}

	.buy-btn__label {
		font-family: 'Poppins', sans-serif;
		font-size: 0.95rem;
		font-weight: 600;
		letter-spacing: 0.03em;
		white-space: nowrap;
		/* Golden gradient clipped to the BUY BONUS text */
		background: linear-gradient(184deg, #ffa90e 15.26%, #ee960b 69.74%, #d18005 92.88%);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.75));
		line-height: 1;
		pointer-events: none;
	}

	@media (max-width: 1100px) {
		.scatter-card {
			display: none;
		}

		/* Laptop widths (e.g. 1024px): tighten padding/gaps only (keep the button/bar height) so the
		   spin + turbo buttons don't overflow the right end of the bar. */
		.hud-bottom {
			width: min(calc(100% - 16px), 1120px);
			/* Extra right padding nudges the spin/turbo/autoplay cluster in from the right end; taller
			   top/bottom padding gives the wooden bar a bit more height. */
			padding: 14px 48px 14px 16px;
			gap: 8px;
		}

		.hud-controls {
			gap: 12px;
		}

		/* Tighten the balance→bet gap: hug the balance value and trim the bet pill's side padding. */
		.value-pill--balance {
			width: 116px;
			padding: 0 12px;
		}
		.value-fit {
			max-width: 116px;
		}
		.value-pill--bet {
			padding: 0 12px;
		}

		/* Shrink the focal spin button so it protrudes less above/below the bar (its negative margins
		   mean this doesn't change the bar height). */
		.spin-btn {
			width: 100px;
			height: 100px;
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

	/* Landscape uses the dedicated .ls-hud block below; the generic bottom bar is hidden. */
	.hud-shell[data-layout='landscape'] .hud-bottom {
		display: none;
	}

	/* ===== Mobile-landscape HUD (Figma 2682-3639) ===== */
	.ls-hud {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 20;
		font-family: 'Cinzel', serif;
		/* How far the bottom controls (bet pad + BUY BONUS) drop toward the bottom edge. Both use
		   this so they stay vertically centre-aligned with each other. */
		--ls-drop: 4px;
	}
	.ls-hud button,
	.ls-hud .ls-bet__value {
		pointer-events: auto;
	}

	/* Left rail: BUY BONUS + BALANCE, bottom-left */
	.ls-left {
		position: absolute;
		left: 4px;
		bottom: 14px;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
	}
	.ls-buy {
		/* Wide green desktop-style button (btn_bg_wide.png, 730×267), scaled down for landscape.
		   Sits at the bottom centre, just left of the bet pad. */
		position: absolute;
		/* Anchor the button's bottom edge to the bet pad's vertical centre (pad: bottom 0, height
		   clamp(70px,10.5vh,88px)), then translateY(50%) drops it by half its own height so the two
		   centres line up regardless of the button's rendered height. */
		bottom: calc(clamp(70px, 10.5vh, 88px) / 2 - var(--ls-drop));
		left: 37%;
		transform: translate(-50%, 50%);
		box-sizing: border-box;
		width: clamp(120px, 15vw, 168px);
		height: auto;
		aspect-ratio: 730 / 267;
		border: 0;
		padding: 0;
		cursor: pointer;
		background: var(--buy-btn-bg) center / 100% 100% no-repeat;
		transition: filter 0.12s ease, transform 0.12s ease;
	}
	.ls-buy:not(:disabled):hover { filter: brightness(1.1); transform: translate(-50%, calc(50% - 1px)); }
	.ls-buy:disabled { opacity: 0.45; filter: grayscale(0.35); cursor: default; }
	.ls-buy__label {
		/* Centred on the green body: the button art has leaves along the bottom, so the body centre is
		   above the element centre. Absolute % is relative to the button height → stable at any size. */
		position: absolute;
		left: 50%;
		top: 43%;
		transform: translate(-50%, -50%);
		font-family: 'Poppins', sans-serif;
		font-size: 0.82rem;
		font-weight: 600;
		line-height: 1;
		letter-spacing: 0.03em;
		white-space: nowrap;
		text-align: center;
		background: linear-gradient(184deg, #ffd84a 10%, #ffa90e 60%, #d18005 95%);
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.75));
	}
	.ls-balance {
		display: flex;
		align-items: baseline;
		gap: 8px;
	}
	.ls-balance__label {
		font-family: 'Poppins', sans-serif;
		font-size: 12px;
		font-style: normal;
		font-weight: 500;
		line-height: normal;
		letter-spacing: 0.36px;
		background: var(--golden-gradient, linear-gradient(184deg, #ffa90e 15.26%, #ee960b 69.74%, #d18005 92.88%));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.ls-balance__value {
		font-family: 'Poppins', sans-serif;
		font-weight: 600;
		font-size: 0.8rem;
		color: #fff;
	}

	/* Bottom-centre bet pad: − value + */
	.ls-bet {
		position: absolute;
		/* Shifted right of centre; BUY BONUS sits to its left (Figma design). */
		left: 61%;
		bottom: calc(-1 * var(--ls-drop));
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		/* Bigger pad; buttons sit just inside the rounded ends (small inset) via the value's auto margins. */
		height: clamp(70px, 10.5vh, 88px);
		width: clamp(205px, 39vh, 310px);
		padding: 0 1.0%;
		box-sizing: border-box;
		border: 0;
		background: var(--ls-betpad) center / 100% 100% no-repeat;
	}
	.ls-bet__value {
		font-family: 'Poppins', sans-serif;
		font-weight: 700;
		font-size: 1.1rem;
		color: #fff;
		/* Auto side margins centre the value and push the two buttons to the pill ends. */
		margin: 0 auto;
		flex: 0 0 auto;
		white-space: nowrap;
		text-align: center;
	}
	/* Same technique as .ls-round (which renders as a proper circle): normal-flow square button.
	   The absolute-positioning version was rendering as an oval. */
	.ls-step {
		width: clamp(48px, 8vh, 66px);
		height: clamp(48px, 8vh, 66px);
		flex: 0 0 auto;
		border: 0;
		background: var(--btn-round-bg) center / contain no-repeat;
		padding: 0;
		cursor: pointer;
		display: grid;
		place-items: center;
		transition: filter 0.12s ease;
	}
	.ls-step:not(:disabled):hover { filter: brightness(1.1); }
	.ls-step:disabled { opacity: 0.45; cursor: default; }
	.ls-step .ls-icon { width: 44%; height: 44%; object-fit: contain; }

	/* Right rail: menu, sound, spin, turbo, autospin (vertical bar) */
	.ls-right {
		position: absolute;
		right: 10px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(6px, 1.4vh, 12px);
		padding: 18px 8px;
		background: var(--ls-rightbar) center / 100% 100% no-repeat;
	}
	.ls-round {
		width: clamp(40px, 5vh, 52px);
		height: clamp(40px, 5vh, 52px);
		border: 0;
		background: var(--btn-round-bg) center / contain no-repeat;
		padding: 0;
		cursor: pointer;
		display: grid;
		place-items: center;
		transition: filter 0.12s ease, transform 0.12s ease;
	}
	.ls-round:not(:disabled):hover { filter: brightness(1.1); }
	.ls-round:disabled { opacity: 0.5; cursor: default; }
	.ls-round .ls-icon { width: 46%; height: 46%; object-fit: contain; }
	.ls-round .ls-icon.is-muted { opacity: 0.55; }

	.ls-spin {
		width: clamp(72px, 11vh, 104px);
		height: clamp(72px, 11vh, 104px);
		border: 0;
		background: var(--ls-spin) center / contain no-repeat;
		padding: 0;
		cursor: pointer;
		position: relative;
		display: grid;
		place-items: center;
		transition: filter 0.12s ease, transform 0.12s ease;
	}
	.ls-spin:not(:disabled):hover { filter: brightness(1.08); }
	.ls-spin:disabled { opacity: 0.5; cursor: default; }
	.ls-spin__icon { width: 42%; height: 42%; object-fit: contain; transform: translateY(7%); }
	.ls-spin__stop {
		position: absolute;
		top: 48.5%;
		left: 51.2%;
		width: 30%;
		aspect-ratio: 1;
		transform: translate(-50%, -50%);
		object-fit: contain;
	}
	.ls-spin__count {
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		font-weight: 800;
		font-size: 1.1rem;
		color: #fff;
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

	.hud-shell[data-layout='landscape'] .buy-btn__amount {
		font-size: 0.65rem;
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

	/* ==================== Portrait mobile HUD (Figma 2792-4133) ==================== */
	.hud-shell[data-layout='portrait'] { padding: 0; }
	.hud-shell[data-layout='portrait'] .hud-bottom { display: none; }

	.pt-hud {
		position: absolute;
		left: 0; right: 0; bottom: 0;
		z-index: 6;
		pointer-events: auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 0 12px calc(10px + env(safe-area-inset-bottom, 0px));
	}

	/* --- control row: menu·sound · SPIN · turbo·auto --- */
	.pt-controls {
		position: relative;
		width: min(412px, 97vw);
		/* Scale the bar height with the buttons (spin is 24vw) so the spin keeps protruding above/below
		   the wood with its leaves on small screens instead of shrinking to sit flat inside the bar. */
		height: clamp(64px, 20vw, 78px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		/* Vertical padding matches the wood ::before insets (8px top / 2px bottom) so the buttons
		   centre on the wood bar itself, not the full box (which left them sitting above centre). */
		padding: 8px clamp(10px, 4vw, 20px) 2px;
		box-sizing: border-box;
	}
	.pt-controls::before {
		content: '';
		position: absolute;
		left: 0; right: 0; top: 8px; bottom: 2px;
		background: var(--pt-navpad) center / 100% 100% no-repeat;
		z-index: -1;
	}
	/* Buttons scale down on narrow screens so the whole row keeps fitting inside the bar —
	   otherwise the fixed-width set overflows and space-between packs everything to the left. */
	.pt-grp { display: flex; align-items: center; gap: clamp(8px, 3vw, 16px); }

	.pt-round {
		width: clamp(38px, 12vw, 46px); height: clamp(38px, 12vw, 46px);
		border: 0; padding: 0; cursor: pointer;
		background: var(--btn-round-bg) center / contain no-repeat;
		display: grid; place-items: center;
		flex: 0 0 auto;
		transition: transform 0.12s ease, filter 0.12s ease;
	}
	.pt-round--sm { width: clamp(34px, 11vw, 42px); height: clamp(34px, 11vw, 42px); }
	.pt-round:not(:disabled):hover { filter: brightness(1.12); }
	.pt-round:not(:disabled):active { transform: translateY(1px) scale(0.94); }
	.pt-round:disabled { opacity: 0.45; cursor: default; }
	.pt-round.active { filter: drop-shadow(0 0 6px rgba(120,220,90,0.85)); }
	.pt-icon { width: 52%; height: 52%; object-fit: contain; pointer-events: none; }
	.pt-icon.is-muted { opacity: 0.4; }
	.pt-round--turbo.turbo-fast { filter: drop-shadow(0 0 5px rgba(255,210,80,0.85)); }
	.pt-round--turbo.turbo-super { filter: drop-shadow(0 0 7px rgba(120,220,90,0.95)); }

	.pt-spin {
		width: clamp(76px, 24vw, 94px); height: clamp(76px, 24vw, 94px);
		margin-top: 0; /* vertically centred on the control bar */
		border: 0; padding: 0; cursor: pointer;
		background: var(--pt-spin) center / contain no-repeat;
		display: grid; place-items: center;
		flex: 0 0 auto;
		position: relative;
		transition: transform 0.12s ease, filter 0.12s ease;
	}
	.pt-spin:not(:disabled):hover { filter: brightness(1.1); }
	.pt-spin:not(:disabled):active { transform: scale(0.96); }
	.pt-spin:disabled { opacity: 0.5; cursor: default; }
	.pt-spin__icon { width: 42%; height: 42%; object-fit: contain; } /* arrow overlay (base has none) */
	.pt-spin__stop { width: 30%; height: 30%; object-fit: contain; }
	.pt-spin__count {
		font-family: 'Cinzel', serif; font-weight: 900; font-size: 1.3rem; color: #fff;
		text-shadow: 0 2px 4px rgba(0,0,0,0.7);
	}

	/* --- stats row: BALANCE · (− bet +) · BUY BONUS ---
	   Centred as a group with equal gaps (not pinned to the edges). */
	.pt-stats {
		width: min(400px, 96vw);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(8px, 3.5vw, 18px);
	}
	/* Balance: transparent (no pad), centred label + gold value. */
	.pt-balance {
		flex: 0 0 auto;
		max-width: clamp(104px, 34vw, 140px);
		display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		gap: 1px;
		min-width: 0;
		overflow: hidden;
	}
	.pt-balance__label {
		font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 10px;
		letter-spacing: 0.04em; white-space: nowrap;
		color: #f3e7cf;
	}
	.pt-balance__value {
		font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 14px;
		white-space: nowrap; transform-origin: center;
		background: linear-gradient(184.14deg, #ffa90e 15.26%, #ee960b 69.74%, #d18005 92.88%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
	}

	/* Bet pill: dark rounded pad with − value + (no BET label, per Figma) */
	.pt-bet {
		flex: 0 0 auto;
		display: flex; align-items: center; justify-content: space-between;
		gap: 4px;
		width: clamp(140px, 45vw, 164px); height: clamp(48px, 15vw, 56px);
		padding: 0 7px;
		box-sizing: border-box;
		background: var(--pt-betpad) center / 100% 100% no-repeat;
	}
	.pt-bet__value {
		font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 16px; color: #fff;
		white-space: nowrap; cursor: pointer; transform-origin: center;
		text-shadow: 0 1px 2px rgba(0,0,0,0.6);
	}
	.pt-bet__value.value--feature { color: #ffd84a; }

	/* Buy bonus: round green badge with 2-line label inside */
	.pt-buy {
		flex: 0 0 auto;
		width: clamp(54px, 17vw, 62px); height: clamp(50px, 16vw, 58px);
		border: 0; padding: 0; cursor: pointer;
		background: var(--pt-buybonus) center / contain no-repeat;
		display: grid; place-items: center;
		transition: filter 0.12s ease, transform 0.12s ease;
	}
	.pt-buy:hover { filter: brightness(1.1); }
	.pt-buy:active { transform: scale(0.95); }
	.pt-buy__label {
		font-family: 'Cinzel', serif; font-weight: 900; font-size: 8.5px; line-height: 1.05;
		letter-spacing: 0.01em; text-align: center;
		max-width: 66%;
		background: linear-gradient(184.14deg, #ffa90e 15.26%, #ee960b 69.74%, #d18005 92.88%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
		filter: drop-shadow(0 1px 1px rgba(0,0,0,0.7));
	}
</style>
