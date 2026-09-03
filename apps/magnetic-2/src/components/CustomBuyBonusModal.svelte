<script lang="ts" module>
	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;
	// Version2 panels (Figma 4040-4075): steel chamfered card frame + compact bet plate, keyed off
	// the export's white backdrop with the shared saturation flood fill (scratchpad/key_panel.py).
	const cardPanel      = ap('/assets/components/ui/bb_card_panel_v2.webp?v=20260810');
	const betPanel       = ap('/assets/components/ui/bb_bet_panel_v2.webp?v=20260810');
	const coinIcon       = ap('/assets/components/ui/bb_coin.svg?v=20260708c');

	// Card icons — the Version2 design pictures the REEL SYMBOL art on every card: the green chip
	// for Extra Chance, the compass for Feature Spins, and the scatter capsule (with the 3x/4x
	// badge) for both bought bonuses. This replaced the old bespoke icon set AND the earlier
	// wild-symbol substitution on FEATURE — the design's own choice wins now.
	const iconChance  = ap('/assets/components/symbols/magnetic/low/energy_screw_full.webp?v=20260902');
	// Both point at the FLATTENED composites from scripts/build-paytable-symbols.py, not at the
	// board's own textures: the compass and the scatter are assembled from loose parts now, so their
	// base files alone are a bezel with no needle and a capsule with no alien.
	const iconFeature = ap('/assets/components/symbols/magnetic/premium/compass_full.webp?v=20260902');
	const iconBrief   = ap('/assets/components/symbols/magnetic/special/scatter_full.webp?v=20260902');

	// For LoadingController's HTML-image pass — built from the consts above so path/?v= edits stay in sync.
	export const BUY_BONUS_MODAL_IMAGES = [
		cardPanel,
		betPanel,
		coinIcon,
		iconChance,
		iconFeature,
		iconBrief,
	];
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { stateBet, stateBetDerived, stateConfig } from 'state-shared';
	import { getContext } from '../game/context';
	import { magneticStakeDerived } from '../state/magneticStake.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitTextScale } from '../utils/fitText';
	import {
		CONFIRM_TITLE_FONT_F,
		CONFIRM_TEXT_FONT_F,
		CONFIRM_TITLE_FIT_W,
		CONFIRM_TEXT_FIT_W,
		CONFIRM_TITLE_FAMILY,
		CONFIRM_TEXT_FAMILY,
		CONFIRM_TEXT_WEIGHT,
	} from './confirmDialog';

	const t = (k: string) => i18nDerived.translate(k);
	const tv = (k: string, vars: Record<string, string | number>) => i18nDerived.translateVars(k, vars);

	type Props = {
		onclose: () => void;
		isChanceActive: boolean;
		isFeatureActive: boolean;
		onToggleChance: () => void;
		onToggleFeature: () => void;
	};

	const props: Props = $props();
	const context = getContext();

	// Portrait (mobile) uses a single vertical scrollable column of cards (Figma 4137-16084);
	// landscape/desktop keeps the 4-in-a-row layout.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	// Landscape/desktop card sizing. The modal is rendered inside the (often CSS-scaled) game
	// container, NOT the browser window — so vw/vh don't map to the real box and cards ended up
	// clipped/oversized. Instead we MEASURE the panel and size each card as the largest square
	// that fits both the row width and the leftover height, then feed everything to CSS as px vars.
	const clampNum = (min: number, val: number, max: number) => Math.max(min, Math.min(val, max));
	let panelEl = $state<HTMLDivElement>();
	let landscapeVars = $state('');
	$effect(() => {
		if (isPortrait || !panelEl) return;
		const el = panelEl;
		const measure = () => {
			const w = el.clientWidth;
			const h = el.clientHeight;
			if (!w || !h) return;
			// Chrome (title / close button) scales down on small containers so it doesn't dominate.
			const uiScale = clampNum(0.6, Math.min(w, h) / 520, 1);
			const closePx = 48 * uiScale;
			const titlePx = 18 * uiScale;
			const gap = clampNum(8, w * 0.011, 22);
			const padX = clampNum(8, w * 0.008, 32);
			const padTop = clampNum(46, closePx * 1.4, 132);
			const padBot = clampNum(10, h * 0.04, 40);
			const vGap = clampNum(8, h * 0.024, 28);
			// Bet bar shrinks with the container; its − / + and text derive from its width.
			const betW = clampNum(120, w * 0.24, 380);
			const betH = (betW * 107) / 298;
			const betStep = clampNum(24, betW * 0.17, 52);
			const widthBudget = (Math.min(w, 1860) - 2 * padX - 3 * gap) / 4;
			const heightBudget = h - padTop - padBot - vGap - betH;
			// Version2 plate is a near-square (556x551 art) — height follows the art's own aspect.
			const cardHRatio = 551 / 556;
			const card = Math.min(widthBudget, Math.max(56, heightBudget) / cardHRatio, 420);
			const cardH = card * cardHRatio;
			landscapeVars =
				`--bb-card:${card}px;--bb-card-h:${cardH}px;--bb-gap:${gap}px;--bb-pad-x:${padX}px;` +
				`--bb-pad-top:${padTop}px;--bb-pad-bot:${padBot}px;--bb-vgap:${vGap}px;` +
				`--bb-bet-w:${betW}px;--bb-bet-step:${betStep}px;--bb-close:${closePx}px;--bb-title:${titlePx}px`;
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	});

	const betAmount   = $derived(stateBet.betAmount);
	const chanceCost  = $derived(magneticStakeDerived.formatCurrencyAmount(betAmount * 2));
	const bonusCost   = $derived(magneticStakeDerived.formatCurrencyAmount(betAmount * 100));
	const superCost   = $derived(magneticStakeDerived.formatCurrencyAmount(betAmount * 500));
	const featureCost = $derived(magneticStakeDerived.formatCurrencyAmount(betAmount * 50));
	const betDisplay  = $derived(magneticStakeDerived.formatCurrencyAmount(betAmount));
	const canBuy      = $derived(stateBetDerived.isBetCostAvailable());

	// Bet selector (mirrors the HUD bet stepper).
	const betOptions      = $derived(stateConfig.betAmountOptions);
	const currentBetIndex = $derived(Math.max(0, betOptions.indexOf(betAmount)));
	const disableDec      = $derived(currentBetIndex <= 0);
	const disableInc      = $derived(currentBetIndex >= betOptions.length - 1);
	const stepBet = (dir: -1 | 1) => {
		const i = Math.min(betOptions.length - 1, Math.max(0, currentBetIndex + dir));
		const next = betOptions[i];
		if (typeof next === 'number' && next !== betAmount) stateBetDerived.setBetAmount(next);
	};

	// FEATURE is here because Stake's checklist requires a confirmation step for any mode costing
	// more than 2x a normal round, and Feature Spin costs 50x PER ROUND — it was previously a
	// one-click toggle. Chance Spin is exactly 2x, which the rule does not cover, so it stays
	// one-click. Deactivating never costs anything and never asks.
	let confirmMode = $state<null | 'BONUS' | 'SUPER' | 'FEATURE'>(null);

	const buyMode      = (mode: 'BONUS' | 'SUPER') => {
		// If the machine isn't idle the 'bet' event would be dropped but the mode
		// assignment would stick — every later (auto-)spin would then bet at buy cost.
		if (!context.stateXstateDerived.isIdle()) { props.onclose(); return; }
		stateBet.activeBetModeKey = mode; props.onclose(); context.eventEmitter.broadcast({ type: 'bet' });
	};
	const openConfirm  = (mode: 'BONUS' | 'SUPER' | 'FEATURE') => { confirmMode = mode; };
	const closeConfirm = () => { confirmMode = null; };
	const toggleActivateMode = (toggle: () => void) => { toggle(); props.onclose(); };

	const confirmLabel = $derived(
		confirmMode === 'SUPER' ? 'MAGNETIC MEGA CHAIN'
		: confirmMode === 'FEATURE' ? t('BUY FEATURE SPINS TITLE')
		: 'DROP-O-MAGNET',
	);
	const confirmCost = $derived(
		confirmMode === 'SUPER' ? superCost : confirmMode === 'FEATURE' ? featureCost : bonusCost,
	);
	// The design's title/body are ONE nowrap line each ("CONFIRM ALL IN" / "BUY ALL IN FOR 400.00?").
	// Our mode names and localized strings run longer, so each line shrinks to fit the plate instead
	// of spilling past it — measured for real (see fitText), since uppercase "MAGNETIC MEGA CHAIN"
	// is far wider per character than the design's placeholder copy.
	const confirmTitleText = $derived(tv('CONFIRM TITLE', { name: confirmLabel }));
	const confirmBodyText = $derived(tv('BUY CONFIRM', { name: confirmLabel, cost: confirmCost }));
	let confirmEl = $state<HTMLDivElement>();
	let confirmW = $state(0);
	$effect(() => {
		const el = confirmEl;
		if (!el) return;
		const measure = () => (confirmW = el.clientWidth);
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	});
	const confirmVars = $derived(
		`--confirm-title-fit:${fitTextScale(confirmTitleText, {
			fontSizePx: confirmW * CONFIRM_TITLE_FONT_F,
			availablePx: confirmW * CONFIRM_TITLE_FIT_W,
			fontFamily: CONFIRM_TITLE_FAMILY,
			letterSpacingEm: 0.03,
		})};` +
			`--confirm-text-fit:${fitTextScale(confirmBodyText, {
				fontSizePx: confirmW * CONFIRM_TEXT_FONT_F,
				availablePx: confirmW * CONFIRM_TEXT_FIT_W,
				fontWeight: CONFIRM_TEXT_WEIGHT,
				fontFamily: CONFIRM_TEXT_FAMILY,
				letterSpacingEm: 0.03,
			})}`,
	);
	// FEATURE is an activation toggle, not a one-shot purchase, so its confirm runs the toggle.
	const acceptConfirm = () => {
		if (confirmMode === 'FEATURE') { closeConfirm(); toggleActivateMode(props.onToggleFeature); return; }
		buyMode(confirmMode as 'BONUS' | 'SUPER');
	};

	onMount(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			if (confirmMode) closeConfirm(); else props.onclose();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});
</script>

<!-- Backdrop -->
<button class="backdrop" type="button" aria-label="Close" tabindex="-1" onclick={props.onclose}></button>

<!-- Panel -->
<div class="panel" class:portrait={isPortrait} bind:this={panelEl} style={isPortrait ? '' : landscapeVars} role="dialog" aria-modal="true">
	<h2 class="title">{t('BUY BONUS')}</h2>
	<button class="close-btn" type="button" onclick={props.onclose} aria-label="Close"><span class="glyph glyph--close"></span></button>

	<div class="grid">
		<!-- Extra Chance -->
		<div class="card" style={`background-image:url('${cardPanel}')`}>
			<span class="card-title">{t('BUY EXTRA CHANCE TITLE')}</span>
			<span class="card-desc">{t('BUY EXTRA CHANCE DESC')}</span>
			<div class="card-icon-slot">
				<img class="card-icon" src={iconChance} alt="" />
			</div>
			<span class="card-price">{chanceCost} {t('PER SPIN')}</span>
			<button
				class="card-btn card-btn--activate"
				class:card-btn--active={props.isChanceActive}
				type="button"
				onclick={() => toggleActivateMode(props.onToggleChance)}
			>{props.isChanceActive ? t('DEACTIVATE') : t('ACTIVATE')}</button>
		</div>

		<!-- Feature Spins -->
		<div class="card" style={`background-image:url('${cardPanel}')`}>
			<span class="card-title">{t('BUY FEATURE SPINS TITLE')}</span>
			<span class="card-desc">{t('BUY FEATURE SPINS DESC')}</span>
			<div class="card-icon-slot">
				<img class="card-icon" src={iconFeature} alt="" />
			</div>
			<span class="card-price">{featureCost} {t('PER SPIN')}</span>
			<button
				class="card-btn card-btn--activate"
				class:card-btn--active={props.isFeatureActive}
				type="button"
				onclick={() => (props.isFeatureActive ? toggleActivateMode(props.onToggleFeature) : openConfirm('FEATURE'))}
			>{props.isFeatureActive ? t('DEACTIVATE') : t('ACTIVATE')}</button>
		</div>

		<!-- DROP-O-MAGNET (freegame / BONUS mode) -->
		<div class="card" style={`background-image:url('${cardPanel}')`}>
			<span class="card-title">{t('BUY DROP TITLE')}</span>
			<span class="card-desc">{t('BUY DROP DESC')}</span>
			<div class="card-icon-slot">
				<span class="card-mult">3x</span>
				<img class="card-icon card-icon--brief" src={iconBrief} alt="" />
			</div>
			<span class="card-price">{bonusCost}</span>
			<button class="card-btn card-btn--buy" type="button" disabled={!canBuy} onclick={() => openConfirm('BONUS')}>{t('BUY')}</button>
		</div>

		<!-- MAGNETIC MEGA CHAIN (superspin / SUPER mode) -->
		<div class="card" style={`background-image:url('${cardPanel}')`}>
			<span class="card-title">{t('BUY MEGA TITLE')}</span>
			<span class="card-desc">{t('BUY MEGA DESC')}</span>
			<div class="card-icon-slot">
				<span class="card-mult">4x</span>
				<img class="card-icon card-icon--brief" src={iconBrief} alt="" />
			</div>
			<span class="card-price">{superCost}</span>
			<button class="card-btn card-btn--buy" type="button" disabled={!canBuy} onclick={() => openConfirm('SUPER')}>{t('BUY')}</button>
		</div>
	</div>

	<!-- Bet selector -->
	<div class="bet" style={`background-image:url('${betPanel}')`}>
		<button class="bet-step" type="button" disabled={disableDec} onclick={() => stepBet(-1)} aria-label={`Decrease ${i18nDerived.betLabel()}`}><span class="glyph"></span></button>
		<div class="bet-center">
			<img class="bet-coin" src={coinIcon} alt="" />
			<div class="bet-value">
				<span class="bet-label">{t('BET')}</span>
				<span class="bet-amount">{betDisplay}</span>
			</div>
		</div>
		<button class="bet-step" type="button" disabled={disableInc} onclick={() => stepBet(1)} aria-label={`Increase ${i18nDerived.betLabel()}`}><span class="glyph glyph--plus"></span></button>
	</div>
</div>

<!-- Confirm -->
{#if confirmMode}
	<button class="backdrop backdrop--z2" type="button" aria-label="Close" tabindex="-1" onclick={closeConfirm}></button>
	<button class="confirm-close" type="button" onclick={closeConfirm} aria-label="Close">
		<span class="confirm-close__glyph"></span>
	</button>
	<div class="confirm" role="dialog" aria-modal="true" bind:this={confirmEl} style={confirmVars}>
		<div class="confirm-panel">
			<div class="confirm-title">{confirmTitleText}</div>
			<div class="confirm-text">{confirmBodyText}</div>
			<div class="confirm-row">
				<button class="confirm-btn confirm-btn--cancel" type="button" onclick={closeConfirm}>{t('CANCEL')}</button>
				<button class="confirm-btn confirm-btn--ok" type="button" onclick={acceptConfirm}>{t('CONFIRM')}</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Backdrops */
	.backdrop {
		position: fixed; inset: 0; z-index: 60;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(5px);
		border: 0; padding: 0; cursor: pointer;
	}
	.backdrop--z2 { z-index: 70; }

	/* Full-screen panel container */
	.panel {
		position: fixed; inset: 0;
		z-index: 61;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 3vh;
		/* top-heavy padding nudges the centred cards + bet selector down from the title */
		padding: 12vh 1vw 4vh;
		box-sizing: border-box;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		pointer-events: none;
	}
	.panel > * { pointer-events: auto; }

	/* Figma: IBM Plex Sans Condensed Bold, #FFF, 18px / 0.54px, centered on the close-button's
	   vertical centre (close-btn = top:22px, 48px tall → centre at 46px). */
	.title {
		position: absolute;
		top: 46px;
		left: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		font-size: 18px;
		line-height: normal;
		letter-spacing: 0.54px;
		text-align: center;
		text-transform: uppercase;
		color: #ffffff;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
	}

	/* Version2 icon button (Figma "Icon buttons"): #22365B circle, 1px #2391C1, white glyph. */
	.close-btn {
		position: fixed; top: 22px; right: 22px; z-index: 63;
		width: 48px; height: 48px; border-radius: 50%;
		border: 1px solid #2391c1;
		background: #22365b;
		font-size: 16px;
		padding: 0;
		cursor: pointer; display: grid; place-items: center;
		transition: filter 0.12s ease;
	}
	.close-btn:hover { filter: brightness(1.35); }

	/* Glyphs are drawn, not imported — the design's are plain 2.13px white strokes (same pattern
	   as CustomAutoSpinModal). Sized in em off the button's font-size. */
	.glyph {
		position: relative;
		display: block;
		width: 0.866em;
		height: 0.133em;
		border-radius: 0.133em;
		background: #fff;
	}
	.glyph--plus::after,
	.glyph--close::before,
	.glyph--close::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: #fff;
	}
	.glyph--plus::after { transform: rotate(90deg); }
	.glyph--close { width: 1.155em; background: none; }
	.glyph--close::before { transform: rotate(45deg); }
	.glyph--close::after { transform: rotate(-45deg); }

	/* Four cards in a row — square, kept compact so they don't dominate the screen. */
	.grid {
		display: flex;
		gap: clamp(10px, 1.2vw, 24px);
		justify-content: center;
		align-items: center;
		width: 100%;
		max-width: 1860px;
	}

	/* Card = the Version2 steel chamfered panel (556x551 keyed art), near-square.
	   Sized with clamp()/vw (reliable in the scaled game env, unlike cqw). Big Figma-scale fonts +
	   compact gaps keep the content filling the square without overflowing it. */
	.card {
		flex: 1 1 0;
		min-width: 0;
		max-width: 400px;
		aspect-ratio: 556 / 551;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(2px, 0.35vh, 6px);
		text-align: center;
		padding: 2% 3% 2%;
		box-sizing: border-box;
	}

	/* Children never shrink (keeps the icon full-size); the desc reserves a fixed height so the
	   icon / price / button line up across all four cards regardless of description length. */
	/* Figma 4040:4138 — IBM Plex Sans Condensed Bold 18px, FLAT #2391C1, 0.54px tracking. */
	.card-title {
		flex-shrink: 0;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(14px, 1.32vw, 23px);
		letter-spacing: 0.03em;
		white-space: nowrap;
		color: #2391c1;
	}

	/* Figma: Inter Regular, #d7d7d7 — big & readable. `width: 100%` is essential: without it the span
	   shrink-to-fits under `align-items: center` and wraps into a narrow column (tall cards). Full width
	   lets the description use the whole card, wrapping to fewer/wider lines so the card stays square. */
	.card-desc {
		flex-shrink: 0;
		width: 100%;
		/* Reserve the SAME height on every card (enough for the longest 4-line description) and centre
		   the text in it, so all four cards are the same height regardless of description length.
		   `grid` (not flex) is used so the wrapping text still fills the width instead of overflowing. */
		min-height: 5.2em;
		display: flex;
		flex-direction: column;
		justify-content: center; /* vertical centre; align-items:stretch (default) lets text wrap to full width */
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 400;
		font-size: clamp(11px, 0.98vw, 16px);
		line-height: 1.26;
		letter-spacing: 0.02em;
		color: #d7d7d7;
	}

	/* Fixed-height icon row so the magnet / cube / (badge + briefcase) all line up. */
	.card-icon-slot {
		flex-shrink: 0;
		position: relative;
		height: clamp(54px, 5.2vw, 94px);
		margin-top: clamp(4px, 0.9vh, 12px); /* breathe below the description */
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.15em;
	}
	.card-icon {
		height: 100%;
		width: auto;
		object-fit: contain;
		filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.6));
	}
	/* Briefcase art (ALL IN / DEAL IT) — make it bigger to match the reference; it overflows the slot
	   a touch, which is fine since the icon row is centred. */
	.card-icon--brief { height: 128%; }

	/* Multiplier badge — sits to the LEFT of the briefcase, vertically aligned with the case's
	   "M" plate (which sits at ~47% of the case art, slightly above the slot centre). */
	.card-mult {
		position: relative;
		top: -0.12em; /* nudge up so the badge centre matches the M plate centre */
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(18px, 1.7vw, 30px);
		letter-spacing: 0.03em;
		color: #ffffff;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.65);
		line-height: 1;
	}

	/* Figma: IBM Plex Sans Condensed Bold, white, "X.XX $". */
	.card-price {
		flex-shrink: 0;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(14px, 1.3vw, 21px);
		letter-spacing: 0.02em;
		white-space: nowrap;
		color: #ffffff;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
	}

	/* Buttons — uniform WIDE width (BUY matches ACTIVATE), Figma padding/rounding. */
	.card-btn {
		flex-shrink: 0;
		min-width: 74%;
		/* Taller = rectangular (not pill). Moderate radius keeps rounded corners with straight sides. */
		padding: clamp(11px, 1.15vw, 18px) clamp(22px, 2.2vw, 40px);
		/* Pin the button to the card bottom so ALL cards' buttons share one baseline (the auto
		   margin absorbs whatever free space each card's content leaves). */
		margin-top: auto;
		border: 1px solid #60a5fa;
		border-radius: 14px;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: clamp(14px, 1.3vw, 21px);
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #fff;
		cursor: pointer;
		filter: drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
		transition: filter 0.12s ease;
	}
	.card-btn:hover:not(:disabled) {
		filter: brightness(1.12) drop-shadow(0 0 6px #4a94ff);
		border-color: #60a5fa;
	}
	.card-btn:disabled { opacity: 0.45; cursor: default; }
	/* Buy — Version2 flat primary (#28A6DE), like the confirm dialogs. */
	.card-btn--buy {
		background: #28a6de;
	}
	/* Activate — Figma 4040:4142: bottom-lit navy (#0F2053 -> black). */
	.card-btn--activate {
		background: linear-gradient(0deg, #0f2053 0%, #000000 100%);
	}
	/* Active state — the flat primary, to signal it's on. */
	.card-btn--active {
		background: #28a6de;
	}

	/* Bet selector — Figma: cyan-bordered steppers, coin + BET label + big value. */
	.bet {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: clamp(280px, 27vw, 440px);
		aspect-ratio: 577 / 220;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		padding: 0 3.5%; /* small side padding so − / + sit near the panel ends */
		margin-top: clamp(10px, 2.2vh, 34px); /* nudge the whole bet board down from the cards */
		box-sizing: border-box;
	}
	/* Version2 icon button, same as the close button / HUD circles. font-size drives the glyph. */
	.bet-step {
		width: clamp(38px, 3.4vw, 54px);
		height: clamp(38px, 3.4vw, 54px);
		flex-shrink: 0;
		border-radius: 50%;
		border: 1px solid #2391c1;
		background: #22365b;
		font-size: clamp(13px, 1.15vw, 18px);
		padding: 0;
		display: grid; place-items: center;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.bet-step:hover:not(:disabled) { filter: brightness(1.35); }
	.bet-step:disabled { opacity: 0.4; cursor: default; }
	.bet-center {
		display: flex;
		align-items: center;
		gap: clamp(6px, 0.7vw, 12px);
	}
	.bet-coin {
		width: clamp(20px, 1.9vw, 30px);
		height: clamp(20px, 1.9vw, 30px);
		object-fit: contain;
	}
	.bet-value {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1;
	}
	.bet-label {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: clamp(8px, 0.72vw, 11px); font-weight: 700;
		letter-spacing: 0.2em; text-transform: uppercase;
		color: rgba(96, 165, 250, 0.85);
	}
	.bet-amount {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: clamp(17px, 1.7vw, 26px); font-weight: 700;
		color: #ffffff;
		text-shadow: 0 2px 5px rgba(0, 0, 0, 0.7);
	}

	/* ---- Landscape / desktop: size every card as ONE square that fits both the row width and the
	   screen height, then scale the card's contents to that square so 4-in-a-row never overflows
	   (fixes tall cards on mobile-landscape and the total breakdown on very small screens). All
	   dimensions derive from --bb-card, so shrinking the square shrinks the text/icons with it. ---- */
	.panel:not(.portrait) {
		/* All --bb-* vars are measured in JS from the panel's real box (see the $effect) and set
		   inline; the values here are only fallbacks for the first frame / no-JS. */
		--bb-card: 300px;
		--bb-gap: 16px;
		--bb-pad-x: 12px;
		--bb-pad-top: 90px;
		--bb-pad-bot: 24px;
		--bb-vgap: 20px;
		--bb-bet-w: 300px;
		gap: var(--bb-vgap);
		padding: var(--bb-pad-top) var(--bb-pad-x) var(--bb-pad-bot);
	}
	.panel:not(.portrait) .grid {
		gap: var(--bb-gap);
		max-width: none;
		overflow: auto; /* scroll rather than overlap if a tiny screen can't fit the floored squares */
	}
	.panel:not(.portrait) .card {
		flex: 0 0 auto;
		width: var(--bb-card);
		height: var(--bb-card-h, var(--bb-card));
		aspect-ratio: auto;
		max-width: none;
		gap: calc(var(--bb-card) * 0.015);
		padding: calc(var(--bb-card) * 0.115) calc(var(--bb-card) * 0.08) calc(var(--bb-card) * 0.075);
	}
	.panel:not(.portrait) .card-title  { font-size: calc(var(--bb-card) * 0.064); }
	.panel:not(.portrait) .card-desc   { font-size: calc(var(--bb-card) * 0.042); min-height: calc(var(--bb-card) * 0.27); }
	.panel:not(.portrait) .card-icon-slot { height: calc(var(--bb-card) * 0.15); margin-top: calc(var(--bb-card) * 0.01); }
	.panel:not(.portrait) .card-mult   { font-size: calc(var(--bb-card) * 0.062); }
	.panel:not(.portrait) .card-price  { font-size: calc(var(--bb-card) * 0.047); }
	.panel:not(.portrait) .card-btn {
		font-size: calc(var(--bb-card) * 0.048);
		padding: calc(var(--bb-card) * 0.03) calc(var(--bb-card) * 0.1);
		margin-top: auto; /* keep the shared bottom baseline in landscape too */
		border-radius: calc(var(--bb-card) * 0.035);
	}
	.panel:not(.portrait) .bet {
		width: var(--bb-bet-w);
		margin-top: var(--bb-vgap);
		padding: 0 calc(var(--bb-bet-w) * 0.09); /* keep − / + inside the frame's side brackets */
	}
	/* Bet controls scale with the bar width so they shrink on small containers. */
	.panel:not(.portrait) .bet-step {
		width: var(--bb-bet-step);
		height: var(--bb-bet-step);
		font-size: calc(var(--bb-bet-step) * 0.34);
	}
	.panel:not(.portrait) .bet-center { gap: calc(var(--bb-bet-w) * 0.03); }
	.panel:not(.portrait) .bet-coin {
		width: calc(var(--bb-bet-w) * 0.075);
		height: calc(var(--bb-bet-w) * 0.075);
	}
	.panel:not(.portrait) .bet-label { font-size: calc(var(--bb-bet-w) * 0.033); }
	.panel:not(.portrait) .bet-amount { font-size: calc(var(--bb-bet-w) * 0.075); }
	/* Space the BET label off the value so they don't sit on top of each other. */
	.panel:not(.portrait) .bet-value { gap: calc(var(--bb-bet-w) * 0.025); }
	/* Title + close button scale with the container (X was way too big on small screens). */
	.panel:not(.portrait) .title {
		font-size: var(--bb-title);
		top: calc(var(--bb-close) * 0.92);
	}
	.panel:not(.portrait) .close-btn {
		width: var(--bb-close);
		height: var(--bb-close);
		top: calc(var(--bb-close) * 0.42);
		right: calc(var(--bb-close) * 0.42);
		font-size: calc(var(--bb-close) * 0.34);
	}

	/* ---- Mobile portrait (Figma 4137-16084): BUY BONUS title fixed at top, the four cards in a
	   vertical scrollable column starting at the FIRST card, and the bet selector as a compact pill
	   pinned floating at the bottom. Landscape/desktop keeps the 4-in-a-row layout above.
	   The grid + bet are absolutely positioned (not flex children) so the scroll region has a
	   DEFINITE height and reliably starts at the top card — flex sizing was hiding the first card. */
	.panel.portrait {
		padding: 0;
	}
	.panel.portrait .grid {
		position: absolute;
		top: 84px;    /* clear the BUY BONUS title */
		bottom: 20px; /* extend the scroll area almost to the bottom (bet pill floats over it — OK) */
		left: 4vw;
		right: 4vw;
		width: auto;
		max-width: none;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start; /* always start at the first card */
		overflow-y: auto;
		overflow-x: hidden;
		gap: clamp(12px, 2.2vh, 26px);
		/* room at the end so the last card can scroll fully clear of the floating bet pill */
		padding-bottom: 110px;
	}
	/* The card needs a DEFINITE (px) width in this scrolling column — vw/% widths didn't let the
	   description wrap. Fixed widths + a couple of breakpoints keep it fitting on narrow phones. */
	.panel.portrait .card {
		flex: 0 0 auto;
		width: 336px;
		aspect-ratio: auto; /* height follows content in portrait */
		height: auto;
		padding: 34px 22px 26px; /* px (not %): % padding mis-resolved and let the description overflow */
	}
	/* Bet selector: floating pill pinned to the bottom, centred (matches Figma). */
	.panel.portrait .bet {
		position: absolute;
		bottom: 18px;
		left: 50%;
		transform: translateX(-50%);
		width: 260px; /* smaller frame than the cards */
		margin: 0;
		padding: 0 7%; /* − / + sit near the frame ends */
	}
	.panel.portrait .bet-step {
		width: 50px;
		height: 50px;
		font-size: 17px;
	}
	/* Coin and BET / value need clear separation in the compact portrait pill. */
	.panel.portrait .bet-center {
		gap: 12px;
	}
	.panel.portrait .bet-coin {
		width: 24px;
		height: 24px;
	}
	/* Space the BET label off the value so they don't sit on top of each other. */
	.panel.portrait .bet-value {
		gap: 4px;
	}
	/* Plain block + explicit px max-width so the description reliably wraps in portrait. (The landscape
	   flex-column centring didn't wrap here; a block always wraps at its max-width.) */
	.panel.portrait .card-desc {
		display: block;
		max-width: 300px;
		margin-inline: auto;
	}
	@media (max-width: 372px) {
		.panel.portrait .card,
		.panel.portrait .bet { width: 300px; }
		.panel.portrait .card-desc { max-width: 264px; }
	}
	@media (max-width: 332px) {
		.panel.portrait .card,
		.panel.portrait .bet { width: 270px; }
		.panel.portrait .card-desc { max-width: 234px; }
	}

	/* ---- Confirm dialog — Version2 (Figma 4036-3584, art node 7002:11406) ----
	   Identical to BonusResumeModal's .resume block; keep the two in sync. The art box is
	   507.33 x 283 design px, so with container-type:inline-size 1cqw == 1% of the design
	   width and every number below is the design's own measurement. */

	/* Design 4036:3584: a 46px #494A9B circle with a white CSS glyph, no ring. */
	.confirm-close {
		position: fixed; top: 22px; right: 22px; z-index: 73;
		width: 46px; height: 46px; border-radius: 50%;
		border: none;
		background: #494a9b;
		padding: 0;
		cursor: pointer; display: grid; place-items: center;
		transition: filter 0.12s ease;
	}
	.confirm-close:hover { filter: brightness(1.35); }
	.confirm-close__glyph {
		position: relative; display: block;
		width: 18.5px; height: 2.13px;
	}
	.confirm-close__glyph::before,
	.confirm-close__glyph::after {
		content: ''; position: absolute; inset: 0;
		border-radius: 2.13px; background: #fff;
	}
	.confirm-close__glyph::before { transform: rotate(45deg); }
	.confirm-close__glyph::after { transform: rotate(-45deg); }

	.confirm {
		position: fixed; left: 50%; top: 50%;
		transform: translate(-50%, -50%);
		z-index: 71;
		/* Same sizing as BonusResumeModal .resume — the two share this plate and the cqw scale, so
		   they must grow/shrink together or the buy confirm would dwarf the resume dialog in a popout.
		   32vw / 508px read too small at every size (user, 2026-08-10); two passes later it is 54vw with a
		   300px floor and a 720px cap — the popout ramp is kept, the plate just has real presence now. */
		width: clamp(300px, 54vw, 720px);
		container-type: inline-size;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}
	/* The plate is DRAWN, not art: a flat rounded rectangle, exactly what the design is. It also
	   stopped being a fixed-aspect box — the three dialogs that wear it hold one nowrap line, a
	   wrapping sentence and a single button respectively, and an `aspect-ratio` plate sized for one
	   of them clips or strands the other two. Flow layout at the design's own paddings instead.
	   Design 4036:3584: plate 458x215, radius 14, fill #3A3981 over a #2D2C69 edge. */
	.confirm-panel {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6.3cqw;
		padding: 6.33cqw 5.5cqw 4.37cqw;
		background: #3a3981;
		border: 0.44cqw solid #2d2c69;
		border-radius: 3.06cqw;
		box-shadow: 0 1.6cqw 3.6cqw rgba(0, 0, 0, 0.5);
	}
	/* Design 4036:3584 — Chakra Petch Bold 30/458 of the plate, WHITE (the Version2 plate set this
	   in #2391C1; the MOTHERSHIP design does not). */
	.confirm-title {
		text-align: center;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		font-size: calc(6.55cqw * var(--confirm-title-fit, 1));
		letter-spacing: 0.03em;
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
		color: #ffffff;
	}
	/* Design 4036:3584 — 20/458 of the plate, white. */
	.confirm-text {
		text-align: center;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: calc(4.37cqw * var(--confirm-text-fit, 1));
		font-weight: 600;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: #fff;
		line-height: 1.3;
		/* One line, like the design — the fitter above shrinks it instead of wrapping. */
		white-space: nowrap;
	}
	/* Design 4036:3584 — two 196x48 buttons, 17 apart, spanning 89.3% of the plate. */
	.confirm-row {
		display: flex;
		gap: 3.71cqw;
		justify-content: center;
	}
	.confirm-btn {
		height: 10.48cqw;
		min-width: 42.79cqw;
		padding: 0 3cqw;
		border: 0.22cqw solid #a88eff;
		border-radius: 1.75cqw;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		font-size: 3.28cqw;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		white-space: nowrap;
		color: #ffffff;
		cursor: pointer;
		background: #47468a;
		transition: filter 0.12s ease;
	}
	.confirm-btn:hover {
		filter: brightness(1.18);
	}
	.confirm-btn--cancel {
		background: #47468a;
	}
	.confirm-btn--ok {
		background: #a88eff;
	}

	/* Buttons do NOT inherit font-family: the UA stylesheet hard-sets `font: 400 13.333px Arial` on
	   form controls, so every <button> here (and the glyph spans inside them) rendered in Arial no
	   matter what the container was set to — measured via getComputedStyle, not assumed.
	   Deliberately NOT scoped to a root element, and set OUTRIGHT rather than to `inherit`: the
	   confirm dialog in CustomBuyBonusModal is a SIBLING of .panel, so a `.panel button` rule misses
	   its buttons, and `inherit` on a top-level sibling like .confirm-close resolves against <body>,
	   not the dialog. Svelte already scopes this to the component. */
	button {
		font-family: 'Chakra Petch', 'Inter', sans-serif;
	}
</style>
