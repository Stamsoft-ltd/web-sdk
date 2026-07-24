<script lang="ts">
	import { onMount } from 'svelte';
	import { stateBet, stateBetDerived, stateConfig } from 'state-shared';
	import { getContext } from '../game/context';
	import { magneticStakeDerived } from '../state/magneticStake.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';

	const t = (k: string) => i18nDerived.translate(k);
	const tv = (k: string, vars: Record<string, string | number>) => i18nDerived.translateVars(k, vars);

	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;
	const cardPanel      = ap('/assets/components/ui/bb_card_panel.webp?v=20260708c');
	const betPanel       = ap('/assets/components/ui/bb_bet_panel.webp?v=20260708c');
	const confirmPanelBg = ap('/assets/components/ui/confirm_panel.webp?v=20260708b');
	const coinIcon       = ap('/assets/components/ui/bb_coin.svg?v=20260708c');
	// Our control icons (same set the info modal documents) for the +, − and × (close) buttons.
	const iconClose      = ap('/assets/components/ui/ctrl_close.webp');
	const iconMinus      = ap('/assets/components/ui/ctrl_minus.webp');
	const iconPlus       = ap('/assets/components/ui/ctrl_plus.webp');

	// Icons — exact Figma art (node 4040-4075): glowing magnet, purple M cube, red M briefcase.
	const iconChance  = ap('/assets/components/ui/bb_icon_extra_chance.webp?v=20260708c');
	const iconFeature = ap('/assets/components/ui/bb_icon_feature_spins.webp?v=20260708c');
	const iconBrief   = ap('/assets/components/ui/bb_icon_briefcase.webp?v=20260708c');

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
			// Cards are a touch taller than wide (--bb-card drives width + content scaling; the extra
			// height gives breathing room so the button isn't flush to the bottom edge).
			const cardHRatio = 1.1;
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

	let confirmMode = $state<null | 'BONUS' | 'SUPER'>(null);

	const buyMode      = (mode: 'BONUS' | 'SUPER') => {
		// If the machine isn't idle the 'bet' event would be dropped but the mode
		// assignment would stick — every later (auto-)spin would then bet at buy cost.
		if (!context.stateXstateDerived.isIdle()) { props.onclose(); return; }
		stateBet.activeBetModeKey = mode; props.onclose(); context.eventEmitter.broadcast({ type: 'bet' });
	};
	const openConfirm  = (mode: 'BONUS' | 'SUPER') => { confirmMode = mode; };
	const closeConfirm = () => { confirmMode = null; };
	const toggleActivateMode = (toggle: () => void) => { toggle(); props.onclose(); };

	const confirmLabel = $derived(confirmMode === 'SUPER' ? 'MAGNETIC MEGA CHAIN' : 'DROP-O-MAGNET');
	const confirmCost  = $derived(confirmMode === 'SUPER' ? superCost : bonusCost);

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
	<button class="close-btn" type="button" onclick={props.onclose} aria-label="Close"><img class="ctrl-glyph" src={iconClose} alt="" /></button>

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
				onclick={() => toggleActivateMode(props.onToggleFeature)}
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
		<button class="bet-step" type="button" disabled={disableDec} onclick={() => stepBet(-1)} aria-label="Decrease bet"><img class="ctrl-glyph" src={iconMinus} alt="" /></button>
		<div class="bet-center">
			<img class="bet-coin" src={coinIcon} alt="" />
			<div class="bet-value">
				<span class="bet-label">{t('BET')}</span>
				<span class="bet-amount">{betDisplay}</span>
			</div>
		</div>
		<button class="bet-step" type="button" disabled={disableInc} onclick={() => stepBet(1)} aria-label="Increase bet"><img class="ctrl-glyph" src={iconPlus} alt="" /></button>
	</div>
</div>

<!-- Confirm -->
{#if confirmMode}
	<button class="backdrop backdrop--z2" type="button" aria-label="Close" tabindex="-1" onclick={closeConfirm}></button>
	<button class="confirm-close" type="button" onclick={closeConfirm} aria-label="Close"><img class="ctrl-glyph" src={iconClose} alt="" /></button>
	<div class="confirm" role="dialog" aria-modal="true">
		<div class="confirm-panel" style={`background-image:url('${confirmPanelBg}')`}>
			<div class="confirm-content">
				<div class="confirm-title">{tv('CONFIRM TITLE', { name: confirmLabel })}</div>
				<div class="confirm-text">{tv('BUY CONFIRM', { name: confirmLabel, cost: confirmCost })}</div>
				<div class="confirm-row">
					<button class="confirm-btn confirm-btn--cancel" type="button" onclick={closeConfirm}>{t('CANCEL')}</button>
					<button class="confirm-btn confirm-btn--ok" type="button" onclick={() => buyMode(confirmMode!)}>{t('CONFIRM')}</button>
				</div>
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
		font-family: 'Inter', sans-serif;
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
		font-family: 'Cinzel', serif;
		font-weight: 900;
		font-size: 18px;
		line-height: normal;
		letter-spacing: 0.54px;
		text-align: center;
		text-transform: uppercase;
		color: #ffffff;
		text-shadow: 0 2px 10px rgba(0, 0, 0, 0.6);
	}

	/* Blue circular close button, pinned to the top-right of the screen */
	.close-btn {
		position: fixed; top: 22px; right: 22px; z-index: 63;
		width: 48px; height: 48px; border-radius: 50%;
		border: 1.5px solid #60a5fa;
		background: linear-gradient(180deg, #0f2053 0%, #05070f 100%);
		color: #cfe6ff; font-size: 1rem; font-weight: 700;
		cursor: pointer; display: grid; place-items: center;
		box-shadow: 0 0 12px rgba(0, 140, 255, 0.35), 0 4px 12px rgba(0, 0, 0, 0.5);
		transition: filter 0.12s ease;
	}
	.close-btn:hover { filter: brightness(1.25) drop-shadow(0 0 2.5px #0d89c6); }
	/* The ctrl icons are full round buttons (cyan ring + glyph) — let them fill the wrapper and
	   strip the wrapper's own frame so it isn't a button-inside-a-button. */
	.close-btn:has(.ctrl-glyph),
	.confirm-close:has(.ctrl-glyph),
	.bet-step:has(.ctrl-glyph) {
		border: none;
		background: none;
		box-shadow: none;
		padding: 0;
	}
	.ctrl-glyph { width: 100%; height: 100%; object-fit: contain; display: block; }

	/* Four cards in a row — square, kept compact so they don't dominate the screen. */
	.grid {
		display: flex;
		gap: clamp(10px, 1.2vw, 24px);
		justify-content: center;
		align-items: center;
		width: 100%;
		max-width: 1860px;
	}

	/* Card = blue bracketed panel, SQUARE to match the 550×550 (Figma 265×265) panel art.
	   Sized with clamp()/vw (reliable in the scaled game env, unlike cqw). Big Figma-scale fonts +
	   compact gaps keep the content filling the square without overflowing it. */
	.card {
		flex: 1 1 0;
		min-width: 0;
		max-width: 400px;
		aspect-ratio: 1 / 1;
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
	/* Figma: IBM Plex Sans Condensed Bold, cyan→blue gradient (#00fcff → #0046a9), 18px / 0.54px. */
	.card-title {
		flex-shrink: 0;
		font-family: 'IBM Plex Sans Condensed', 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(14px, 1.32vw, 23px);
		letter-spacing: 0.02em;
		white-space: nowrap;
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
		filter: drop-shadow(0 1px 4px rgba(0, 40, 100, 0.55));
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
		font-family: 'Inter', sans-serif;
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
		font-family: 'IBM Plex Sans Condensed', 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(18px, 1.7vw, 30px);
		letter-spacing: 0.03em;
		color: #ffffff;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.65);
		line-height: 1;
	}

	/* Figma: Cinzel Bold, white, "X.XX $". */
	.card-price {
		flex-shrink: 0;
		font-family: 'Cinzel', serif;
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
		font-family: 'Inter', sans-serif;
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
	/* Buy — bright cyan */
	.card-btn--buy {
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
	}
	/* Activate — dark navy */
	.card-btn--activate {
		background: linear-gradient(0deg, #0f2053 0%, #000000 100%);
	}
	/* Active state — cyan to signal it's on */
	.card-btn--active {
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
	}

	/* Bet selector — Figma: cyan-bordered steppers, coin + BET label + big value. */
	.bet {
		display: flex;
		align-items: center;
		justify-content: space-between;
		width: clamp(280px, 27vw, 440px);
		aspect-ratio: 298 / 107;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		padding: 0 3.5%; /* small side padding so − / + sit near the panel ends */
		margin-top: clamp(10px, 2.2vh, 34px); /* nudge the whole bet board down from the cards */
		box-sizing: border-box;
	}
	/* Dark glossy disc with a faint rim (matches the reference — no bright cyan glow ring). */
	.bet-step {
		width: clamp(38px, 3.4vw, 54px);
		height: clamp(38px, 3.4vw, 54px);
		flex-shrink: 0;
		border-radius: 50%;
		border: 1px solid rgba(150, 180, 220, 0.35);
		background: radial-gradient(circle at 50% 32%, #1a2b4d 0%, #0b1428 68%, #060b18 100%);
		color: #d6e0f0;
		font-size: clamp(20px, 1.9vw, 30px); font-weight: 400; line-height: 1;
		display: grid; place-items: center;
		cursor: pointer;
		box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.12), inset 0 -2px 5px rgba(0, 0, 0, 0.55), 0 2px 5px rgba(0, 0, 0, 0.45);
		transition: filter 0.12s ease;
	}
	.bet-step:hover:not(:disabled) { filter: brightness(1.25) drop-shadow(0 0 2.5px #0d89c6); }
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
		font-family: 'Inter', sans-serif;
		font-size: clamp(8px, 0.72vw, 11px); font-weight: 700;
		letter-spacing: 0.2em; text-transform: uppercase;
		color: rgba(96, 165, 250, 0.85);
	}
	.bet-amount {
		font-family: 'Inter', sans-serif;
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
		padding: calc(var(--bb-card) * 0.05) calc(var(--bb-card) * 0.06);
	}
	.panel:not(.portrait) .card-title  { font-size: calc(var(--bb-card) * 0.064); }
	.panel:not(.portrait) .card-desc   { font-size: calc(var(--bb-card) * 0.042); min-height: calc(var(--bb-card) * 0.315); }
	.panel:not(.portrait) .card-icon-slot { height: calc(var(--bb-card) * 0.235); margin-top: calc(var(--bb-card) * 0.025); }
	.panel:not(.portrait) .card-mult   { font-size: calc(var(--bb-card) * 0.075); }
	.panel:not(.portrait) .card-price  { font-size: calc(var(--bb-card) * 0.055); }
	.panel:not(.portrait) .card-btn {
		font-size: calc(var(--bb-card) * 0.053);
		padding: calc(var(--bb-card) * 0.045) calc(var(--bb-card) * 0.1);
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
		font-size: calc(var(--bb-bet-step) * 0.52);
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
		padding: 18px 16px; /* px (not %): % padding mis-resolved and let the description overflow */
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
		font-size: 28px;
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

	/* ---- Confirm dialog (blue) ---- */
	.confirm-close {
		position: fixed; top: 22px; right: 22px; z-index: 73;
		width: 48px; height: 48px; border-radius: 50%;
		border: 1.5px solid #60a5fa;
		background: linear-gradient(180deg, #0f2053 0%, #05070f 100%);
		color: #cfe6ff; font-size: 1rem; font-weight: 700;
		cursor: pointer; display: grid; place-items: center;
		box-shadow: 0 0 12px rgba(0, 140, 255, 0.35), 0 4px 12px rgba(0, 0, 0, 0.5);
		transition: filter 0.12s ease;
	}
	.confirm-close:hover { filter: brightness(1.25) drop-shadow(0 0 2.5px #0d89c6); }

	.confirm {
		position: fixed; left: 50%; top: 50%;
		transform: translate(-50%, -50%);
		z-index: 71;
		width: min(500px, 92vw);
		container-type: inline-size;
		font-family: 'Inter', sans-serif;
	}
	.confirm-panel {
		aspect-ratio: 500 / 300;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		display: flex; align-items: center; justify-content: center;
		padding: 13% 13% 14%;
		box-sizing: border-box;
	}
	.confirm-content {
		width: 100%; height: 100%;
		display: flex; flex-direction: column; align-items: center;
		justify-content: space-between; text-align: center;
	}
	.confirm-title {
		font-family: 'Cinzel', serif;
		font-weight: 900; font-size: 4.8cqw;
		letter-spacing: 0.03em; text-transform: uppercase;
		line-height: 1; white-space: nowrap;
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
		filter: drop-shadow(0 2px 8px rgba(0, 60, 140, 0.55));
	}
	.confirm-text {
		font-family: 'Inter', sans-serif;
		font-size: 4cqw; font-weight: 500;
		letter-spacing: 0.03em; text-transform: uppercase;
		color: #fff; line-height: 1.3;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.7);
	}
	.confirm-row { display: flex; gap: 3.2cqw; justify-content: center; }
	.confirm-btn {
		border: 1px solid #60a5fa;
		border-radius: 2.4cqw;
		padding: 2.4cqw 4.8cqw; min-width: 28cqw;
		font-family: 'Inter', sans-serif; font-size: 2.8cqw; font-weight: 700;
		letter-spacing: 0.1em; text-transform: uppercase; color: #fff;
		cursor: pointer;
		filter: drop-shadow(0 4px 2px rgba(0, 0, 0, 0.25));
		transition: filter 0.12s ease;
	}
	.confirm-btn:hover { filter: brightness(1.12) drop-shadow(0 0 6px #4a94ff); }
	.confirm-btn--cancel {
		background: linear-gradient(0deg, #0f2053 0%, #000000 100%);
	}
	.confirm-btn--ok {
		background: linear-gradient(180deg, #00fcff 0%, #0046a9 100%);
	}
</style>
