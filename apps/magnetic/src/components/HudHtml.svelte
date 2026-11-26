<script lang="ts" module>
	// Converts absolute /path to ./path so it resolves relative to the page URL at any deploy sub-path
	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;

	const heroCardBg = ap('/assets/components/backgrounds/visual_v2.jpg');

	// Frame backgrounds — passed as CSS vars because url() in style blocks can't use runtime paths
	const menuBtnFrame = ap('/assets/components/frames/top_menu-button_frame.webp');
	const soundBtnFrame = ap('/assets/components/frames/top_sound_button_frame.webp');
	const menuBarFrame = ap('/assets/components/navbar/nav_bar.webp'); // blue-tech bottom bar

	// Button backgrounds (icon-less frames) — icons are layered on top in markup.
	// Version2 (Figma 2503:7839): spin = blue ring art + circular-arrow glyph; buy bonus = the blue
	// capsule; utility buttons are flat CSS circles (#22365B / #2391C1 ring) with bare SVG glyphs.
	const btnRoundBg = ap('/assets/components/navbar/btn_bg_round.webp'); // (unused; utility buttons are CSS circles)
	const btnSpinBg = ap('/assets/components/ui/spin_ring.webp?v=20260807'); // Version2 blue round — spin
	const btnSpinStop = ap('/assets/components/ui/spin_ring.webp?v=20260807'); // busy keeps the ring; the glyph overlay conveys stop
	const btnWideBg = ap('/assets/components/ui/buy_bonus_capsule.webp'); // Version2 blue capsule — buy bonus

	// Round icon-buttons — each PNG is a COMPLETE button (dark disc + cyan ring + icon baked in),
	// with default + disabled/mute states from the "Icon Buttons" set. Used as the whole button.
	// Menu popover (Figma 7041-8978): flat Version2 navy panel with SOUND / MUSIC / INFO rows —
	// pure CSS now (same #364970 / #4E78B8 language as the bottom bar), no bitmap panel.
	const iconMenuMusic = ap('/assets/components/navbar/icons/menu_music.svg');
	const iconMenuInfo = ap('/assets/components/navbar/icons/menu_info.svg');
	// Disabled state (Figma 4553-9279): slashed note. There is no menu_sound* pair any more — the
	// SOUND row renders the bottom-bar button art whole (see .menu-row__icon--full).
	const iconMenuMusicOff = ap('/assets/components/navbar/icons/menu_music_off.webp');
	// Version2 flat glyphs (white SVGs / cutout webp) drawn inside the CSS circle buttons — the old
	// per-state baked-button webps are gone; disabled/muted states are conveyed by CSS dimming.
	const iconSound = ap('/assets/components/navbar/icons/v2/ic_sound.svg');
	const iconMinus = ap('/assets/components/navbar/icons/v2/ic_minus.svg');
	const iconMinusDisabled = ap('/assets/components/navbar/icons/v2/ic_minus.svg');
	const iconPlus = ap('/assets/components/navbar/icons/v2/ic_plus.svg');
	const iconPlusDisabled = ap('/assets/components/navbar/icons/v2/ic_plus.svg');
	// The Press Play bar's glyphs (2026-11-26), shared with Blob Split (its public/base/bar/*.svg) so
	// the studio's games wear one bottom bar: outline bolt = normal, filled = turbo, two = super.
	const barMenu = ap('/assets/components/navbar/icons/bar/menu.svg');
	const barSpin = ap('/assets/components/navbar/icons/bar/spin.svg');
	const barAuto = ap('/assets/components/navbar/icons/bar/auto.svg');
	const barArrow = ap('/assets/components/navbar/icons/bar/arrow.svg');
	const barBonusMark = ap('/assets/components/navbar/icons/bar/bonus-mark.svg');
	const barTurboOff = ap('/assets/components/navbar/icons/bar/turbo-off.svg');
	const barTurbo = ap('/assets/components/navbar/icons/bar/turbo.svg');
	const barTurboSuper = ap('/assets/components/navbar/icons/bar/turbo-super.svg');

	// Portrait-only pad art (passed to CSS as vars): nav bar behind the controls, round buy-bonus
	// badge, and the bordered value box for balance / bet.
	const navBarMobile = ap('/assets/components/navbar/nav_bar_mobile.webp');
	const buyBonusMobile = ap('/assets/components/navbar/buy_bonus_mobile.webp');
	const valueBoxMobile = ap('/assets/components/navbar/value_box_mobile.webp');
	const balanceContainer = ap('/assets/components/navbar/balance_container.webp');
	const betContainer = ap('/assets/components/navbar/bet_container.webp');
	// Landscape: tall vertical nav-bar panel behind the right-hand control column + the bet box.
	const navBarLand = ap('/assets/components/navbar/nav_bar_land.webp');
	const betBoxLand = ap('/assets/components/navbar/bet_box_land.webp');

	const scatterFrame = ap('/assets/components/frames/scatter_frame.webp');
	const hudFrame = ap('/assets/components/frames/hud_frame.webp');
	const smallBtnFrame = ap('/assets/components/frames/lower_hud_button_frame.webp');
	const playBtnFrame = ap('/assets/components/frames/play_button-frame.webp');

	const scatterImg = ap('/assets/components/ui/scatter-panel-image.webp');

	// Every image the HUD renders (CSS url() vars + <img>), for LoadingController's HTML-image pass —
	// these are invisible to the pixi loader. Built from the consts above so a path or ?v= edit can
	// never desync the preload list. Duplicate URLs are fine; the loader de-dupes with a Set.
	export const HUD_IMAGES = [
		heroCardBg,
		menuBtnFrame,
		soundBtnFrame,
		menuBarFrame,
		btnRoundBg,
		btnSpinBg,
		btnWideBg,
		iconMenuMusic,
		iconMenuInfo,
		iconMenuMusicOff,
		iconSound,
		iconMinus,
		iconPlus,
		barMenu,
		barSpin,
		barAuto,
		barArrow,
		barBonusMark,
		barTurboOff,
		barTurbo,
		barTurboSuper,
		navBarMobile,
		buyBonusMobile,
		valueBoxMobile,
		balanceContainer,
		betContainer,
		navBarLand,
		betBoxLand,
		scatterFrame,
		hudFrame,
		smallBtnFrame,
		playBtnFrame,
		scatterImg,
	];
</script>

<script lang="ts">
	import { OnHotkey } from 'components-shared';
	import { stateBet, stateBetDerived, stateConfig, stateModal, stateSound } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';
	import { onDestroy } from 'svelte';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { magneticStakeDerived } from '../state/magneticStake.svelte';
	import CustomBuyBonusModal from './CustomBuyBonusModal.svelte';
	import CustomAutoSpinModal from './CustomAutoSpinModal.svelte';
	import CustomInfoModal from './CustomInfoModal.svelte';

	const context = getContext();

	// Fit an AMOUNT into its fixed-width box (desktop BALANCE / WIN / BET, the landscape stepper). The
	// boxes hold a fixed width so a count-up never re-lays the bar; a long amount steps its type down
	// instead. Watches the TEXT (MutationObserver): the box never resizes when its number changes, so a
	// ResizeObserver alone would never fire.
	function fitAmount(node: HTMLElement) {
		const apply = () => {
			const box = node.parentElement;
			if (!box) return;
			node.style.fontSize = '';
			const baseSize = parseFloat(getComputedStyle(node).fontSize);
			const bcs = getComputedStyle(box);
			// Range rects are post-transform, clientWidth is not — compare them in the same space.
			const k = box.offsetWidth ? box.getBoundingClientRect().width / box.offsetWidth : 1;
			const availW =
				(box.clientWidth - parseFloat(bcs.paddingLeft || '0') - parseFloat(bcs.paddingRight || '0')) * k;
			if (availW <= 0) return;
			const range = document.createRange();
			range.selectNodeContents(node);
			let size = baseSize;
			let guard = 0;
			while (guard++ < 48 && size > baseSize * 0.4 && range.getBoundingClientRect().width > availW) {
				size -= 0.5;
				node.style.fontSize = `${size}px`;
			}
		};
		const ro = new ResizeObserver(apply);
		if (node.parentElement) ro.observe(node.parentElement);
		const mo = new MutationObserver(apply);
		mo.observe(node, { characterData: true, childList: true, subtree: true });
		requestAnimationFrame(apply);
		(document as Document).fonts?.ready.then(apply);
		return {
			destroy: () => {
				ro.disconnect();
				mo.disconnect();
			},
		};
	}

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait');
	const isLandscapeMobile = $derived(layoutType === 'landscape');

	const canInteract = $derived(context.stateXstateDerived.isIdle());
	const hasAuto = $derived(stateBetDerived.hasAutoBetCounter());
	const isSpinStop = $derived(!context.stateXstateDerived.isIdle() || hasAuto);
	const canAffordBet = $derived(stateBetDerived.isBetCostAvailable());
	// An active manual spin is in progress (not idle, and not an auto-spin sequence) — the spin
	// button shows its no-arrow "empty" disabled state and is not clickable.
	//
	// A held spin (isSpaceHold) is explicitly NOT busy: `busy` disables the button, and a disabled
	// element stops delivering pointer events, so the pointerup that ends the hold would never
	// arrive and the player would be stuck spinning.
	const isBusy = $derived(
		!context.stateXstateDerived.isIdle() && !hasAuto && !stateBet.isSpaceHold,
	);

	// Stop autoplay and disable spin when balance drops below bet cost
	$effect(() => {
		if (canInteract && hasAuto && !canAffordBet) {
			stateBet.autoSpinsCounter = 0;
		}
	});
	const isFeatureActive = $derived(stateBet.activeBetModeKey === 'FEATURE');
	const isChanceActive = $derived(stateBet.activeBetModeKey === 'CHANCE');
	const isAnyModeActive = $derived(isFeatureActive || isChanceActive);
	// Buying a bonus makes no sense while one is running — disable the button during free spins,
	// and keep it disabled while the final congratulations (outro) screen is still up (gameType
	// may already be back to basegame at that point).
	let outroShowing = $state(false);
	context.eventEmitter.subscribeOnMount({
		freeSpinOutroShow: () => (outroShowing = true),
		freeSpinOutroHide: () => (outroShowing = false),
	});
	const isInBonus = $derived(context.stateGame.gameType !== 'basegame' || outroShowing);
	// Also no buying mid-round: while reels spin, clusters stack/respin or a win presents
	// (anything non-idle), the button stays disabled.
	const disableBuy = $derived(isInBonus || !context.stateXstateDerived.isIdle());
	// Bolder icon = faster: outline bolt = normal, filled = turbo, two bolts = super turbo.
	const turboIcon = $derived(
		stateBet.isSuperTurbo ? barTurboSuper : stateBet.isTurbo ? barTurbo : barTurboOff,
	);
	const betOptions = $derived(stateConfig.betAmountOptions);
	const smallestBet = $derived(stateConfig.betAmountOptions[0]);
	const biggestBet = $derived(
		stateConfig.betAmountOptions[stateConfig.betAmountOptions.length - 1],
	);
	const currentBetIndex = $derived(Math.max(0, betOptions.indexOf(stateBet.betAmount)));
	const formattedBalance = $derived(
		magneticStakeDerived.formatCurrencyAmount(stateBet.balanceAmount),
	);
	// Last round's win — shown persistently in the HUD (desktop between balance/bet; portrait in the
	// stats row where the buy-bonus button used to sit). Holds the round total until the next spin.
	// winBookEventAmount is in BOOK units (like the capsule's TOTAL WIN), so format it the same way —
	// NOT formatCurrencyAmount, which is for the currency-unit balance/bet and over-reads it 100×.
	const formattedWin = $derived(bookEventAmountToCurrencyString(stateBet.winBookEventAmount));
	const formattedBet = $derived(
		isFeatureActive
			? magneticStakeDerived.formatCurrencyAmount(stateBet.betAmount * 50)
			: isChanceActive
				? magneticStakeDerived.formatCurrencyAmount(stateBet.betAmount * 2)
				: magneticStakeDerived.formatCurrencyAmount(stateBet.betAmount),
	);
	const autoSpinsRemainingText = $derived(
		stateBet.autoSpinsCounter === Infinity ? '∞' : `${stateBet.autoSpinsCounter}`,
	);
	// The counter sits inside a fixed disc on the spin button, so a 3-digit run (the autoplay stops
	// go up to 500) overflowed the dark backing and spilled onto the arrow art — "99" already
	// touched the edges. Shrink the type per digit count instead of sizing everything for the worst
	// case, which would leave the common 1- and 2-digit values looking undersized.
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

	let showMenuPopup = $state(false);
	const toggleMenuPopup = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		showMenuPopup = !showMenuPopup;
	};
	// Menu rows reflect the MASTER mute too — the outside speaker button silences everything,
	// so both rows read as off while it's engaged.
	const sfxOff = $derived(stateSound.volumeValueSoundEffect === 0 || stateSound.volumeValueMaster === 0);
	const musicOff = $derived(stateSound.volumeValueMusic === 0 || stateSound.volumeValueMaster === 0);
	// Muting BOTH channels from the menu = everything silent, so the master button reflects it.
	const syncMasterWithChannels = () => {
		if (stateSound.volumeValueMusic === 0 && stateSound.volumeValueSoundEffect === 0) {
			stateSound.volumeValueMaster = 0;
		}
	};
	const toggleSfx = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		const turningOn = sfxOff;
		stateSound.volumeValueSoundEffect = turningOn ? 75 : 0;
		// Turning a channel back on while master-muted must actually be audible.
		if (turningOn && stateSound.volumeValueMaster === 0) stateSound.volumeValueMaster = 50;
		syncMasterWithChannels();
	};
	const toggleMusic = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		const turningOn = musicOff;
		stateSound.volumeValueMusic = turningOn ? 75 : 0;
		if (turningOn && stateSound.volumeValueMaster === 0) stateSound.volumeValueMaster = 50;
		syncMasterWithChannels();
	};
	const openInfoFromMenu = () => {
		showMenuPopup = false;
		openRules();
	};

	const openRules = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		showInfoModal = true;
	};

	const openPaytable = () => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateModal.modal = { name: 'payTable' };
	};

	let showBuyModal = $state(false);
	let showAutoModal = $state(false);
	let showInfoModal = $state(false);

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
			// Clear stale buy modes (BONUS/SUPER) before a new spin; FEATURE and CHANCE
			// are player toggles that persist until deactivated.
			if (!isAnyModeActive) stateBet.activeBetModeKey = 'BASE';
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

	const onSpinHotkey = () => {
		// Space must not start a spin behind an open modal (buy/auto/info or any shared modal).
		if (showBuyModal || showAutoModal || showInfoModal || stateModal.modal !== null) return;

		if (hasAuto) {
			if (context.stateXstateDerived.isIdle()) return;
			context.eventEmitter.broadcast({ type: 'soundPressBet' });
			context.eventEmitter.broadcast({ type: 'stopButtonClick' });
			return;
		}

		context.eventEmitter.broadcast({ type: 'soundPressBet' });

		if (context.stateXstateDerived.isIdle()) {
			if (!isAnyModeActive) stateBet.activeBetModeKey = 'BASE';
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

	// ── hold the spin button to keep spinning ──
	// Reuses the platform's `isSpaceHold` flag rather than inventing a parallel loop:
	// createIntermediateMachineBet's `checkSpaceHold` already re-enters `fetching` instead of ending
	// the round while it is set, and actor.ts already skips the spin-up presentation for it, so the
	// spins chain back to back for as long as the button is held. Same 400ms threshold as
	// components-shared/OnHotkey, so holding the button and holding Space feel identical.
	const SPIN_HOLD_MS = 400;
	let spinHoldTimeout: ReturnType<typeof setTimeout> | null = null;
	// A hold consumes the click that pointerup would otherwise deliver — without this the release
	// immediately fires onSpinButton, which reads as a STOP press and kills the round just started.
	let spinHoldConsumedClick = false;

	const beginSpinHold = (fromPointer = true) => {
		spinHoldTimeout = null;
		// An auto-spin batch is already a continuous loop; holding on top of it would fight the
		// counter, and the button's job in that state is to cancel.
		if (hasAuto || !stateBetDerived.isBetCostAvailable()) return;
		// Re-entry guard: OnHotkey delivers onhold twice (callback + its isHolding effect).
		if (stateBet.isSpaceHold) return;
		// The click to consume and the press sound only exist on the pointer path — a Space hold has
		// no click event, and its keydown already played the press sound via onSpinHotkey.
		if (fromPointer) {
			spinHoldConsumedClick = true;
			context.eventEmitter.broadcast({ type: 'soundPressBet' });
		}
		stateBet.isSpaceHold = true;
		stateBetDerived.updateIsTurbo(true, { persistent: true });
		// Held from idle, nothing is running yet, so the first spin still needs a kick; held during a
		// round, the machine picks the flag up when that round ends.
		if (context.stateXstateDerived.isIdle()) {
			if (!isAnyModeActive) stateBet.activeBetModeKey = 'BASE';
			context.eventEmitter.broadcast({ type: 'bet' });
		}
	};

	// Holding Space mirrors holding the spin button. The keyboard reaches the HUD even under an
	// open modal (the button cannot), so onSpinHotkey's modal guard is re-applied here.
	const onSpaceHold = () => {
		if (showBuyModal || showAutoModal || showInfoModal || stateModal.modal !== null) return;
		beginSpinHold(false);
	};

	const endSpinHold = () => {
		if (spinHoldTimeout) {
			clearTimeout(spinHoldTimeout);
			spinHoldTimeout = null;
		}
		if (!stateBet.isSpaceHold) return;
		stateBet.isSpaceHold = false;
		stateBetDerived.updateIsTurbo(false, { persistent: true });
	};

	const onSpinPointerDown = (event: PointerEvent) => {
		if (event.button !== 0) return;
		endSpinHold();
		spinHoldTimeout = setTimeout(beginSpinHold, SPIN_HOLD_MS);
	};

	const onSpinClick = (event: MouseEvent) => {
		if (spinHoldConsumedClick) {
			spinHoldConsumedClick = false;
			event.preventDefault();
			return;
		}
		onSpinButton();
	};

	// The balance can run dry mid-hold; the machine would keep asking for bets it cannot pay for.
	$effect(() => {
		if (stateBet.isSpaceHold && !stateBetDerived.isBetCostAvailable()) endSpinHold();
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
		// isSpaceHold lives in shared state, so leaving it set would keep the machine looping bets
		// after this HUD is gone.
		endSpinHold();
	});
</script>

<!-- The hold ends on the WINDOW, not on the button: the finger routinely drifts off a round button
     during a long press, and a release outside it (or after the layout reflows under it) must still
     stop the spinning. pointerdown arms the hold on the button itself. -->
<svelte:window onpointerup={endSpinHold} onpointercancel={endSpinHold} onblur={endSpinHold} />

<OnHotkey
	hotkey="Space"
	disabled={!stateConfig.jurisdiction ? false : stateConfig.jurisdiction.disabledSpacebar}
	onpress={onSpinHotkey}
	onhold={onSpaceHold}
	onholdend={endSpinHold}
/>

<div
	class="hud-shell"
	class:hud-shell--celebrating={context.stateGame.celebrationActive}
	data-layout={layoutType}
	style={`--forest-card-bg:url('${heroCardBg}');--menu-btn-bg:url('${menuBtnFrame}');--sound-btn-bg:url('${soundBtnFrame}');--menu-bar-bg:url('${menuBarFrame}');--scatter-frame-bg:url('${scatterFrame}');--hud-frame-bg:url('${hudFrame}');--buy-btn-bg:url('${btnWideBg}');--small-btn-bg:url('${smallBtnFrame}');--play-btn-bg:url('${playBtnFrame}');--btn-round-bg:url('${btnRoundBg}');--btn-spin-bg:url('${btnSpinBg}');--btn-spin-stop-bg:url('${btnSpinStop}');--pt-navbar:url('${navBarMobile}');--pt-buy:url('${buyBonusMobile}');--pt-value:url('${valueBoxMobile}');--pt-balance-bg:url('${balanceContainer}');--pt-bet-bg:url('${betContainer}');--ls-navbar:url('${navBarLand}');--ls-betbox:url('${betBoxLand}')`}
>
	<!-- Menu popover (SOUND / MUSIC / INFO) — shared by desktop and portrait; rendered inside a
	     position:relative nav container so it floats above the menu button. -->
	{#snippet bonusFace(showTag: boolean)}
		<!-- The Press Play square (Blob Split's BONUS). The desktop bar, where a press turns an active
		     mode off, shows a DEACTIVATE tag while one is on. -->
		<img class="bonus-mark" src={barBonusMark} alt="" />
		{#if showTag}
			<span class="bonus-tag"
				>{isAnyModeActive ? i18nDerived.translate('DEACTIVATE') : i18nDerived.buyBonus()}</span
			>
		{/if}
	{/snippet}

	{#snippet menuToggle()}
		<button
			class="nav-btn nav-btn--framed nav-btn--menu"
			class:nav-btn--open={showMenuPopup}
			data-menu-toggle
			type="button"
			onclick={toggleMenuPopup}
			aria-label="Menu"
		>
			{#if showMenuPopup}
				<span class="nav-close-x" aria-hidden="true"></span>
			{:else}
				<img class="nav-icon bar-menu" src={barMenu} alt="menu" />
			{/if}
		</button>
		{#if showMenuPopup}{@render menuPopup()}{/if}
	{/snippet}

	{#snippet menuPopup()}
		<button
			class="menu-popup-backdrop"
			type="button"
			aria-label="Close menu"
			onclick={() => (showMenuPopup = false)}
		></button>
		<div class="menu-popup">
			<button class="menu-row" type="button" onclick={toggleSfx}>
				<!-- SOUND uses the exact bottom-bar sound/mute button art so the two match 1:1. -->
				<span class="menu-row__icon">
					<img class="menu-row__fullimg" class:is-muted={sfxOff} src={iconSound} alt="" />
				</span>
				<span class="menu-row__label">{i18nDerived.translate('SOUND')}</span>
			</button>
			<div class="menu-divider"></div>
			<button class="menu-row" type="button" onclick={toggleMusic}>
				<span class="menu-row__icon">
					<span class="menu-row__glyph" class:is-off={musicOff} style={`--icon:url('${musicOff ? iconMenuMusicOff : iconMenuMusic}')`}></span>
				</span>
				<span class="menu-row__label">{i18nDerived.translate('MUSIC')}</span>
			</button>
			<div class="menu-divider"></div>
			<button class="menu-row" type="button" onclick={openInfoFromMenu}>
				<span class="menu-row__icon">
					<span class="menu-row__glyph" style={`--icon:url('${iconMenuInfo}')`}></span>
				</span>
				<span class="menu-row__label">{i18nDerived.translate('INFO')}</span>
			</button>
		</div>
	{/snippet}

	<div class="hud-bottom">
		<div class="hud-left">
			<!-- No mute button: sound lives in the menu popover (SOUND / MUSIC rows), as on Blob's bar. -->
			<div class="hud-system">
				{@render menuToggle()}
			</div>

			<div class="hud-buy">
				<button
					class="bonus-square"
					class:is-active={isAnyModeActive}
					type="button"
					disabled={disableBuy}
					onclick={isAnyModeActive ? handleDeactivate : openBuyBonus}
					aria-label={isAnyModeActive ? 'Deactivate' : i18nDerived.buyBonus()}
				>
					{@render bonusFace(true)}
				</button>
			</div>

			<div class="value-pill value-pill--balance">
				<div class="label label--balance">
					<span class="label-text">{i18nDerived.balance()}</span>
				</div>
				<span class="value" use:fitAmount>{formattedBalance}</span>
			</div>
		</div>

		<div class="hud-divider" aria-hidden="true"></div>

		<div class="hud-controls">
			<!-- Last round win — sits between balance and bet. -->
			<div class="value-pill value-pill--balance value-pill--win">
				<div class="label label--balance">
					<span class="label-text">{i18nDerived.win()}</span>
				</div>
				<span class="value" use:fitAmount>{formattedWin}</span>
			</div>

			<!-- Display-only: bet changes go through the − / + steppers (bet menu on click disabled). -->
			<div class="value-pill value-pill--bet bet-pill">
				<div class="bet-values">
					<span class="label">{i18nDerived.betLabel()}</span>
					<span class="value" class:value--feature={isAnyModeActive} use:fitAmount>{formattedBet}</span>
				</div>
			</div>

			<div class="stepper">
				<button
					class="nav-btn nav-btn--step nav-btn--up"
					type="button"
					onpointerdown={(event) =>
						startHoldRepeat(event, onIncrease, () => stepBet(1, { playSound: false }))}
					onpointerup={clearHoldRepeat}
					onpointercancel={clearHoldRepeat}
					onpointerleave={clearHoldRepeat}
					onclick={(event) => maybeRunClickAction(event, onIncrease)}
					disabled={disableIncrease}
					aria-label={`Increase ${i18nDerived.betLabel()}`}
				>
					<img class="step-chevron" src={barArrow} alt="" />
				</button>
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
					aria-label={`Decrease ${i18nDerived.betLabel()}`}
				>
					<img class="step-chevron step-chevron--down" src={barArrow} alt="" />
				</button>
			</div>

			<div class="play-cluster">
				<button
					class="spin-btn"
					class:spin-btn--busy={isBusy}
					class:spin-btn--holding={stateBet.isSpaceHold}
					type="button"
					onclick={onSpinClick}
					onpointerdown={onSpinPointerDown}
					aria-label="Spin"
					disabled={isBusy || (canInteract && !hasAuto && !canAffordBet)}
				>
					<img class="spin-btn__icon" src={barSpin} alt="" />
					{#if hasAuto}
						<span
							class="spin-btn__count"
							style={`--spin-count-scale:${autoSpinsCountScale}`}
							aria-label={`Remaining auto spins ${autoSpinsRemainingText}`}
							>{autoSpinsRemainingText}</span
						>
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
					<img class="nav-icon turbo-glyph" src={turboIcon} alt="turbo" />
				</button>
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
			</div>
		</div>
	</div>

	{#if isPortrait}
		<!-- ── Portrait HUD: spin-centred control row + balance / bet / buy row ── -->
		<div class="pt-hud">
			<div class="pt-controls">
				<div class="pt-grp pt-grp--left">
					{@render menuToggle()}
					<button
						class="bonus-square pt-bonus"
						type="button"
						disabled={disableBuy}
						onclick={openBuyBonus}
						aria-label={i18nDerived.buyBonus()}
					>
						{@render bonusFace(false)}
					</button>
				</div>

				<button
					class="spin-btn pt-spin"
					class:spin-btn--busy={isBusy}
					class:spin-btn--holding={stateBet.isSpaceHold}
					type="button"
					onclick={onSpinClick}
					onpointerdown={onSpinPointerDown}
					aria-label="Spin"
					disabled={isBusy || (canInteract && !hasAuto && !canAffordBet)}
				>
					<img class="spin-btn__icon" src={barSpin} alt="" />
					{#if hasAuto}
						<span class="spin-btn__count" style={`--spin-count-scale:${autoSpinsCountScale}`}
							>{autoSpinsRemainingText}</span
						>
					{/if}
				</button>

				<div class="pt-grp">
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
				</div>
			</div>

			<div class="pt-stats">
				<div class="value-pill value-pill--balance pt-balance">
					<div class="label label--balance">
						<span class="label-text">{i18nDerived.balance()}</span>
					</div>
					<span class="value">{formattedBalance}</span>
				</div>

				<!-- Bet stepper: round −/+ (desktop-style) flanking the value inside the bet container. -->
				<div class="pt-bet">
					<button
						class="nav-btn nav-btn--framed pt-step"
						type="button"
						onpointerdown={(event) => startHoldRepeat(event, onDecrease, () => stepBet(-1, { playSound: false }))}
						onpointerup={clearHoldRepeat}
						onpointercancel={clearHoldRepeat}
						onpointerleave={clearHoldRepeat}
						onclick={(event) => maybeRunClickAction(event, onDecrease)}
						disabled={disableDecrease}
						aria-label={`Decrease ${i18nDerived.betLabel()}`}
					>
						<img class="nav-icon" src={disableDecrease ? iconMinusDisabled : iconMinus} alt="minus" />
					</button>
					<!-- Display-only, like desktop: bet changes go through the − / + steppers. The tap-to-open
					     bet menu was removed here (user pass 2026-08-10). -->
					<div class="pt-bet-val">
						<span class="value" class:value--feature={isAnyModeActive}>{formattedBet}</span>
					</div>
					<button
						class="nav-btn nav-btn--framed pt-step"
						type="button"
						onpointerdown={(event) => startHoldRepeat(event, onIncrease, () => stepBet(1, { playSound: false }))}
						onpointerup={clearHoldRepeat}
						onpointercancel={clearHoldRepeat}
						onpointerleave={clearHoldRepeat}
						onclick={(event) => maybeRunClickAction(event, onIncrease)}
						disabled={disableIncrease}
						aria-label={`Increase ${i18nDerived.betLabel()}`}
					>
						<img class="nav-icon" src={disableIncrease ? iconPlusDisabled : iconPlus} alt="plus" />
					</button>
				</div>

				<!-- Where the buy-bonus used to be: the last round's win, always shown. -->
				<div class="value-pill value-pill--balance pt-balance pt-win">
					<div class="label label--balance">
						<span class="label-text">{i18nDerived.win()}</span>
					</div>
					<span class="value">{formattedWin}</span>
				</div>
			</div>
		</div>
	{/if}

	{#if isLandscapeMobile}
		<!-- ── Phone landscape: Blob Split's rail (Figma 11318:45947), as Veggie / magnetic-2 — rail =
		     menu, turbo, spin, auto; a vertical chevron bet stepper over the Press Play square, left of
		     the rail; BALANCE over WIN bottom-left. Sound lives in the menu popover. The capsule tube is
		     kept clear of the stepper column by stateGame's landscapeCapsuleLayout. ── -->
		<div class="ls-hud">
			<div class="ls-stats">
				<div class="value-pill value-pill--balance ls-balance">
					<div class="label label--balance">
						<span class="label-text">{i18nDerived.balance()}</span>
					</div>
					<span class="value" use:fitAmount>{formattedBalance}</span>
				</div>
				<div class="value-pill value-pill--balance ls-balance ls-win-box">
					<div class="label label--balance">
						<span class="label-text">{i18nDerived.win()}</span>
					</div>
					<span class="value" use:fitAmount>{formattedWin}</span>
				</div>
			</div>

			<div class="ls-side">
				<div class="ls-bet">
					<button
						class="ls-chev"
						type="button"
						onpointerdown={(event) =>
							startHoldRepeat(event, onIncrease, () => stepBet(1, { playSound: false }))}
						onpointerup={clearHoldRepeat}
						onpointercancel={clearHoldRepeat}
						onpointerleave={clearHoldRepeat}
						onclick={(event) => maybeRunClickAction(event, onIncrease)}
						disabled={disableIncrease}
						aria-label={`Increase ${i18nDerived.betLabel()}`}
					>
						<img class="step-chevron" src={barArrow} alt="" />
					</button>
					<div
						class="ls-bet-val"
						role="button"
						tabindex="0"
						onkeydown={(e) =>
							e.key === 'Enter' && canInteract && (stateModal.modal = { name: 'betAmountMenu' })}
						onclick={() => canInteract && (stateModal.modal = { name: 'betAmountMenu' })}
					>
						<span class="value" class:value--feature={isAnyModeActive} use:fitAmount
							>{formattedBet}</span
						>
					</div>
					<button
						class="ls-chev"
						type="button"
						onpointerdown={(event) =>
							startHoldRepeat(event, onDecrease, () => stepBet(-1, { playSound: false }))}
						onpointerup={clearHoldRepeat}
						onpointercancel={clearHoldRepeat}
						onpointerleave={clearHoldRepeat}
						onclick={(event) => maybeRunClickAction(event, onDecrease)}
						disabled={disableDecrease}
						aria-label={`Decrease ${i18nDerived.betLabel()}`}
					>
						<img class="step-chevron step-chevron--down" src={barArrow} alt="" />
					</button>
				</div>
				<button
					class="bonus-square ls-bonus"
					type="button"
					disabled={disableBuy}
					onclick={openBuyBonus}
					aria-label={i18nDerived.buyBonus()}
				>
					{@render bonusFace(false)}
				</button>
			</div>

			<div class="ls-nav">
				{@render menuToggle()}
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
				<button
					class="spin-btn ls-spin"
					class:spin-btn--busy={isBusy}
					class:spin-btn--holding={stateBet.isSpaceHold}
					type="button"
					onclick={onSpinClick}
					onpointerdown={onSpinPointerDown}
					aria-label="Spin"
					disabled={isBusy || (canInteract && !hasAuto && !canAffordBet)}
				>
					<img class="spin-btn__icon" src={barSpin} alt="" />
					{#if hasAuto}
						<span class="spin-btn__count" style={`--spin-count-scale:${autoSpinsCountScale}`}
							>{autoSpinsRemainingText}</span
						>
					{/if}
				</button>
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

{#if showInfoModal}
	<CustomInfoModal onclose={() => (showInfoModal = false)} />
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
		font-family: 'Chakra Petch', 'Inter', sans-serif;
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
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: 0.1em;
	}

	.scatter-card__text {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
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
		font-family: 'Chakra Petch', 'Inter', sans-serif;
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
		font-family: 'Chakra Petch', 'Inter', sans-serif;
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
		font-family: 'Chakra Petch', 'Inter', sans-serif;
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

	/* Turbo states — same Version2 toggle vocabulary as the bottom-bar button (see above). */
	.circle-btn--turbo .btn-icon {
		width: 23px;
		height: 23px;
	}
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
		font-family: 'Chakra Petch', 'Inter', sans-serif;
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
	   magnetic-2 wear (Blob Split's Figma 11395:4052), asked for here 2026-11-26 =====================
	   A black 47% plate, white round buttons with black rims and black glyphs, a white spin disc with a
	   black rim, the Press Play square as BONUS, accent labels over white amounts. Desktop + tablet also
	   take Blob Split's placements; portrait keeps its own and wears the look; phone landscape takes
	   Blob's rail. Later in the sheet than the Version2 navy rules it overrides, so it wins by source order. */
	.hud-shell {
		--bar-fill: rgb(0 0 0 / 0.47);
		--bar-hover: #efeaff;
		/* Magnetic's own label blue (the old bar's #60a5facc), not Blob Split's pink. */
		--bar-accent: #60a5fa;
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
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
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
</style>
