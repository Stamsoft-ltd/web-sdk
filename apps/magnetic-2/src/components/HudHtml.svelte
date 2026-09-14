<script lang="ts" module>
	// Converts absolute /path to ./path so it resolves relative to the page URL at any deploy sub-path
	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;

	const heroCardBg = ap('/assets/components/backgrounds/visual_v2.jpg');

	// Frame backgrounds — passed as CSS vars because url() in style blocks can't use runtime paths
	const menuBtnFrame = ap('/assets/components/frames/top_menu-button_frame.webp');
	const soundBtnFrame = ap('/assets/components/frames/top_sound_button_frame.webp');

	// The MOTHERSHIP HUD (Figma 9032:23173) draws every control as a flat CSS shape in the palette
	// declared on .hud-shell — the spin disc, the BONUS pill, the utility circles and all three
	// layouts' bar plates. The blue ring / capsule / nav-bar textures those replaced are gone.

	// Round icon-buttons — each PNG is a COMPLETE button (dark disc + cyan ring + icon baked in),
	// with default + disabled/mute states from the "Icon Buttons" set. Used as the whole button.
	const iconMenu = ap('/assets/components/navbar/icons/v2/ic_menu.svg');
	// Same button (cyan ring + dark fill) as menu.webp but with a white X (Figma 4036-3577) — shown
	// while the menu popover is open so the button reads as "close".
	// ?v= because an earlier cut of this file shipped with an opaque white background (Figma's export
	// flattens onto white), and browsers that already fetched it would keep serving the white box.
	// Menu popover (Figma 7041-8978): flat Version2 navy panel with SOUND / MUSIC / INFO rows —
	// pure CSS now (same #364970 / #4E78B8 language as the bottom bar), no bitmap panel.
	const iconMenuMusic = ap('/assets/components/navbar/icons/menu_music.svg');
	const iconMenuInfo = ap('/assets/components/navbar/icons/menu_info.svg');
	// Disabled state (Figma 4553-9279): slashed note.
	const iconMenuMusicOff = ap('/assets/components/navbar/icons/menu_music_off.webp');
	// ...and its speaker twin, which the design never exported — scripts/build-sound-off-icon.py
	// draws the ON-state SVG with the note's own slash through it. Muted sound used to be signalled
	// by dimming the speaker to 40%, which does not read as the same state as the struck note
	// directly below it in the popover.
	const iconMenuSoundOff = ap('/assets/components/navbar/icons/menu_sound_off.webp');
	// Version2 flat glyphs (white SVGs / cutout webp) drawn inside the CSS circle buttons — the old
	// per-state baked-button webps are gone; disabled/muted states are conveyed by CSS dimming.
	const iconSound = ap('/assets/components/navbar/icons/v2/ic_sound.svg');
	const iconMinus = ap('/assets/components/navbar/icons/v2/ic_minus.svg');
	const iconMinusDisabled = ap('/assets/components/navbar/icons/v2/ic_minus.svg');
	const iconPlus = ap('/assets/components/navbar/icons/v2/ic_plus.svg');
	const iconPlusDisabled = ap('/assets/components/navbar/icons/v2/ic_plus.svg');
	const iconAuto = ap('/assets/components/navbar/icons/v2/ic_auto.svg');
	const iconAutoDisabled = ap('/assets/components/navbar/icons/v2/ic_auto.svg');
	const iconSpin = ap('/assets/components/ui/spin_arrow.webp?v=20260807');
	// Three-state turbo bolt — the DESIGN'S own arts (Figma 4148:16896 outline = off,
	// 2503:7489 solid = fast, 4148:16893 double = super), not regenerated shapes.
	const iconTurbo = ap('/assets/components/ui/ic_thunder.webp?v=20260810b');
	const iconTurbo1 = ap('/assets/components/ui/ic_thunder_double.webp?v=20260810b');
	const iconTurbo3 = ap('/assets/components/ui/ic_thunder_outline.webp?v=20260810b');
	const iconCoins = ap('/assets/components/navbar/coins.webp');

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
		iconMenu,
		iconMenuMusic,
		iconMenuInfo,
		iconMenuMusicOff,
		iconSound,
		iconMenuSoundOff,
		iconMinus,
		iconPlus,
		iconAuto,
		iconSpin,
		iconTurbo,
		iconTurbo1,
		iconTurbo3,
		iconCoins,
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

	// Fit an AMOUNT into its fixed-width pill (desktop balance / win). The pills hold a fixed width
	// so a count-up never re-lays the bar; what gives instead is the type — a long amount steps its
	// font down until the text clears the pill's inner width. Unlike fitLabel this watches the TEXT
	// (MutationObserver): the pill never resizes when its number changes, so a parent
	// ResizeObserver would never fire, and Svelte 5 does not call an action's update() on a dep
	// change either.
	function fitAmount(node: HTMLElement) {
		const apply = () => {
			const pill = node.parentElement;
			if (!pill) return;
			node.style.fontSize = '';
			const cs = getComputedStyle(node);
			const baseSize = parseFloat(cs.fontSize);
			const pcs = getComputedStyle(pill);
			const availW =
				pill.clientWidth - parseFloat(pcs.paddingLeft || '0') - parseFloat(pcs.paddingRight || '0');
			if (availW <= 0) return;
			const range = document.createRange();
			range.selectNodeContents(node);
			let size = baseSize;
			let guard = 0;
			while (
				guard++ < 48 &&
				size > baseSize * 0.4 &&
				range.getBoundingClientRect().width > availW
			) {
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

	// Centre of the left rail in device px — the BET and BALANCE chips sit on the same column as the
	// logo and the FREE SPINS / TOTAL WIN / RESPIN boxes (user, 2026-09-11: "always center those
	// horizontally between left and board"). The column lives in main units, so convert it with the
	// same virtual→screen transform pixi uses.
	const lsMain = $derived(context.stateLayoutDerived.mainLayout());
	const lsRailCX = $derived(
		lsMain.x + (context.stateGameDerived.landscapeRail().x - lsMain.width / 2) * lsMain.scale,
	);

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
		const affordable = betOptions.filter(
			(option) => option * costMultiplier <= stateBet.balanceAmount,
		);
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
	const sfxOff = $derived(
		stateSound.volumeValueSoundEffect === 0 || stateSound.volumeValueMaster === 0,
	);
	const musicOff = $derived(
		stateSound.volumeValueMusic === 0 || stateSound.volumeValueMaster === 0,
	);
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
	// The hold forces turbo on for its duration, so the player's OWN turbo setting has to be put
	// back when they let go. Releasing used to write `false` unconditionally, which silently
	// demoted a TURBO player to normal speed every time they held the button or Space — the hold
	// was stealing a setting it only borrowed.
	let turboBeforeHold: boolean | null = null;
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
		turboBeforeHold = stateBet.isTurbo;
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
		// `isSuperTurbo` is never touched by the hold, so restoring `isTurbo` restores all three
		// speeds exactly as the player left them.
		stateBetDerived.updateIsTurbo(turboBeforeHold ?? false, { persistent: true });
		turboBeforeHold = null;
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
	style={`--forest-card-bg:url('${heroCardBg}');--menu-btn-bg:url('${menuBtnFrame}');--sound-btn-bg:url('${soundBtnFrame}');--scatter-frame-bg:url('${scatterFrame}');--hud-frame-bg:url('${hudFrame}');--small-btn-bg:url('${smallBtnFrame}');--play-btn-bg:url('${playBtnFrame}');--ls-rail-cx:${lsRailCX}px`}
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
		<div class="menu-popup">
			<button class="menu-row" type="button" onclick={toggleSfx}>
				<!-- SOUND uses the exact bottom-bar sound/mute button art so the two match 1:1. -->
				<span class="menu-row__icon">
					<span
						class="menu-row__glyph"
						style={`--icon:url('${sfxOff ? iconMenuSoundOff : iconSound}')`}
					></span>
				</span>
				<span class="menu-row__label">{i18nDerived.translate('SOUND')}</span>
			</button>
			<div class="menu-divider"></div>
			<button class="menu-row" type="button" onclick={toggleMusic}>
				<span class="menu-row__icon">
					<span
						class="menu-row__glyph"
						class:is-off={musicOff}
						style={`--icon:url('${musicOff ? iconMenuMusicOff : iconMenuMusic}')`}
					></span>
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
					class:nav-btn--open={showMenuPopup}
					type="button"
					onclick={toggleMenuPopup}
					aria-label="Menu"
				>
					{#if showMenuPopup}
						<!-- Open state (design): the disc fills lilac and a bare white X sits in it. Drawn,
						     not the old menu_close.webp — that was the previous theme's navy disc with a
						     cyan ring, which read as a second, smaller button inside this one. -->
						<span class="nav-close-x" aria-hidden="true"></span>
					{:else}
						<img class="nav-icon" src={iconMenu} alt="menu" />
					{/if}
				</button>
				{#if showMenuPopup}{@render menuPopup()}{/if}
				<!-- No mute button here: the design moves sound INTO the menu popover (which already
				     carries its own SOUND and MUSIC rows), which is what frees the width the balance
				     and win readouts needed. Landscape-mobile keeps its own pair — it has no popover. -->
			</div>

			<div class="hud-buy">
				<button
					class="buy-btn"
					type="button"
					disabled={disableBuy}
					onclick={isAnyModeActive ? handleDeactivate : openBuyBonus}
					aria-label={isAnyModeActive ? 'Deactivate' : i18nDerived.buyBonus()}
				>
					<!-- Label is the SHORT form; the aria-label keeps the full "buy bonus" wording so the
					     control still announces what it does. -->
					<span
						class="buy-btn__label"
						use:fitLabel={isAnyModeActive
							? i18nDerived.translate('DEACTIVATE')
							: i18nDerived.bonus()}
						>{isAnyModeActive ? i18nDerived.translate('DEACTIVATE') : i18nDerived.bonus()}</span
					>
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

			<div class="hud-divider" aria-hidden="true"></div>

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
						<img class="nav-icon" src={isMuted ? iconMenuSoundOff : iconSound} alt="sound" />
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
					class:spin-btn--holding={stateBet.isSpaceHold}
					type="button"
					onclick={onSpinClick}
					onpointerdown={onSpinPointerDown}
					aria-label="Spin"
					disabled={isBusy || (canInteract && !hasAuto && !canAffordBet)}
				>
					<img class="spin-btn__icon" src={iconSpin} alt="" />
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
					<!-- The design captions this one: glyph on top, AUTO beneath it, so it reads as
					     autoplay at a glance rather than by icon alone. -->
					<span class="auto-stack">
						<img
							class="nav-icon nav-icon--auto"
							src={disableAuto ? iconAutoDisabled : iconAuto}
							alt="auto"
						/>
						<span class="auto-word">{i18nDerived.autoShort()}</span>
					</span>
				</button>
			</div>
		</div>
	</div>

	{#if isPortrait}
		<!-- ── Portrait HUD: spin-centred control row + balance / bet / buy row ── -->
		<div class="pt-hud">
			<div class="pt-controls">
				<div class="pt-grp pt-grp--left">
					<button
						class="nav-btn nav-btn--framed"
						class:nav-btn--open={showMenuPopup}
						type="button"
						onclick={toggleMenuPopup}
						aria-label="Menu"
					>
						{#if showMenuPopup}
							<!-- Open state (design): the disc fills lilac and a bare white X sits in it. Drawn,
						     not the old menu_close.webp — that was the previous theme's navy disc with a
						     cyan ring, which read as a second, smaller button inside this one. -->
							<span class="nav-close-x" aria-hidden="true"></span>
						{:else}
							<img class="nav-icon" src={iconMenu} alt="menu" />
						{/if}
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
							<!-- Short label, as the design's pill has it and as the desktop bar already does;
							     the aria-label keeps the full wording so the control still announces itself. -->
							<span class="buy-btn__label" use:fitLabel={i18nDerived.bonus()}
								>{i18nDerived.bonus()}</span
							>
						</button>
					</div>
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
					<img class="spin-btn__icon" src={iconSpin} alt="" />
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
						onpointerdown={(event) =>
							startHoldRepeat(event, onDecrease, () => stepBet(-1, { playSound: false }))}
						onpointerup={clearHoldRepeat}
						onpointercancel={clearHoldRepeat}
						onpointerleave={clearHoldRepeat}
						onclick={(event) => maybeRunClickAction(event, onDecrease)}
						disabled={disableDecrease}
						aria-label={`Decrease ${i18nDerived.betLabel()}`}
					>
						<img
							class="nav-icon"
							src={disableDecrease ? iconMinusDisabled : iconMinus}
							alt="minus"
						/>
					</button>
					<!-- Display-only, like desktop: bet changes go through the − / + steppers. The tap-to-open
					     bet menu was removed here (user pass 2026-08-10). -->
					<div class="pt-bet-val">
						<span class="value" class:value--feature={isAnyModeActive}>{formattedBet}</span>
					</div>
					<button
						class="nav-btn nav-btn--framed pt-step"
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
						onpointerdown={(event) =>
							startHoldRepeat(event, onDecrease, () => stepBet(-1, { playSound: false }))}
						onpointerup={clearHoldRepeat}
						onpointercancel={clearHoldRepeat}
						onpointerleave={clearHoldRepeat}
						onclick={(event) => maybeRunClickAction(event, onDecrease)}
						disabled={disableDecrease}
						aria-label={`Decrease ${i18nDerived.betLabel()}`}
					>
						<img
							class="nav-icon"
							src={disableDecrease ? iconMinusDisabled : iconMinus}
							alt="minus"
						/>
					</button>
					<div
						class="ls-bet-val"
						role="button"
						tabindex="0"
						onkeydown={(e) =>
							e.key === 'Enter' && canInteract && (stateModal.modal = { name: 'betAmountMenu' })}
						onclick={() => canInteract && (stateModal.modal = { name: 'betAmountMenu' })}
					>
						<span class="value" class:value--feature={isAnyModeActive}>{formattedBet}</span>
					</div>
					<button
						class="nav-btn nav-btn--framed ls-step"
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
				<button
					class="nav-btn nav-btn--framed"
					class:nav-btn--open={showMenuPopup}
					type="button"
					onclick={toggleMenuPopup}
					aria-label="Menu"
				>
					{#if showMenuPopup}
						<!-- Open state (design): the disc fills lilac and a bare white X sits in it. Drawn,
						     not the old menu_close.webp — that was the previous theme's navy disc with a
						     cyan ring, which read as a second, smaller button inside this one. -->
						<span class="nav-close-x" aria-hidden="true"></span>
					{:else}
						<img class="nav-icon" src={iconMenu} alt="menu" />
					{/if}
				</button>
				{#if showMenuPopup}{@render menuPopup()}{/if}
				<!-- NOTE: the landscape nav carries exactly the design's five controls (menu, BONUS, spin,
				     turbo, AUTO). The standalone sound/mute disc that used to sit here is gone by
				     request (user, 2026-09-11) — a sixth button crowded the column and the design has
				     no slot for it. Master mute is still one tap away in the menu popover, which
				     carries SOUND / MUSIC / INFO. Portrait and desktop keep their own sound button. -->
				<!-- BONUS pill, in the nav column where the design puts it (4161:22199). It used to be a
				     round badge floating in the sky right of the board — the spot the capsule tube used
				     to occupy — which, once the board grew to the design's size, left it half on the
				     nav bar. -->
				<button
					class="buy-btn ls-nav-buy"
					type="button"
					disabled={disableBuy}
					onclick={openBuyBonus}
					aria-label={i18nDerived.buyBonus()}
				>
					<span class="buy-btn__label" use:fitLabel={i18nDerived.bonus()}
						>{i18nDerived.bonus()}</span
					>
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
					<img class="spin-btn__icon" src={iconSpin} alt="" />
					{#if hasAuto}
						<span class="spin-btn__count" style={`--spin-count-scale:${autoSpinsCountScale}`}
							>{autoSpinsRemainingText}</span
						>
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
					class="nav-btn nav-btn--framed ls-nav-auto"
					class:active={hasAuto}
					type="button"
					onclick={onAuto}
					disabled={disableAuto}
					aria-label={i18nDerived.autoplayLabel()}
				>
					<!-- Glyph AND the word, stacked — the design's AUTO disc carries both. -->
					<img class="nav-icon" src={disableAuto ? iconAutoDisabled : iconAuto} alt="auto" />
					<span class="ls-nav-auto__label">{i18nDerived.autoShort()}</span>
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
		/* MOTHERSHIP HUD palette (Figma 9032:23173), measured off the design's own bar render.
		   Declared once here so the desktop bar, the portrait/landscape bars and the menu popover
		   cannot drift apart — they were three separate sets of hard-coded blues before. */
		--hud-bar: #3a3981;
		--hud-bar-edge: #2d2c69;
		/* The near-black BALANCE / WIN bars of the mobile-landscape design (4161:22199). */
		--hud-bar-dark: #151139;
		--hud-accent: #a88eff;
		--hud-accent-rim: #47468a;
		--hud-control: #49489b;
		--hud-label: #a0a2ec;

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
	   also swallows the press that is meant to dismiss it.

	   Fully transparent, not merely dimmed. At 0.12 the bar's own WIN and BET readouts still showed
	   through the win pad underneath them, which looked like the PAD was translucent. Nothing else
	   here depends on the HUD staying faintly visible — the press it used to swallow is handled by
	   the pointer-events rule below, not by the opacity. */
	.hud-shell--celebrating {
		opacity: 0;
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
		/* A DEFINITE width, not fit-content. The readouts reserve width through a flex basis
		   (.value-pill--balance), and a basis is only honoured against a real container width: in
		   a content-hugging bar each group is sized from its text and the pill shrinks straight
		   back to it. The definite width is also what lets the pills give that reservation up when
		   the window is tighter than the content, instead of the groups overflowing the plate's
		   ends. (Used to hug content; the >=1200px rule below sets the wide bar.) */
		width: min(calc(100% - 16px), 1120px);
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

	/* MOTHERSHIP bottom bar (Figma 9032:23174): flat indigo plate, 4-unit darker edge, 10 radius. */
	.hud-bottom::before {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 0;
		background: var(--hud-bar);
		border: 4px solid var(--hud-bar-edge);
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
	/* Compact buy-bonus so the whole bar (now with the WIN pill) fits on narrow laptops. */
	.hud-buy .buy-btn {
		width: 126px;
		padding: 0 12px;
	}
	.hud-bottom .nav-btn {
		width: 42px;
		height: 42px;
	}

	/* Both groups may SHRINK: the bar hugs its content up to the screen, and when that is not
	   enough the readouts inside give up their reserved width (see .value-pill--balance) instead
	   of the groups overflowing the bar's ends — which is what put the menu and AUTO buttons half
	   off the plate on a 1000px laptop. */
	.hud-stats {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		flex: 0 1 auto;
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
		flex: 0 1 auto;
		min-width: 0;
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
		/* FIXED width, so WIN going "$0.00" -> "$25.00" as a round pays never re-lays the bar (it
		   used to push the bet stepper and the spin button sideways; a min-width reservation then
		   pushed the menu and AUTO buttons off a 1000px laptop's bar instead). The number fits the
		   pill, not the other way round: fitAmount steps the numerals down when an amount is too
		   long for it. The width itself yields to the window: 130px holds "$1,000.00" at the 24px
		   numerals, and the bar's other content measures 701px, so below that room the two pills
		   split what is left (10px guard). Wide bar (>=1200px): 160px, holds six figures. */
		flex: 0 0 auto;
		width: min(130px, calc((min(100vw - 16px, 1120px) - 711px) / 2));
		min-width: 0;
		box-sizing: border-box;
		border-left: none;
	}

	.value-pill--balance .label--balance {
		line-height: 1;
		justify-content: flex-start;
	}

	.value-pill--balance .value {
		line-height: 1;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
	@media (min-width: 1200px) {
		.hud-shell[data-layout='desktop'] .value-pill--balance {
			width: 160px;
		}
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
		background: rgba(255, 255, 255, 0.28);
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
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: 10px;
		font-weight: 700;
		line-height: 1.5;
		letter-spacing: 2px;
		text-transform: uppercase;
		color: var(--hud-label);
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
		/* Audiowide, the design's numeral face (Figma 9078:18352 balance, 9078:18354 win/bet).
		   Weight 400 is not a style choice: Audiowide ships Regular only, and asking for 700 makes
		   the browser synthesise a smeared bold. The label above each amount stays Chakra Petch. */
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-size: 24px;
		font-weight: 400;
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
		filter: brightness(1.12) drop-shadow(0 0 3px var(--hud-accent));
	}
	/* BUY BONUS hover (Figma): indigo glow around the pill */
	.buy-btn:not(:disabled):hover {
		filter: brightness(1.08) drop-shadow(0 0 6.5px var(--hud-accent));
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

	/* Utility buttons: flat CSS circle (control disc, accent ring) with a bare white glyph inside —
	   the old per-state baked-button PNGs are gone. */
	.nav-btn--framed {
		background: var(--hud-control);
		border: 1px solid var(--hud-accent);
		border-radius: 50%;
	}

	/* Captioned AUTO button (desktop only, Figma 9032:23188): the glyph shrinks to make room for
	   the word, overriding the shared .nav-btn--framed .nav-icon size below. */
	.auto-stack {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1px;
		line-height: 1;
		pointer-events: none;
	}

	.nav-btn--framed .nav-icon--auto {
		width: 17px;
		height: 17px;
	}

	.auto-word {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.06em;
		color: #ffffff;
	}

	.nav-btn--framed .nav-icon {
		width: 40%;
		height: 40%;
	}

	/* Menu button while its popover is open (design, sampled from the reference): the whole disc
	   fills lilac and the glyph is a bare white X — no ring, no inner disc. */
	.nav-btn--open,
	.nav-btn--open:not(:disabled):hover {
		background: #a08cf8;
		border-color: #a08cf8;
	}

	.nav-close-x {
		position: relative;
		display: block;
		width: 36%;
		height: 36%;
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
		background: #ffffff;
		transform: translate(-50%, -50%) rotate(45deg);
	}

	.nav-close-x::after {
		transform: translate(-50%, -50%) rotate(-45deg);
	}

	/* Figma glyph sizes vary per icon: the speaker is 22.5/48 ≈ 47% wide where the others sit
	   near 40% — at a uniform 40% it read undersized (user feedback). */
	.nav-btn--framed .nav-icon[alt='sound'] {
		width: 50%;
		height: 50%;
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
		filter: brightness(1.12) drop-shadow(0 0 3px var(--hud-accent));
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
		/* Clearance above the menu button. The button's frame art overhangs the bar's top edge, so
		   at 14px the panel read as sitting ON the bar rather than floating over it. */
		bottom: calc(100% + 24px);
		width: 200px;
		height: 200px;
		box-sizing: border-box;
		padding: 18px 20px;
		/* Flat panel in the same language as the bottom bar. */
		background: var(--hud-bar);
		border: 4px solid var(--hud-bar-edge);
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
		/* Matches the bottom bar's framed circle buttons. */
		border: 1px solid var(--hud-accent);
		background: var(--hud-control);
		display: grid;
		place-items: center;
		transition:
			opacity 0.12s ease,
			filter 0.12s ease;
	}
	.menu-row__glyph {
		width: 20px;
		height: 20px;
		background: #ffffff;
		mask: var(--icon) center / contain no-repeat;
		-webkit-mask: var(--icon) center / contain no-repeat;
		transition: background 0.12s ease;
	}
	/* menu_music_off.webp is a Figma export with no internal padding, so at `contain` it fills the
	   glyph box where the padded .svg on-state only reaches ~80% of its own. Scale is set against
	   the NOTE, not the bounding box: the off art's box is squared off by the diagonal slash, which
	   reaches well past the note it crosses, so equalising boxes (0.78-0.80) shrank the note itself
	   to 87% of the on-state's. Measured off a 400px render of both masks — note-head diameter
	   128px on / 143px off — so 128/143 lands the two notes the same size and lets the slash
	   overhang, which is what the design does.
	   menu_sound_off.webp needs no such correction: it is DRAWN square around the on-state's own
	   aspect (build-sound-off-icon.py), so both speakers land at the same size on their own. */
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
		background: var(--hud-accent);
	}
	.menu-row:hover .menu-row__label {
		color: var(--hud-accent);
	}
	.menu-row:hover .menu-row__icon {
		box-shadow: 0 0 6px 1px rgba(168, 142, 255, 0.9);
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

	/* The design draws the spin as a plain violet disc with a darker rim (Figma 9032:23199) — no
	   ring artwork at all, so spin_ring.webp is gone. `inset` keeps the disc at the design's
	   112/128 of the button box, leaving the arrow glyph its overhang.
	   The hover/hold flourish moved to the ARROW: a featureless disc rotating is invisible. */
	.spin-btn::before {
		content: '';
		position: absolute;
		inset: 8px;
		border-radius: 50%;
		background: var(--hud-accent);
		box-shadow: inset 0 0 0 3px var(--hud-accent-rim);
	}

	.spin-btn__icon {
		transition: transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
		will-change: transform;
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
		filter: brightness(1.08) drop-shadow(0 0 5px var(--hud-accent));
	}

	/* Hover flourish: the metal ring cranks a few degrees with a springy overshoot (pointer
	   devices only — on touch, :hover sticks after tap and the ring would stay cocked). */
	@media (hover: hover) {
		.spin-btn:not(:disabled):hover .spin-btn__icon {
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

	/* While a spin is running the count / stop overlay carries the message, so the disc simply
	   recedes — there is no separate stop-state artwork to swap to any more. */
	.spin-btn.spin-btn--busy::before {
		background: var(--hud-accent-rim);
	}

	.spin-btn.spin-btn--busy:disabled {
		opacity: 1;
	}

	/* Held for continuous spins: the ring spins for as long as the button is down, so the player can
	   see the hold registered — the button itself never changes state while chaining. */
	.spin-btn--holding .spin-btn__icon {
		animation: spin-hold-turn 900ms linear infinite;
	}
	.spin-btn--holding .spin-btn__icon {
		filter: drop-shadow(0 0 6px var(--hud-accent));
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

	/* BONUS pill (Figma 9032:23176): a flat violet capsule with a darker rim — the blue capsule
	   texture it replaced is gone. 143x47 in the design; the width is overridden per layout below,
	   so only the height and the fully-round radius are pinned here. */
	.buy-btn {
		width: 143px;
		height: 47px;
		border: 2px solid var(--hud-accent-rim);
		border-radius: 999px;
		background: var(--hud-accent);
		box-sizing: border-box;
		padding: 0 18px;
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

	/* Audiowide, matching the design's BONUS pill (Figma 9076:29225) — the same face the HUD's
	   numerals wear. Audiowide ships Regular only, so 700 here would be a synthesised smear; the
	   pill's weight comes from the face itself. */
	.buy-btn__label {
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-size: 12px;
		font-weight: 400;
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
	/* Control row sits on the mobile nav bar (the bg-border). The design (4336:15793) runs it
	   326 of its 360 wide and 62.5 tall — 90.6% and 17.4vw. */
	.pt-controls {
		position: relative;
		width: min(90.6%, 372px);
		height: clamp(54px, 17.4vw, 72px);
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 clamp(12px, 4.5vw, 22px);
	}
	.pt-controls::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--hud-bar);
		/* The design's own plate: #3A3981 under a 4px #2D2C69 inside edge, radius 10. */
		border: 4px solid var(--hud-bar-edge);
		border-radius: 10px;
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

	/* Balance and WIN. The design (4336:15793, Group 60 / 61) does NOT give these the violet bar
	   plate the rest of the HUD wears — they are 90x44 panes of #000616 at 78% behind a 1px white
	   hairline at 9%, radius 8, which is what separates the two readouts from the bet plate sitting
	   between them (that one IS the violet plate). Left-aligned white label + value, sized to fit. */
	.pt-balance {
		flex: 0 0 auto;
		background: rgba(0, 6, 22, 0.78);
		border: 1px solid rgba(255, 255, 255, 0.09);
		border-radius: 8px;
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
		/* The design's bet plate is the SAME card as the control bar above it — #3A3981 under a 4px
		   #2D2C69 edge, radius 10 — which is what makes the two dark readouts either side read as
		   set into it rather than as three of a kind. */
		background: var(--hud-bar);
		border: 4px solid var(--hud-bar-edge);
		border-radius: 10px;
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
	.pt-buy {
		flex: 0 0 auto;
	}

	/* Buy-bonus in the nav bar (left group). The design draws the SAME violet capsule the desktop
	   bar wears — 61 x 33 of its 360-wide screen, radius fully round — not the circular badge this
	   used to be; a disc reading "BUY BONUS" over two lines was the one control on the bar that did
	   not match the rest of the UI's language. Sizes are the design's fractions. */
	.pt-buy--nav {
		flex: 0 0 auto;
	}
	.pt-buy--nav .buy-btn {
		width: clamp(52px, 16.9vw, 72px);
		height: clamp(28px, 9.2vw, 39px);
		padding: 0 clamp(4px, 1.6vw, 8px);
	}
	.pt-buy--nav .buy-btn__label {
		font-size: clamp(0.44rem, 2.8vw, 0.63rem);
		letter-spacing: 0.12em;
		max-width: 100%;
	}
	/* WIN takes the buy-bonus slot in the stats row. The design stacks its label over its value on
	   the same left margin the balance uses (both boxes are the same 90x44 pane, inset 11.7), so it
	   is NOT mirrored — right-aligning it made the two readouts read as a pair pointing outward. */
	.pt-win {
		align-items: flex-start;
		text-align: left;
	}
	.pt-win .label--balance {
		justify-content: flex-start;
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
		/* Straight off the design (4161:22199, an 800x360 frame): the bar is x 718.7..781.3, y 39.3..315
		   — 7.83% of the width, 19px clear of the right edge, 76.7% of the height, centred at 49.2%.
		   It used to be sized by min(4.8vw, 8.4vh), which rendered it ~30px on that frame: half the
		   design's width, so the whole control column read as a thin sliver. */
		right: 2.34vw;
		top: 49.2%;
		transform: translateY(-50%);
		/* The big spin disc deliberately overflows the bar's sides as the focal control (mirrors the
		   desktop spin button, which protrudes past the bar via negative margins). */
		width: 7.83vw;
		height: 76.7vh;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		gap: 0;
		padding: clamp(5px, 2.8vh, 20px) 0;
		background: var(--hud-bar);
		/* 4px -> 2px: the design's bar carries only a hairline edge, and a thick one inset every
		   button in the column by its own width, which is what made the BONUS pill and the discs read
		   as too small for the bar. */
		border: 2px solid var(--hud-bar-edge);
		border-radius: 12px;
		box-sizing: border-box;
		overflow: visible;
	}
	.ls-nav .nav-btn {
		/* The design's discs are ~30px on its 800x360 frame — 8.3vh, capped by 5.4vw so a tall, narrow
		   popout cannot grow them past the bar. */
		width: clamp(14px, min(8.3vh, 5.4vw), 46px);
		height: clamp(14px, min(8.3vh, 5.4vw), 46px);
	}
	/* AUTO carries the word under its glyph (design 4161:22199), so it stacks rather than centring a
	   single icon. The glyph gives up the room the label needs; the disc itself stays the same size as
	   the others in the column. */
	.ls-nav .ls-nav-auto {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0;
	}
	.ls-nav .ls-nav-auto .nav-icon {
		width: 42%;
		height: 42%;
	}
	.ls-nav .ls-nav-auto__label {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(4px, 1.85vh, 11px);
		line-height: 1.1;
		letter-spacing: 0.02em;
		color: #fff;
	}
	/* Focal spin — big disc that overflows the slim nav panel on both sides (negative side margins so
	   it protrudes past the panel edges without widening the flex column), centred. */
	.ls-nav .ls-spin {
		/* Sized against BOTH axes: vh alone let a tall-but-narrow popout grow the disc past the
		   right screen edge (user report, twice) — the vw term caps it on narrow windows.
		   23.6vh / 10.6vw puts the DISC at the design's 85px on its 800x360 frame (79px of lilac
		   inside a 3px rim). */
		width: clamp(40px, min(23.6vh, 10.6vw), 112px);
		height: clamp(40px, min(23.6vh, 10.6vw), 112px);
		margin: clamp(1px, 0.4vh, 4px) calc(-1 * clamp(6px, 3.6vh, 22px));
		flex: 0 0 auto;
	}
	/* .spin-btn::before insets the disc by a FLAT 8px, a figure tuned for the 128px desktop button
	   — 6% there, but 20% of this one, which drew the landscape disc a fifth smaller than its own
	   button box and is why it read as undersized against the design. */
	.ls-nav .ls-spin::before {
		inset: 0;
	}
	.ls-nav .ls-spin .spin-btn__count {
		font-size: calc(0.8rem * var(--spin-count-scale, 1));
	}
	/* Balance + bet, bottom-left. */
	.ls-stats {
		position: absolute;
		/* Centred on the left rail's own column — the same one the logo and the FREE SPINS / TOTAL WIN
		   / RESPIN boxes sit on — rather than flush-left at a fixed inset (user, 2026-09-11). The
		   column comes from stateGameDerived.landscapeRail() via --ls-rail-cx. */
		left: var(--ls-rail-cx, 10.65%);
		transform: translateX(-50%);
		bottom: clamp(6px, 2.2vh, 20px);
		display: flex;
		/* The design puts the BET stepper ABOVE the balance box; the DOM order is balance-first so the
		   balance stays the first thing a screen reader hits. */
		flex-direction: column-reverse;
		align-items: center;
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
		background: var(--hud-bar-dark);
		border: none;
		border-radius: clamp(5px, 1.25vw, 12px);
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
		font-size: clamp(0.17rem, 1.45vh, 0.38rem);
		letter-spacing: 0.04em;
		/* Near-white in the design, not the lilac the rest of the HUD's labels use — sampled off the
		   frame's own BALANCE chip. */
		color: #dcdbe8;
	}
	/* Bet: the bet-box art with round − / + steppers inside. */
	.ls-bet {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: clamp(1px, 0.4vw, 4px);
		/* The design's bet box is the lighter control blue, a shade up from the bar. */
		background: var(--hud-control);
		border: 2px solid var(--hud-bar-edge);
		border-radius: 8px;
		padding: clamp(2px, 1.4vh, 9px) clamp(3px, 1.6vw, 18px);
	}
	.ls-bet .ls-step {
		/* The design's steppers are 30px on its 800x360 frame (8.3vh); the vw term keeps them in
		   proportion on a squarer popout. They used to be 4.4vh — half the design's size. */
		width: clamp(12px, min(8.3vh, 4vw), 34px);
		height: clamp(12px, min(8.3vh, 4vw), 34px);
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
	/* BONUS pill inside the nav column. The design's is a full-width lilac rounded rect the same
	   height as the icon buttons either side of it (62 x 26 of the 800x360 frame). */
	.ls-nav .ls-nav-buy {
		/* Spans the bar's OUTER width, as in the design: measured on the frame, the pill's lilac is
		   60px against a 60px bar. Inside the bar's own border it came out 54, which is what made it
		   read as a small chip floating in the column. The dark 2px rim went with it — the design's
		   pill is flat --hud-accent, edge to edge. */
		width: calc(100% + 4px);
		margin: 0 -2px;
		box-sizing: border-box;
		height: clamp(14px, min(8.3vh, 5.4vw), 46px);
		flex: 0 0 auto;
		background: var(--hud-accent);
		border: none;
		border-radius: 999px;
		padding: 0;
	}
	.ls-nav .ls-nav-buy .buy-btn__label {
		white-space: nowrap;
		line-height: 1;
		text-align: center;
		/* Measured, not guessed, twice: the design's BONUS ink is 45x6 px on its 800x360 frame. 3.9vh
		   overshot it (58x9) because the ink is not just bigger there — it is TRACKED wider. The ratio
		   45/6 = 7.5 against this face's own 6.4 is the whole difference, so the size comes down to
		   match the height and the tracking opens up to match the width. */
		font-size: clamp(0.2rem, 2.42vh, 0.62rem);
		letter-spacing: 0.28em;
		max-width: 92%;
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
	   ancestor) sits ~16px inside hud-bottom's left frame edge, so pull the popup left by that much.

	   The rows are then inset LESS than the 20px the panel uses on its right, so the icon circles sit
	   on the menu button's own centre line rather than 7.5px right of it. The panel is pulled 16px
	   left of hud-system and has a 4px border, and the icon is 39px wide inside a 1px border
	   (content-box — there is no global border-box reset), so its centre lands at
	   -16 + 4 + padding + 20.5. The button is 42px wide starting at hud-system's left edge, so that
	   has to come to 21: padding = 12.5. Keeping the panel where it is and moving the padding is what
	   holds the outer edge on the bar's frame line while the column lines up. */
	.hud-shell[data-layout='desktop'] .menu-popup {
		left: -16px;
		padding-left: 12.5px;
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
		background: var(--hud-accent);
		border: 2px solid var(--hud-accent-rim);
		border-radius: 50%;
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
		/* Design: a 133x26 bar at x 643..776 of 800, 8px clear of the bottom. Anchored by its RIGHT
		   edge with a min width rather than pinned on both sides, so a long win amount grows the bar
		   leftward instead of spilling out of it. (It used to be pinned to the buy badge's centre,
		   which moved into the nav column.) */
		right: 3vw;
		left: auto;
		bottom: clamp(6px, 2.2vh, 20px);
		/* 16.6% is the design's own bar width; 12% is narrower on purpose, to hand the width back to
		   the board (user, 2026-09-11). stateGame's LS_WIN_LEFT mirrors 1 - right - this. A long win
		   amount still grows the bar leftward up to max-width. */
		min-width: 12%;
		max-width: 46%;
		display: flex;
		justify-content: flex-end;
	}
	/* Scoped under the layout attribute so it outranks the generic `[data-layout='landscape']
	   .value-pill` rule — which is more specific than a bare `.ls-win .ls-win-pill` and was winning,
	   collapsing this into a 98x12 sliver instead of the design's 184x26 bar. */
	.hud-shell[data-layout='landscape'] .ls-win .ls-win-pill {
		width: 100%;
		box-sizing: border-box;
		flex-direction: row;
		align-items: center;
		/* Design: the label sits against the left edge and the amount against the right, not the two
		   centred as a pair. */
		justify-content: space-between;
		gap: clamp(6px, 1.6vw, 16px);
		background: var(--hud-bar-dark);
		border: none;
		/* The design's chip is a ROUNDED bar (~10px on its 800x360 frame); this rule used to end in a
		   second `border-radius: 0` that squared it off. */
		border-radius: clamp(5px, 1.25vw, 12px);
		box-shadow: none;
		backdrop-filter: none;
		min-width: 0;
		padding: clamp(4px, 2vh, 10px) clamp(8px, 2vw, 18px);
	}
	/* The three bottom-row chips (BET, BALANCE, WIN) are set in POPPINS in the design, not in the
	   Audiowide the rest of the HUD uses for numerals — measured, not guessed: the design's
	   "$1,50.00" has an ink aspect of 4.385, against Poppins 700's 4.52 and Audiowide's 5.98 (whose
	   slashed zero is the giveaway). Scoped to landscape; portrait and desktop keep Audiowide. */
	.hud-shell[data-layout='landscape'] .ls-win .ls-win-pill .value,
	.hud-shell[data-layout='landscape'] .ls-balance .value,
	.hud-shell[data-layout='landscape'] .ls-bet-val .value {
		font-family: 'Poppins', 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		letter-spacing: 0;
	}
	.hud-shell[data-layout='landscape'] .ls-win .label-text,
	.hud-shell[data-layout='landscape'] .ls-balance .label-text {
		font-family: 'Poppins', 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		letter-spacing: 0.03em;
	}
	.ls-win .label--balance {
		justify-content: center;
		width: auto;
	}
	.ls-win .label--balance {
		justify-content: center;
	}
	.ls-win .ls-win-pill .value {
		font-size: clamp(0.42rem, 3.9vh, 1rem);
		white-space: nowrap;
		color: #fff;
	}
	.ls-win .ls-win-pill .label-text {
		font-size: clamp(0.3rem, 1.75vh, 0.54rem);
		color: #fff;
	}

	/* NOTE: the BONUS pill's label used to be stepped down again here (max-height 400 and 300). Both
	   overrides were left over from the round badge this replaced, and they OUTRANKED the rule above
	   — which is why raising it to the design's ~14px silently kept rendering at 6.3px. The base is
	   quoted in vh, so it already scales with the screen; it does not need a second opinion. */

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
		/* WIN, bottom right: shrink so it clears the board's right edge. */
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
