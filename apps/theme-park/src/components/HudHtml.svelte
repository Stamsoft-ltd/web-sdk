<script lang="ts" module>
	import { ap } from '../lib/preloadArt';
	import { fitLabel } from '../lib/fitLabel';

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
	// The bar's plate, its BUY pill and its spin ring used to be three pieces of neon marquee art
	// (bar_plate-clean.webp, buy_plate.webp, spin-bg.webp). The redesign draws all three as flat
	// shapes — a filled rounded rectangle, a gradient pill, a gradient ring — so they are CSS now
	// and none of that art is loaded any more: Figma 7033:25229 retired it on desktop, 7063:17249
	// on portrait, which was the last layout still carrying the old pieces.
	//
	// The spin ring is still a separate element from the glyph on top of it, for the same reason it
	// always was: the ring is identical in every state and keeps spinning across a glyph swap.
	const navSpinArrow = ap('/assets/theme-park/v2/controls/spin-arrow.webp');
	const navSpinStopGlyph = ap('/assets/theme-park/v2/controls/spin-stop-glyph.webp');
	const navCoins = ap('/assets/theme-park/v2/hud/icon_coin.svg');
	// The redrawn lockup (Figma 7033:25250), and the SAME file the splash, the info modal and the
	// max-win card already load — the old rendered logo it replaced was a second copy of the title
	// with a coaster car bolted to its left end, and nothing in the redesign has that car.
	const gameLogo = ap('/assets/theme-park/v2/splash/logo.webp');
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
	// Mobile landscape's speed button (portrait and desktop use the turbo-1/2/3 webps above). One
	// bolt per step: OFF is the outlined bolt, turbo is one solid bolt, super turbo is two. The three
	// files used to hold that art rotated by one — btn-turbo.png carried a solid bolt, so the button
	// read as "turbo on" while turbo was off.
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

	// The THEME PARK logo tracks the board: it sits just above the portrait board frame. MainContainer
	// maps a logical point to CSS px as cssY = canvasH/2 + (logicalY − mainH/2) · scale, so this is
	// that mapping applied to whatever top the board reports. Read rather than hard-coded: the board
	// settles further down the taller the screen is (PORTRAIT_SETTLE), and a fixed number left the logo
	// stranded halfway up the sky.
	const portraitLogoTop = $derived.by(() => {
		if (!isPortrait) return null;
		const canvas = context.stateLayoutDerived.canvasSizes();
		const main = context.stateLayoutDerived.mainLayout();
		const board = context.stateGameDerived.boardLayout();
		const boardTopCss = canvas.height / 2 + (board.frameTopY - main.height / 2) * main.scale;
		// logo BOTTOM anchored just above the board frame — small gap so it nearly touches
		return Math.max(6, Math.round(boardTopCss + 10));
	});

	/**
	 * The two x positions the landscape HUD cannot get from CSS, in canvas px: the centre of the gutter
	 * left of the board (which the balance/bet column shares with the free-spin plates, so the two line
	 * up in one column) and the centre of the gap between the board and the action dock (where BUY
	 * BONUS goes). Both edges belong to the board, which is drawn on the canvas.
	 */
	/**
	 * The dock's rendered width, measured rather than recomputed. Its box is as wide as its widest
	 * child, which is the spin button and not the small round ones, and every attempt to mirror that
	 * arithmetic here goes stale the moment one of the clamps changes.
	 */
	let lsDockWidth = $state(0);

	const landscapeColumns = $derived.by(() => {
		if (!isLandscapeMobile) return null;
		const canvas = context.stateLayoutDerived.canvasSizes();
		const main = context.stateLayoutDerived.mainLayout();
		const board = context.stateGameDerived.boardLayout();
		const toCss = (x: number) => canvas.width / 2 + (x - main.width / 2) * main.scale;
		const frameLeft = toCss(board.frameCx - board.frameW / 2);
		const frameRight = toCss(board.frameCx + board.frameW / 2);
		const clamp = (min: number, value: number, max: number) => Math.min(max, Math.max(min, value));
		const vh = canvas.height / 100;
		// 1.8% mirrors the dock's own `right` in CSS — it has to, or the gap is measured to the wrong
		// edge and the button drifts into the dock.
		const dockLeft = canvas.width - canvas.width * 0.018 - lsDockWidth;
		// Centring BUY BONUS in the gap is only half the job: on the narrower popouts the gap is smaller
		// than the button, and a centred button that does not fit overlaps BOTH edges. So it is sized to
		// the gap as well, keeping a margin off the board's rail and the dock's border. The margin is
		// small because the gap is the scarce thing here — the board's neon rail and the dock's border
		// both fade out at their edges, so a few pixels read as clearance already.
		const BUY_MARGIN = 3;
		return {
			left: Math.round(frameLeft / 2),
			buy: Math.round((frameRight + dockLeft) / 2),
			buySize: Math.round(
				clamp(52, Math.min(dockLeft - frameRight - BUY_MARGIN * 2, 18 * vh), 104),
			),
		};
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
	// One word, not "BUY BONUS" — the redesign labels this button BONUS (Figma 7033:25229) and every
	// message map carries the key. 'BUY BONUS' is still the title of the dialog the button opens.
	const buyLabel = $derived(
		isAnyModeActive ? i18nDerived.translate('DEACTIVATE') : i18nDerived.bonus(),
	);
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
		)
			return;
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
		<div
			class="ls-hud"
			style:--ls-left-x="{landscapeColumns?.left ?? 0}px"
			style:--ls-buy-x="{landscapeColumns?.buy ?? 0}px"
			style:--ls-buy-size="{landscapeColumns?.buySize ?? 66}px"
		>
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
						<span class="ls-pill__value ls-bet__value" use:fitText={formattedBet}
							>{formattedBet}</span
						>
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

			<div class="ls-actions" bind:clientWidth={lsDockWidth}>
				<img class="ls-actions__bg" src={lsNavBox} alt="" aria-hidden="true" />
				<button
					class="ls-btn"
					type="button"
					onclick={openRules}
					aria-label={i18nDerived.gameRules()}
				>
					<img src={ptMenu} alt="" />
				</button>
				<button
					class="ls-btn"
					type="button"
					onclick={toggleSound}
					aria-label={i18nDerived.translate('SOUND')}
				>
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
					<span class="spin-btn__img spin-btn__ring" aria-hidden="true">
						<span class="spin-btn__disc"></span>
					</span>
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
				<span class="ls-buy__label" use:fitLabel={{ dep: buyLabel, maxFraction: 0.82 }}
					>{buyLabel}</span
				>
			</button>

			<div class="ls-pill ls-pill--win">
				<span class="ls-pill__label">{i18nDerived.win()}</span>
				<span class="ls-pill__value" use:fitText={formattedWin}>{formattedWin}</span>
			</div>
		</div>
	{:else if !isPortrait}
		<div class="hud-bottom">
			<!-- The bar. Still a sibling rather than a background on the row, because the spin button
		     overhangs it top and bottom: the plate has to sit BEHIND the row at its own smaller height
		     while the row keeps the taller box. It used to be neon art with running lights along its
		     edge; the redesign has neither, so it is a plain rounded rectangle now. -->
			<div class="hud-plate" aria-hidden="true"></div>
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
					<!-- The redesign puts one button on this end of the bar, not two. The sound toggle that
				     used to sit beside the burger is still reachable — it is the first item in the menu
				     the burger opens, next to MUSIC and INFO. -->

					{#if menuOpen}
						<div class="hud-menu" role="menu">
							<button
								class="hud-menu__item"
								class:is-off={isMuted}
								type="button"
								role="menuitem"
								onclick={toggleSound}
							>
								<span class="hud-menu__badge"
									><span class="hud-menu__glyph" style={`--icon:url('${menuIconSound}')`}
									></span></span
								>
								<span class="hud-menu__label">{i18nDerived.translate('SOUND')}</span>
							</button>
							<div class="hud-menu__divider"></div>
							<button
								class="hud-menu__item"
								class:is-off={musicMuted}
								type="button"
								role="menuitem"
								onclick={toggleMusic}
							>
								<span class="hud-menu__badge"
									><span class="hud-menu__glyph" style={`--icon:url('${menuIconMusic}')`}
									></span></span
								>
								<span class="hud-menu__label">{i18nDerived.translate('MUSIC')}</span>
							</button>
							<div class="hud-menu__divider"></div>
							<button class="hud-menu__item" type="button" role="menuitem" onclick={openInfo}>
								<span class="hud-menu__badge"
									><span class="hud-menu__glyph" style={`--icon:url('${menuIconInfo}')`}
									></span></span
								>
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
						<span class="buy-btn__label" use:fitLabel={{ dep: buyLabel, maxFraction: 0.9 }}
							>{buyLabel}</span
						>
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
						<button
							class="nav-btn nav-btn--menu"
							type="button"
							onclick={openRules}
							aria-label={i18nDerived.gameRules()}
						>
							<img src={navMenu} alt="" />
						</button>
						<button
							class="nav-btn nav-btn--sound"
							type="button"
							onclick={toggleSound}
							aria-label={i18nDerived.translate('SOUND')}
						>
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
					     arrow and stop — remounting it would restart the animation from 0deg and snap.
					     Two elements because the ring is a gradient and the disc inside it is not: the
					     outer box IS the ring's colour and the inner one covers all but its edge. -->
						<span class="spin-btn__img spin-btn__ring" aria-hidden="true">
							<span class="spin-btn__disc"></span>
						</span>
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
								})}>{autoSpinsRemainingText}</span
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
		<!-- PORTRAIT HUD — Figma 7063:17249. Two rows on one 349-unit width: a drawn control plate
	     (menu · BONUS · spin · turbo · auto) and a balance | bet | win strip below it. Every control
	     is the SAME component the desktop bar draws — .nav-btn, .buy-btn, .spin-btn — at the portrait
	     size, so this row is no longer the last consumer of the old marquee art (nav-bar-clean.png,
	     the round btn-*.png set, spin-bg.webp, the neon-frame bet plate). The burger now opens the
	     shared SOUND · MUSIC · INFO menu instead of jumping straight to the rules, which is also how
	     portrait gets a sound toggle back: the design gives this end of the bar one button, not two. -->
		<div class="pt-hud">
			<div class="pt-controls">
				<div class="pt-plate" aria-hidden="true"></div>

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

					{#if menuOpen}
						<div class="hud-menu" role="menu">
							<button
								class="hud-menu__item"
								class:is-off={isMuted}
								type="button"
								role="menuitem"
								onclick={toggleSound}
							>
								<span class="hud-menu__badge"
									><span class="hud-menu__glyph" style={`--icon:url('${menuIconSound}')`}
									></span></span
								>
								<span class="hud-menu__label">{i18nDerived.translate('SOUND')}</span>
							</button>
							<div class="hud-menu__divider"></div>
							<button
								class="hud-menu__item"
								class:is-off={musicMuted}
								type="button"
								role="menuitem"
								onclick={toggleMusic}
							>
								<span class="hud-menu__badge"
									><span class="hud-menu__glyph" style={`--icon:url('${menuIconMusic}')`}
									></span></span
								>
								<span class="hud-menu__label">{i18nDerived.translate('MUSIC')}</span>
							</button>
							<div class="hud-menu__divider"></div>
							<button class="hud-menu__item" type="button" role="menuitem" onclick={openInfo}>
								<span class="hud-menu__badge"
									><span class="hud-menu__glyph" style={`--icon:url('${menuIconInfo}')`}
									></span></span
								>
								<span class="hud-menu__label">{i18nDerived.translate('INFO')}</span>
							</button>
						</div>
					{/if}
				</div>

				<button
					class="buy-btn"
					type="button"
					disabled={disableBuy}
					onclick={isAnyModeActive ? deactivateMode : openBuyBonus}
					aria-label={buyLabel}
				>
					<span class="buy-btn__label" use:fitLabel={{ dep: buyLabel, maxFraction: 0.9 }}
						>{buyLabel}</span
					>
				</button>

				<button
					class="spin-btn pt-spin"
					class:is-spinning={isSpinStop}
					type="button"
					onclick={onSpinButton}
					aria-label={i18nDerived.translate('SPIN')}
					disabled={canInteract && !hasAuto && !canAffordBet}
				>
					<span class="spin-btn__img spin-btn__ring" aria-hidden="true">
						<span class="spin-btn__disc"></span>
					</span>
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

			<div class="pt-stats">
				<div class="pt-pill">
					<span class="pt-pill__label">{i18nDerived.balance()}</span>
					<span class="pt-pill__value" use:fitText={formattedBalance}>{formattedBalance}</span>
				</div>

				<div class="pt-bet">
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

					<div
						class="pt-bet__values"
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && (stateModal.modal = { name: 'betAmountMenu' })}
						onclick={() => (stateModal.modal = { name: 'betAmountMenu' })}
					>
						<span class="pt-bet__value" use:fitText={formattedBet}>{formattedBet}</span>
					</div>

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

	/* Figma 7033:25250 — the redrawn lockup, 282 wide and centred, its box starting 2 down inside a
	   1197 frame. --hud-u is 93.8vw/1126, which works out at one design pixel of that frame to within
	   a quarter of a percent, so these are the design's own numbers rather than a viewport guess.
	   The 7 is the art's own top: the design box is 94 tall and the drawing is 83.7 in it, centred.

	   It was 388 wide for the logo this replaced — that one was a wider lockup with a coaster car on
	   its left end, and carrying its width over made the new one tower over the board. */
	.game-logo {
		position: absolute;
		left: 50%;
		top: calc(var(--hud-u) * 7);
		width: calc(var(--hud-u) * 282);
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
		/* Plate width. The row inside it totals 1063.72 in the design, so the ~16 units of slack on
		   each side come out of centring rather than out of padding — which is what the design does
		   too: it leaves 16.5 between the plate's edge and the burger's. */
		width: calc(var(--hud-u) * 1095);
		height: calc(var(--hud-u) * 118.538);
		box-sizing: border-box;
		display: flex;
		align-items: center;
		/* Pushed to the ends rather than bunched in the middle: the burger and BONUS sit against the
		   plate's left edge, the spin cluster against its right, and everything left over goes to the
		   BALANCE / WIN / BET block between them. That block is the only part of the row whose content
		   is not a fixed size — a ten-figure balance has to shrink to fit its box, and the room the
		   ends give up is room it does not have to shrink by. */
		justify-content: space-between;
		gap: calc(var(--hud-u) * 16);
		padding: 0 calc(var(--hud-u) * 16);
		background: none;
		border: 0;
		border-radius: 0;
		box-shadow: none;
		font-family: 'Inter', sans-serif;
	}

	/* The plate is only 77 tall against the row's 118.538 — the spin button is what makes the row
	   taller — so it sits behind rather than stretched to fit.

	   Every number here is measured off Figma 7033:25229, whose bar node is 1096 x 120 with the plate
	   in it at y 25.5..102.5 and a corner radius of 14.34. The 1.6 is the design's own offset: it
	   centres the plate at y 64.5 while the controls sit on y 62.9, so the plate rides fractionally
	   low and the spin circle overhangs its top more than its bottom.

	   The border reads as one purple line but is really a ramp across its 5.5 units — dark at the
	   outside, #66169c through the middle, dark again at the inside. A single flat stroke that
	   thick comes out either too heavy or, averaged, too muddy, so the two dark edges are drawn as
	   their own hairlines and only the middle carries the colour. */
	.hud-plate {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(calc(-50% + var(--hud-u) * 1.6));
		width: 100%;
		height: calc(var(--hud-u) * 77);
		box-sizing: border-box;
		background: #1d013c;
		border: calc(var(--hud-u) * 3) solid #64159a;
		border-radius: calc(var(--hud-u) * 13);
		box-shadow:
			0 0 0 calc(var(--hud-u) * 1.3) #2e0166,
			inset 0 0 0 calc(var(--hud-u) * 1.2) #240050,
			0 calc(var(--hud-u) * 4) calc(var(--hud-u) * 10) rgba(0, 0, 0, 0.45);
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
		/* Takes the slack the two button groups leave, and hands it to the balance and win boxes. */
		flex: 1 1 auto;
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

	/* 130.333 x 46.667 with 6.667 side padding (node 6589:4363) — but that width is a FLOOR now, not
	   the box. Both of these grow into whatever .hud-stats has spare, because their contents are the
	   only ones in the row that can be any length: a ten-figure balance in a 130-unit box is legible
	   only because fitText shrinks it, and every unit it gains here is a unit it does not shrink by.
	   overflow stays hidden so a value that still will not fit is clipped rather than pushing the row
	   apart. */
	.value-pill--balance {
		height: calc(var(--hud-u) * 46.667);
		padding: 0 calc(var(--hud-u) * 6.667);
		flex: 1 1 auto;
		min-width: calc(var(--hud-u) * 130.333);
		overflow: hidden;
	}

	/* 66 wide (node 6589:4367), again as a floor. */
	.value-pill--win {
		flex: 1 1 auto;
		min-width: calc(var(--hud-u) * 66);
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

	/* 48 circle, near-black fill lifting to #1a0535 at the bottom (component "Icon buttons"). No gold
	   anywhere in this design.

	   The rim is a 1.5-unit gradient, not the flat #d836fc hairline it was: in the redesign every
	   round button is lit magenta on its top-left shoulder and cold blue on its bottom-right, the
	   same sweep the spin ring and the BONUS pill run. Two backgrounds do it — the fill clipped to
	   the padding box, the rim colour to the border box, with the border itself transparent. */
	.nav-btn {
		width: calc(var(--hud-u) * 48);
		height: calc(var(--hud-u) * 48);
		border: calc(var(--hud-u) * 1.5) solid transparent;
		border-radius: 9999px;
		background:
			linear-gradient(0deg, #1a0535 0%, #000 100%) padding-box,
			linear-gradient(135deg, #b435f5 0%, #7c30dd 50%, #4429c6 100%) border-box;
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

	/* The button is a stack: one ring with a glyph centred on it. Every piece is height-driven off
	   .spin-btn and placed in percentages, so the mobile layouts — which resize .spin-btn rather than
	   restyling it — keep the same relationship for free.

	   The numbers come from Figma 7033:25229, measured in its own 120-tall bar node: the ring is
	   105.75 across, the glyph inside it 60.5 tall, and both are centred on y 59.25 — 4.75 ABOVE the
	   line the rest of the controls sit on, which is why the circle clears the plate's top edge by
	   twice what it clears the bottom by. The negative --art-dy is that 4.75.

	   These replace numbers that scripts/spin-button/build_spin_button.py derived from the old flat
	   marquee composites. Those composites are not what the button looks like any more, so the script
	   no longer has anything to say about this block. */
	.spin-btn__img {
		position: absolute;
		left: 50%;
		top: 50%;
		/* Height-driven with an auto width so the source aspect is preserved no matter what aspect
		   .spin-btn itself has — portrait overrides it to a square. */
		width: auto;
		height: var(--art-h);
		transform: translate(calc(-50% + var(--art-dx)), calc(-50% + var(--art-dy)));
		object-fit: contain;
		display: block;
		pointer-events: none;
		transition: opacity 0.12s ease;
		filter: drop-shadow(0 0 12px rgba(255, 79, 216, 0.35));
	}

	/* 105.75 of 118.538, offset up by 4.75 of its own 105.75. The ring IS this box: the gradient is
	   its background and .spin-btn__disc covers everything but the 4.5-unit edge. aspect-ratio is
	   what gives an auto-width absolute box its width back once the height is set. */
	.spin-btn__ring {
		--art-h: 89.21%;
		--art-dx: 0%;
		--art-dy: -4.49%;
		aspect-ratio: 1;
		border-radius: 50%;
		background: linear-gradient(135deg, #c236ff 0%, #a72bf3 28%, #5132ee 100%);
		filter: drop-shadow(0 0 10px rgba(180, 53, 245, 0.4));
	}

	/* 4.5 of the ring's 105.75 — a percentage inset rather than a border, so it scales with the ring
	   instead of with --hud-u, which the mobile layouts do not size the button by. */
	.spin-btn__disc {
		position: absolute;
		inset: 4.26%;
		border-radius: 50%;
		background: radial-gradient(circle at 50% 34%, #46076f 0%, #37065f 72%);
	}

	/* --art-dy is a percentage of the element's OWN size, so each glyph needs its own number for what
	   is the same 4.75-unit lift: 4.75 of a 60.5-tall arrow is 7.85%, of a 32-tall stop 14.84%. */
	.spin-btn__img--arrow {
		--art-h: 51.04%;
		--art-dx: 0%;
		--art-dy: -7.85%;
	}

	/* No stop state in the design. Sized by eye against the arrow rather than to its box: a filled
	   square at the arrow's own height reads much heavier than the open C does. */
	.spin-btn__img--stopglyph {
		--art-h: 27%;
		--art-dx: 0%;
		--art-dy: -14.84%;
	}

	/* The ring turns whenever the player engages the button — pointer, keyboard focus, the press
	   itself — and keeps turning for as long as the round is running. Keyed off .spin-btn rather than
	   the ring so the glyph swap at spin-start doesn't interrupt it.

	   The circle is round, so what actually reads as motion is its GRADIENT: the magenta shoulder
	   travels round the rim. That is why the ring's colour is on the outer box and not painted into a
	   conic that would have to be re-derived every frame.

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

	.spin-btn:not(:disabled):hover .spin-btn__ring,
	.spin-btn:not(:disabled):focus-visible .spin-btn__ring,
	.spin-btn:not(:disabled):active .spin-btn__ring,
	.spin-btn.is-spinning .spin-btn__ring {
		animation: spin-btn-ring 2.4s linear infinite;
	}

	/* Faster while the reels are actually turning, so the button reads as "running" rather than just
	   "hovered". */
	.spin-btn.is-spinning .spin-btn__ring {
		animation-duration: 1.1s;
	}

	@media (prefers-reduced-motion: reduce) {
		.spin-btn .spin-btn__ring {
			animation: none;
		}
	}

	/* The press state is a brighter bloom off the rim, nothing more — the design has no second, larger
	   circle for it. */
	.spin-btn:not(:disabled):active .spin-btn__ring {
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

	/* A fully rounded gradient pill, 48 tall, lit magenta at its top-left and cold blue at its
	   bottom-right (Figma 7033:25229). It replaces a 178 x 59 marquee plate that was deliberately
	   drawn BIGGER than its own hit box so the gold frame and glow could bleed out of it; there is no
	   frame and no glow now, so the button and the shape it draws are the same box.

	   119 x 48, the design's own box, now that the label is the single word BONUS. It was 159 for the
	   two-word BUY BONUS this replaced. */
	.buy-btn {
		width: calc(var(--hud-u) * 119);
		/* aspect-ratio rather than a fixed height: the mobile layouts override only the width. */
		aspect-ratio: 119 / 48;
		height: auto;
		border: 0;
		border-radius: 9999px;
		background: linear-gradient(135deg, #cf36ff 0%, #a833f2 32%, #3d2edf 100%);
		box-shadow: 0 calc(var(--hud-u) * 3) calc(var(--hud-u) * 8) rgba(0, 0, 0, 0.45);
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

	.buy-btn:not(:disabled):hover {
		transform: translateY(-1px);
		filter: brightness(1.1);
	}

	.buy-btn:not(:disabled):active {
		transform: translateY(1px) scale(0.95);
	}

	/* Lilita One 17 / 1.4 tracking / 20 line box, white. 17 rather than the 12 of node 6004:4333: the
	   label was sized for the two-word BUY BONUS and kept that size when it became the single word
	   BONUS, which left the pill mostly empty. */
	.buy-btn__label {
		position: relative;
		font-family: 'Lilita One', sans-serif;
		font-size: calc(var(--hud-u) * 17);
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
		/* The same 12 -> 17 step the desktop label took, kept in this layout's own rem scale. */
		font-size: 0.74rem;
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
	   Figma 7033:25229 specifies the DESKTOP bar only: one row, 1095 wide, on a 77-tall plate.
	   Landscape floats the same controls over the board, so it cannot use a 1095x77 pill: it takes
	   the design's palette, glyphs and type but keeps its own geometry — hence the plate is dropped
	   and the row height goes back to auto here. Without this the fixed row height and the stretched
	   plate wrecked it. Portrait no longer renders .hud-bottom at all — it has its own .pt-hud two-row
	   block below (node 7063:17249) — but the rules stay keyed to both so the fallback is safe. */
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
		font-size: clamp(0.28rem, 1.56vh, 0.5rem);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #b79ae6;
		line-height: 1.1;
	}
	.ls-pill__value {
		font-size: clamp(0.4rem, 2.3vh, 0.76rem);
		font-weight: 800;
		color: #fff;
		white-space: nowrap;
		line-height: 1.1;
	}

	/* Left column: balance above the bet stepper, pinned to the bottom and centred on the gutter left
	   of the board — the same axis the free-spin plates use, so the four read as one column. */
	.ls-left {
		position: absolute;
		left: var(--ls-left-x, 2.4%);
		transform: translateX(-50%);
		bottom: 5%;
		display: flex;
		flex-direction: column;
		gap: clamp(4px, 1.1vh, 8px);
		/* Held inside the left gutter as well as sized off the viewport. --ls-left-x is the gutter's
		   MIDPOINT, so twice it is the gutter; without the cap the column kept its viewport width and
		   ran off the left edge of the screen once the board moved left to make room for BUY BONUS. */
		width: min(clamp(94px, 15vw, 134px), calc(var(--ls-left-x, 100px) * 2 - 8px));
	}
	.ls-bet {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 5px;
		/* Roomier now that it shows only the value (no BET label). */
		padding: clamp(3px, 1.55vh, 11px) clamp(4px, 2.05vh, 14px);
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
		font-size: clamp(0.5rem, 3.05vh, 1rem);
	}
	.ls-step {
		position: relative;
		flex: 0 0 auto;
		width: clamp(11px, 6.15vh, 32px);
		height: clamp(11px, 6.15vh, 32px);
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
		gap: clamp(3px, 2.4vh, 16px);
		padding: clamp(6px, 3.35vh, 22px) clamp(3px, 1.55vh, 12px);
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
		width: clamp(15px, 8.7vh, 46px);
		height: clamp(15px, 8.7vh, 46px);
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
		width: clamp(26px, 14.4vh, 84px);
		height: clamp(42px, 22.6vh, 132px);
	}
	.ls-spin .spin-btn__count {
		position: relative;
		z-index: 4;
		font-weight: 800;
		color: #fff;
		font-size: clamp(0.5rem, 2.87vh, 1rem);
	}

	/* BUY BONUS — round button, seated left of the action dock near the bottom. Bigger so the
	   two-word label fits inside the circle. */
	/* BUY BONUS — bottom aligned with the dock's end, centred in the gap between the board's right edge
	   and the dock. It used to be placed by a fixed offset off the right edge, which put it on the
	   board's neon rail once the board grew; centring keeps it off both sides whatever the window does.
	   A size down as well, because that gap is narrow on the site's small popout windows. */
	.ls-buy {
		position: absolute;
		/* Centred in the gap, which means knowing where the board's edge is — see landscapeColumns. */
		left: var(--ls-buy-x);
		transform: translateX(-50%);
		bottom: 15%;
		width: var(--ls-buy-size);
		height: var(--ls-buy-size);
		border: 0;
		padding: 0;
		background: none;
		cursor: pointer;
		display: grid;
		place-items: center;
	}
	/* btn-buy-mobile.png is a 174x174 export in which the disc itself is only the middle 119px — the
	   rest is transparent margin around the glow. Drawn at `inset: 0` the button therefore rendered a
	   disc 68% of its own declared size, so the box was reserving 65px of gap to paint 44px of button
	   and the label, sized against the box, ran straight off the rim. Blowing the image up by 174/119
	   makes the declared size and the visible disc the same thing, which is what every measurement
	   here (the gap arithmetic, the label ratio below) already assumed. */
	.ls-buy img {
		position: absolute;
		left: -23.1%;
		top: -23.1%;
		width: 146.2%;
		height: 146.2%;
		object-fit: contain;
		/* The blown-up box now hangs past the button on every side, and a child does not get clipped to
		   its parent — without this it would swallow clicks meant for the dock next to it. */
		pointer-events: none;
	}
	.ls-buy__label {
		position: relative;
		z-index: 2;
		/* Narrow enough that "BUY BONUS" wraps onto two rows, as the design shows. */
		max-width: 80%;
		/* Sized off the BUTTON, not the viewport. A vh-based size ignores the fact that the button is
		   itself clamped to the gap beside the board, so on the small popouts the disc shrank to its
		   floor while the label did not, and "BONUS" ran out past the rim. The ratio is set by the
		   longer of the two rows: "BONUS" runs about 4.1 times the font size, so anything above ~0.19
		   is wider than the disc's flat centre. */
		font-size: calc(var(--ls-buy-size, 66px) * 0.16);
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

	/* WIN — bottom-right corner, label + value on a single row. Kept narrow: the board's bottom-right
	   corner comes down close to it on the small popout windows, and the pill was running under the
	   corner's neon rail. It grows from its content anyway, so a long amount still fits. */
	.ls-pill--win {
		position: absolute;
		right: 1.8%;
		bottom: 3%;
		flex-direction: row;
		align-items: baseline;
		justify-content: center;
		gap: 6px;
		width: auto;
		min-width: clamp(104px, 13vw, 140px);
		padding: 6px 12px;
	}
	.ls-pill--win .ls-pill__value {
		font-size: clamp(0.46rem, 2.79vh, 0.92rem);
	}
	.ls-pill--win .ls-pill__label {
		font-size: clamp(0.32rem, 1.8vh, 0.58rem);
	}

	/* Very small landscape (e.g. 400×225): the board takes most of the width, leaving a tiny gap and
	   narrow corners. Shrink BUY BONUS and centre it in that gap, trim the balance/win boxes so they
	   don't crowd the board. Only fires well below phone size, so the normal layout is untouched. */
	@media (max-height: 300px) {
		.ls-buy {
			width: clamp(18px, 13.3vh, 34px);
			height: clamp(18px, 13.3vh, 34px);
			/* The gap is tiny here, so bias toward the dock (onto its edge, like on phones) to gain
			   size while the left edge still clears the board. */
			right: 11%;
		}
		.ls-buy__label {
			font-size: clamp(0.26rem, 1.7vh, 0.42rem);
			max-width: 78%;
		}
		.ls-left {
			/* Reclaim a few px of the narrow gutter (the board is only ~2px off the column here) so the
			   stepper value and balance aren't crushed. */
			width: min(clamp(94px, 15vw, 134px), calc(var(--ls-left-x, 100px) * 2 - 4px));
		}
		.ls-pill--balance {
			/* Roomier box — the razor-thin 2px was the "too small" the balance read as. */
			padding: 4px 6px;
			gap: 3px;
		}
		.ls-pill--balance .ls-pill__label {
			font-size: clamp(0.24rem, 1.35vh, 0.4rem);
		}
		/* The stepper is the tightest thing on this screen: two +/- buttons plus gaps ate the whole
		   row and fitText collapsed the bet value. Shrink the +/- buttons, gaps and padding hard so the
		   value gets most of the width, and lift its ceiling so fitText fills it (bet was still too small). */
		.ls-bet {
			padding: 2px 2px;
			gap: 1px;
		}
		.ls-step {
			width: clamp(8px, 4vh, 12px);
			height: clamp(8px, 4vh, 12px);
		}
		.ls-bet__value {
			font-size: clamp(0.75rem, 5.5vh, 1rem);
		}
		/* Spin (the round "turn" button) dwarfed the dock here — pull its floor/scale down so it stays
		   the biggest control without swallowing the whole column. */
		.ls-spin.spin-btn {
			width: clamp(22px, 11.5vh, 84px);
			height: clamp(34px, 17.8vh, 132px);
		}
		.ls-pill--win {
			min-width: clamp(56px, 16.5vw, 100px);
			padding: 2px 7px;
			gap: 4px;
		}
	}

	/* ===== PORTRAIT HUD — dedicated 2-row layout ===== */
	.hud-shell[data-layout='portrait'] {
		/* The design's phone frame is 358 wide and puts both HUD rows on 349 of it. --pt-w is that
		   349, capped so the bar keeps phone proportions on a tall tablet, and --pt-u is one design
		   pixel of it — every portrait size below is written in those units. */
		--pt-w: min(97vw, 460px);
		--pt-u: calc(var(--pt-w) / 349);
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
		/* 118 units of black lifting to nothing (node 7063:17253) — the park scene still reads
		   through it. The design also backdrop-blurs this strip; that is deliberately left off,
		   because a live blur over the WebGL canvas forces a full re-composite every frame on
		   mobile, which is exactly the cost this game has spent two rounds removing. */
		height: calc(var(--pt-u) * 118);
		background: linear-gradient(to top, rgba(0, 0, 0, 0.57) 7%, rgba(0, 0, 0, 0) 100%);
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

	/* ===== PORTRAIT HUD — Figma 7063:17249 =======================================================
	   One --pt-u is one pixel of the design's phone frame, in which the control plate and the stats
	   strip are both 349 wide — so every number below is read straight off the design and the whole
	   HUD scales as one block.

	   The shared button components (.nav-btn, .buy-btn, .spin-btn) are sized in --hud-u, and this
	   design draws the round ones at 36 where the desktop bar draws 48. Re-basing --hud-u to three
	   quarters of a portrait unit is therefore the whole port: every glyph, caption and stepper
	   inside those components follows, with no second table of numbers to keep in step. */
	.pt-hud {
		pointer-events: auto;
		position: relative;
		z-index: 6;
		align-self: center;
		margin-top: auto;
		/* The strip clears the viewport bottom by 14 in the design; the shell contributes 8 of it. */
		margin-bottom: calc(var(--pt-u) * 6);
		width: var(--pt-w);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		/* 602.5 -> 611 between the two rows. */
		gap: calc(var(--pt-u) * 8.5);
		--hud-u: calc(var(--pt-u) * 0.75);
		font-family: 'Lilita One', sans-serif;
	}

	/* 349 x 62: an outer #310463 shell with a #1d013c panel inset in it, the panel edged #5f1484 and
	   glowing magenta. The controls sit on top, spread across the row the way the design spaces
	   them; the spin button is the only one that breaks the panel's line, by being taller than it. */
	.pt-controls {
		position: relative;
		width: 100%;
		height: calc(var(--pt-u) * 62);
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 calc(var(--pt-u) * 11);
		border-radius: calc(var(--pt-u) * 14);
		background: #310463;
	}

	.pt-plate {
		position: absolute;
		inset: calc(var(--pt-u) * 4) calc(var(--pt-u) * 4.5);
		border-radius: calc(var(--pt-u) * 13);
		background: #1d013c;
		border: 1px solid #5f1484;
		box-shadow: 0 0 calc(var(--pt-u) * 5) #b335f5;
		pointer-events: none;
	}

	.pt-controls > :not(.pt-plate) {
		position: relative;
		z-index: 1;
	}

	/* 87 x 40 with a 13.6 label — the same pill the desktop bar draws at 119 x 48 / 17. */
	.pt-controls .buy-btn {
		width: calc(var(--pt-u) * 87);
		aspect-ratio: 87 / 40;
	}

	.pt-controls .buy-btn__label {
		font-size: calc(var(--pt-u) * 13.6);
		letter-spacing: calc(var(--pt-u) * 1.12);
		line-height: calc(var(--pt-u) * 16);
	}

	/* 76 square and centred on the row — the desktop button is 134 x 118.5 and rides 4.75 units
	   high, and neither applies here, so the ring and both glyphs re-declare their percentages.
	   The stack itself is unchanged: the design's Ellipse 11 IS .spin-btn__ring (a #37065F disc
	   behind a 2.17 gradient rim, glowing #d100ff), and its arrow is spin-arrow.webp. */
	.pt-spin.spin-btn {
		width: calc(var(--pt-u) * 76);
		height: calc(var(--pt-u) * 76);
	}

	.pt-spin .spin-btn__ring {
		--art-h: 100%;
		--art-dy: 0%;
		filter: drop-shadow(0 0 calc(var(--pt-u) * 14) rgba(209, 0, 255, 0.55));
	}

	/* 2.17 of the ring's 76. */
	.pt-spin .spin-btn__disc {
		inset: 2.86%;
	}

	/* The arrow stands 43.9 tall inside that 76 ring in the design; the stop square keeps the
	   arrow-to-stop ratio the desktop button uses. */
	.pt-spin .spin-btn__img--arrow {
		--art-h: 57.8%;
		--art-dy: 0%;
	}

	.pt-spin .spin-btn__img--stopglyph {
		--art-h: 30.6%;
		--art-dy: 0%;
	}

	.pt-spin .spin-btn__count {
		font-size: calc(var(--pt-u) * 18);
	}

	/* --- Stats strip: 90 | 160.8 | 90 with 4-unit gutters, i.e. the plate's own 349 across. The two
	   value boxes take up any slack on a wider screen; the bet box holds the design's width because
	   the two stepper circles inside it do. --- */
	.pt-stats {
		width: 100%;
		display: flex;
		align-items: stretch;
		justify-content: center;
		gap: calc(var(--pt-u) * 4);
	}

	.pt-pill {
		flex: 1 1 0;
		min-width: 0;
		height: calc(var(--pt-u) * 45);
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		padding: 0 calc(var(--pt-u) * 6.667);
		border-radius: calc(var(--pt-u) * 4);
		background: rgba(0, 6, 22, 0.78);
		border: 1px solid rgba(255, 255, 255, 0.09);
		box-shadow: 0 calc(var(--pt-u) * 2) calc(var(--pt-u) * 10) rgba(0, 0, 0, 0.55);
		overflow: hidden;
	}

	.pt-pill__label {
		font-family: 'Poppins', sans-serif;
		font-weight: 500;
		font-size: calc(var(--pt-u) * 11);
		letter-spacing: calc(var(--pt-u) * 0.33);
		text-transform: uppercase;
		color: #fff;
		white-space: nowrap;
	}

	.pt-pill__value {
		max-width: 100%;
		font-family: 'Poppins', sans-serif;
		font-weight: 500;
		font-size: calc(var(--pt-u) * 14);
		letter-spacing: calc(var(--pt-u) * 0.42);
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
	}

	/* 160.8 x 45: a 1.2 rim of #63307d around a #21003d panel, the shared stepper circles at each
	   end and the amount between them. */
	.pt-bet {
		position: relative;
		flex: 0 1 calc(var(--pt-u) * 160.8);
		min-width: 0;
		height: calc(var(--pt-u) * 45);
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 calc(var(--pt-u) * 3.5);
		border-radius: calc(var(--pt-u) * 4);
		background: #63307d;
	}

	.pt-bet::before {
		content: '';
		position: absolute;
		inset: calc(var(--pt-u) * 1.2);
		border-radius: calc(var(--pt-u) * 4.389);
		background: #21003d;
		border: 1px solid #5e4374;
		pointer-events: none;
	}

	.pt-bet > * {
		position: relative;
		z-index: 1;
	}

	.pt-bet__values {
		flex: 1 1 0;
		min-width: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		overflow: hidden;
	}

	.pt-bet__value {
		max-width: 100%;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: calc(var(--pt-u) * 14);
		line-height: calc(var(--pt-u) * 16.5);
		color: #fff;
		white-space: nowrap;
		overflow: hidden;
	}
</style>
