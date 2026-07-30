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

	// Shrink a button label so long-locale copy fits its button. Two button shapes:
	//   • Wide pills (landscape / desktop, `white-space: nowrap`) — the single line must fit the inner
	//     width (e.g. de "BONUS KAUFEN", fr "ACHETER BONUS", pt "COMPRAR BÔNUS", ru "КУПИТЬ БОНУС").
	//   • The round portrait pad (`white-space: normal`, text wraps) — the wrapped block must sit inside
	//     the pad's INSCRIBED area, which is smaller than its square box; long copy (ar/es/fr/hi/ja/ko/
	//     pt/ru/vi) otherwise reaches the ring. Short labels (en "BUY BONUS", da "KØB BONUS") keep base.
	// Iterative so it also converges when shrinking re-flows a wrapped label onto fewer lines. Re-runs on
	// language change (text passed as the dep), on resize, and once the web font has loaded.
	function fitLabel(node: HTMLElement, _dep?: unknown) {
		const apply = () => {
			const btn = node.parentElement;
			if (!btn) return;
			node.style.fontSize = '';
			node.style.letterSpacing = '';
			const cs = getComputedStyle(node);
			const baseSize = parseFloat(cs.fontSize);
			const baseLs = parseFloat(cs.letterSpacing) || 0;
			const bcs = getComputedStyle(btn);
			const bw = btn.clientWidth;
			const bh = btn.clientHeight;
			const padX = parseFloat(bcs.paddingLeft || '0') + parseFloat(bcs.paddingRight || '0');
			const padY = parseFloat(bcs.paddingTop || '0') + parseFloat(bcs.paddingBottom || '0');
			// Near-square pads are the round buy-bonus button: usable text area is a fraction of the box so
			// the wrapped copy clears the ring. Wide pills use their full inner width (height never binds).
			const round = Math.max(bw, bh) > 0 && Math.abs(bw - bh) / Math.max(bw, bh) < 0.35;
			const availW = round ? bw * 0.62 : Math.max(0, bw - padX) * 0.96;
			const availH = round ? bh * 0.6 : Math.max(0, bh - padY);
			if (availW <= 0 || availH <= 0) return;
			// Measure the ACTUAL rendered text (widest line + total height) via a Range — for a wrapping
			// label `scrollWidth` reports the max-width box, not the widest line, which would over-shrink.
			const range = document.createRange();
			range.selectNodeContents(node);
			const overflows = () => {
				const r = range.getBoundingClientRect();
				return r.width > availW + 0.5 || r.height > availH + 0.5;
			};
			let size = baseSize;
			let guard = 0;
			while (guard++ < 48 && size > baseSize * 0.4 && overflows()) {
				size -= 0.5;
				const k = size / baseSize;
				node.style.fontSize = `${size}px`;
				node.style.letterSpacing = `${baseLs * k}px`;
			}
		};
		const ro = new ResizeObserver(apply);
		if (node.parentElement) ro.observe(node.parentElement);
		requestAnimationFrame(apply);
		(document as Document).fonts?.ready.then(apply);
		return { update: apply, destroy: () => ro.disconnect() };
	}

	// Converts absolute /path to ./path so it resolves relative to the page URL at any deploy sub-path
	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;

	const heroCardBg = ap('/assets/components/backgrounds/visual_v2.jpg');
	const controlsBg = ap('/assets/components/reference/controls_reference.png');
	const buyBonusBg = ap('/assets/components/reference/buy_bonus_reference.png');

	// Frame backgrounds — passed as CSS vars because url() in style blocks can't use runtime paths
	const menuBtnFrame = ap('/assets/components/frames/top_menu-button_frame.webp');
	const soundBtnFrame = ap('/assets/components/frames/top_sound_button_frame.webp');
	const menuBarFrame = ap('/assets/components/navbar/nav_bar.webp'); // blue-tech bottom bar

	// Button backgrounds (icon-less frames) — icons are layered on top in markup
	const btnRoundBg = ap('/assets/components/navbar/btn_bg_round.webp'); // (unused; utility buttons are CSS circles)
	const btnSpinBg = ap('/assets/components/navbar/btn_spin.webp'); // blue round — spin
	const btnSpinStop = ap('/assets/components/navbar/btn_spin_stop.webp'); // stop/disabled state (during a spin) — square baked in
	const btnWideBg = ap('/assets/components/navbar/btn_buy_bonus.webp'); // blue pill — buy bonus

	// Round icon-buttons — each PNG is a COMPLETE button (dark disc + cyan ring + icon baked in),
	// with default + disabled/mute states from the "Icon Buttons" set. Used as the whole button.
	const iconMenu = ap('/assets/components/navbar/icons/menu.webp');
	// Same button (cyan ring + dark fill) as menu.webp but with a white X — shown while the menu
	// popover is open so the button reads as "close".
	const iconMenuClose = ap('/assets/components/navbar/icons/menu_close.webp');
	// Menu popover (Figma 4498-8432): panel above the menu button with SOUND / MUSIC / INFO rows.
	const menuPopupBg = ap('/assets/components/navbar/menu_popup_bg.webp');
	const iconMenuSound = ap('/assets/components/navbar/icons/menu_sound.svg');
	const iconMenuMusic = ap('/assets/components/navbar/icons/menu_music.svg');
	const iconMenuInfo = ap('/assets/components/navbar/icons/menu_info.svg');
	// Disabled-state icons (Figma 4553-9279): slashed speaker / slashed note.
	const iconMenuSoundOff = ap('/assets/components/navbar/icons/menu_sound_off.webp');
	const iconMenuMusicOff = ap('/assets/components/navbar/icons/menu_music_off.webp');
	const iconSound = ap('/assets/components/navbar/icons/sound.webp');
	const iconMute = ap('/assets/components/navbar/icons/mute.webp');
	const iconMinus = ap('/assets/components/navbar/icons/minus.webp');
	const iconMinusDisabled = ap('/assets/components/navbar/icons/minus_disabled.webp');
	const iconPlus = ap('/assets/components/navbar/icons/plus.webp');
	const iconPlusDisabled = ap('/assets/components/navbar/icons/plus_disabled.webp');
	const iconAuto = ap('/assets/components/navbar/icons/auto.webp');
	const iconAutoDisabled = ap('/assets/components/navbar/icons/auto_disabled.webp');
	const iconSpin = ap('/assets/hud/icon-spin.webp');
	const iconTurbo = ap('/assets/components/navbar/icons/turbo.webp');
	const iconTurbo1 = ap('/assets/components/navbar/icons/turbo1.webp');
	const iconTurbo3 = ap('/assets/components/navbar/icons/turbo3.webp');
	const iconCoins = ap('/assets/components/navbar/coins.webp');

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

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait');
	const isLandscapeMobile = $derived(layoutType === 'landscape');

	// Landscape: the buy-bonus button is an HTML element but must sit centred directly beneath the
	// pixi capsule. The capsule lives in virtual (main) coordinates; convert its column centre + bottom
	// to device pixels using the same virtual→screen transform pixi uses, so they track at every ratio.
	const lsMain = $derived(context.stateLayoutDerived.mainLayout());
	const lsCapsule = $derived(context.stateGameDerived.landscapeCapsuleLayout());
	const lsBuyX = $derived(lsMain.x + (lsCapsule.colX - lsMain.width / 2) * lsMain.scale);
	// Buy TOP hangs a gap below the VISIBLE tube bottom (the sprite box is padded). Anchoring by the top
	// (not the centre) keeps the gap independent of the button's size, so the big min-sized button on
	// small screens can't creep up against the capsule.
	const lsBuyY = $derived(
		lsMain.y +
			(lsCapsule.visibleBottom - lsMain.height / 2) * lsMain.scale +
			lsCapsule.visibleW * 0.15 * lsMain.scale,
	);
	const canInteract = $derived(context.stateXstateDerived.isIdle());
	const hasAuto = $derived(stateBetDerived.hasAutoBetCounter());
	const isSpinStop = $derived(!context.stateXstateDerived.isIdle() || hasAuto);
	const canAffordBet = $derived(stateBetDerived.isBetCostAvailable());
	// An active manual spin is in progress (not idle, and not an auto-spin sequence) — the spin
	// button shows its no-arrow "empty" disabled state and is not clickable.
	const isBusy = $derived(!context.stateXstateDerived.isIdle() && !hasAuto);

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
	// Bolder icon = faster: normal = outline bolt (turbo3), turbo = solid bolt (turbo), super = double (turbo1)
	const turboIcon = $derived(
		stateBet.isSuperTurbo ? iconTurbo1 : stateBet.isTurbo ? iconTurbo : iconTurbo3,
	);
	const isMuted = $derived(stateSound.volumeValueMaster === 0);
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
		const unmuting = stateSound.volumeValueMaster === 0;
		stateSound.volumeValueMaster = unmuting ? 50 : 0;
		// Unmuting the master while BOTH channels are individually off would stay silent —
		// restore the channels so the button audibly unmutes everything.
		if (unmuting && stateSound.volumeValueMusic === 0 && stateSound.volumeValueSoundEffect === 0) {
			stateSound.volumeValueMusic = 75;
			stateSound.volumeValueSoundEffect = 75;
		}
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
	data-layout={layoutType}
	style={`--forest-card-bg:url('${heroCardBg}');--forest-controls-bg:url('${controlsBg}');--forest-buy-bg:url('${buyBonusBg}');--menu-btn-bg:url('${menuBtnFrame}');--sound-btn-bg:url('${soundBtnFrame}');--menu-bar-bg:url('${menuBarFrame}');--scatter-frame-bg:url('${scatterFrame}');--hud-frame-bg:url('${hudFrame}');--buy-btn-bg:url('${btnWideBg}');--small-btn-bg:url('${smallBtnFrame}');--play-btn-bg:url('${playBtnFrame}');--btn-round-bg:url('${btnRoundBg}');--btn-spin-bg:url('${btnSpinBg}');--btn-spin-stop-bg:url('${btnSpinStop}');--pt-navbar:url('${navBarMobile}');--pt-buy:url('${buyBonusMobile}');--pt-value:url('${valueBoxMobile}');--pt-balance-bg:url('${balanceContainer}');--pt-bet-bg:url('${betContainer}');--ls-navbar:url('${navBarLand}');--ls-betbox:url('${betBoxLand}');--ls-buy-x:${lsBuyX}px;--ls-buy-y:${lsBuyY}px`}
>
	<!-- Menu popover (SOUND / MUSIC / INFO) — shared by desktop and portrait; rendered inside a
	     position:relative nav container so it floats above the menu button. -->
	{#snippet menuPopup()}
		<button
			class="menu-popup-backdrop"
			type="button"
			aria-label="Close menu"
			onclick={() => (showMenuPopup = false)}
		></button>
		<div class="menu-popup" style={`background-image:url('${menuPopupBg}')`}>
			<button class="menu-row" type="button" onclick={toggleSfx}>
				<!-- SOUND uses the exact bottom-bar sound/mute button art so the two match 1:1. -->
				<span class="menu-row__icon menu-row__icon--full">
					<img class="menu-row__fullimg" src={sfxOff ? iconMute : iconSound} alt="" />
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
			<div class="hud-system">
				<button
					class="nav-btn nav-btn--framed"
					type="button"
					onclick={toggleMenuPopup}
					aria-label="Menu"
				>
					<img class="nav-icon" src={showMenuPopup ? iconMenuClose : iconMenu} alt="menu" />
				</button>
				{#if showMenuPopup}{@render menuPopup()}{/if}
				<!-- Master mute toggle: one press silences ALL sound + music. The menu popup still lets you
				     turn SOUND / MUSIC on/off individually. -->
				<button
					class="nav-btn nav-btn--framed"
					type="button"
					onclick={toggleSound}
					aria-label="Mute all sound"
				>
					<img class="nav-icon" src={isMuted ? iconMute : iconSound} alt="sound" />
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
					<span class="buy-btn__label" use:fitLabel={isAnyModeActive ? i18nDerived.translate('DEACTIVATE') : i18nDerived.buyBonus()}>{isAnyModeActive ? i18nDerived.translate('DEACTIVATE') : i18nDerived.buyBonus()}</span>
				</button>
			</div>

			<div class="value-pill value-pill--balance">
				<div class="label label--balance">
					<span class="label-text">{i18nDerived.balance()}</span>
				</div>
				<span class="value">{formattedBalance}</span>
			</div>
		</div>

		<div class="hud-divider" aria-hidden="true"></div>

		<div class="hud-controls">
			<!-- Last round win — sits between balance and bet. -->
			<div class="value-pill value-pill--balance value-pill--win">
				<div class="label label--balance">
					<span class="label-text">{i18nDerived.win()}</span>
				</div>
				<span class="value">{formattedWin}</span>
			</div>

			<!-- Display-only: bet changes go through the − / + steppers (bet menu on click disabled). -->
			<div class="value-pill value-pill--bet bet-pill">
				<span class="bet-coin" aria-hidden="true">
					<img src={iconCoins} alt="" />
				</span>
				<div class="bet-values">
					<span class="label">{i18nDerived.betLabel()}</span>
					<span class="value" class:value--feature={isAnyModeActive}>{formattedBet}</span>
				</div>
			</div>

			<div class="stepper">
				{#if isLandscapeMobile}
					<button class="nav-btn nav-btn--framed" type="button" onclick={openRules} aria-label="Game rules">
						<img class="nav-icon" src={iconMenu} alt="menu" />
					</button>
					<button class="nav-btn nav-btn--framed" type="button" onclick={toggleSound} aria-label="Sound">
						<img class="nav-icon" src={isMuted ? iconMute : iconSound} alt="sound" />
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
					aria-label={`Decrease ${i18nDerived.betLabel()}`}
				>
					<img class="nav-icon" src={disableDecrease ? iconMinusDisabled : iconMinus} alt="minus" />
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
					aria-label={`Increase ${i18nDerived.betLabel()}`}
				>
					<img class="nav-icon" src={disableIncrease ? iconPlusDisabled : iconPlus} alt="plus" />
				</button>
			</div>

			<div class="play-cluster">
				<button
					class="spin-btn"
					class:spin-btn--busy={isBusy}
					type="button"
					onclick={onSpinButton}
					aria-label="Spin"
					disabled={isBusy || (canInteract && !hasAuto && !canAffordBet)}
				>
					{#if hasAuto}
						<span
							class="spin-btn__count"
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
					<img class="nav-icon" src={disableAuto ? iconAutoDisabled : iconAuto} alt="auto" />
				</button>
			</div>
		</div>
	</div>

	{#if isPortrait}
		<!-- ── Portrait HUD: spin-centred control row + balance / bet / buy row ── -->
		<div class="pt-hud">
			<div class="pt-controls">
				<div class="pt-grp pt-grp--left">
					<button class="nav-btn nav-btn--framed" type="button" onclick={toggleMenuPopup} aria-label="Menu">
						<img class="nav-icon" src={showMenuPopup ? iconMenuClose : iconMenu} alt="menu" />
					</button>
					{#if showMenuPopup}{@render menuPopup()}{/if}
					<div class="pt-buy pt-buy--nav">
						<button
							class="buy-btn"
							type="button"
							disabled={disableBuy}
							onclick={openBuyBonus}
							aria-label={i18nDerived.buyBonus()}
						>
							<span class="buy-btn__label" use:fitLabel={i18nDerived.buyBonus()}>{i18nDerived.buyBonus()}</span>
						</button>
					</div>
				</div>

				<button
					class="spin-btn pt-spin"
					class:spin-btn--busy={isBusy}
					type="button"
					onclick={onSpinButton}
					aria-label="Spin"
					disabled={isBusy || (canInteract && !hasAuto && !canAffordBet)}
				>
					{#if hasAuto}
						<span class="spin-btn__count">{autoSpinsRemainingText}</span>
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
						<img class="nav-icon" src={disableAuto ? iconAutoDisabled : iconAuto} alt="auto" />
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
					<div
						class="pt-bet-val"
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && canInteract && (stateModal.modal = { name: 'betAmountMenu' })}
						onclick={() => canInteract && (stateModal.modal = { name: 'betAmountMenu' })}
					>
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
		<!-- ── Landscape HUD: vertical nav bar (right), balance/bet (bottom-left), buy bonus ── -->
		<div class="ls-hud">
			<div class="ls-stats">
				<div class="value-pill value-pill--balance ls-balance">
					<div class="label label--balance">
						<span class="label-text">{i18nDerived.balance()}</span>
					</div>
					<span class="value">{formattedBalance}</span>
				</div>
				<div class="ls-bet">
					<button
						class="nav-btn nav-btn--framed ls-step"
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
					<div
						class="ls-bet-val"
						role="button"
						tabindex="0"
						onkeydown={(e) => e.key === 'Enter' && canInteract && (stateModal.modal = { name: 'betAmountMenu' })}
						onclick={() => canInteract && (stateModal.modal = { name: 'betAmountMenu' })}
					>
						<span class="value" class:value--feature={isAnyModeActive}>{formattedBet}</span>
					</div>
					<button
						class="nav-btn nav-btn--framed ls-step"
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
			</div>

			<!-- Buy bonus centred under the capsule (its original spot), with the last-round WIN stretched
			     beneath it, reaching under the nav. -->
			<div class="ls-buy">
				<button
					class="buy-btn"
					type="button"
					disabled={disableBuy}
					onclick={openBuyBonus}
					aria-label={i18nDerived.buyBonus()}
				>
					<span class="buy-btn__label" use:fitLabel={i18nDerived.buyBonus()}>{i18nDerived.buyBonus()}</span>
				</button>
			</div>
			<div class="ls-win">
				<div class="value-pill value-pill--balance ls-win-pill">
					<div class="label label--balance">
						<span class="label-text">{i18nDerived.win()}</span>
					</div>
					<span class="value">{formattedWin}</span>
				</div>
			</div>

			<div class="ls-nav">
				<button class="nav-btn nav-btn--framed" type="button" onclick={toggleMenuPopup} aria-label="Menu">
					<img class="nav-icon" src={showMenuPopup ? iconMenuClose : iconMenu} alt="menu" />
				</button>
				{#if showMenuPopup}{@render menuPopup()}{/if}
				<!-- Sound icon moved here (was buy bonus): master mute for ALL sound + music. -->
				<button
					class="nav-btn nav-btn--framed ls-nav-sound"
					type="button"
					onclick={toggleSound}
					aria-label="Mute all sound"
				>
					<img class="nav-icon" src={isMuted ? iconMute : iconSound} alt="sound" />
				</button>
				<button
					class="spin-btn ls-spin"
					class:spin-btn--busy={isBusy}
					type="button"
					onclick={onSpinButton}
					aria-label="Spin"
					disabled={isBusy || (canInteract && !hasAuto && !canAffordBet)}
				>
					{#if hasAuto}
						<span class="spin-btn__count">{autoSpinsRemainingText}</span>
					{/if}
				</button>
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
					<img class="nav-icon" src={disableAuto ? iconAutoDisabled : iconAuto} alt="auto" />
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
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 8px;
		z-index: 20;
		font-family: 'IBM Plex Sans Condensed', 'Inter', sans-serif;
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
		font-family: 'IBM Plex Sans Condensed', 'Inter', sans-serif;
		font-size: 1.15rem;
		font-weight: 700;
		letter-spacing: 0.1em;
	}

	.scatter-card__text {
		font-family: 'IBM Plex Sans Condensed', 'Inter', sans-serif;
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

	/* Blue-tech bottom bar (thin border + corner brackets), stretched to fill the box */
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
	/* Compact buy-bonus so the whole bar (now with the WIN pill) fits on narrow laptops. */
	.hud-buy .buy-btn {
		width: 126px;
		padding: 0 12px;
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

	.bet-coin {
		pointer-events: none;
		width: 32px;
		height: 32px;
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
		font-family: 'Inter', sans-serif;
		font-size: 10px;
		font-weight: 700;
		line-height: 15px;
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

	.value {
		font-family: 'Inter', sans-serif;
		font-size: 1.05rem;
		font-weight: 700;
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
	/* BUY BONUS hover (Figma): indigo glow around the pill */
	.buy-btn:not(:disabled):hover {
		filter: brightness(1.08) drop-shadow(0 0 6.5px #4f5bff);
	}

	.circle-btn:not(:disabled):active,
	.buy-btn:active {
		filter: brightness(0.92);
	}

	.buy-btn {
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}
	.buy-btn:disabled {
		filter: grayscale(0.7) brightness(0.55);
		cursor: default;
		pointer-events: none;
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

	/* Utility buttons: the icon-button PNG IS the whole button (disc + ring + icon), so no CSS
	   frame — the image fills the button box. */
	.nav-btn--framed {
		background: none;
	}

	.nav-btn--framed .nav-icon {
		width: 100%;
		height: 100%;
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

	.nav-btn img.is-muted {
		opacity: 0.4;
	}

	.nav-btn.active {
		filter: drop-shadow(0 0 7px rgba(255, 216, 74, 0.9));
	}

	/* Turbo active — subtle icon brightness only, no coloured (yellow) glow. The turbo icon asset itself
	   swaps outline -> solid -> double bolt, which is what conveys the fast/super state. */
	.nav-btn--turbo.turbo-fast .nav-icon {
		filter: brightness(1.15);
	}

	.nav-btn--turbo.turbo-super .nav-icon {
		filter: brightness(1.4);
	}

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
		padding: 22px 22px 24px;
		background-size: 100% 100%;
		background-repeat: no-repeat;
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
		border: 1px solid #00fcff;
		background: linear-gradient(to top, #0f2053, #000000);
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
		width: 100%;
		height: 100%;
		object-fit: contain;
		display: block;
	}
	/* The "off" (struck-through) icons are .webp exports with little internal padding, so at `contain`
	   they fill the glyph box more than the padded .svg on-state icons — scale them down to match. */
	.menu-row__glyph.is-off {
		transform: scale(0.78);
	}
	.menu-row__label {
		font-family: 'Inter', sans-serif;
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
		background: rgba(0, 252, 255, 0.28);
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

	/* Fast mode: subtle icon brightness only — no coloured (yellow) glow or gold tint. */
	.circle-btn--turbo.turbo-fast {
		opacity: 1;
	}
	.circle-btn--turbo.turbo-fast .btn-icon {
		filter: brightness(1.15);
	}

	/* Turbo (super) mode: brighter icon, still no coloured glow. */
	.circle-btn--turbo.turbo-super {
		opacity: 1;
	}
	.circle-btn--turbo.turbo-super .btn-icon {
		filter: brightness(1.4);
	}

	.spin-btn {
		width: 128px;
		height: 128px;
		/* Negative margins keep the big button from inflating the bar height;
		   it protrudes above/below the bar as the focal control. */
		margin: -32px 0;
		border: none;
		background: var(--btn-spin-bg) center / contain no-repeat;
		padding: 0;
		outline: none;
		cursor: pointer;
		display: grid;
		place-items: center;
		position: relative;
		z-index: 3;
		transition: filter 0.12s ease;
	}

	.spin-btn__icon {
		width: 42%;
		height: 42%;
		object-fit: contain;
		display: block;
		pointer-events: none;
		/* The green frame's disc sits ~2% below the asset's box center (leaves are
		   heavier at the bottom), so nudge the icon down to center it on the disc. */
		transform: translateY(7%);
	}

	.spin-btn:not(:disabled):hover {
		filter: brightness(1.08) drop-shadow(0 0 5px #0d89c6);
	}

	.spin-btn:not(:disabled):active {
		filter: brightness(0.92);
	}

	.spin-btn:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* While a spin is running: swap to the dedicated stop-state button asset (square baked in). */
	.spin-btn.spin-btn--busy {
		background-image: var(--btn-spin-stop-bg);
	}

	.spin-btn.spin-btn--busy:disabled {
		opacity: 1;
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
		font-family: 'IBM Plex Sans Condensed', 'Inter', sans-serif;
		font-weight: 900;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.9);
		pointer-events: none;
	}

	.spin-btn__glyph {
		font-size: 2rem;
	}

	.spin-btn__count {
		font-size: 1.5rem;
	}

	.buy-btn {
		width: 152px;
		height: auto;
		aspect-ratio: 636 / 192;
		border: 0;
		background: var(--buy-btn-bg) center / 100% 100% no-repeat;
		padding: 0 26px;
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

	.buy-btn__label {
		font-family: 'Inter', sans-serif;
		font-size: 12px;
		font-weight: 700;
		color: #fff;
		letter-spacing: 1.4px;
		line-height: 20px;
		text-transform: uppercase;
		text-align: center;
		white-space: nowrap;
		pointer-events: none;
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
	/* ══ Portrait (mobile) HUD ══ */
	.hud-shell[data-layout='portrait'] {
		padding: 0;
	}
	/* Hide the desktop single-row bar; the portrait two-row HUD replaces it. */
	.hud-shell[data-layout='portrait'] .hud-bottom {
		display: none;
	}
	.hud-shell[data-layout='portrait']::after {
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
		width: clamp(98px, 30vw, 118px);
		height: clamp(98px, 30vw, 118px);
		margin: 0;
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 1;
	}
	.pt-spin .spin-btn__count {
		font-size: 1.25rem;
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
		cursor: pointer;
	}
	.pt-bet-val .value {
		font-size: clamp(0.76rem, 3.7vw, 0.96rem);
		font-weight: 700;
		color: #fff;
		white-space: nowrap;
		line-height: 1.1;
		text-shadow: 0 0 6px rgba(80, 190, 255, 0.35);
	}
	/* Round buy-bonus badge — larger focal action. */
	.pt-buy {
		flex: 0 0 auto;
	}
	.pt-buy .buy-btn {
		width: clamp(68px, 20.5vw, 88px);
		height: clamp(68px, 20.5vw, 88px);
		aspect-ratio: 1;
		background: var(--pt-buy) center / contain no-repeat;
		padding: 0;
	}
	.pt-buy .buy-btn__label {
		white-space: normal;
		line-height: 1.05;
		text-align: center;
		font-size: clamp(0.52rem, 2.6vw, 0.66rem);
		max-width: 74%;
	}

	/* Buy-bonus moved INTO the nav bar (left group), sized to ~100% of the nav height. */
	.pt-buy--nav {
		flex: 0 0 auto;
	}
	.pt-buy--nav .buy-btn {
		width: clamp(50px, 15vw, 64px);
		height: clamp(50px, 15vw, 64px);
		aspect-ratio: 1;
		background: var(--pt-buy) center / contain no-repeat;
		padding: 0;
	}
	.pt-buy--nav .buy-btn__label {
		font-size: clamp(0.4rem, 2vw, 0.52rem);
		max-width: 78%;
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
	.hud-shell[data-layout='landscape']::after {
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
		right: clamp(12px, 2.6vw, 32px);
		top: 54%;
		transform: translateY(-50%);
		/* Slim panel, tall enough to space the buttons out. Width is decoupled from height (the art is a
		   plain rounded panel, so the mild horizontal stretch is invisible) so it can be narrow AND tall.
		   The big spin disc overflows its sides as the focal control (mirrors the desktop spin button,
		   which protrudes past the bar via negative margins). */
		width: clamp(40px, 7vw, 68px);
		/* Slightly shorter (was 78vh / 348) to leave room for the buy-bonus + WIN column under the capsule. */
		height: clamp(150px, 70vh, 312px);
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
		width: clamp(17px, 7.4vh, 42px);
		height: clamp(17px, 7.4vh, 42px);
	}
	/* Focal spin — big disc that overflows the slim nav panel on both sides (negative side margins so
	   it protrudes past the panel edges without widening the flex column), centred. */
	.ls-nav .ls-spin {
		width: clamp(54px, 24vh, 126px);
		height: clamp(54px, 24vh, 126px);
		margin: clamp(1px, 0.4vh, 4px) calc(-1 * clamp(20px, 6vh, 36px));
		flex: 0 0 auto;
	}
	.ls-nav .ls-spin .spin-btn__count {
		font-size: 0.9rem;
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
	.ls-bet .ls-step {
		width: clamp(12px, 4.4vh, 28px);
		height: clamp(12px, 4.4vh, 28px);
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
	/* Buy bonus round badge — locked to the pixi capsule column (device px, computed from the shared
	   capsule geometry) so it stays centred beneath the capsule at every device aspect ratio. */
	.ls-buy {
		position: absolute;
		left: var(--ls-buy-x, 79.5%);
		top: var(--ls-buy-y, auto);
		right: auto;
		bottom: auto;
		transform: translate(-50%, 0);
		/* Buy bonus on top, WIN stacked beneath it — both centred on the capsule column. */
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: clamp(3px, 1.4vh, 10px);
	}
	.ls-buy .buy-btn {
		width: clamp(44px, 15.5vh, 94px);
		height: clamp(44px, 15.5vh, 94px);
		aspect-ratio: 1;
		background: var(--pt-buy) center / contain no-repeat;
		padding: 0;
	}
	.ls-buy .buy-btn__label {
		white-space: normal;
		line-height: 1.02;
		text-align: center;
		font-size: clamp(0.19rem, 2vh, 0.6rem);
		max-width: 82%;
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
	.ls-nav-buy {
		flex: 0 0 auto;
		display: flex;
	}
	.ls-nav-buy .buy-btn {
		width: clamp(34px, 15vh, 62px);
		height: clamp(34px, 15vh, 62px);
		aspect-ratio: 1;
		background: var(--pt-buy) center / contain no-repeat;
		padding: 0;
	}
	.ls-nav-buy .buy-btn__label {
		white-space: normal;
		line-height: 1.02;
		text-align: center;
		font-size: clamp(0.28rem, 1.5vh, 0.48rem);
		max-width: 80%;
	}
	/* WIN: a bar stretched across the lower-right gutter — starting just right of the board, running under
	   the buy-bonus/capsule across to under the nav. Bottom-anchored so it sits beneath the buy-bonus. */
	.ls-win {
		position: absolute;
		left: calc(var(--ls-buy-x, 79.5%) - clamp(56px, 12vw, 128px));
		right: clamp(4px, 1vw, 14px);
		bottom: clamp(8px, 4.5vh, 30px);
		display: flex;
		justify-content: center;
	}
	.ls-win .ls-win-pill {
		width: 100%;
		box-sizing: border-box;
		flex-direction: row;
		align-items: center;
		justify-content: center;
		gap: clamp(4px, 1.2vw, 12px);
		background: var(--pt-balance-bg) center / 100% 100% no-repeat;
		border: none;
		box-shadow: none;
		backdrop-filter: none;
		border-radius: 0;
		min-width: 0;
		/* Roomier vertical padding so the black box reads clearly (matches the balance box). */
		padding: clamp(5px, 2.7vh, 12px) clamp(10px, 2.4vw, 22px);
	}
	.ls-win .label--balance {
		justify-content: center;
		width: auto;
	}
	.ls-win .label--balance {
		justify-content: center;
	}
	.ls-win .ls-win-pill .value {
		font-size: clamp(0.42rem, 2.9vh, 0.85rem);
		white-space: nowrap;
		color: #fff;
	}
	.ls-win .ls-win-pill .label-text {
		font-size: clamp(0.3rem, 1.75vh, 0.54rem);
		color: #fff;
	}

	/* Smaller landscape phones (height ≤ 400px, e.g. 812×375 / 568×320): the buy-bonus badge under the
	   capsule is smaller, so its BUY / BONUS label shrinks too. (The tiniest screens shrink further in the
	   max-height:300px block below.) */
	@media (max-height: 400px) {
		.hud-shell[data-layout='landscape'] .ls-buy .buy-btn__label {
			font-size: clamp(0.16rem, 1.55vh, 0.42rem);
			max-width: 78%;
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
		/* Buy-bonus badge under the capsule: smaller BUY / BONUS text so it fits the shrunk badge on
		   these short landscape screens. */
		.hud-shell[data-layout='landscape'] .ls-buy .buy-btn__label {
			font-size: clamp(0.14rem, 1.5vh, 0.28rem);
			max-width: 74%;
		}
		/* WIN under the capsule: shrink so it clears the board's right edge and the capsule above it. */
		.hud-shell[data-layout='landscape'] .ls-win .ls-win-pill .value {
			font-size: clamp(0.34rem, 2.4vh, 0.5rem);
		}
		.hud-shell[data-layout='landscape'] .ls-win .ls-win-pill .label-text {
			font-size: clamp(0.24rem, 1.5vh, 0.34rem);
		}
		/* Drop the pill's box (min-width / dark fill / blur) here — centred on the capsule, the boxed pill
		   grew LEFT into the board with a real win value. As plain centred text it stays clear of the board. */
		.hud-shell[data-layout='landscape'] .ls-win .ls-win-pill {
			min-width: 0;
			background: none;
			box-shadow: none;
			backdrop-filter: none;
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
</style>
