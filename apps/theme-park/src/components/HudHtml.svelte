<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	// Bottom-bar chrome and glyphs from Figma 6281-1791. The glyphs replace the old set, which baked
	// each icon into its own dark badge — those badges doubled up with this design's circular button
	// chrome. The stepper is -/+ here, not the old left/right arrows.
	const navMenu = ap('/assets/theme-park/v2/hud/icon_menu.svg');
	const navClose = ap('/assets/theme-park/v2/hud/icon_close.svg');
	const navSound = ap('/assets/theme-park/v2/hud/icon_sound.svg');

	// Settings-menu glyphs — existing icon assets, used as CSS masks so icon AND label recolour
	// together on hover (see .hud-menu__glyph { background: currentColor }).
	const menuIconSound = ap('/assets/theme-park/v2/hud/menu_sound.svg');
	const menuIconMusic = ap('/assets/theme-park/v2/hud/menu_music.svg');
	const menuIconInfo = ap('/assets/theme-park/v2/hud/menu_info.svg');
	const navMinus = ap('/assets/theme-park/v2/hud/icon_minus.svg');
	const navPlus = ap('/assets/theme-park/v2/hud/icon_plus.svg');
	const navAuto = ap('/assets/theme-park/v2/hud/icon_auto.svg');
	// The three turbo glyphs from Figma 2503:7493 ("Tunder"/"Thunder1"/"Thunder 3"), extracted onto
	// full-button-frame canvases so each lands exactly where the design places it in the circle:
	// OUTLINED bolt = normal (off), one solid bolt = turbo, two bolts = super turbo.
	const navTurboSolid = ap('/assets/theme-park/v2/hud/turbo-1.webp');
	const navTurboDouble = ap('/assets/theme-park/v2/hud/turbo-2.webp');
	const navTurboOutline = ap('/assets/theme-park/v2/hud/turbo-3.webp');
	const barPlate = ap('/assets/theme-park/v2/hud/bar_plate.webp');
	const buyPlate = ap('/assets/theme-park/v2/hud/buy_plate.webp');
	// The spin button is a rotatable marquee ring plus a static glyph on top, NOT one flat composite
	// (see scripts/spin-button/build_spin_button.py). The ring is identical in every state — only the
	// glyph changes — so one background serves all of them and can keep spinning across a state swap.
	const navSpinBg = ap('/assets/theme-park/v2/controls/spin-bg.webp');
	const navSpinArrow = ap('/assets/theme-park/v2/controls/spin-arrow.webp');
	const navSpinStopGlyph = ap('/assets/theme-park/v2/controls/spin-stop-glyph.webp');
	const navCoins = ap('/assets/theme-park/v2/hud/icon_coin.svg');
	const gameLogo = ap('/assets/theme-park/v2/logo.png');
	const pressPlayLogo = ap('/assets/theme-park/v2/press-play.webp');
	// Same mark the splash uses (Figma 6612:4340 places it at the scene's top right too). Desktop and
	// landscape only — portrait shows the larger pressPlayLogo inside its own logo stack instead.
	const pressPlayMark = ap('/assets/theme-park/v2/splash/press_play_mark.svg');

	// Real marquee button art (portrait + landscape HUD). Round neon-rim buttons.
	const ptMenu = ap('/assets/theme-park/v2/controls/btn-menu.png');
	const ptSound = ap('/assets/theme-park/v2/controls/btn-sound.png');
	const ptSoundMuted = ap('/assets/theme-park/v2/controls/btn-sound-muted.png');
	// Landscape control-dock box art (neon-edged vertical panel behind the right-hand buttons).
	const lsNavBox = ap('/assets/theme-park/v2/controls/nav-box-landscape.svg');
	const ptTurbo = ap('/assets/theme-park/v2/controls/btn-turbo.png');
	const ptTurboFast = ap('/assets/theme-park/v2/controls/btn-turbo-fast.png');
	const ptTurboSuper = ap('/assets/theme-park/v2/controls/btn-turbo-super.png');
	const ptAuto = ap('/assets/theme-park/v2/controls/btn-auto.png');
	const ptAutoDisabled = ap('/assets/theme-park/v2/controls/btn-auto-disabled.png');
	const ptPlus = ap('/assets/theme-park/v2/controls/btn-plus.png');
	const ptPlusDisabled = ap('/assets/theme-park/v2/controls/btn-plus-disabled.png');
	const ptMinus = ap('/assets/theme-park/v2/controls/btn-minus.png');
	const ptMinusDisabled = ap('/assets/theme-park/v2/controls/btn-minus-disabled.png');
	const ptBuy = ap('/assets/theme-park/v2/controls/btn-buy-mobile.png');
	// Bet box plate — the same glowing neon gradient frame ("S pad") used by the buy-bonus popup's
	// bet setter, stretched to fill this box so the two match.
	const ptBetBox = ap('/assets/theme-park/v2/hud/neon-frame.png');
	// Portrait nav bar — bar_plate cropped tight + vertically symmetric, so the visible bar nearly
	// fills its box and the (bigger) buttons sit centred inside it.
	const ptNavBar = ap('/assets/theme-park/v2/controls/nav-bar.png');
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
	import CustomInfoModal from './CustomInfoModal.svelte';

	const context = getContext();

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isLandscapeMobile = $derived(layoutType === 'landscape');
	const isPortrait = $derived(layoutType === 'portrait');

	// The THEME PARK logo tracks the board: it sits just above the portrait board frame, whose top is
	// at logical Y = 236 (PORTRAIT_TOP_OFFSET) in the 1080×1920 portrait space. MainContainer maps a
	// logical point to CSS px as cssY = canvasH/2 + (logicalY − mainH/2) · scale, scale = min(cssW/1080,
	// cssH/1920). We anchor the logo's BOTTOM at that Y (via translateY(-100%)), so it never overlaps.
	const PORTRAIT_BOARD_FRAME_TOP = 236;
	const portraitLogoTop = $derived.by(() => {
		if (!isPortrait) return null;
		const canvas = context.stateLayoutDerived.canvasSizes();
		const main = context.stateLayoutDerived.mainLayout();
		const boardTopCss = canvas.height / 2 + (PORTRAIT_BOARD_FRAME_TOP - main.height / 2) * main.scale;
		// logo BOTTOM anchored just above the board frame — small gap so it nearly touches
		return Math.max(6, Math.round(boardTopCss + 10));
	});
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

	const speedMode = $derived(
		stateBet.isSuperTurbo ? 'super' : stateBet.isTurbo ? 'fast' : 'normal',
	);
	const ptTurboImg = $derived(
		stateBet.isSuperTurbo ? ptTurboSuper : stateBet.isTurbo ? ptTurboFast : ptTurbo,
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

	// Burger settings menu (SOUND · MUSIC · INFO).
	let menuOpen = $state(false);
	const toggleMenu = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		menuOpen = !menuOpen;
	};
	const closeMenu = () => (menuOpen = false);
	const musicMuted = $derived(stateSound.volumeValueMusic === 0);
	const toggleMusic = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateSound.volumeValueMusic = musicMuted ? 50 : 0;
	};
	const openInfo = () => {
		closeMenu();
		openRules();
	};
	// Close the menu on any click outside it (and outside its trigger).
	$effect(() => {
		if (!menuOpen) return;
		const onDown = (event: PointerEvent) => {
			const target = event.target as HTMLElement | null;
			if (target?.closest('.hud-menu') || target?.closest('.nav-btn--menu')) return;
			closeMenu();
		};
		document.addEventListener('pointerdown', onDown, true);
		return () => document.removeEventListener('pointerdown', onDown, true);
	});

	const openRules = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		showInfoModal = true;
	};

	let showInfoModal = $state(false);
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
		let frame = 0;
		const fit = () => {
			const slot = node.parentElement;
			if (!slot) return;
			// A transform only changes paint size; the unscaled text still expands flex layout. Reset to
			// the authored size, measure the full line, then change the real font size so layout also fits.
			node.style.removeProperty('font-size');
			const style = getComputedStyle(slot);
			const available =
				slot.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
			const baseSize = parseFloat(getComputedStyle(node).fontSize);
			const full = node.scrollWidth;
			const scale = full > available && available > 0 ? available / full : 1;
			if (scale < 1) node.style.fontSize = `${Math.max(1, baseSize * scale)}px`;
		};
		const schedule = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(fit);
		};
		const observer = new ResizeObserver(schedule);
		if (node.parentElement) observer.observe(node.parentElement);
		document.fonts?.ready.then(schedule);
		schedule();
		return {
			update: schedule,
			destroy: () => {
				cancelAnimationFrame(frame);
				observer.disconnect();
			},
		};
	}
</script>

<OnHotkey
	hotkey="Space"
	disabled={!stateConfig.jurisdiction ? false : stateConfig.jurisdiction.disabledSpacebar}
	onpress={onSpinHotkey}
/>

<div
	class="hud-shell"
	class:hud-shell--blocked={congratsBlocking}
	class:hud-shell--dimmed={showBuyModal}
	data-layout={layoutType}
>
	{#if isPortrait}
		<!-- Portrait logo stack: Press Play mark above the THEME PARK logo, the stack's bottom
		     (the game logo) anchored just above the board via inline top + translateY(-100%). -->
		<div
			class="pt-logo-stack"
			style={portraitLogoTop != null ? `top:${portraitLogoTop}px` : undefined}
		>
			<img class="pt-pressplay" src={pressPlayLogo} alt="Press Play" />
			<img class="pt-themelogo" src={gameLogo} alt={i18nDerived.gameTitle()} />
		</div>
	{:else}
		<img class="game-logo" src={gameLogo} alt={i18nDerived.gameTitle()} />
		<img class="press-play-mark" src={pressPlayMark} alt="Press Play" />
	{/if}
	{#if isLandscapeMobile}
	<!-- MOBILE-LANDSCAPE HUD — two side columns flanking the board, matching the design. Left: balance
	     + bet stepper. Right: menu · sound · SPIN · turbo · auto stack, with BUY BONUS + WIN beside it. -->
	<div class="ls-hud">
		<div class="ls-left">
			<div class="ls-pill ls-pill--balance">
				<span class="ls-pill__label">{i18nDerived.balance()}</span>
				<span class="ls-pill__value" use:fitText={formattedBalance}>{formattedBalance}</span>
			</div>
			<div class="ls-bet">
				<img class="ls-bet__bg" src={ptBetBox} alt="" aria-hidden="true" />
				<button
					class="ls-step"
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
					<img src={disableDecrease ? ptMinusDisabled : ptMinus} alt="" />
				</button>
				<div
					class="ls-bet__values"
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && (stateModal.modal = { name: 'betAmountMenu' })}
					onclick={() => (stateModal.modal = { name: 'betAmountMenu' })}
				>
					<span class="ls-pill__value ls-bet__value" use:fitText={formattedBet}>{formattedBet}</span>
				</div>
				<button
					class="ls-step"
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
					<img src={disableIncrease ? ptPlusDisabled : ptPlus} alt="" />
				</button>
			</div>
		</div>

		<div class="ls-actions">
			<img class="ls-actions__bg" src={lsNavBox} alt="" aria-hidden="true" />
			<button class="ls-btn" type="button" onclick={openRules} aria-label={i18nDerived.gameRules()}>
				<img src={ptMenu} alt="" />
			</button>
			<button class="ls-btn" type="button" onclick={toggleSound} aria-label={i18nDerived.translate('SOUND')}>
				<img src={isMuted ? ptSoundMuted : ptSound} alt="" />
			</button>
			<button
				class="spin-btn ls-spin"
				class:is-spinning={isSpinStop}
				type="button"
				onclick={onSpinButton}
				aria-label={i18nDerived.translate('SPIN')}
				disabled={canInteract && !hasAuto && !canAffordBet}
			>
				<img src={navSpinBg} alt="" class="spin-btn__img spin-btn__img--bg" />
				{#if isSpinStop}
					<img src={navSpinStopGlyph} alt="" class="spin-btn__img spin-btn__img--stopglyph" />
				{:else}
					<img src={navSpinArrow} alt="" class="spin-btn__img spin-btn__img--arrow" />
				{/if}
				{#if hasAuto}
					<span class="spin-btn__count">{autoSpinsRemainingText}</span>
				{/if}
			</button>
			<button
				class="ls-btn"
				data-speed={speedMode}
				type="button"
				onclick={onTurbo}
				aria-label={i18nDerived.turboLabel()}
				title={`${i18nDerived.turboLabel()}: ${speedMode}`}
			>
				<img src={ptTurboImg} alt="" />
			</button>
			<button
				class="ls-btn"
				class:active={hasAuto}
				type="button"
				onclick={onAuto}
				disabled={disableAuto}
				aria-label={i18nDerived.autoplayLabel()}
			>
				<img src={disableAuto && !hasAuto ? ptAutoDisabled : ptAuto} alt="" />
			</button>
		</div>

		<button
			class="ls-buy"
			type="button"
			disabled={disableBuy}
			onclick={isAnyModeActive ? deactivateMode : openBuyBonus}
			aria-label={buyLabel}
		>
			<img src={ptBuy} alt="" />
			<span class="ls-buy__label">{buyLabel}</span>
		</button>

		<div class="ls-pill ls-pill--win">
			<span class="ls-pill__label">{i18nDerived.win()}</span>
			<span class="ls-pill__value" use:fitText={formattedWin}>{formattedWin}</span>
		</div>
	</div>
	{:else if !isPortrait}
	<div class="hud-bottom">
		<!-- The bar itself is art (1126x107 neon pill), not CSS chrome. It is a sibling rather than a
		     background-image because the spin button overhangs the plate top and bottom, so the plate
		     has to sit BEHIND the row at its own smaller height while the row keeps the taller box. -->
		<img class="hud-plate" src={barPlate} alt="" />
		<div class="hud-left">
			<div class="hud-system">
				<button
					class="nav-btn nav-btn--menu"
					class:is-open={menuOpen}
					type="button"
					onclick={toggleMenu}
					aria-haspopup="true"
					aria-expanded={menuOpen}
					aria-label={i18nDerived.translate('MENU')}
				>
					<img src={menuOpen ? navClose : navMenu} alt="" />
				</button>
				<button class="nav-btn nav-btn--sound" type="button" onclick={toggleSound} aria-label={i18nDerived.translate('SOUND')}>
					<img src={navSound} alt="" class:is-muted={isMuted} />
				</button>

				{#if menuOpen}
					<div class="hud-menu" role="menu">
						<button class="hud-menu__item" class:is-off={isMuted} type="button" role="menuitem" onclick={toggleSound}>
							<span class="hud-menu__badge"><span class="hud-menu__glyph" style={`--icon:url('${menuIconSound}')`}></span></span>
							<span class="hud-menu__label">{i18nDerived.translate('SOUND')}</span>
						</button>
						<div class="hud-menu__divider"></div>
						<button class="hud-menu__item" class:is-off={musicMuted} type="button" role="menuitem" onclick={toggleMusic}>
							<span class="hud-menu__badge"><span class="hud-menu__glyph" style={`--icon:url('${menuIconMusic}')`}></span></span>
							<span class="hud-menu__label">{i18nDerived.translate('MUSIC')}</span>
						</button>
						<div class="hud-menu__divider"></div>
						<button class="hud-menu__item" type="button" role="menuitem" onclick={openInfo}>
							<span class="hud-menu__badge"><span class="hud-menu__glyph" style={`--icon:url('${menuIconInfo}')`}></span></span>
							<span class="hud-menu__label">{i18nDerived.translate('INFO')}</span>
						</button>
					</div>
				{/if}
			</div>

			<div class="hud-buy">
				<button
					class="buy-btn"
					type="button"
					disabled={disableBuy}
					onclick={isAnyModeActive ? deactivateMode : openBuyBonus}
					aria-label={buyLabel}
				>
					<img class="buy-btn__plate" src={buyPlate} alt="" />
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

			<!-- 1px x 49 rule between BALANCE and WIN (design node 6589:4366). -->
			<span class="stats-divider" aria-hidden="true"></span>

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
					<button class="nav-btn nav-btn--menu" type="button" onclick={openRules} aria-label={i18nDerived.gameRules()}>
						<img src={navMenu} alt="" />
					</button>
					<button class="nav-btn nav-btn--sound" type="button" onclick={toggleSound} aria-label={i18nDerived.translate('SOUND')}>
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
					<img class="step-glyph step-glyph--minus" src={navMinus} alt="" />
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
					<img class="step-glyph step-glyph--plus" src={navPlus} alt="" />
				</button>
			</div>

			<div class="play-cluster">
				<button
					class="spin-btn"
					class:is-spinning={isSpinStop}
					type="button"
					onclick={onSpinButton}
					aria-label={i18nDerived.translate('SPIN')}
					disabled={canInteract && !hasAuto && !canAffordBet}
				>
					<!-- Mounted unconditionally so the ring's rotation survives the glyph swapping between
					     arrow and stop — remounting it would restart the animation from 0deg and snap. -->
					<img src={navSpinBg} alt="" class="spin-btn__img spin-btn__img--bg" />
					{#if isSpinStop}
						<img src={navSpinStopGlyph} alt="" class="spin-btn__img spin-btn__img--stopglyph" />
					{:else}
						<img src={navSpinArrow} alt="" class="spin-btn__img spin-btn__img--arrow" />
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
					<img
						class="turbo-glyph"
						src={stateBet.isSuperTurbo
							? navTurboDouble
							: stateBet.isTurbo
								? navTurboSolid
								: navTurboOutline}
						alt=""
					/>
				</button>
				<button
					class="nav-btn nav-btn--auto"
					class:active={hasAuto}
					type="button"
					onclick={onAuto}
					disabled={disableAuto}
					aria-label={i18nDerived.autoplayLabel()}
				>
					<img class="auto-glyph" src={navAuto} alt="" />
					<span class="auto-label">{i18nDerived.translate('AUTO')}</span>
				</button>
			</div>
		</div>
	</div>
	{:else}
	<!-- PORTRAIT HUD — dedicated 2-row marquee layout. Controls row (menu · buy · spin · turbo ·
	     auto) on top, balance | bet(-/+) | win strip below. Real neon button art. -->
	<div class="pt-hud">
		<div class="pt-controls">
			<img class="pt-bar-bg" src={ptNavBar} alt="" aria-hidden="true" />
			<div class="pt-side pt-side--left">
				<button class="pt-btn" type="button" onclick={openRules} aria-label={i18nDerived.gameRules()}>
					<img src={ptMenu} alt="" />
				</button>

				<button
					class="pt-btn pt-buy"
					type="button"
					disabled={disableBuy}
					onclick={isAnyModeActive ? deactivateMode : openBuyBonus}
					aria-label={buyLabel}
				>
					<img src={ptBuy} alt="" />
					<span class="pt-buy__label">{buyLabel}</span>
				</button>
			</div>

			<button
				class="pt-spin"
				class:is-spinning={isSpinStop}
				type="button"
				onclick={onSpinButton}
				aria-label={i18nDerived.translate('SPIN')}
				disabled={canInteract && !hasAuto && !canAffordBet}
			>
				<img src={navSpinBg} alt="" class="pt-spin__img pt-spin__img--bg" />
				{#if isSpinStop}
					<img src={navSpinStopGlyph} alt="" class="pt-spin__img pt-spin__img--stopglyph" />
				{:else}
					<img src={navSpinArrow} alt="" class="pt-spin__img pt-spin__img--arrow" />
				{/if}
				{#if hasAuto}
					<span class="pt-spin__count">{autoSpinsRemainingText}</span>
				{/if}
			</button>

			<div class="pt-side pt-side--right">
				<button
					class="pt-btn pt-turbo"
					data-speed={speedMode}
					type="button"
					onclick={onTurbo}
					aria-label={i18nDerived.turboLabel()}
					title={`${i18nDerived.turboLabel()}: ${speedMode}`}
				>
					<img src={ptTurboImg} alt="" />
				</button>

				<button
					class="pt-btn"
					class:active={hasAuto}
					type="button"
					onclick={onAuto}
					disabled={disableAuto}
					aria-label={i18nDerived.autoplayLabel()}
				>
					<img src={disableAuto && !hasAuto ? ptAutoDisabled : ptAuto} alt="" />
				</button>
			</div>
		</div>

		<div class="pt-stats">
			<div class="pt-pill">
				<span class="pt-pill__label">{i18nDerived.balance()}</span>
				<span class="pt-pill__value" use:fitText={formattedBalance}>{formattedBalance}</span>
			</div>

			<div class="pt-bet">
				<img class="pt-bet__bg" src={ptBetBox} alt="" aria-hidden="true" />
				<button
					class="pt-step"
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
					<img src={disableDecrease ? ptMinusDisabled : ptMinus} alt="" />
				</button>

				<div
					class="pt-bet__values"
					role="button"
					tabindex="0"
					onkeydown={(e) => e.key === 'Enter' && (stateModal.modal = { name: 'betAmountMenu' })}
					onclick={() => (stateModal.modal = { name: 'betAmountMenu' })}
				>
					<span class="pt-pill__value" use:fitText={formattedBet}>{formattedBet}</span>
				</div>

				<button
					class="pt-step"
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
					<img src={disableIncrease ? ptPlusDisabled : ptPlus} alt="" />
				</button>
			</div>

			<div class="pt-pill">
				<span class="pt-pill__label">{i18nDerived.win()}</span>
				<span class="pt-pill__value" use:fitText={formattedWin}>{formattedWin}</span>
			</div>
		</div>
	</div>
	{/if}
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

{#if showInfoModal}
	<CustomInfoModal onclose={() => (showInfoModal = false)} {layoutType} />
{/if}

<style>
	.hud-shell {
		position: absolute;
		inset: 0;
		pointer-events: none;
		/* From brightness(1), not unset — a transition out of `none` cannot animate, and the bar
		   popped back to full brightness while the popup was still fading (see --blocked below). */
		filter: brightness(1);
		transition: filter 200ms ease;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 8px;
		z-index: 20;
		font-family: 'Lilita One', sans-serif;
		/* One design unit = one pixel of Figma 6281-1791, so every size below can be read straight off
		   the design. The bar plate is 1126 wide in a 1200-wide frame (93.8%); the 1400px cap stops it
		   from growing past the design's proportions on an ultrawide monitor. */
		--hud-u: calc(min(93.8vw, 1400px) / 1126);
	}

	.hud-shell--blocked,
	.hud-shell--blocked *,
	.hud-shell--dimmed,
	.hud-shell--dimmed * {
		pointer-events: none !important;
	}

	/* Same treatment for the buy-bonus screen (Figma 6695:4781), which scrims the whole frame — bar
	   and logo included — and lifts only the bet stepper back above it. That stepper belongs to the
	   modal, not to this bar, so the bar can dim wholesale. Unlike --blocked the logo is only dimmed,
	   not hidden: the design keeps it behind the title. */
	.hud-shell--dimmed {
		filter: brightness(0.3);
	}

	/* The design scrims the WHOLE frame behind a congratulations screen, the bottom bar and the logo
	   included (Figma 6094:4022). Those screens are pixi and this is a DOM layer above the canvas, so
	   the popup's own full-canvas scrim stops at the canvas — the bar has to dim itself. brightness()
	   is the same arithmetic: a 70% black scrim over an element is its colour times 0.3.
	   Dropping the HUD behind the canvas instead would hide it outright, not dim it — the park
	   backdrop is an opaque full-screen sprite inside that canvas. <PressAnywhereCaption> is a
	   sibling at z-index 21, so the line the design runs across the bar stays at full strength. */
	.hud-shell--blocked {
		filter: brightness(0.3);
	}

	/* Dimming is not enough for the logo: it hangs low enough to cross the top of the panel, and
	   being DOM it paints over a pixi popup no matter what the canvas does. The design gets away
	   with keeping it because its panel clears the logo art; ours does not, so the mark steps aside
	   for the duration instead of sitting on top of the screen it is meant to be behind. */
	.hud-shell--blocked .game-logo,
	.hud-shell--blocked .press-play-mark,
	.hud-shell--blocked .pt-logo-stack {
		opacity: 0;
	}

	/* No bottom scrim. This used to be a 120px band of solid #08041d, opaque for its lower 78%, to
	   lift the HUD off the old sharp park art — but it cut the background off in a hard line just
	   above the bar and left a black strip along the bottom of the screen. The background is now
	   blurred art the reels already read against, and the bar plate carries its own dark fill, so the
	   scene runs to the bottom edge as it does in Figma 6281-1791. */

	/* Figma 6612:4356 — 456 wide, centred (372 + 228 = the 1200 frame's midpoint), with its art
	   starting 10 down. --hud-u is one design pixel of that same frame, so this is the design's own
	   number rather than a viewport guess; it works out ~1.7x the clamp(190px, 22vw, 330px) it
	   replaced, which is why the logo now overlaps the top of the board the way the design shows. */
	.game-logo {
		position: absolute;
		left: 50%;
		top: calc(var(--hud-u) * 10);
		width: calc(var(--hud-u) * 388);
		height: auto;
		transform: translateX(-50%);
		filter: drop-shadow(0 6px 11px rgba(0, 0, 0, 0.7));
		animation: game-logo-idle 3.4s ease-in-out infinite;
		transition: opacity 220ms ease;
		z-index: 4;
	}

	/* Figma 6612:4340 — 112.51 x 36.4 at (1076, 8), i.e. 11.49 in from the frame's right edge. */
	.press-play-mark {
		position: absolute;
		top: calc(var(--hud-u) * 8);
		right: calc(var(--hud-u) * 11.49);
		width: calc(var(--hud-u) * 112.51);
		height: auto;
		opacity: 0.9;
		filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.55));
		transition: opacity 220ms ease;
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
		/* Plate width; the row inside it totals 1063.72 in the design, so the ~31 units of slack on
		   each side come out of centring rather than out of padding. */
		width: calc(var(--hud-u) * 1126);
		height: calc(var(--hud-u) * 118.538);
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(var(--hud-u) * 16);
		padding: 0;
		background: none;
		border: 0;
		border-radius: 0;
		box-shadow: none;
		font-family: 'Inter', sans-serif;
	}

	/* The plate is only 107 tall against the row's 118.538 — the spin button is what makes the row
	   taller — so it sits behind rather than stretched to fit.

	   The +4 is not a fudge: the pill drawn inside this 1126x107 export occupies y 6..92, so its
	   optical centre is 4 units ABOVE the centre of the image box. Centring the box therefore lands
	   every control 4 units BELOW the middle of the pill, which is what read as "not centred". The
	   design does the same correction — it places the plate 3.23 below the row centre rather than on
	   it. Pushing the image down by 4 puts the pill's centre on the row's centre instead. */
	.hud-plate {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(calc(-50% + var(--hud-u) * 4));
		width: 100%;
		height: calc(var(--hud-u) * 107);
		z-index: 0;
		pointer-events: none;
	}

	.hud-bottom > *:not(.hud-plate) {
		position: relative;
		z-index: 1;
	}

	/* Every top-level item in the design sits on one uniform 16-unit rhythm, so the wrapper groups
	   this markup keeps for the mobile layouts all carry the same gap and no extra padding. */
	.hud-left {
		display: flex;
		align-items: center;
		gap: calc(var(--hud-u) * 16);
		flex: 0 0 auto;
	}

	.hud-buy {
		display: flex;
		align-items: center;
		justify-content: flex-start;
		flex: 0 0 auto;
		padding-top: 0;
	}

	/* Balance | rule | Win are 12 apart in the design (node 6589:4362); the bet group that follows is
	   a separate top-level item on the 16 rhythm, hence the 4-unit make-up margin. */
	.hud-stats {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(var(--hud-u) * 12);
		flex: 0 0 auto;
		min-width: 0;
	}

	.hud-controls {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: calc(var(--hud-u) * 16);
		flex: 0 0 auto;
		padding-top: 0;
	}

	.value-pill {
		min-width: 0;
		padding: 0;
		box-sizing: border-box;
		border-left: none;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: calc(var(--hud-u) * 2);
	}

	.stats-divider {
		flex: 0 0 auto;
		width: 1px;
		height: calc(var(--hud-u) * 49);
		background: rgba(189, 70, 198, 0.8);
	}

	/* 130.333 x 46.667 with 6.667 side padding (node 6589:4363). */
	.value-pill--balance {
		height: calc(var(--hud-u) * 46.667);
		padding: 0 calc(var(--hud-u) * 6.667);
		flex: 0 0 auto;
		width: calc(var(--hud-u) * 130.333);
		overflow: hidden;
	}

	/* 66 wide (node 6589:4367) — the value is fitText-shrunk rather than allowed to push the row. */
	.value-pill--win {
		flex: 0 0 auto;
		width: calc(var(--hud-u) * 66);
		overflow: hidden;
	}

	.value-pill--balance .label--balance {
		justify-content: flex-start;
	}

	/* 116 x 49 with a 10 gap between the coin and the text column (node 6589:4371). */
	.value-pill--bet {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: calc(var(--hud-u) * 10);
		height: calc(var(--hud-u) * 49);
		padding: 0;
		border-left: none;
		flex: 0 0 auto;
		margin-left: calc(var(--hud-u) * 4);
	}

	.bet-values {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0;
		width: calc(var(--hud-u) * 66);
		min-width: 0;
		overflow: hidden;
	}

	.bet-coin {
		pointer-events: none;
		width: calc(var(--hud-u) * 40);
		height: calc(var(--hud-u) * 40);
		display: grid;
		place-items: center;
		flex: 0 0 auto;
	}

	/* The glyph is 24 inside a 40 box (node I6589:4372;2503:4361) — it does not fill the box. */
	.bet-coin img {
		width: calc(var(--hud-u) * 24);
		height: calc(var(--hud-u) * 24);
		object-fit: contain;
		display: block;
	}

	.bet-pill {
		cursor: pointer;
	}

	/* 10px / 2px tracking / #bd46c6, 15px line box, Nunito Sans ExtraBold (node 6957:7108). */
	.label {
		font-family: 'Nunito Sans', sans-serif;
		font-size: calc(var(--hud-u) * 10);
		line-height: calc(var(--hud-u) * 15);
		letter-spacing: calc(var(--hud-u) * 2);
		text-transform: uppercase;
		font-weight: 800;
		color: #bd46c6;
		display: flex;
		align-items: center;
		gap: calc(var(--hud-u) * 4);
	}

	.label--balance {
		gap: calc(var(--hud-u) * 4);
		align-items: center;
		justify-content: flex-start;
		width: 100%;
	}

	.label-text {
		display: inline-block;
	}

	/* 24px white, 32px line box, Lilita One (node 6957:7109). */
	.value {
		font-family: 'Lilita One', sans-serif;
		font-size: calc(var(--hud-u) * 24);
		line-height: calc(var(--hud-u) * 32);
		font-weight: 400;
		color: #fff;
		white-space: nowrap;
		max-width: 100%;
		overflow: hidden;
	}

	.stepper,
	.action-cluster {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(var(--hud-u) * 16);
		padding-top: 0;
	}

	/* 48 circle, 1px #d836fc hairline, near-black fill lifting to #1a0535 at the bottom
	   (component "Icon buttons"). No gold anywhere in this design. */
	.nav-btn {
		width: calc(var(--hud-u) * 48);
		height: calc(var(--hud-u) * 48);
		border: 1px solid #d836fc;
		border-radius: 9999px;
		background: linear-gradient(0deg, #1a0535 0%, #000 100%);
		padding: 0;
		outline: none;
		cursor: pointer;
		flex: 0 0 auto;
		display: grid;
		place-items: center;
		box-sizing: border-box;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}

	/* Each glyph carries its own designed size below; this is only the shared reset. */
	.nav-btn img {
		object-fit: contain;
		display: block;
		pointer-events: none;
	}

	/* Menu 17.5x15, sound 22.5x16.09 (nodes 2503:4292, 2503:4295). Class-tagged rather than matched
	   positionally: the landscape layout renders this same pair inside .stepper instead. */
	.nav-btn--menu img {
		width: calc(var(--hud-u) * 17.5);
		height: calc(var(--hud-u) * 15);
	}
	/* The close (X) glyph is square and reads smaller than the wide burger at the same box — size it
	   up while open so the two icons look the same weight. */
	.nav-btn--menu.is-open img {
		width: calc(var(--hud-u) * 23);
		height: calc(var(--hud-u) * 23);
	}

	.nav-btn--sound img {
		width: calc(var(--hud-u) * 22.5);
		height: calc(var(--hud-u) * 16.09);
	}

	/* Stepper: 48.696 circles carrying the -/+ glyphs at their designed sizes
	   (nodes 2503:4319, 2503:4322). */
	.nav-btn--step {
		width: calc(var(--hud-u) * 48.696);
		height: calc(var(--hud-u) * 48.696);
	}

	.step-glyph--minus {
		width: calc(var(--hud-u) * 13.854);
		height: calc(var(--hud-u) * 2.13);
	}

	.step-glyph--plus {
		width: calc(var(--hud-u) * 13.854);
		height: calc(var(--hud-u) * 13.854);
	}

	/* Turbo: the design's bolt art is rendered at 38.667 square, of which a 20x28 window is the
	   visible bolt. Two bolts (super turbo) shrink so the pair still clears the 48 circle. */
	/* Full-button-frame glyph (the bolt is authored in place inside a 48u frame), so it just fills
	   the circle — no per-state sizing gymnastics. */
	.turbo-glyph {
		width: calc(var(--hud-u) * 48);
		height: calc(var(--hud-u) * 48);
		flex: 0 0 auto;
		pointer-events: none;
	}

	/* Autoplay: arrow glyph over an 8px caption, stacked (nodes 2503:4335, 2503:4339). */
	.nav-btn--auto {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: calc(var(--hud-u) * 2);
	}

	.auto-glyph {
		width: calc(var(--hud-u) * 11.23);
		height: calc(var(--hud-u) * 10.5);
	}

	.auto-label {
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: calc(var(--hud-u) * 8);
		line-height: calc(var(--hud-u) * 12);
		letter-spacing: calc(var(--hud-u) * -0.2);
		text-transform: uppercase;
		color: #fff;
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
		position: relative;
		display: flex;
		align-items: center;
		gap: calc(var(--hud-u) * 8);
		flex: 0 0 auto;
	}

	/* Burger settings menu — pops above the menu button. Fixed pixel sizing (like the Magnetic game)
	   so it stays the SAME size at every resolution instead of scaling with the bar. */
	.hud-menu {
		position: absolute;
		/* Align the panel's left edge with the nav bar's left frame edge (the menu button is inset
		   from it), and lift it clear of the bar so the two never overlap. Both offsets track the bar
		   via --hud-u. */
		left: calc(var(--hud-u) * -24);
		bottom: calc(100% + var(--hud-u) * 24);
		z-index: 30;
		display: flex;
		flex-direction: column;
		min-width: 168px;
		padding: 10px 15px;
		border-radius: 16px;
		background: linear-gradient(180deg, rgba(34, 10, 60, 0.97), rgba(12, 4, 26, 0.98));
		border: 1px solid rgba(160, 96, 246, 0.55);
		box-shadow:
			0 6px 18px rgba(0, 0, 0, 0.5),
			0 0 16px rgba(130, 66, 224, 0.4),
			inset 0 0 12px rgba(96, 44, 190, 0.25);
	}
	.hud-menu__item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 2px;
		border: 0;
		background: none;
		cursor: pointer;
		/* Label inherits this colour; the icon (a mask filled with currentColor) follows it too, so
		   hover recolours both together. */
		color: #fff;
		transition: color 0.14s ease;
		text-align: left;
	}
	.hud-menu__item:hover,
	.hud-menu__item:focus-visible {
		color: #e070ff;
		outline: none;
	}
	.hud-menu__item.is-off {
		color: rgba(255, 255, 255, 0.42);
	}
	.hud-menu__item.is-off:hover {
		color: #e070ff;
	}
	.hud-menu__badge {
		flex: 0 0 auto;
		width: 32px;
		height: 32px;
		display: grid;
		place-items: center;
		border-radius: 50%;
		border: 1px solid rgba(160, 96, 246, 0.6);
		background: linear-gradient(to top, #1a0a38, #05010c);
		transition: box-shadow 0.14s ease;
	}
	.hud-menu__item:hover .hud-menu__badge {
		box-shadow: 0 0 6px 1px rgba(160, 96, 246, 0.85);
	}
	.hud-menu__glyph {
		width: 16px;
		height: 16px;
		background: currentColor;
		mask: var(--icon) center / contain no-repeat;
		-webkit-mask: var(--icon) center / contain no-repeat;
	}
	.hud-menu__label {
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		font-size: 14px;
		letter-spacing: 0.05em;
		color: inherit;
	}
	.hud-menu__divider {
		height: 1px;
		background: rgba(160, 96, 246, 0.3);
		margin: 0 2px;
	}

	/* 134 x 118.538 (node 4173:27432) — the tallest item in the row, which is why .hud-bottom is
	   118.538 tall while the plate behind it is only 107. */
	.spin-btn {
		width: calc(var(--hud-u) * 134);
		height: calc(var(--hud-u) * 118.538);
		margin: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		box-shadow: none;
		padding: 0;
		outline: none;
		cursor: pointer;
		display: grid;
		place-items: center;
		/* The design centres this in the row like everything else; the overhang past the plate comes
		   from the row being taller than the plate, not from an offset. */
		transform: none;
		position: relative;
		z-index: 3;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
		color: #fff;
	}

	/* The button is a stack: one marquee ring (spin-bg) with a glyph centred on it. The ring art is
	   square and centred on its own circle, so `rotate()` turns about the circle's centre with no
	   transform-origin correction — that squareness is the whole reason the build script crops the
	   way it does.

	   Every variant below is sized and nudged so the RING — not the image frame — lands in exactly
	   the place the old flat composites put it; the numbers are printed by
	   scripts/spin-button/build_spin_button.py, which derives them FROM those composites. All values
	   are percentages so the mobile layouts, which resize .spin-btn, keep the same relationship. */
	.spin-btn__img {
		position: absolute;
		left: 50%;
		top: 50%;
		/* Height-driven with an auto width so the source aspect is preserved no matter what aspect
		   .spin-btn itself has — portrait overrides it to a square. --art-h is what makes the ring
		   88.58% of the button height (105 of 118.538) in every state. */
		width: auto;
		height: var(--art-h);
		transform: translate(calc(-50% + var(--art-dx)), calc(-50% + var(--art-dy)));
		object-fit: contain;
		display: block;
		pointer-events: none;
		transition: opacity 0.12s ease;
		filter: drop-shadow(0 0 12px rgba(255, 79, 216, 0.35));
	}

	.spin-btn__img--bg {
		--art-h: 88.115%;
		--art-dx: 0%;
		--art-dy: 4.44%;
	}

	.spin-btn__img--arrow {
		--art-h: 34.591%;
		--art-dx: -0.676%;
		--art-dy: 9.284%;
	}

	.spin-btn__img--stopglyph {
		--art-h: 19.633%;
		--art-dx: -1.786%;
		--art-dy: 23.501%;
	}

	/* The marquee spins whenever the player engages the button — pointer, keyboard focus, the press
	   itself — and keeps spinning for as long as the round is running. Keyed off .spin-btn rather
	   than the image so the glyph swap at spin-start doesn't interrupt it.

	   translate() is repeated in the keyframes because the element's placement lives in the same
	   `transform` property; dropping it here would fling the ring to the button's top-left. */
	@keyframes spin-btn-ring {
		from {
			transform: translate(calc(-50% + var(--art-dx)), calc(-50% + var(--art-dy))) rotate(0deg);
		}
		to {
			transform: translate(calc(-50% + var(--art-dx)), calc(-50% + var(--art-dy))) rotate(360deg);
		}
	}

	.spin-btn:not(:disabled):hover .spin-btn__img--bg,
	.spin-btn:not(:disabled):focus-visible .spin-btn__img--bg,
	.spin-btn:not(:disabled):active .spin-btn__img--bg,
	.spin-btn.is-spinning .spin-btn__img--bg {
		animation: spin-btn-ring 2.4s linear infinite;
	}

	/* Faster while the reels are actually turning, so the button reads as "running" rather than just
	   "hovered". */
	.spin-btn.is-spinning .spin-btn__img--bg {
		animation-duration: 1.1s;
	}

	@media (prefers-reduced-motion: reduce) {
		.spin-btn .spin-btn__img--bg {
			animation: none;
		}
	}

	/* The old press state swapped in a separate export whose only real difference was a bigger outer
	   glow (its ring measured the same 377px). A filter reproduces that without a second download —
	   and without the 16% size jump that export actually introduced. */
	.spin-btn:not(:disabled):active .spin-btn__img--bg {
		filter: drop-shadow(0 0 14px rgba(209, 0, 255, 0.75)) brightness(1.06);
	}

	/* The old stepper art carried its own circle, so the button chrome was switched off for it. The
	   -/+ are bare glyphs now and take the same circle as every other icon button. */

	.spin-btn:not(:disabled):hover {
		transform: translateY(-2px);
		filter: brightness(1.08);
	}

	.spin-btn:not(:disabled):active {
		transform: translateY(1px) scale(0.96);
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
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
		pointer-events: none;
	}

	.spin-btn__count {
		font-size: 1.5rem;
	}

	/* 159 x 48 hit box (node 4169:27091). The marquee plate art is 178 x 59 and is deliberately
	   BIGGER than the box — the design lets the gold frame and its glow bleed out on all four sides
	   (inset -5.97% horizontally, -11.46% vertically) rather than fitting it inside. */
	.buy-btn {
		width: calc(var(--hud-u) * 159);
		/* aspect-ratio rather than a fixed height: the mobile layouts override only the width, and a
		   fixed height would squash the marquee plate. */
		aspect-ratio: 159 / 48;
		height: auto;
		border: 0;
		border-radius: 0;
		background: none;
		box-shadow: none;
		padding: 0;
		outline: none;
		cursor: pointer;
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}

	.buy-btn__plate {
		position: absolute;
		left: -5.97%;
		top: -11.46%;
		width: 111.94%;
		height: 122.92%;
		pointer-events: none;
	}

	.buy-btn:not(:disabled):hover {
		transform: translateY(-1px);
		filter: brightness(1.1);
	}

	.buy-btn:not(:disabled):active {
		transform: translateY(1px) scale(0.95);
	}

	/* Lilita One 12 / 1.4 tracking / 20 line box, white (node 6004:4333). */
	.buy-btn__label {
		position: relative;
		font-family: 'Lilita One', sans-serif;
		font-size: calc(var(--hud-u) * 12);
		font-weight: 400;
		color: #fff;
		letter-spacing: calc(var(--hud-u) * 1.4);
		text-transform: uppercase;
		line-height: calc(var(--hud-u) * 20);
		text-align: center;
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
		width: min(98px, 13vw);
		min-width: 0;
		max-width: 100%;
		overflow: hidden;
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
	/* ── Mobile layouts ──────────────────────────────────────────────────────────────────────────
	   Figma 6281-1791 specifies the DESKTOP bar only: one row, 1126 wide, backed by the neon plate
	   art. Landscape floats the same controls over the board, so it cannot use a 1126x107 pill: it
	   takes the design's palette, glyphs and type but keeps its own geometry — hence the plate is
	   dropped and the row height goes back to auto here. Without this the fixed row height and the
	   stretched plate wrecked it. Portrait no longer renders .hud-bottom at all — it has its own
	   .pt-hud marquee below — but the rules stay keyed to both so the fallback is safe. */
	.hud-shell[data-layout='portrait'] .hud-plate,
	.hud-shell[data-layout='landscape'] .hud-plate {
		display: none;
	}

	.hud-shell[data-layout='portrait'] .hud-bottom,
	.hud-shell[data-layout='landscape'] .hud-bottom {
		height: auto;
	}

	/* ===== MOBILE-LANDSCAPE HUD — two side columns flanking the board =====================
	   A full-screen overlay whose groups are pinned to the left/right margins so nothing floats over
	   the reels. Buttons reuse the round marquee art; sizes are vh-based so the columns scale with a
	   short landscape viewport. */
	.ls-hud {
		position: absolute;
		inset: 0;
		z-index: 6;
		pointer-events: none;
		font-family: Helvetica, Arial, sans-serif;
	}
	.ls-hud > * {
		pointer-events: auto;
	}

	/* Shared neon pill (balance / win). Design spec: magenta top border + soft drop shadow, 8px radius. */
	.ls-pill {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
		padding: 3px 9px;
		border-radius: 8px;
		border: none;
		border-top: 1px solid #9f0ac0;
		background: rgba(22, 7, 46, 0.82);
		box-shadow: 0px 2px 10px 0px #0000008c;
		backdrop-filter: blur(4px);
		box-sizing: border-box;
	}
	/* Balance: label + value on one row. */
	.ls-pill--balance {
		flex-direction: row;
		align-items: baseline;
		justify-content: center;
		gap: 6px;
		padding: 4px 10px;
	}
	.ls-pill__label {
		font-size: clamp(0.38rem, 1.1vh, 0.5rem);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #b79ae6;
		line-height: 1.1;
	}
	.ls-pill__value {
		font-size: clamp(0.56rem, 1.75vh, 0.76rem);
		font-weight: 800;
		color: #fff;
		white-space: nowrap;
		line-height: 1.1;
	}

	/* Left column: balance above the bet stepper, small, pinned to the bottom-left. */
	.ls-left {
		position: absolute;
		left: 2.4%;
		bottom: 5%;
		display: flex;
		flex-direction: column;
		gap: clamp(4px, 1.1vh, 8px);
		width: clamp(94px, 15vw, 134px);
	}
	.ls-bet {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 5px;
		/* Roomier now that it shows only the value (no BET label). */
		padding: clamp(6px, 1.5vh, 11px) clamp(8px, 1.8vh, 14px);
	}
	.ls-bet__bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		pointer-events: none;
	}
	.ls-bet__values {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		cursor: pointer;
		min-width: 0;
	}
	.ls-bet__value {
		font-size: clamp(0.74rem, 2.3vh, 1rem);
	}
	.ls-step {
		position: relative;
		flex: 0 0 auto;
		width: clamp(24px, 3.8vh, 32px);
		height: clamp(24px, 3.8vh, 32px);
		border: 0;
		padding: 0;
		background: none;
		cursor: pointer;
	}
	.ls-step img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}
	.ls-step:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* Right column: menu · sound · SPIN · turbo · auto inside the neon dock box art, pinned to the
	   right edge and bottom-anchored so its end lines up with BUY BONUS. Taller now (roomier gaps). */
	.ls-actions {
		position: absolute;
		right: 1.8%;
		bottom: 15%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(8px, 2.4vh, 16px);
		padding: clamp(13px, 3vh, 22px) clamp(6px, 1.5vh, 12px);
	}
	.ls-actions__bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		pointer-events: none;
		z-index: 0;
	}
	.ls-actions > button {
		position: relative;
		z-index: 1;
	}
	.ls-btn {
		width: clamp(34px, 5.7vh, 46px);
		height: clamp(34px, 5.7vh, 46px);
		border: 0;
		padding: 0;
		background: none;
		cursor: pointer;
		display: block;
	}
	.ls-btn img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}
	.ls-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	/* The turn button — taller than it is wide so the dock stays narrow (leaving room for BUY BONUS)
	   while the ring still reads as the biggest control. The ring art is height-driven, so it fills
	   the taller box and slightly overhangs the narrow width, which reads as it popping out. */
	.ls-spin.spin-btn {
		width: clamp(56px, 10.5vh, 84px);
		height: clamp(88px, 17vh, 132px);
	}
	.ls-spin .spin-btn__count {
		position: relative;
		z-index: 4;
		font-weight: 800;
		color: #fff;
		font-size: clamp(0.7rem, 2.4vh, 1rem);
	}

	/* BUY BONUS — round button, seated left of the action dock near the bottom. Bigger so the
	   two-word label fits inside the circle. */
	/* BUY BONUS — bottom aligned with the dock's end, and centred horizontally in the gap between the
	   board and the dock. The gap runs from the dock's left edge (~1.8% + 68px) to the board's right
	   edge (~23.6% of the viewport), so its centre is ~16.6% from the right; place the button's centre
	   there (right edge = centre − half its width). */
	.ls-buy {
		position: absolute;
		/* Right edge just onto the dock's left edge (≈ 1.8% + ~68px) — a few px over its neon border,
		   still clear of the buttons inside. */
		right: calc(1.8% + 64px);
		bottom: 15%;
		width: clamp(66px, 12.5vh, 98px);
		height: clamp(66px, 12.5vh, 98px);
		border: 0;
		padding: 0;
		background: none;
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	.ls-buy img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	.ls-buy__label {
		position: relative;
		z-index: 2;
		/* Narrow enough that "BUY BONUS" wraps onto two rows, as the design shows. */
		max-width: 58%;
		font-size: clamp(0.5rem, 1.85vh, 0.68rem);
		font-weight: 800;
		line-height: 1.08;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		text-align: center;
		color: #fff;
	}
	.ls-buy:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* WIN — bottom-right corner, label + value on a single row. Bigger and more square (8px radius). */
	.ls-pill--win {
		position: absolute;
		right: 1.8%;
		bottom: 3%;
		flex-direction: row;
		align-items: baseline;
		justify-content: center;
		gap: 7px;
		width: auto;
		min-width: clamp(126px, 17vw, 172px);
		padding: 7px 16px;
	}
	.ls-pill--win .ls-pill__value {
		font-size: clamp(0.68rem, 2.15vh, 0.92rem);
	}
	.ls-pill--win .ls-pill__label {
		font-size: clamp(0.44rem, 1.35vh, 0.58rem);
	}

	/* ===== PORTRAIT HUD — dedicated 2-row marquee layout ===== */
	.hud-shell[data-layout='portrait'] {
		/* MUST carry a unit. The desktop value is a length (a vw/px expression over 1126), so every
		   `calc(var(--hud-u) * N)` below resolves to a length. A bare `1` here made those unitless,
		   which silently dropped the width/height/font-size declarations and — because a unitless
		   line-height is legal — turned `line-height: calc(var(--hud-u) * 20)` into "20x font-size",
		   blowing the bar up to 900px tall. */
		--hud-u: 1px;
		padding: 0 4px calc(8px + env(safe-area-inset-bottom, 0px));
	}

	/* Self-contained: the base .hud-shell::after this used to extend was dropped along with the
	   desktop scrim, so every property the pseudo-element needs to exist has to be declared here.
	   Portrait keeps a scrim because the marquee HUD sits over the busiest part of the park art. */
	.hud-shell[data-layout='portrait']::after {
		content: '';
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		z-index: 5;
		pointer-events: none;
		height: 230px;
		/* translucent so the park scene shows through behind the HUD (design), still aids legibility */
		background: linear-gradient(
			to top,
			rgba(8, 4, 20, 0.74) 0%,
			rgba(8, 4, 20, 0.5) 52%,
			rgba(8, 4, 20, 0) 100%
		);
	}

	/* Portrait draws its own pill in CSS since the plate art cannot back a three-row stack. Colours
	   are the design's: near-black lifting to #1a0535, hairline #d836fc. */
	.hud-shell[data-layout='portrait'] .hud-bottom {
		width: min(97vw, 440px);
		display: flex;
		flex-direction: column;
		gap: 5px;
		padding: 6px 10px;
		border-radius: 30px;
		background: linear-gradient(0deg, #1a0535 0%, #05010c 100%);
		border: 1px solid #d836fc;
		box-shadow:
			0 0 18px rgba(216, 54, 252, 0.25),
			0 12px 26px rgba(0, 0, 0, 0.45);
	}

	.hud-shell[data-layout='portrait'] .hud-controls {
		order: 0;
		width: 100%;
		justify-content: center;
		gap: 8px;
	}

	/* Portrait logo stack: Press Play mark stacked above the THEME PARK logo; the stack's bottom
	   (the game logo) sits just above the board (inline top + translateY(-100%)). */
	.hud-shell[data-layout='portrait'] .pt-logo-stack {
		position: absolute;
		left: 50%;
		transform: translate(-50%, -100%);
		transition: opacity 220ms ease;
		z-index: 4;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		pointer-events: none;
	}
	.hud-shell[data-layout='portrait'] .pt-themelogo {
		width: clamp(168px, 46vw, 272px);
		height: auto;
		filter: drop-shadow(0 6px 11px rgba(0, 0, 0, 0.7));
	}
	.hud-shell[data-layout='portrait'] .pt-pressplay {
		width: clamp(92px, 28vw, 140px);
		height: auto;
		filter: drop-shadow(0 3px 7px rgba(0, 0, 0, 0.55));
	}

	.pt-hud {
		pointer-events: auto;
		position: relative;
		z-index: 6;
		align-self: center;
		/* Lifted off the very bottom edge ("move to the top a bit"). */
		margin-top: auto;
		margin-bottom: 22px;
		width: min(97vw, 460px);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 22px;
		font-family: 'Lilita One', sans-serif;
	}

	/* --- Controls row: the Navigation plate art (bar_plate) is the bar background; the buttons sit
	   on top. Buy bonus = 100% bar height, spin exceeds it, menu/turbo/auto smaller & inside. --- */
	/* 3-column grid: [left group | spin | right group]. The 1fr side columns are equal, so the
	   spin (auto centre column) is always dead-centre; each side spreads its two buttons. */
	.pt-controls {
		position: relative;
		width: 94%;
		height: 62px;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		grid-template-rows: 100%;
		column-gap: 12px;
		align-items: center;
		align-content: center;
		padding: 0 10px;
		overflow: visible;
	}
	.pt-bar-bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		z-index: 0;
		pointer-events: none;
	}
	.pt-controls > :not(.pt-bar-bg) {
		position: relative;
		z-index: 1;
	}
	.pt-side {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.pt-btn {
		flex: 0 0 auto;
		width: 34px;
		height: 34px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		display: grid;
		place-items: center;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}
	.pt-btn img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}
	.pt-btn:active {
		transform: scale(0.92);
	}
	.pt-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}
	.pt-btn.active img,
	.pt-turbo[data-speed='fast'] img,
	.pt-turbo[data-speed='super'] img {
		filter: drop-shadow(0 0 7px rgba(120, 200, 255, 0.9));
	}

	/* Buy bonus — round purple button, bigger than the small buttons, centered in the bar. */
	.pt-buy {
		position: relative;
		width: 60px;
		height: 60px;
		align-self: center;
	}
	.pt-buy__label {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		font-weight: 800;
		font-size: 0.48rem;
		line-height: 1.05;
		letter-spacing: 0.01em;
		color: #fff;
		text-transform: uppercase;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.7);
		text-align: center;
		overflow-wrap: break-word;
		pointer-events: none;
		/* narrow enough that "BUY BONUS" wraps to two lines inside the round button */
		padding: 0 16px;
	}

	/* Spin — the largest button of the row, centered and sitting inside the bar. (The art has ~13%
	   transparent padding, so the visible ring is smaller than the box and stays inside the bar.) */
	.pt-spin {
		flex: 0 0 auto;
		position: relative;
		align-self: center;
		width: 98px;
		height: 98px;
		margin: 0;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		display: grid;
		place-items: center;
		transition: transform 0.12s ease;
		z-index: 2;
	}
	/* Same two-layer stack as the landscape button. The ring art is square and centred on its own
	   circle, so a plain 100% box puts the ring exactly where the old composite had it and lets the
	   ring rotate without drifting. The glyph percentages are the design's glyph-to-ring ratios. */
	.pt-spin__img {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		object-fit: contain;
		display: block;
		pointer-events: none;
	}
	.pt-spin__img--bg {
		width: 100%;
		height: 100%;
		filter: drop-shadow(0 4px 12px rgba(0, 0, 0, 0.5));
	}
	.pt-spin__img--arrow {
		width: 39.3%;
		height: 39.3%;
		transform: translate(calc(-50% - 0.27%), calc(-50% - 0.8%));
	}
	.pt-spin__img--stopglyph {
		width: 22.3%;
		height: 22.3%;
		transform: translate(calc(-50% - 0.4%), calc(-50% + 0.9%));
	}

	@keyframes pt-spin-ring {
		from {
			transform: translate(-50%, -50%) rotate(0deg);
		}
		to {
			transform: translate(-50%, -50%) rotate(360deg);
		}
	}

	.pt-spin:not(:disabled):hover .pt-spin__img--bg,
	.pt-spin:not(:disabled):focus-visible .pt-spin__img--bg,
	.pt-spin:not(:disabled):active .pt-spin__img--bg,
	.pt-spin.is-spinning .pt-spin__img--bg {
		animation: pt-spin-ring 2.4s linear infinite;
	}
	.pt-spin.is-spinning .pt-spin__img--bg {
		animation-duration: 1.1s;
	}
	@media (prefers-reduced-motion: reduce) {
		.pt-spin .pt-spin__img--bg {
			animation: none;
		}
	}
	.pt-spin:active {
		transform: scale(0.94);
	}
	.pt-spin:disabled {
		opacity: 0.6;
		cursor: default;
	}
	.pt-spin__count {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		font-weight: 800;
		font-size: 1.15rem;
		color: #fff;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
		pointer-events: none;
	}

	/* --- Stats strip: balance | bet(-/+) | win --- */
	.pt-stats {
		width: 100%;
		display: flex;
		align-items: stretch;
		justify-content: center;
		gap: 7px;
	}
	/* balance / win — black, semi-transparent box */
	.pt-pill {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		padding: 5px 8px;
		border-radius: 14px;
		background: rgba(0, 0, 0, 0.42);
		border: 1px solid rgba(255, 255, 255, 0.08);
		overflow: hidden;
	}
	.pt-pill__label {
		font-size: 0.55rem;
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #fff;
		white-space: nowrap;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.75);
	}
	.pt-pill__value {
		max-width: 100%;
		font-size: 0.92rem;
		font-weight: 700;
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.8);
	}
	/* bet — the purple box art (Variant8) fills the cell; −, value and + sit inside it. */
	.pt-bet {
		position: relative;
		flex: 1.5 1 0;
		min-width: 0;
		height: 50px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		padding: 0 18px;
	}
	.pt-bet__bg {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: fill;
		z-index: 0;
		pointer-events: none;
	}
	.pt-bet > :not(.pt-bet__bg) {
		position: relative;
		z-index: 1;
	}
	/* small step buttons that fit inside the bet box with clear margin */
	.pt-bet .pt-step {
		width: 28px;
		height: 28px;
	}
	.pt-bet__values {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		cursor: pointer;
		overflow: hidden;
	}
	.pt-step {
		flex: 0 0 auto;
		width: 40px;
		height: 40px;
		padding: 0;
		border: 0;
		background: transparent;
		cursor: pointer;
		display: grid;
		place-items: center;
		transition: transform 0.1s ease;
	}
	.pt-step img {
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}
	.pt-step:active {
		transform: scale(0.9);
	}
	.pt-step:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
