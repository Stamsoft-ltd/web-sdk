<script lang="ts" module>
	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;

	// MOTHERSHIP buy menu — Figma 9164:11722 "Bonus menu" (SECTION 9078:18631 POPUPS). Everything
	// here is DRAWN now: the card is a flat #3A3981 plate on a #2D2C69 edge, and so is the bet
	// selector, which retired the Version2 steel bitmaps (bb_card_panel_v2 / bb_bet_panel_v2) and
	// the coin that used to sit in the bet plate — the design's plate has no coin in it.
	//
	// Card icons. Two of the five are reel symbols the game already ships; the design draws its own
	// art for the bought bonuses and the Mystery buy (scripts/build-bonus-menu-icons.py).
	const iconChance = ap(
		'/assets/components/symbols/magnetic/low/energy_screw_full.webp?v=20260902',
	);
	// The design pictures the WILD on Feature Spins — it is the thing the spin is bought for. It
	// used to be the compass, which is only the top-paying symbol and says nothing about the mode.
	// (Flattened composite from scripts/build-paytable-symbols.py, not the board's own texture: the
	// wild is assembled from loose parts, so its base file alone is a horseshoe with no plaque.)
	const iconFeature = ap('/assets/components/symbols/magnetic/special/wild_full.webp?v=20260904');
	const iconBonus = ap('/assets/components/ui/bb_ic_gravity.webp?v=20260904');
	const iconSuper = ap('/assets/components/ui/bb_ic_core.webp?v=20260904');
	const iconMystery = ap('/assets/components/ui/bb_ic_mystery.webp?v=20260904');

	// For LoadingController's HTML-image pass — built from the consts above so path/?v= edits stay in sync.
	export const BUY_BONUS_MODAL_IMAGES = [
		iconChance,
		iconFeature,
		iconBonus,
		iconSuper,
		iconMystery,
	];
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { stateBet, stateBetDerived, stateConfig, stateMeta } from 'state-shared';
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
	const tv = (k: string, vars: Record<string, string | number>) =>
		i18nDerived.translateVars(k, vars);

	type Props = {
		onclose: () => void;
		isChanceActive: boolean;
		isFeatureActive: boolean;
		onToggleChance: () => void;
		onToggleFeature: () => void;
	};

	const props: Props = $props();
	const context = getContext();

	// Portrait (mobile) uses a single vertical scrollable column of cards; landscape/desktop lays
	// them out the way the design does, 3 across in two rows.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	// Landscape/desktop card sizing. The modal is rendered inside the (often CSS-scaled) game
	// container, NOT the browser window — so vw/vh don't map to the real box and cards ended up
	// clipped/oversized. Instead we MEASURE the panel and size the card off both the row width and
	// the leftover height, then feed everything to CSS as px vars.
	const clampNum = (min: number, val: number, max: number) => Math.max(min, Math.min(val, max));
	const LANDSCAPE_VARS = [
		'--bb-card',
		'--bb-gap',
		'--bb-pad-x',
		'--bb-pad-top',
		'--bb-pad-bot',
		'--bb-vgap',
		'--bb-bet-w',
		'--bb-close',
		'--bb-title',
	];
	/** The design's card block is 1048 wide on a 1200 frame, with 6 between cards. */
	const GRID_W_FRACTION = 1048 / 1200;
	const CARD_GAP_FRACTION = 6 / 1200;
	/** Card box 345.3x243.3. Our descriptions run a line longer than the design's, so the card is
	 *  allowed to grow past that 0.70 ratio — the budget reserves the taller box so two rows plus
	 *  the bet plate still fit inside the panel. */
	const CARD_H_BUDGET = 0.83;
	let panelEl = $state<HTMLDivElement>();
	let gridEl = $state<HTMLDivElement>();
	$effect(() => {
		const el = panelEl;
		if (!el) return;
		if (isPortrait) {
			// Portrait sizes the card from its own breakpoints; leaving landscape's vars behind would
			// override them.
			for (const name of LANDSCAPE_VARS) el.style.removeProperty(name);
			return;
		}
		const measure = () => {
			const w = el.clientWidth;
			const h = el.clientHeight;
			if (!w || !h) return;
			// Chrome (title / close button) scales down on small containers so it doesn't dominate.
			const closePx = clampNum(30, (w * 48.7) / 1200, 56);
			const titlePx = clampNum(15, (w * 32) / 1200, 38);
			const gap = Math.max(6, w * CARD_GAP_FRACTION);
			const padX = clampNum(8, w * 0.008, 32);
			// The design starts its card block at 74 of 670.
			const padTop = clampNum(44, h * 0.11, 100);
			const padBot = clampNum(8, h * 0.03, 32);
			const vGap = clampNum(8, h * 0.03, 30);
			// Bet plate 271.7x67, shrinking with the container.
			const betW = clampNum(180, (w * 271.7) / 1200, 340);
			const betH = (betW * 67) / 271.7;
			const widthBudget = (Math.min(w, 1860) * GRID_W_FRACTION - 2 * gap) / 3;
			const heightBudget = (h - padTop - padBot - betH - vGap - gap) / 2;
			let card = clampNum(
				56,
				Math.min(widthBudget, heightBudget / CARD_H_BUDGET, 420),
				widthBudget,
			);
			el.style.setProperty('--bb-gap', `${gap}px`);
			el.style.setProperty('--bb-pad-x', `${padX}px`);
			el.style.setProperty('--bb-pad-top', `${padTop}px`);
			el.style.setProperty('--bb-pad-bot', `${padBot}px`);
			el.style.setProperty('--bb-vgap', `${vGap}px`);
			el.style.setProperty('--bb-bet-w', `${betW}px`);
			el.style.setProperty('--bb-close', `${closePx}px`);
			el.style.setProperty('--bb-title', `${titlePx}px`);
			el.style.setProperty('--bb-card', `${card}px`);
			// Second pass. CARD_H_BUDGET is only an estimate of the card's height — what actually
			// settles it is where the DESCRIPTION wraps, and in the wordiest locales (Russian,
			// Finnish, German) it runs a line longer than the reserve, which left the two rows
			// scrolling inside the grid. Shrink the card until they fit. Written straight to the
			// element rather than through a reactive style string so each pass can read the new
			// layout back immediately; it converges in one or two rounds.
			const grid = gridEl;
			if (!grid) return;
			for (let pass = 0; pass < 3 && grid.scrollHeight > grid.clientHeight + 1; pass += 1) {
				card = Math.max(56, card * (grid.clientHeight / grid.scrollHeight));
				el.style.setProperty('--bb-card', `${card}px`);
			}
		};
		measure();
		const ro = new ResizeObserver(measure);
		ro.observe(el);
		return () => ro.disconnect();
	});

	const betAmount = $derived(stateBet.betAmount);
	const betDisplay = $derived(magneticStakeDerived.formatCurrencyAmount(betAmount));

	// Costs come from the bet-mode table Game.svelte publishes, not from literals copied out of it:
	// the math has already moved the bought bonuses once (BONUS 150 -> 100, SUPER 400 -> 500) and a
	// second copy of those numbers is a second place to forget.
	const costMultiplier = (key: string) => {
		const meta = stateMeta.betModeMeta?.[key];
		return typeof meta?.costMultiplier === 'number' ? meta.costMultiplier : 0;
	};
	const modeCost = (key: string) =>
		magneticStakeDerived.formatCurrencyAmount(betAmount * costMultiplier(key));
	/** Per-CARD affordability. isBetCostAvailable() only answers for the mode that happens to be
	 *  active, which greyed out every buy button together — a balance that covers Gravity Breach at
	 *  100x does not cover Core Overload at 500x. */
	const canAfford = (key: string) => {
		const cost = betAmount * costMultiplier(key);
		return cost > 0 && cost <= stateBet.balanceAmount;
	};

	// Bet selector (mirrors the HUD bet stepper).
	const betOptions = $derived(stateConfig.betAmountOptions);
	const currentBetIndex = $derived(Math.max(0, betOptions.indexOf(betAmount)));
	const disableDec = $derived(currentBetIndex <= 0);
	const disableInc = $derived(currentBetIndex >= betOptions.length - 1);
	const stepBet = (dir: -1 | 1) => {
		const i = Math.min(betOptions.length - 1, Math.max(0, currentBetIndex + dir));
		const next = betOptions[i];
		if (typeof next === 'number' && next !== betAmount) stateBetDerived.setBetAmount(next);
	};

	// FEATURE is here because Stake's checklist requires a confirmation step for any mode costing
	// more than 2x a normal round, and Feature Spin costs 50x PER ROUND — it was previously a
	// one-click toggle. Chance Spin is exactly 2x, which the rule does not cover, so it stays
	// one-click. Deactivating never costs anything and never asks.
	type BuyMode = 'BONUS' | 'MYSTERY' | 'SUPER';
	type ConfirmMode = BuyMode | 'FEATURE';
	let confirmMode = $state<null | ConfirmMode>(null);

	const buyMode = (mode: BuyMode) => {
		// If the machine isn't idle the 'bet' event would be dropped but the mode
		// assignment would stick — every later (auto-)spin would then bet at buy cost.
		if (!context.stateXstateDerived.isIdle()) {
			props.onclose();
			return;
		}
		stateBet.activeBetModeKey = mode;
		props.onclose();
		context.eventEmitter.broadcast({ type: 'bet' });
	};
	const openConfirm = (mode: ConfirmMode) => {
		confirmMode = mode;
	};
	const closeConfirm = () => {
		confirmMode = null;
	};
	const toggleActivateMode = (toggle: () => void) => {
		toggle();
		props.onclose();
	};

	// The five cards, in the design's reading order: the two activate modes, then the two bought
	// bonuses, then the Mystery buy. (The design draws a SIXTH — Zero Point Protocol — and it was
	// built here on 2026-09-04, then removed the same day at the user's request: no bet mode buys
	// it, so its card could only ever show a dash and a dead BUY button. Zero Point stays on rules
	// page 5, where its 5-scatter trigger is the whole story. Put the card back — icon, i18n keys
	// BUY ZERO TITLE/DESC and the HIDDEN mode key are all still here — when the math ships it.)
	const cards = $derived([
		{
			key: 'CHANCE',
			title: t('BUY EXTRA CHANCE TITLE'),
			desc: t('BUY EXTRA CHANCE DESC'),
			icon: iconChance,
			perSpin: true,
			active: props.isChanceActive,
			buy: false,
			// Exactly 2x a normal round, which Stake's confirmation rule does not cover.
			press: () => toggleActivateMode(props.onToggleChance),
		},
		{
			key: 'FEATURE',
			title: t('BUY FEATURE SPINS TITLE'),
			desc: t('BUY FEATURE SPINS DESC'),
			icon: iconFeature,
			perSpin: true,
			active: props.isFeatureActive,
			buy: false,
			press: () =>
				props.isFeatureActive ? toggleActivateMode(props.onToggleFeature) : openConfirm('FEATURE'),
		},
		{
			key: 'BONUS',
			title: t('BUY DROP TITLE'),
			desc: t('BUY DROP DESC'),
			icon: iconBonus,
			perSpin: false,
			active: false,
			buy: true,
			press: () => openConfirm('BONUS'),
		},
		{
			key: 'SUPER',
			title: t('BUY MEGA TITLE'),
			desc: t('BUY MEGA DESC'),
			icon: iconSuper,
			perSpin: false,
			active: false,
			buy: true,
			press: () => openConfirm('SUPER'),
		},
		{
			key: 'MYSTERY',
			title: t('BUY MYSTERY TITLE'),
			// The three outcomes are named from the SAME keys the splash screen's bonus tiers use,
			// so the card can never drift from what the game calls them elsewhere.
			desc: tv('BUY MYSTERY DESC', {
				a: t('SPLASH GRAVITY BREACH'),
				b: t('SPLASH CORE OVERLOAD'),
				c: t('SPLASH ZERO POINT'),
			}),
			icon: iconMystery,
			perSpin: false,
			active: false,
			buy: true,
			press: () => openConfirm('MYSTERY'),
		},
	]);

	// FEATURE is an activation toggle, not a one-shot purchase, so its confirm runs the toggle.
	const acceptConfirm = () => {
		if (confirmMode === 'FEATURE') {
			closeConfirm();
			toggleActivateMode(props.onToggleFeature);
			return;
		}
		buyMode(confirmMode as BuyMode);
	};

	const confirmLabel = $derived(
		confirmMode === 'SUPER'
			? t('BUY MEGA TITLE')
			: confirmMode === 'FEATURE'
				? t('BUY FEATURE SPINS TITLE')
				: confirmMode === 'MYSTERY'
					? t('BUY MYSTERY TITLE')
					: t('BUY DROP TITLE'),
	);
	const confirmCost = $derived(confirmMode ? modeCost(confirmMode) : '');
	// The design's title/body are ONE nowrap line each ("CONFIRM ALL IN" / "BUY ALL IN FOR 400.00?").
	// Our mode names and localized strings run longer, so each line shrinks to fit the plate instead
	// of spilling past it — measured for real (see fitText), since uppercase "CORE OVERLOAD"
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

	onMount(() => {
		const onKeyDown = (e: KeyboardEvent) => {
			if (e.key !== 'Escape') return;
			if (confirmMode) closeConfirm();
			else props.onclose();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});
</script>

<!-- Backdrop -->
<button class="backdrop" type="button" aria-label="Close" tabindex="-1" onclick={props.onclose}
></button>

<!-- Panel -->
<div class="panel" class:portrait={isPortrait} bind:this={panelEl} role="dialog" aria-modal="true">
	<h2 class="title">{t('BUY BONUS')}</h2>
	<button class="close-btn" type="button" onclick={props.onclose} aria-label="Close"
		><span class="glyph glyph--close"></span></button
	>

	<div class="grid" bind:this={gridEl}>
		{#each cards as card (card.key)}
			<div class="card">
				<span class="card-title">{card.title}</span>
				<span class="card-desc">{card.desc}</span>
				<div class="card-icon-slot">
					<img class="card-icon" src={card.icon} alt="" />
				</div>
				<!-- A mode the RGS has not published has no price to state — show a dash rather than a
				     confident "$0.00", which reads as free. -->
				<span class="card-price"
					>{costMultiplier(card.key) > 0
						? `${modeCost(card.key)}${card.perSpin ? ` ${t('PER SPIN')}` : ''}`
						: '—'}</span
				>
				{#if card.buy}
					<button
						class="card-btn card-btn--buy"
						type="button"
						disabled={!canAfford(card.key)}
						onclick={card.press}>{t('BUY')}</button
					>
				{:else}
					<button
						class="card-btn card-btn--activate"
						class:card-btn--active={card.active}
						type="button"
						onclick={card.press}>{card.active ? t('DEACTIVATE') : t('ACTIVATE')}</button
					>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Bet selector -->
	<div class="bet">
		<button
			class="bet-step"
			type="button"
			disabled={disableDec}
			onclick={() => stepBet(-1)}
			aria-label={`Decrease ${i18nDerived.betLabel()}`}><span class="glyph"></span></button
		>
		<div class="bet-value">
			<span class="bet-label">{t('BET')}</span>
			<span class="bet-amount">{betDisplay}</span>
		</div>
		<button
			class="bet-step"
			type="button"
			disabled={disableInc}
			onclick={() => stepBet(1)}
			aria-label={`Increase ${i18nDerived.betLabel()}`}
			><span class="glyph glyph--plus"></span></button
		>
	</div>
</div>

<!-- Confirm -->
{#if confirmMode}
	<button
		class="backdrop backdrop--z2"
		type="button"
		aria-label="Close"
		tabindex="-1"
		onclick={closeConfirm}
	></button>
	<button class="confirm-close" type="button" onclick={closeConfirm} aria-label="Close">
		<span class="confirm-close__glyph"></span>
	</button>
	<div class="confirm" role="dialog" aria-modal="true" bind:this={confirmEl} style={confirmVars}>
		<div class="confirm-panel">
			<div class="confirm-title">{confirmTitleText}</div>
			<div class="confirm-text">{confirmBodyText}</div>
			<div class="confirm-row">
				<button class="confirm-btn confirm-btn--cancel" type="button" onclick={closeConfirm}
					>{t('CANCEL')}</button
				>
				<button class="confirm-btn confirm-btn--ok" type="button" onclick={acceptConfirm}
					>{t('CONFIRM')}</button
				>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Backdrops */
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		/* Design 9164:11750 — a flat 70% black over the game, no blur. */
		background: rgba(0, 0, 0, 0.7);
		border: 0;
		padding: 0;
		cursor: pointer;
	}
	.backdrop--z2 {
		z-index: 70;
	}

	/* Full-screen panel container */
	.panel {
		position: fixed;
		inset: 0;
		z-index: 61;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-family: 'Chakra Petch', 'Inter', sans-serif;
		pointer-events: none;
	}
	.panel > * {
		pointer-events: auto;
	}

	/* Design 9164:11751 — AUDIOWIDE 32px / 0.96px on the 1200-wide frame, centred on the close
	   button's vertical centre. Audiowide ships Regular only; 700 here would be synthesised. */
	.title {
		position: absolute;
		top: calc(var(--bb-close, 48px) * 0.83);
		left: 50%;
		transform: translate(-50%, -50%);
		margin: 0;
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 400;
		font-size: var(--bb-title, 24px);
		line-height: normal;
		letter-spacing: 0.03em;
		text-align: center;
		text-transform: uppercase;
		color: #ffffff;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
	}

	/* Design 9164:11763 "Icon buttons" — a #49489B circle ringed white, with a drawn glyph. */
	.close-btn {
		position: fixed;
		top: 16px;
		right: 16px;
		z-index: 63;
		width: var(--bb-close, 48px);
		height: var(--bb-close, 48px);
		border-radius: 50%;
		border: 1px solid #ffffff;
		background: #49489b;
		font-size: calc(var(--bb-close, 48px) * 0.34);
		padding: 0;
		cursor: pointer;
		display: grid;
		place-items: center;
		transition: filter 0.12s ease;
	}
	.close-btn:hover {
		filter: brightness(1.35);
	}

	/* Glyphs are drawn, not imported — the design's are plain white strokes (same pattern as
	   CustomAutoSpinModal). Sized in em off the button's font-size. */
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
	.glyph--plus::after {
		transform: rotate(90deg);
	}
	.glyph--close {
		width: 1.155em;
		background: none;
	}
	.glyph--close::before {
		transform: rotate(45deg);
	}
	.glyph--close::after {
		transform: rotate(-45deg);
	}

	/* Five cards, three to a row (design 9164:11764 — two rows of three, 6 apart). The last row is
	   short by one because Zero Point Protocol is rules-only; wrapping + centring is what puts the
	   remaining two under the middle of the block instead of hard against the left edge. */
	.grid {
		display: flex;
		flex-wrap: wrap;
		gap: var(--bb-gap, 12px);
		justify-content: center;
		/* stretch, not flex-start: a locale whose copy wraps one line longer on ONE card would
		   otherwise leave that card taller than its row-mates and ragged along the bottom. */
		align-items: stretch;
		width: 100%;
	}

	/* Card = design 9164:11766 — a flat #3A3981 plate, #2D2C69 edge, radius 8, 345.3x243.3.
	   `container-type: inline-size` makes 1cqw == 1% of the card's CONTENT box for everything
	   INSIDE it, so both orientations share one set of numbers: each is the design's own
	   measurement divided by that content width, 345.3 - 2x12 padding - 2x3.6 edge = 314.1.
	   The card's OWN box cannot use cqw — a container never queries itself, and those lengths
	   silently fell back to the viewport (a 3.6px edge came out 13px wide on desktop) — so the
	   plate's padding/edge/radius are calc()ed off the same --bb-card that sets its width. */
	.card {
		container-type: inline-size;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		width: var(--bb-card);
		background: #3a3981;
		border: max(1px, calc(var(--bb-card) * 0.0104)) solid #2d2c69;
		border-radius: calc(var(--bb-card) * 0.0232);
		padding: calc(var(--bb-card) * 0.0463) calc(var(--bb-card) * 0.0348);
		gap: calc(var(--bb-card) * 0.0116);
	}

	/* 9164:11767 — AUDIOWIDE 16.45px / 0.49px, white, one line. */
	.card-title {
		flex-shrink: 0;
		width: 100%;
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 400;
		font-size: 5.24cqw;
		line-height: 1.28;
		letter-spacing: 0.03em;
		color: #ffffff;
		/* The names run longer than the design's placeholders in several locales — shrink the glyphs
		   rather than wrap, which would push the icon row out of line across the cards. */
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	/* 9164:11768 — POPPINS Regular 11px / 0.33px, white, centred. The design reserves three lines;
	   our descriptions run to four, and the box is fixed at that so the icon, price and button line
	   up across every card regardless of how long each description is. */
	.card-desc {
		flex-shrink: 0;
		width: 100%;
		min-height: 21cqw;
		display: flex;
		flex-direction: column;
		justify-content: center;
		font-family: 'Poppins', 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 400;
		font-size: 3.5cqw;
		line-height: 1.5;
		letter-spacing: 0.03em;
		color: #ffffff;
	}

	/* Fixed-height icon row (69 of 345.3) so all five icons sit on one line whatever their own
	   aspect is — the design draws them at five different widths. */
	.card-icon-slot {
		flex-shrink: 0;
		height: 21.97cqw;
		margin-top: 1.27cqw;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.card-icon {
		height: 100%;
		width: auto;
		object-fit: contain;
		filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.45));
	}

	/* 9164:11770 — POPPINS Bold 9.36px, white. */
	.card-price {
		flex-shrink: 0;
		margin-top: 2.5cqw;
		font-family: 'Poppins', 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 700;
		font-size: 2.98cqw;
		letter-spacing: 0.02em;
		white-space: nowrap;
		color: #ffffff;
	}

	/* 9164:11771 "Button" — 300x50 on radius 12, AUDIOWIDE 12.79px / 1.28px. The auto margin pins
	   every card's button to a shared baseline. */
	.card-btn {
		flex-shrink: 0;
		margin-top: auto;
		width: 95.5cqw;
		height: 15.92cqw;
		padding: 0 3cqw;
		border-radius: 3.82cqw;
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-size: 4.07cqw;
		font-weight: 400;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		white-space: nowrap;
		color: #fff;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.card-btn:hover:not(:disabled) {
		filter: brightness(1.18);
	}
	.card-btn:disabled {
		opacity: 0.45;
		cursor: default;
	}
	/* Buy — the design's primary: flat #A88EFF ringed in #47468A. */
	.card-btn--buy {
		background: #a88eff;
		border: 1px solid #47468a;
	}
	/* Activate — the secondary of the same pair, the two fills swapped. */
	.card-btn--activate {
		background: #47468a;
		border: 1px solid #a88eff;
	}
	/* Active state — wear the primary fill, so an armed mode reads as "on". */
	.card-btn--active {
		background: #a88eff;
		border-color: #47468a;
	}

	/* Bet selector — design 9164:11752: the card's own plate at 271.7x67 on radius 12, a round
	   stepper at each end and the label/value stack between them. cqw is the PLATE here. */
	.bet {
		container-type: inline-size;
		box-sizing: border-box;
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: var(--bb-bet-w, 272px);
		height: calc(var(--bb-bet-w, 272px) * 67 / 271.7);
		/* Own box off --bb-bet-w for the same reason the card's is off --bb-card; the children
		   below are cqw of this plate's content box, 271.7 - 2x6 - 2x2 = 255.7. */
		padding: 0 calc(var(--bb-bet-w, 272px) * 0.0221);
		background: #3a3981;
		border: max(1px, calc(var(--bb-bet-w, 272px) * 0.00736)) solid #2d2c69;
		border-radius: calc(var(--bb-bet-w, 272px) * 0.0442);
	}
	/* 9164:11761 — a #49489B circle at 48.7 of the plate's 271.7. */
	.bet-step {
		width: 19.05cqw;
		height: 19.05cqw;
		flex-shrink: 0;
		border-radius: 50%;
		border: 1px solid #a88eff;
		background: #49489b;
		font-size: 6.26cqw;
		padding: 0;
		display: grid;
		place-items: center;
		cursor: pointer;
		transition: filter 0.12s ease;
	}
	.bet-step:hover:not(:disabled) {
		filter: brightness(1.35);
	}
	.bet-step:disabled {
		opacity: 0.4;
		cursor: default;
	}
	.bet-value {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.6cqw;
		line-height: 1;
	}
	/* 9164:11758 — INTER Bold 10px / 2px, white. */
	.bet-label {
		font-family: 'Inter', 'Chakra Petch', sans-serif;
		font-size: 3.91cqw;
		font-weight: 700;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.8);
	}
	/* 9164:11760 — INTER Bold 24px, white. */
	.bet-amount {
		font-family: 'Inter', 'Chakra Petch', sans-serif;
		font-size: 9.39cqw;
		font-weight: 700;
		color: #ffffff;
	}

	/* ---- Landscape / desktop: the card width is measured in JS from the panel's real box (see the
	   $effect) and set inline; the values here are only fallbacks for the first frame / no-JS. ---- */
	.panel:not(.portrait) {
		--bb-card: 300px;
		--bb-gap: 12px;
		--bb-pad-x: 12px;
		--bb-pad-top: 90px;
		--bb-pad-bot: 24px;
		--bb-vgap: 20px;
		--bb-bet-w: 272px;
		gap: var(--bb-vgap);
		padding: var(--bb-pad-top) var(--bb-pad-x) var(--bb-pad-bot);
		box-sizing: border-box;
	}
	.panel:not(.portrait) .grid {
		max-width: calc(var(--bb-card) * 3 + var(--bb-gap) * 2);
		/* scroll rather than overlap if a tiny screen can't fit the floored cards */
		overflow: auto;
	}
	.panel:not(.portrait) .card {
		flex: 0 0 auto;
		/* The design's card is 0.705 of its width; ours reserves a fourth description line, so it
		   settles nearer 0.82 — CARD_H_BUDGET in the measuring effect reserves exactly that, and
		   min-height (not height) means a longer locale grows the card and scrolls the grid rather
		   than spilling its copy out of the plate. */
		min-height: calc(var(--bb-card) * 0.82);
	}

	/* ---- Mobile portrait: BUY BONUS title fixed at top, the cards in a vertical scrollable column
	   starting at the FIRST card, and the bet selector as a compact plate pinned floating at the
	   bottom. The grid + bet are absolutely positioned (not flex children) so the scroll region has
	   a DEFINITE height and reliably starts at the top card — flex sizing was hiding the first
	   card. Portrait has no MOTHERSHIP design of its own; it wears the landscape card verbatim,
	   which is what cqw metrics buy us. ---- */
	.panel.portrait {
		padding: 0;
	}
	.panel.portrait .title {
		top: 42px;
		font-size: 22px;
	}
	.panel.portrait .close-btn {
		width: 42px;
		height: 42px;
		font-size: 14px;
	}
	.panel.portrait .grid {
		position: absolute;
		top: 74px; /* clear the BUY BONUS title */
		bottom: 20px; /* extend the scroll area almost to the bottom (bet plate floats over it — OK) */
		left: 4vw;
		right: 4vw;
		width: auto;
		flex-direction: column;
		flex-wrap: nowrap;
		align-items: center;
		justify-content: flex-start; /* always start at the first card */
		overflow-y: auto;
		overflow-x: hidden;
		gap: clamp(12px, 2.2vh, 26px);
		/* room at the end so the last card can scroll fully clear of the floating bet plate */
		padding-bottom: 110px;
	}
	/* The card needs a DEFINITE (px) width in this scrolling column — vw/% widths didn't let the
	   description wrap. Fixed widths + a couple of breakpoints keep it fitting on narrow phones. */
	.panel.portrait .card {
		flex: 0 0 auto;
		--bb-card: 336px;
	}
	/* Bet plate: floating, pinned to the bottom, centred. */
	.panel.portrait .bet {
		position: absolute;
		bottom: 18px;
		left: 50%;
		transform: translateX(-50%);
		--bb-bet-w: 260px;
	}
	@media (max-width: 372px) {
		.panel.portrait .card {
			--bb-card: 300px;
		}
		.panel.portrait .bet {
			--bb-bet-w: 234px;
		}
	}
	@media (max-width: 332px) {
		.panel.portrait .card {
			--bb-card: 270px;
		}
		.panel.portrait .bet {
			--bb-bet-w: 210px;
		}
	}

	/* ---- Confirm dialog — see the plate note on .confirm-panel below ---- */

	/* Design 4036:3584: a 46px #494A9B circle with a white CSS glyph, no ring. */
	.confirm-close {
		position: fixed;
		top: 22px;
		right: 22px;
		z-index: 73;
		width: 46px;
		height: 46px;
		border-radius: 50%;
		border: none;
		background: #494a9b;
		padding: 0;
		cursor: pointer;
		display: grid;
		place-items: center;
		transition: filter 0.12s ease;
	}
	.confirm-close:hover {
		filter: brightness(1.35);
	}
	.confirm-close__glyph {
		position: relative;
		display: block;
		width: 18.5px;
		height: 2.13px;
	}
	.confirm-close__glyph::before,
	.confirm-close__glyph::after {
		content: '';
		position: absolute;
		inset: 0;
		border-radius: 2.13px;
		background: #fff;
	}
	.confirm-close__glyph::before {
		transform: rotate(45deg);
	}
	.confirm-close__glyph::after {
		transform: rotate(-45deg);
	}

	.confirm {
		position: fixed;
		left: 50%;
		top: 50%;
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
	/* MOTHERSHIP confirm popup — plate node 9076:28671 inside the design's "confirm popup" frame
	   (Figma 4036:3584, SECTION 9078:18631 POPUPS). Three dialogs wear this plate — the buy
	   confirmation, the unfinished-round dialog and the insufficient-funds notice — and they must
	   stay identical; the metrics the text fitter needs live in confirmDialog.ts.

	   Re-measured 2026-09-03 off 9076:28671, which REPLACED the 4036-era plate the old numbers came
	   from. What changed: the faces (Audiowide title / Poppins body, not Chakra Petch throughout),
	   a 4px #2D2C69 edge with a #5E4374 hairline inside it, and 196.5x50 buttons on radius 12.
	   The outer plate is 467 design px wide, so with container-type:inline-size 1cqw == 1% of it
	   and every number below is the design's own measurement divided by 467. */
	.confirm-panel {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 5.7cqw;
		padding: 4.71cqw 5.35cqw 4.26cqw;
		background: #3a3981;
		border: 0.86cqw solid #2d2c69;
		border-radius: 3cqw;
		/* The design's inner plate carries its own 1px #5E4374 hairline inside the #2D2C69 edge. */
		box-shadow:
			inset 0 0 0 0.21cqw #5e4374,
			0 1.6cqw 3.6cqw rgba(0, 0, 0, 0.5);
	}
	.confirm-title {
		text-align: center;
		/* 32/467, AUDIOWIDE — Regular is the family's only weight, so 700 here would be synthesised. */
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-weight: 400;
		font-size: calc(6.85cqw * var(--confirm-title-fit, 1));
		letter-spacing: 0.03em;
		text-transform: uppercase;
		line-height: 1;
		white-space: nowrap;
		color: #ffffff;
	}
	.confirm-text {
		text-align: center;
		/* 20/467, POPPINS Regular. */
		font-family: 'Poppins', 'Chakra Petch', 'Inter', sans-serif;
		font-size: calc(4.28cqw * var(--confirm-text-fit, 1));
		font-weight: 400;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		color: #fff;
		line-height: 1.3;
		/* One line, like the design — the fitter above shrinks it instead of wrapping. */
		white-space: nowrap;
	}
	/* 9076:28675 — two 196.5x50 buttons 16 apart, spanning 89% of the plate. */
	.confirm-row {
		display: flex;
		gap: 3.43cqw;
		justify-content: center;
	}
	.confirm-btn {
		height: 10.71cqw;
		min-width: 42.08cqw;
		padding: 0 3cqw;
		/* The design's primary is a flat #A88EFF with NO stroke — which is what this ring already is
		   once the fill matches it, so both variants keep the same box. */
		border: 0.21cqw solid #a88eff;
		border-radius: 2.57cqw;
		font-family: 'Audiowide', 'Chakra Petch', 'Inter', sans-serif;
		font-size: 3.43cqw;
		font-weight: 400;
		letter-spacing: 0.0875em;
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
