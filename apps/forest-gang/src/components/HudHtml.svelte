<script lang="ts">
	import { OnHotkey } from 'components-shared';
	import { stateBet, stateBetDerived, stateConfig, stateModal, stateSound } from 'state-shared';
	import { onDestroy } from 'svelte';
	import { Tween } from 'svelte/motion';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

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

	// Frame backgrounds — passed as CSS vars because url() in style blocks can't use runtime paths
	const menuBtnFrame = ap('/assets/components/frames/top_menu-button_frame.webp');
	const soundBtnFrame = ap('/assets/components/frames/top_sound_button_frame.webp');
	const menuBarFrame = ap('/assets/components/navbar/bar.webp');
	const menuPopupBg = ap('/assets/components/frames/menu_popup.webp'); // wooden plaque (Figma 3311-2924)

	// Button backgrounds (icon-less frames) — icons are layered on top in markup
	const btnRoundBg = ap('/assets/components/navbar/btn_bg_round.png'); // wooden round — utility buttons
	const btnSpinBg = ap('/assets/components/navbar/btn_bg_spin.webp?v=20260720'); // green round — spin
	const btnSpinHoverBg = ap('/assets/components/navbar/btn_bg_spin_hover.webp?v=20260720'); // spin hover
	const btnWideBg = ap('/assets/components/navbar/btn_bg_wide.png?v=20260720'); // wide green — buy bonus
	const btnWideHoverBg = ap('/assets/components/navbar/btn_bg_wide_hover.png?v=20260720'); // buy hover
	// Portrait/mobile pads (Figma 2792-4133)
	// Mobile-landscape HUD art (Figma 2682-3639)
	const lsRightBar = ap('/assets/components/symbols/landscape/right_bar.webp?v=20260715'); // vertical control bar
	const lsBetPad = ap('/assets/components/symbols/landscape/stepper_pad.png'); // − value + bottom pad
	const lsBuyBonus = ap('/assets/components/symbols/landscape/buy_bonus.png'); // round green badge
	const navPadMobile = ap('/assets/components/navbar/nav_pad_mobile.webp'); // control-bar pill
	const betPadMobile = ap('/assets/components/navbar/bet_pad_mobile.png'); // − value + pill
	const buyBonusMobile = ap('/assets/components/navbar/buy_bonus_mobile.png'); // round green badge
	const spinMobile = ap('/assets/components/navbar/spin_mobile.webp'); // green spin w/ leaves

	// Gold icons layered over the button backgrounds
	const iconMenu = ap('/assets/hud/icon-info.png');
	const iconMenuBars = ap('/assets/hud/icon-menu.png'); // hamburger — opens the portrait sound/info menu
	const iconSound = ap('/assets/hud/icon-volume.png');
	const iconSoundMuted = ap('/assets/hud/icon-volume-muted.png');
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
	const hudFrame = ap('/assets/components/frames/hud_frame.webp');
	const smallBtnFrame = ap('/assets/components/frames/lower_hud_button_frame.webp');
	const playBtnFrame = ap('/assets/components/frames/play_button-frame.webp');

	const scatterImg = ap('/assets/components/ui/scatter-panel-image.webp');

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
	// Buying a bonus is not allowed while a multi-spin bonus round is in progress.
	// Feature mode keeps its selected-symbol badge after the round, but should not lock the HUD.
	const isInBonus = $derived(context.stateGame.bonusMode !== null && context.stateGame.bonusMode !== 'feature');
	// BUY BONUS availability: blocked while a spin is running (incl. the bought bonus's own
	// trigger-spin reel animation, when bonusMode isn't set yet) and inside the bonus.
	const disableBuy = $derived((!canInteract || isInBonus) && !isAnyModeActive);
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

	// Portrait: the menu (☰) button opens a small popup holding Sound + Info instead of those
	// living on the bottom bar. Toggles to an ✕ while open.
	let menuOpen = $state(false);
	let menuPopEl = $state<HTMLElement | undefined>();
	let menuBtnEl = $state<HTMLElement | undefined>();
	const toggleMenu = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		menuOpen = !menuOpen;
	};
	// Close the popup on any interaction outside it (including pressing Spin — which then also spins).
	$effect(() => {
		if (!menuOpen) return;
		const onDown = (event: PointerEvent) => {
			const t = event.target as Node | null;
			if ((t && menuPopEl?.contains(t)) || (t && menuBtnEl?.contains(t))) return;
			menuOpen = false;
		};
		window.addEventListener('pointerdown', onDown, true);
		return () => window.removeEventListener('pointerdown', onDown, true);
	});

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
	const hasWin = $derived(context.stateGame.roundWin > 0);

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
			// Space actually left for the value: the slot minus what the preceding sibling
			// (label / minus-button) already occupies — but ONLY when that sibling sits on the
			// same row. In a column layout (portrait BALANCE: label ABOVE value) the value has the
			// full slot width, so subtracting the label there wrongly shrank it to nothing.
			const prev = node.previousElementSibling as HTMLElement | null;
			const sameRow = prev ? Math.abs(prev.offsetTop - node.offsetTop) < node.offsetHeight * 0.6 : false;
			const used = prev && sameRow ? prev.getBoundingClientRect().width + 8 : 0;
			const avail = slot.clientWidth - used;
			const full = node.scrollWidth;
			const scale = full > avail && avail > 0 ? avail / full : 1;
			node.style.transform = scale < 1 ? `scale(${scale})` : 'none';
		};
		const raf = () => requestAnimationFrame(fit);
		const ro = new ResizeObserver(raf);
		if (node.parentElement) ro.observe(node.parentElement);
		// Re-fit once the webfont arrives: the first fit measures fallback-font metrics, and a
		// fixed-width slot never resizes afterwards (so the observer alone can't catch it).
		document.fonts?.ready.then(raf);
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
	style={`--forest-card-bg:url('${heroCardBg}');--menu-btn-bg:url('${menuBtnFrame}');--sound-btn-bg:url('${soundBtnFrame}');--menu-bar-bg:url('${menuBarFrame}');--menu-popup-bg:url('${menuPopupBg}');--scatter-frame-bg:url('${scatterFrame}');--hud-frame-bg:url('${hudFrame}');--buy-btn-bg:url('${btnWideBg}');--small-btn-bg:url('${smallBtnFrame}');--play-btn-bg:url('${playBtnFrame}');--btn-round-bg:url('${btnRoundBg}');--btn-spin-bg:url('${btnSpinBg}');--btn-spin-hover-bg:url('${btnSpinHoverBg}');--buy-btn-hover-bg:url('${btnWideHoverBg}');--ls-spin-hover:url('${btnSpinHoverBg}');--pt-navpad:url('${navPadMobile}');--pt-betpad:url('${betPadMobile}');--pt-buybonus:url('${buyBonusMobile}');--pt-spin:url('${spinMobile}');--ls-rightbar:url('${lsRightBar}');--ls-betpad:url('${lsBetPad}');--ls-buybonus:url('${lsBuyBonus}');--ls-spin:url('${btnSpinBg}')`}
>
	{#if isPortrait}
		<!-- Dedicated portrait HUD (Figma mobile 2792-4133). Desktop/landscape markup below is untouched. -->
		<div class="pt-hud">
			<div class="pt-controls">
				<div class="pt-grp">
					<div class="pt-menu-wrap">
						<!-- Sound / Info popup — anchored directly above the ☰ menu button. -->
						{#if menuOpen}
							<div class="pt-menu-pop" role="menu" bind:this={menuPopEl}>
								<button class="pt-menu-item" type="button" role="menuitem" onclick={toggleSound}>
									<span class="pt-menu-item__ic">
										<img src={isMuted ? iconSoundMuted : iconSound} alt="" class:is-muted={isMuted} />
									</span>
									<span class="pt-menu-item__label">SOUND</span>
								</button>
								<button class="pt-menu-item" type="button" role="menuitem" onclick={openRules}>
									<span class="pt-menu-item__ic"><img src={iconMenu} alt="" /></span>
									<span class="pt-menu-item__label">INFO</span>
								</button>
							</div>
						{/if}
						<button class="pt-round" type="button" onclick={toggleMenu} aria-label="Menu" aria-expanded={menuOpen} bind:this={menuBtnEl}>
							{#if menuOpen}
								<span class="pt-round__x">✕</span>
							{:else}
								<img class="pt-icon" src={iconMenuBars} alt="menu" />
							{/if}
						</button>
					</div>
					<button
						class="pt-buy pt-buy--controls"
						type="button"
						disabled={disableBuy}
						onclick={isAnyModeActive ? handleDeactivate : openBuyBonus}
						aria-label={isAnyModeActive ? 'Deactivate' : i18nDerived.buyBonus()}
					>
						<span class="pt-buy__label" use:fitLabel={{ dep: isAnyModeActive ? i18nDerived.deactivate() : i18nDerived.buyBonus(), maxFraction: 0.58 }}>{isAnyModeActive ? i18nDerived.deactivate() : i18nDerived.buyBonus()}</span>
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

				<!-- WIN readout: shows the current spin win / running bonus total; cleared on next spin.
				     Hidden (but keeps its slot, so the bet stays centred) until there is a win. -->
				<div class="pt-win" class:pt-win--hidden={!hasWin}>
					<span class="pt-win__label">{i18nDerived.win()}</span>
					<span class="pt-win__value" use:fitText={winValue}>{hasWin ? winValue : ''}</span>
				</div>
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
				disabled={disableBuy}
				onclick={isAnyModeActive ? handleDeactivate : openBuyBonus}
				aria-label={isAnyModeActive ? 'Deactivate' : i18nDerived.buyBonus()}
			>
				<span class="ls-buy__label" use:fitLabel={{ dep: isAnyModeActive ? i18nDerived.deactivate() : i18nDerived.buyBonus(), maxFraction: 0.82 }}>{isAnyModeActive ? i18nDerived.deactivate() : i18nDerived.buyBonus()}</span>
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
					<img class="ls-icon" src={isMuted ? iconSoundMuted : iconSound} alt="sound" class:is-muted={isMuted} />
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

			<!-- WIN readout, bottom-right — mirrors the BALANCE block bottom-left. Same behavior as
			     portrait: current spin win / running bonus total, cleared on the next spin; keeps its
			     slot while hidden so nothing shifts. -->
			<div class="ls-win" class:ls-win--hidden={!hasWin}>
				<span class="ls-win__label">{i18nDerived.win()}</span>
				<span class="ls-win__value" use:fitText={winValue}>{hasWin ? winValue : ''}</span>
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
					<img class="nav-icon" src={isMuted ? iconSoundMuted : iconSound} alt="sound" class:is-muted={isMuted} />
				</button>
			</div>

			<div class="hud-buy">
				<button
					class="buy-btn"
					type="button"
					disabled={disableBuy}
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

			<!-- WIN readout next to BALANCE (same behavior as portrait): current spin win / running
			     bonus total, cleared on the next spin. Keeps its slot while hidden so nothing shifts. -->
			<div class="value-pill value-pill--win" class:value-pill--win-hidden={!hasWin}>
				<div class="label label--balance">
					<span class="label-text">{i18nDerived.win()}</span>
				</div>
				<div class="value-fit">
					<span class="value" use:fitText={winValue}>{hasWin ? winValue : ''}</span>
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

			<!-- − / + live right beside the BET value they change. -->
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
						<img class="nav-icon" src={isMuted ? iconSoundMuted : iconSound} alt="sound" class:is-muted={isMuted} />
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
		</div>

		<!-- The focal SPIN floats CENTERED in the free bar space between the + stepper (left)
		     and the turbo/auto pair (right) via its auto side margins. -->
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

		<div class="hud-controls">
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
					class="nav-btn nav-btn--framed nav-btn--auto"
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
		/* Fluid desktop-bar sizing: the bar and everything on it scale with viewport width
		   (growing until ~1900px, then capped) so wide screens get the chunky redesign bar
		   instead of sizes frozen at the 1200px breakpoint. Min sizes stay near the old
		   desktop sizes; the ~30% growth happens on wide screens where there's room. */
		--nav-s: clamp(53px, 5.3vw, 100px);
		--spin-s: clamp(121px, 13.2vw, 251px);
	}

	/* No dark shelf behind the bottom bar: the redesign forest background paints all
	   the way to the bottom edge and the wooden bar floats directly on it. */

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
		/* The bar is one fixed 1860px-wide design scaled uniformly: --u is the design-px
		   unit (1px at ≥1917px viewports, proportionally smaller below). Every size inside
		   the bar is a design px × --u, so laptops and the Stake iframe render the exact
		   desktop bar, just scaled — no per-breakpoint reflow, matching the Figma reference
		   (node 3406-4596) where the whole bar scales as one unit. */
		--u: calc(min(97vw, 1860px) / 1860);
		--nav-s: calc(var(--u) * 104);
		--spin-s: calc(var(--u) * 259);
		width: calc(var(--u) * 1860);
		height: auto;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: calc(var(--u) * 12);
		/* Vertical padding gives the bar its height (Figma: 125-tall bar on a 1150 span,
		   ×1.617 → 200 design px); side padding (74) is the row inset from the bar ends —
		   wider than the 70px end-cap art, so edge buttons clear the caps by construction. */
		padding: calc(var(--u) * 36) calc(var(--u) * 74);
		/* The wooden pill art (bar.webp) is fully opaque with its own dark-wood body, so no
		   background base is needed — a dark base used to peek past the art's silhouette and
		   read as a black halo around the bar. */
		background: none;
		border-radius: 0;
		box-shadow: none;
	}

	/* Wooden bar background. The bar's box is a fixed 1860×200 design (aspect 9.3),
	   essentially bar.webp's native 4600×500 (9.2) — so the art paints whole, un-sliced,
	   and the caps/vines keep exactly the original artwork proportions at every scale.
	   (The old 9-slice existed only because bar width used to vary independently of
	   height; with uniform --u scaling it distorted the cap art instead.) */
	.hud-bottom::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		background: var(--menu-bar-bg) center / 100% 100% no-repeat;
		pointer-events: none;
	}

	.hud-bottom > * {
		position: relative;
		z-index: 1;
	}

	.hud-left {
		display: flex;
		align-items: center;
		gap: calc(var(--u) * 10);
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
		gap: calc(var(--u) * 22);
		flex: 0 0 auto;
		padding-top: 0;
	}

	.value-pill {
		min-width: 0;
		padding: 0 calc(var(--u) * 5);
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
		padding: 0 calc(var(--u) * 12);
		/* Hug the actual balance text so the WIN readout sits right beside it; .value-fit's
		   max-width still caps very long balances (fitText scales them into that slot), so the
		   pill can never push the navigation. */
		flex: 0 0 auto;
		width: fit-content;
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
	   value can never widen the bar and push the navigation. The balance/bet slots are
	   pinned (px clamps tracking the vw-fluid value font ≈1.45vw): the pill can't hug
	   the text, so a changing amount ($1,000.00 → $999.40) never shifts the items to
	   its right — fitText scales longer values down into the slot instead. Sized with
	   ~8% headroom over the common values ($992.40 / $1.00) at every viewport — a
	   snugger slot clipped the balance, an oversized one left a gap before the
	   steppers and pushed the bar past its max width. */
	.value-fit {
		max-width: calc(var(--u) * 150);
		overflow: hidden;
	}

	.value-pill--balance .value-fit {
		width: calc(var(--u) * 126);
	}

	.value-fit--bet {
		width: calc(var(--u) * 90);
		max-width: none;
	}

	.value-fit .value {
		display: inline-block;
		white-space: nowrap;
	}

	/* WIN mirrors the balance pill, sitting tight against it behind a thin divider. Hugs its
	   text (like balance) so BET stays close; the min-width keeps a small slot while hidden. */
	.value-pill--win {
		align-items: flex-start;
		padding: 0 calc(var(--u) * 12);
		flex: 0 0 auto;
		width: fit-content;
		min-width: calc(var(--u) * 96);
		border-left: 1px solid rgba(255, 255, 255, 0.3);
	}

	.value-pill--win .label--balance {
		line-height: 1;
		justify-content: flex-start;
	}

	.value-pill--win .value {
		line-height: 1;
		/* Reserve the value's line even while empty so the bar height never jumps. */
		min-height: 1em;
	}

	/* No win yet → keep the slot (nothing shifts) but show nothing. */
	.value-pill--win-hidden {
		visibility: hidden;
	}

	.value-pill--bet {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: calc(var(--u) * 6);
		padding: 0 calc(var(--u) * 12);
		/* Nudge the BET block right off the WIN slot (design ask). */
		margin-left: calc(var(--u) * 10);
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
		width: calc(var(--u) * 52);
		height: calc(var(--u) * 52);
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
		font-size: calc(var(--u) * 18);
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
		font-size: calc(var(--u) * 26);
		font-weight: 500;
		letter-spacing: 0.03em; /* 0.54px @ 18px */
		/* Uniform digit widths so the fixed ch-sized balance/bet slots line up exactly
		   and single-digit changes can't jog the text inside the slot. */
		font-variant-numeric: tabular-nums;
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
		gap: calc(var(--u) * 15);
		padding-top: 0;
	}

	/* The whole BET block (coin + value + steppers) sits shifted toward the central spin as one
	   unit — the internal spacing between them stays fixed. */
	.hud-stats .value-pill--bet {
		margin-left: calc(var(--u) * 6);
	}

	/* The − / + pair (kept snug together, matching the turbo↔auto spacing) sits shifted a bit
	   right of the BET value, toward the central spin. */
	.hud-stats .stepper {
		margin-left: calc(var(--u) * 8);
	}

	/* Figma keeps turbo↔autoplay at the plain cluster gap — no extra drift. */

	/* Match the − / + spacing to the turbo↔autoplay spacing. */
	.stepper {
		gap: calc(var(--u) * 20);
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
		width: var(--nav-s);
		height: var(--nav-s);
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
		opacity: 1;
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
		gap: calc(var(--u) * 10);
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
		width: var(--spin-s);
		height: var(--spin-s);
		/* The bar is a space-between flex row: without shrink protection the button is the only
		   child that gives way, collapsing the leafy disc to a sliver on laptop widths. */
		flex: 0 0 auto;
		/* Negative vertical margins make the disc contribute exactly one nav-button height to the
		   bar (it protrudes above/below as the focal control); the auto side margins split the
		   free bar space equally, centering the disc between the + stepper and the turbo button. */
		margin: calc((var(--nav-s) - var(--spin-s)) / 2) auto;
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
		/* Centre the icon on the green disc of btn_bg_spin.png (disc centre ≈ 53% of the box). */
		transform: translateY(4%);
	}

	.spin-btn:not(:disabled):hover {
		transform: translateY(-2px);
		background-image: var(--btn-spin-hover-bg);
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
		font-size: calc(var(--u) * 32);
	}

	/* Gold stop tile shown over the green disc while spinning (replaces the ■ glyph). */
	.spin-btn__stop {
		position: absolute;
		/* Anchor to the green disc's visual center in btn_bg_spin.png. */
		top: 50%;
		left: 51%;
		width: 22%;
		aspect-ratio: 1;
		transform: translate(-50%, -50%);
		object-fit: contain;
		pointer-events: none;
		filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.55));
	}

	.spin-btn__count {
		font-size: calc(var(--u) * 24);
	}

	.buy-btn {
		/* Just a touch taller than the round nav buttons (Figma), so the bar stays slim and
		   the button doesn't stretch the background. Aspect keeps the 300/126 art. */
		height: calc(var(--u) * 100);
		width: auto;
		aspect-ratio: 300 / 126;
		border: 0;
		background: var(--buy-btn-bg) center / contain no-repeat;
		/* Leaves sit along the bottom of the new art, so the green body centre is above the element
		   centre — pad the bottom to lift the flex-centred label onto the body (scales with the button). */
		padding: 0 14px 7% 14px;
		/* Optical vertical centring: the art's leafy bottom makes the element read high on the
		   bar, so nudge the whole button down a touch (position-relative, layout unaffected). */
		top: clamp(2px, 0.45vw, 7px);
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
		background-image: var(--buy-btn-hover-bg);
	}

	.buy-btn:disabled {
		opacity: 0.45;
		cursor: default;
		filter: grayscale(0.35);
	}

	.buy-btn__label {
		font-family: 'Poppins', sans-serif;
		/* Scales with the bar's design unit; fitLabel shrinks it further only when a
		   translation runs long. */
		font-size: calc(var(--u) * 24);
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

	/* Scatter card keeps its original (tighter) hide breakpoint. */
	@media (max-width: 1200px) {
		.scatter-card {
			display: none;
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
		--ls-drop: -1px;
	}
	.ls-hud button,
	.ls-hud .ls-bet__value {
		pointer-events: auto;
	}

	/* Left rail: BUY BONUS + BALANCE, bottom-left */
	.ls-left {
		position: absolute;
		left: 16px;
		bottom: 0;
		/* Stop before the BUY BONUS button (centred at 37%, half-width subtracted). */
		max-width: calc(37% - clamp(48px, 9vh, 84px) - 12px);
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
		   centres line up regardless of the button's rendered height. The extra -5px drops it a
		   touch lower so its leaves clear the board frame on short popup viewports. */
		bottom: calc(clamp(28px, 13.5vh, 116px) / 2 - var(--ls-drop) - 7px);
		left: 37%;
		transform: translate(-50%, 50%);
		box-sizing: border-box;
		width: clamp(72px, 27.5vh, 265px);
		height: auto;
		aspect-ratio: 300 / 126;
		border: 0;
		padding: 0;
		cursor: pointer;
		background: var(--buy-btn-bg) center / contain no-repeat;
		transition: filter 0.12s ease, transform 0.12s ease;
	}
	.ls-buy:not(:disabled):hover { background-image: var(--buy-btn-hover-bg); transform: translate(-50%, calc(50% - 1px)); }
	.ls-buy:disabled { opacity: 0.45; filter: grayscale(0.35); cursor: default; }
	.pt-buy:disabled { opacity: 0.45; filter: grayscale(0.35); cursor: default; }
	.ls-buy__label {
		/* Centred on the green body: the button art has leaves along the bottom, so the body centre is
		   above the element centre. NO transform-based centering here — the fitLabel action overwrites
		   `transform` with its down-scale, which silently removed a translate(-50%,-50%) and shoved the
		   label off the button. Block-level + text-align centers horizontally; em offset vertically. */
		position: absolute;
		left: 0;
		right: 0;
		top: calc(43% - 0.55em);
		font-family: 'Poppins', sans-serif;
		font-size: clamp(9px, 2.7vh, 15px);
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
		/* Same dark translucent pill as the WIN readout — keeps the text readable over the forest. */
		padding: 3px 10px;
		border-radius: 10px;
		background: rgba(17, 12, 10, 0.72);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.22);
		backdrop-filter: blur(4px);
	}
	/* WIN readout — bottom-right corner, mirroring the BALANCE block bottom-left. The right rail
	   is vertically centred so the corner below it stays free. Dark translucent pill keeps the
	   text readable over the bright forest art. */
	.ls-win {
		position: absolute;
		right: 16px;
		bottom: 1px;
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 3px 10px;
		border-radius: 10px;
		background: rgba(17, 12, 10, 0.72);
		box-shadow: 0 8px 16px rgba(0, 0, 0, 0.22);
		backdrop-filter: blur(4px);
	}
	/* No win yet → keep the slot but show nothing (matches the portrait WIN behavior). */
	.ls-win--hidden {
		visibility: hidden;
	}
	.ls-win__label {
		font-family: 'Poppins', sans-serif;
		font-size: clamp(7px, 2.4vh, 11px);
		font-style: normal;
		font-weight: 500;
		line-height: normal;
		letter-spacing: 0.36px;
		background: var(--golden-gradient, linear-gradient(184deg, #ffa90e 15.26%, #ee960b 69.74%, #d18005 92.88%));
		background-clip: text;
		-webkit-background-clip: text;
		-webkit-text-fill-color: transparent;
	}
	.ls-win__value {
		font-family: 'Poppins', sans-serif;
		font-weight: 600;
		font-size: clamp(8px, 2.6vh, 12px);
		color: #fff;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.65);
	}
	.ls-balance__label {
		font-family: 'Poppins', sans-serif;
		font-size: clamp(7px, 2.4vh, 11px);
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
		font-size: clamp(8px, 2.6vh, 12px);
		color: #fff;
	}

	/* Popout L ONLY (landscape layout with a taller window than popout S's ≤375px short side):
	   the BALANCE / WIN readouts sit higher and render bigger there (design ask). The ls-*
	   classes exist only in the landscape layout, so desktop windows never match. */
	@media (min-height: 376px) {
		.ls-left { bottom: 10px; }
		.ls-win { bottom: 11px; }
		.ls-balance,
		.ls-win { padding: 5px 14px; border-radius: 12px; }
		.ls-balance__label,
		.ls-win__label { font-size: clamp(9px, 3.1vh, 15px); }
		.ls-balance__value,
		.ls-win__value { font-size: clamp(10px, 3.4vh, 17px); }

		/* Right rail runs ~20% bigger in the roomier popout L window. */
		.ls-right {
			gap: clamp(4px, 1.6vh, 14px);
			padding: clamp(5px, 1.6vh, 14px) 0;
			background-size: clamp(37px, 12.7vh, 114px) 100%;
		}
		.ls-round {
			width: clamp(26px, 8.6vh, 78px);
			height: clamp(26px, 8.6vh, 78px);
		}
		.ls-spin {
			width: clamp(67px, 26vh, 235px);
			height: clamp(67px, 26vh, 235px);
		}
	}

	/* Bottom-centre bet pad: − value + */
	.ls-bet {
		position: absolute;
		/* Shifted right of centre; BUY BONUS sits to its left (Figma design). */
		left: 61%;
		bottom: calc(-1 * var(--ls-drop) - 4px);
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		/* Pad wraps the (bigger) − / + buttons with clear wood margin around them. */
		height: clamp(28px, 13.5vh, 116px);
		width: clamp(90px, 46vh, 390px);
		padding: 0 1.0%;
		box-sizing: border-box;
		border: 0;
		background: var(--ls-betpad) center / 100% 100% no-repeat;
	}
	.ls-bet__value {
		font-family: 'Poppins', sans-serif;
		font-weight: 700;
		font-size: clamp(11px, 3.9vh, 23px);
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
		width: clamp(21px, 10.5vh, 84px);
		height: clamp(21px, 10.5vh, 84px);
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

	/* Right rail: menu, sound, spin, turbo, autospin (vertical bar).
	   Figma 3451-2143: the dark pill hugs the buttons (pill ≈ 1.25× button width), the buttons
	   are large (≈8.3% of viewport height), and the leafy spin disc is ~2.2× the buttons,
	   overflowing the pill's sides. */
	.ls-right {
		position: absolute;
		right: 6px;
		top: 50%;
		transform: translateY(-50%);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(3px, 1.2vh, 11px);
		padding: clamp(4px, 1.2vh, 11px) 0;
		/* The pill art is painted at a FIXED width (~2.1× the round buttons, per Figma) instead of
		   the element box — the element is as wide as the spin disc, and sizing the art to it made
		   the pill swallow the spin. This way the buttons nearly fill the pill and the bigger spin
		   overflows its sides. */
		background: var(--ls-rightbar) center / clamp(31px, 10.6vh, 95px) 100% no-repeat;
	}
	.ls-round {
		width: clamp(22px, 7.2vh, 65px);
		height: clamp(22px, 7.2vh, 65px);
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
	.ls-round .ls-icon.is-muted { opacity: 1; }

	.ls-spin {
		width: clamp(62px, 23vh, 210px);
		height: clamp(62px, 23vh, 210px);
		border: 0;
		background: var(--ls-spin) center / contain no-repeat;
		padding: 0;
		cursor: pointer;
		position: relative;
		display: grid;
		place-items: center;
		transition: filter 0.12s ease, transform 0.12s ease;
	}
	.ls-spin:not(:disabled):hover { background-image: var(--ls-spin-hover); }
	.ls-spin:disabled { opacity: 0.5; cursor: default; }
	.ls-spin__icon { width: 42%; height: 42%; object-fit: contain; transform: translate(1.5%, 3%); }
	.ls-spin__stop {
		position: absolute;
		/* Same disc-centre anchor as the desktop .spin-btn__stop — the art is identical
		   (btn_bg_spin.webp), and the old 53%/51.2% sat visibly low-right of the disc. */
		top: 50%;
		left: 51%;
		width: 22%;
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
		/* 18px floor: keeps the bet row comfortably off the screen bottom (was 10px — "too bottomed"). */
		padding: 0 12px calc(18px + env(safe-area-inset-bottom, 0px));
		/* THE portrait HUD unit: the bar width. EVERYTHING below is sized as a fraction of this one
		   value, so the layout keeps the design's exact proportions at every viewport width (mixed
		   px/vw clamps previously saturated into different proportions on different screens). */
		--u: min(412px, 97vw);
	}
	/* No browser focus ring / tap highlight on the game buttons (the blue box after a tap). */
	.pt-hud button { outline: none; -webkit-tap-highlight-color: transparent; }
	.pt-hud button:focus, .pt-hud button:focus-visible { outline: none; }

	/* --- control row: ☰·BUY · SPIN · turbo·auto --- */
	.pt-controls {
		position: relative;
		width: var(--u);
		/* Slightly squashed vs the art's native 1372×256 — matches the design's slimmer bar. */
		height: calc(var(--u) * 0.138);
		/* 3-column grid (1fr | auto | 1fr): the SPIN sits at the exact centre — matching the bet pad
		   below — regardless of the (unequal) side groups. align-items centres buttons on the wood
		   (the art's visible wood is centred in its box). */
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		/* Row locked to the bar height — otherwise the taller spin stretches the implicit row past
		   the bar's bottom and every button centres 10px low (halfway out of the wood). With the row
		   fixed, buttons centre ON the wood and the spin's leaves overflow evenly above/below. */
		grid-template-rows: 100%;
		align-items: center;
		/* Slight top padding: the wood art's visible surface centre sits a touch below the box centre
		   (thicker bottom rail), so the buttons need a small downward nudge to look centred ON it. */
		padding: calc(var(--u) * 0.012) calc(var(--u) * 0.04) 0;
		box-sizing: border-box;
		background: var(--pt-navpad) center / 100% 100% no-repeat;
	}
	/* Side groups fill their halves and spread evenly — balanced like the design, clear of the
	   rounded bar ends and of the spin. */
	.pt-controls > .pt-grp { width: 100%; justify-content: space-evenly; }
	.pt-grp { display: flex; align-items: center; }

	.pt-round {
		width: calc(var(--u) * 0.085); height: calc(var(--u) * 0.085);
		border: 0; padding: 0; cursor: pointer;
		background: var(--btn-round-bg) center / contain no-repeat;
		display: grid; place-items: center;
		flex: 0 0 auto;
		transition: transform 0.12s ease, filter 0.12s ease;
	}
	.pt-round--sm { width: calc(var(--u) * 0.095); height: calc(var(--u) * 0.095); }
	.pt-round:not(:disabled):hover { filter: brightness(1.12); }
	.pt-round:not(:disabled):active { transform: translateY(1px) scale(0.94); }
	.pt-round:disabled { opacity: 0.45; cursor: default; }
	.pt-round.active { filter: drop-shadow(0 0 6px rgba(120,220,90,0.85)); }
	.pt-icon { width: 52%; height: 52%; object-fit: contain; pointer-events: none; }
	.pt-icon.is-muted { opacity: 0.4; }
	.pt-round--turbo.turbo-fast { filter: drop-shadow(0 0 5px rgba(255,210,80,0.85)); }
	.pt-round--turbo.turbo-super { filter: drop-shadow(0 0 7px rgba(120,220,90,0.95)); }

	.pt-spin {
		width: calc(var(--u) * 0.21); height: calc(var(--u) * 0.21);
		margin-top: 0; /* vertically centred on the bar; the leaves overflow above/below by design */
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
	/* The green disc in spin_mobile.png sits ~1% right / ~3% above the art centre (leaf border is
	   heavier at the bottom), so nudge the icons onto the disc's optical centre. */
	.pt-spin__icon { width: 42%; height: 42%; object-fit: contain; transform: translate(2%, 2%); } /* arrow overlay (base has none) */
	.pt-spin__stop { width: 30%; height: 30%; object-fit: contain; transform: translate(2%, 2%); }
	.pt-spin__count {
		font-family: 'Cinzel', serif; font-weight: 900; font-size: 1.3rem; color: #fff;
		text-shadow: 0 2px 4px rgba(0,0,0,0.7);
	}

	/* --- stats row: BALANCE · (− bet +) · WIN ---
	   3-column grid (1fr | auto | 1fr) so the bet pad is always perfectly centred on screen
	   regardless of the balance/win widths; balance + win are pulled ~12px in toward the centre. */
	.pt-stats {
		width: var(--u);
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: calc(var(--u) * 0.02);
		/* Nudge the whole BALANCE · bet · WIN row down a touch off the control bar (design ask). */
		margin-top: calc(var(--u) * 0.022);
	}
	.pt-stats .pt-balance { justify-self: start; margin-left: calc(var(--u) * 0.03); }
	.pt-stats .pt-win { justify-self: end; margin-right: calc(var(--u) * 0.03); }
	/* Balance: transparent (no pad), centred label + gold value. */
	.pt-balance {
		flex: 0 0 auto;
		max-width: calc(var(--u) * 0.32);
		display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		gap: 1px;
		min-width: 0;
		overflow: hidden;
	}
	.pt-balance__label {
		font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 10px;
		letter-spacing: 0.04em; white-space: nowrap;
		background: linear-gradient(184.14deg, #ffa90e 15.26%, #ee960b 69.74%, #d18005 92.88%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
	}
	.pt-balance__value {
		font-family: 'Poppins', sans-serif; font-weight: 500; font-size: 12px;
		font-style: normal; line-height: normal; letter-spacing: 0.36px;
		white-space: nowrap; transform-origin: center;
		color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.55);
	}

	/* Bet pill: dark rounded pad with − value + (no BET label, per Figma) */
	.pt-bet {
		flex: 0 0 auto;
		display: flex; align-items: center; justify-content: space-between;
		gap: 4px;
		width: calc(var(--u) * 0.46); height: calc(var(--u) * 0.132);
		padding: 0 calc(var(--u) * 0.018);
		box-sizing: border-box;
		background: var(--pt-betpad) center / 100% 100% no-repeat;
	}
	.pt-bet__value {
		flex: 1 1 auto; text-align: center;
		font-family: 'Poppins', sans-serif; font-weight: 500; font-size: 18px;
		font-style: normal; line-height: normal; letter-spacing: 0.54px; color: #fff;
		white-space: nowrap; cursor: pointer; transform-origin: center;
		text-shadow: 0 1px 2px rgba(0,0,0,0.6);
	}
	.pt-bet__value.value--feature { color: #ffd84a; }

	/* Buy bonus: round green badge with 2-line label inside */
	.pt-buy {
		flex: 0 0 auto;
		width: calc(var(--u) * 0.145); height: calc(var(--u) * 0.138);
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
	/* Buy bonus placed IN the control row (left of spin). */
	.pt-buy--controls { width: calc(var(--u) * 0.14); height: calc(var(--u) * 0.132); }

	/* WIN readout — mirrors the balance block, pinned to the right of the stats row. */
	.pt-win {
		flex: 0 0 auto;
		max-width: calc(var(--u) * 0.3);
		display: flex; flex-direction: column;
		align-items: center; justify-content: center;
		gap: 1px;
		min-width: 0;
		overflow: hidden;
	}
	/* No win yet → keep the slot (bet stays centred) but show nothing. */
	.pt-win--hidden { visibility: hidden; }
	.pt-win__label {
		font-family: 'Poppins', sans-serif; font-weight: 700; font-size: 10px;
		letter-spacing: 0.04em; white-space: nowrap;
		background: linear-gradient(184.14deg, #ffa90e 15.26%, #ee960b 69.74%, #d18005 92.88%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
	}
	.pt-win__value {
		font-family: 'Poppins', sans-serif; font-weight: 500; font-size: 12px;
		font-style: normal; line-height: normal; letter-spacing: 0.36px;
		white-space: nowrap; transform-origin: center; min-height: 12px;
		color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.55);
	}

	/* ☰ menu button open state: gold ✕ glyph in place of the hamburger icon. */
	.pt-round__x {
		font-family: 'Cinzel', serif; font-weight: 900; font-size: calc(var(--u) * 0.048);
		line-height: 1; color: #f1c14a; filter: drop-shadow(0 1px 1px rgba(0,0,0,0.7));
	}

	/* The ☰ button wrapper is NOT a positioning context — the popup anchors to the BAR
	   (.pt-controls, position:relative), giving it a stable containing block whose width is --u,
	   so both its position AND its %-paddings resolve against the bar. */
	.pt-menu-wrap { display: inline-flex; flex: 0 0 auto; }

	/* Sound / Info popup — the wooden plaque from Figma (border baked into the art). Sits just above
	   the bar, aligned to its left edge (like the design). All insets are fractions of the bar width
	   (% padding resolves against the containing block = the bar = --u). */
	.pt-menu-pop {
		position: absolute;
		left: calc(var(--u) * -0.04);
		bottom: calc(100% - 25px); /* almost touching the bar */
		z-index: 8;
		width: calc(var(--u) * 0.5);
		aspect-ratio: 1431 / 1099;
		box-sizing: border-box;
		display: flex; flex-direction: column;
		align-items: flex-start; justify-content: center;
		gap: calc(var(--u) * 0.035);
		padding: 5.5% 4% 6.5% 9%;
		background: var(--menu-popup-bg) center / 100% 100% no-repeat;
	}
	.pt-menu-item {
		display: flex; align-items: center; gap: calc(var(--u) * 0.03);
		border: 0; padding: 0; cursor: pointer;
		background: transparent;
		transition: filter 0.12s ease, transform 0.12s ease;
	}
	.pt-menu-item:hover { filter: brightness(1.12); }
	.pt-menu-item:active { transform: scale(0.97); }
	.pt-menu-item__ic {
		width: calc(var(--u) * 0.095); height: calc(var(--u) * 0.095);
		flex: 0 0 auto;
		display: grid; place-items: center;
		border-radius: 50%;
		background: var(--btn-round-bg) center / contain no-repeat;
	}
	.pt-menu-item__ic img { width: 52%; height: 52%; object-fit: contain; }
	.pt-menu-item__ic img.is-muted { opacity: 0.4; }
	.pt-menu-item__label {
		font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 12px;
		font-style: normal; line-height: normal; color: #fff;
	}
</style>
