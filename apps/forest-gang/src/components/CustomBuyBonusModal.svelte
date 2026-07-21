<script lang="ts">
	import { onMount } from 'svelte';
	import { stateBet, stateBetDerived, stateConfig } from 'state-shared';
	import { getContext } from '../game/context';
	import { forestStakeDerived } from '../state/forestStake.svelte';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitLabel } from '../lib/fitLabel';

	const ap = (p: string) => `./${p.startsWith('/') ? p.slice(1) : p}`;
	const cardBg       = ap('/assets/components/ui/bonus_card_bg.png');
	const chanceIcon   = ap('/assets/components/ui/bonus_icon_chance.png');
	const featureIcon  = ap('/assets/components/ui/bonus_icon_feature.png');
	const allInIcon    = ap('/assets/components/ui/bonus_icon_allin.png');   // 3 coins
	const dealItIcon   = ap('/assets/components/ui/bonus_icon_dealit.png');  // 4 coins
	// Bet readout + steppers reuse the navigation icons / round frame
	const iconCoins    = ap('/assets/hud/icon-coins.png');
	const iconMinus    = ap('/assets/hud/icon-minus.png');
	const iconPlus     = ap('/assets/hud/icon-plus.png');
	const btnRoundBg   = ap('/assets/components/navbar/btn_bg_round.png');
	const betBoxMobile = ap('/assets/components/navbar/bet_box_mobile.png'); // wooden bet-box bg (portrait)
	const confirmPanelBg = ap('/assets/components/ui/confirm_frame.webp?v=20260624');
	// Reuse the game-rules ("tutorials") round nav-button ring for the close button so they match.
	const closeBtnBg = ap('/assets/components/info/nav_btn_bg.webp');

	type Props = {
		onclose: () => void;
		isChanceActive: boolean;
		isFeatureActive: boolean;
		onToggleChance: () => void;
		onToggleFeature: () => void;
	};

	const props: Props = $props();
	const context = getContext();
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isPortrait = $derived(layoutType === 'portrait');
	// Short-height row layouts (mobile landscape / tablet) need tighter card packing so the longest
	// descriptions fit; desktop has room to spare and keeps the roomier original spacing.
	const isCompactRow = $derived(layoutType === 'landscape' || layoutType === 'tablet');

	// Compact one-row mode (Stake popup S, landscape phones): instead of guessing device sizes with
	// media-query breakpoints, measure whether the REGULAR layout fits. A regular card is a square
	// sized by the panel width ((panel − padding − 3 gaps) / 4); the title, bet bar and card text
	// need ~200px on top of that. Shorter than that → compact (4:5 cards, slim title/bet bar).
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	const isCompactShort = $derived.by(() => {
		if (isPortrait) return false;
		const panelWidth = Math.min(1120, canvas.width * 0.97);
		const cardSize = (panelWidth - 32 - 48) / 4;
		return canvas.height < cardSize + 210;
	});

	// Cost multipliers match config.betModes: CHANCE 2×, FEATURE 20×, BONUS 100×, SUPER 400×.
	// "DEAL IT" is the 100× (BONUS) mode, "ALL IN" the 400× (SUPER) mode.
	const betAmount   = $derived(stateBet.betAmount);
	const chanceCost  = $derived(forestStakeDerived.formatCurrencyAmount(betAmount * 2));
	const featureCost = $derived(forestStakeDerived.formatCurrencyAmount(betAmount * 20));
	const allInCost   = $derived(forestStakeDerived.formatCurrencyAmount(betAmount * 100));
	const dealItCost  = $derived(forestStakeDerived.formatCurrencyAmount(betAmount * 400));
	const formattedBet = $derived(forestStakeDerived.formatCurrencyAmount(betAmount));

	// Per-mode affordability: each button must check ITS OWN cost (bet × mode multiplier) against the
	// balance, and re-check whenever the bet changes — a single base-cost check let unaffordable
	// higher-cost buys/activations stay enabled after raising the bet.
	const canAfford = (multiplier: number) => stateBet.balanceAmount >= betAmount * multiplier;
	const canChance  = $derived(canAfford(2));
	const canFeature = $derived(canAfford(20));
	const canAllIn   = $derived(canAfford(100)); // BONUS
	const canDealIt  = $derived(canAfford(400)); // SUPER

	// Bet stepper (mirrors the HUD): changing the bet rescales the bonus costs.
	const betOptions = $derived(stateConfig.betAmountOptions);
	const currentBetIndex = $derived(Math.max(0, betOptions.indexOf(stateBet.betAmount)));
	const canDec = $derived(currentBetIndex > 0);
	const canInc = $derived(currentBetIndex < betOptions.length - 1);
	const stepBet = (dir: -1 | 1) => {
		const next = betOptions[Math.min(betOptions.length - 1, Math.max(0, currentBetIndex + dir))];
		if (typeof next !== 'number' || next === stateBet.betAmount) return;
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateBetDerived.setBetAmount(next);
	};

	let confirmMode = $state<null | 'BONUS' | 'SUPER' | 'FEATURE'>(null);

	const buyMode      = (mode: 'BONUS' | 'SUPER') => { stateBet.activeBetModeKey = mode; props.onclose(); context.eventEmitter.broadcast({ type: 'bet' }); };
	const openConfirm  = (mode: 'BONUS' | 'SUPER' | 'FEATURE') => { confirmMode = mode; };
	const closeConfirm = () => { confirmMode = null; };
	const toggleActivateMode = (toggle: () => void) => { toggle(); props.onclose(); };

	// BONUS → DEAL IT (100×), SUPER → ALL IN (400×)
	const confirmLabel = $derived(
		confirmMode === 'SUPER'
			? i18nDerived.allIn()
			: confirmMode === 'FEATURE'
				? i18nDerived.translate('CARD FEATURE TITLE')
				: i18nDerived.dealIt(),
	);
	const confirmCost  = $derived(
		confirmMode === 'SUPER' ? dealItCost : confirmMode === 'FEATURE' ? featureCost : allInCost,
	);
	// Compliance: any mode costing more than 2x base must be confirmed before activation —
	// Feature Spins (20x) goes through the same confirm dialog as the buy bonuses. Confirming
	// FEATURE toggles the mode on; deactivation stays single-click (it costs nothing).
	const confirmAccept = () => {
		if (confirmMode === 'FEATURE') {
			confirmMode = null;
			toggleActivateMode(props.onToggleFeature);
			return;
		}
		buyMode(confirmMode!);
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
<div class="panel" class:panel--portrait={isPortrait} class:panel--compact={isCompactShort} role="dialog" aria-modal="true">

	<button class="close-btn" type="button" style={`background-image:url('${closeBtnBg}')`} aria-label="Close" onclick={props.onclose}><span class="close-btn__x">✕</span></button>

	<h2 class="title">{i18nDerived.buyBonus()}</h2>

	<div class="grid" class:grid--portrait={isPortrait} class:grid--compact={isCompactRow}>

		<!-- EXTRA CHANCE — CHANCE mode (2×), toggle -->
		<div class="card" style="--frame:url('{cardBg}')">
			<div class="card-inner">
				<span class="card-title card-title--chance">{i18nDerived.translate('CARD CHANCE TITLE')}</span>
				<span class="card-desc">{i18nDerived.translate('CARD CHANCE DESC')}</span>
				<div class="card-icon-wrap"><img class="card-icon" src={chanceIcon} alt="" /></div>
				<span class="card-price">{chanceCost}</span>
				<button
					class="card-btn card-btn--activate"
					class:card-btn--active={props.isChanceActive}
					type="button"
					disabled={!props.isChanceActive && !canChance}
					onclick={() => toggleActivateMode(props.onToggleChance)}
				><span class="btn-label" use:fitLabel={props.isChanceActive ? i18nDerived.deactivate() : i18nDerived.activate()}>{props.isChanceActive ? i18nDerived.deactivate() : i18nDerived.activate()}</span></button>
			</div>
		</div>

		<!-- FEATURE SPINS — FEATURE mode (20×), toggle -->
		<div class="card" style="--frame:url('{cardBg}')">
			<div class="card-inner">
				<span class="card-title card-title--feature">{i18nDerived.translate('CARD FEATURE TITLE')}</span>
				<span class="card-desc">{i18nDerived.translate('CARD FEATURE DESC')}</span>
				<div class="card-icon-wrap"><img class="card-icon" src={featureIcon} alt="" /></div>
				<span class="card-price">{featureCost}</span>
				<button
					class="card-btn card-btn--activate"
					class:card-btn--active={props.isFeatureActive}
					type="button"
					disabled={!props.isFeatureActive && !canFeature}
					onclick={() =>
						props.isFeatureActive
							? toggleActivateMode(props.onToggleFeature)
							: openConfirm('FEATURE')}
				><span class="btn-label" use:fitLabel={props.isFeatureActive ? i18nDerived.deactivate() : i18nDerived.activate()}>{props.isFeatureActive ? i18nDerived.deactivate() : i18nDerived.activate()}</span></button>
			</div>
		</div>

		<!-- DEAL IT — BONUS mode (100×). Titles/descs are swapped vs the old layout: DEAL IT is the
		     cheaper 100× bonus, ALL IN the 400× one. Prices/icons/modes stay put. -->
		<div class="card" style="--frame:url('{cardBg}')">
			<div class="card-inner">
				<span class="card-title card-title--gold">{i18nDerived.dealIt()}</span>
				<span class="card-desc">{i18nDerived.translate('CARD DEALIT DESC')}</span>
				<div class="card-icon-wrap"><img class="card-icon" src={allInIcon} alt="" /></div>
				<span class="card-price">{allInCost}</span>
				<button class="card-btn card-btn--buy" type="button" disabled={!canAllIn} onclick={() => openConfirm('BONUS')}><span class="btn-label" use:fitLabel={i18nDerived.buy()}>{i18nDerived.buy()}</span></button>
			</div>
		</div>

		<!-- ALL IN — SUPER mode (400×) -->
		<div class="card" style="--frame:url('{cardBg}')">
			<div class="card-inner">
				<span class="card-title card-title--gold">{i18nDerived.allIn()}</span>
				<span class="card-desc">{i18nDerived.translate('CARD ALLIN DESC')}</span>
				<div class="card-icon-wrap"><img class="card-icon" src={dealItIcon} alt="" /></div>
				<span class="card-price">{dealItCost}</span>
				<button class="card-btn card-btn--buy" type="button" disabled={!canDealIt} onclick={() => openConfirm('SUPER')}><span class="btn-label" use:fitLabel={i18nDerived.buy()}>{i18nDerived.buy()}</span></button>
			</div>
		</div>

	</div>

	<!-- Bet readout + steppers -->
	{#if isPortrait}
		<!-- Portrait: fixed footer — a wooden bet box holding [−] [coins · BET · amount] [+] -->
		<div class="bet-bar bet-bar--portrait">
			<div class="bet-box" style="--betbox:url('{betBoxMobile}')">
				<button class="step-btn" style="--round:url('{btnRoundBg}')" type="button" disabled={!canDec} onclick={() => stepBet(-1)} aria-label="Decrease bet">
					<img src={iconMinus} alt="" />
				</button>
				<div class="bet-pill">
					<img class="bet-coin" src={iconCoins} alt="" />
					<div class="bet-cell">
						<span class="bet-label">{i18nDerived.betLabel()}</span>
						<span class="bet-amount">{formattedBet}</span>
					</div>
				</div>
				<button class="step-btn" style="--round:url('{btnRoundBg}')" type="button" disabled={!canInc} onclick={() => stepBet(1)} aria-label="Increase bet">
					<img src={iconPlus} alt="" />
				</button>
			</div>
		</div>
	{:else}
		<!-- Desktop: coins · amount · − · + -->
		<div class="bet-bar">
			<img class="bet-coin" src={iconCoins} alt="" />
			<div class="bet-cell">
				<span class="bet-label">{i18nDerived.betLabel()}</span>
				<span class="bet-amount">{formattedBet}</span>
			</div>
			<button class="step-btn" style="--round:url('{btnRoundBg}')" type="button" disabled={!canDec} onclick={() => stepBet(-1)} aria-label="Decrease bet">
				<img src={iconMinus} alt="" />
			</button>
			<button class="step-btn" style="--round:url('{btnRoundBg}')" type="button" disabled={!canInc} onclick={() => stepBet(1)} aria-label="Increase bet">
				<img src={iconPlus} alt="" />
			</button>
		</div>
	{/if}
</div>

<!-- Confirm -->
{#if confirmMode}
	<button class="backdrop backdrop--z2" type="button" aria-label="Close" tabindex="-1" onclick={closeConfirm}></button>
	<button class="confirm-close" type="button" onclick={closeConfirm} aria-label="Close">✕</button>
	<div class="confirm" role="dialog" aria-modal="true">
		<div class="confirm-panel" style={`background-image:url('${confirmPanelBg}')`}>
			<div class="confirm-content">
				<div class="confirm-title">{i18nDerived.confirm()} {confirmLabel}</div>
				<div class="confirm-text">{i18nDerived.translateVars('CONFIRM TEXT', { mode: confirmLabel, cost: confirmCost })}</div>
				<div class="confirm-row">
					<button class="confirm-btn confirm-btn--cancel" type="button" onclick={closeConfirm}>{i18nDerived.cancel()}</button>
					<button class="confirm-btn confirm-btn--ok" type="button" onclick={confirmAccept}>{i18nDerived.confirm()}</button>
				</div>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Backdrops */
	.backdrop {
		position: fixed; inset: 0; z-index: 60;
		background: rgba(0,0,0,0.7);
		backdrop-filter: blur(4px);
		border: 0; padding: 0; cursor: pointer;
	}
	.backdrop--z2 { z-index: 70; }

	/* Panel */
	.panel {
		position: fixed; left: 50%; top: 50%;
		transform: translate(-50%, -50%);
		z-index: 61;
		width: min(1120px, 97vw);
		padding: 26px 16px 20px;
	}

	.title {
		margin: 0 0 14px;
		font-family: 'Cinzel', serif; font-size: 1.35rem; font-weight: 900; letter-spacing: 0.12em;
		text-align: center; color: #fff;
		text-shadow: 0 2px 6px rgba(0,0,0,0.6);
	}

	.close-btn {
		position: absolute; top: 6px; right: 10px;
		/* Same round ring asset + gold ✕ as the game-rules ("tutorials") close button, at the same
		   footprint (~40px) — the old CSS disc read too big/heavy. */
		width: 40px; height: 40px;
		border: none; padding: 0;
		background-color: transparent;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		display: flex; align-items: center; justify-content: center;
		cursor: pointer;
		transition: transform 0.12s ease;
	}
	.close-btn:hover { transform: scale(1.06); }
	.close-btn__x {
		font-family: 'Cinzel', serif; font-weight: 900; font-size: 1rem; line-height: 1;
		background-image: linear-gradient(180deg, #ffa90e 15%, #ee960b 70%, #d18005 93%);
		background-clip: text; -webkit-background-clip: text; color: transparent;
	}

	/* One row of 4 cards with gaps between them (Figma node 2349-2074).
	   align-items: center, NOT stretch — stretch overrides the cards' square aspect-ratio when the
	   host constrains the row height (seen in the Stake popup) and squashes the frames flat. */
	.grid {
		display: flex; justify-content: center; align-items: center;
		gap: 16px;
		width: 100%;
	}

	/* Card — wooden+leaf frame as a full background image (keeps the leaves intact).
	   container-type makes card width the sizing basis for its content (cqw units below),
	   so text/icon/price scale down on small landscape-mobile cards instead of overflowing. */
	.card {
		flex: 1 1 0; min-width: 0;
		aspect-ratio: 1 / 1;
		background: var(--frame) center / 100% 100% no-repeat;
		box-sizing: border-box;
		display: flex; align-items: center; justify-content: center;
		container-type: inline-size;
	}

	/* Content sits inside the wooden interior, clear of the leaf corners */
	.card-inner {
		width: 70%;
		height: 100%;
		padding: 12% 0 15%;
		box-sizing: border-box;
		display: flex; flex-direction: column; align-items: center;
		text-align: center;
		gap: clamp(2px, 1.6cqw, 5px);
	}

	/* Compact row (mobile landscape / tablet): wider content, tighter gap so long text fits */
	.grid--compact { gap: 10px; }
	.grid--compact .card-inner { width: 76%; padding: 13% 0 15%; }

	.card-title {
		font-family: 'Cinzel', serif; font-size: clamp(11px, 6.5cqw, 18px); line-height: 1.05;
		letter-spacing: 0.03em; display: block;
	}
	.card-title--chance {
		font-weight: 700; color: #aac732;
	}
	.card-title--feature {
		font-weight: 900;
		background: linear-gradient(182deg, #cf53f6 21%, #d561fa 41%, #bd39e7 62%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
	}
	.card-title--gold {
		font-weight: 900;
		background: linear-gradient(180deg, #ffa90e 15%, #ee960b 70%, #d18005 93%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
	}

	.card-desc {
		font-family: 'Poppins', sans-serif; font-size: clamp(8px, 4.6cqw, 12px); font-weight: 400;
		color: #d7d7d7; letter-spacing: 0.03em;
		/* Figma spec: line-height 100% with leading-trim NONE → the font's
		   natural leading is kept (≈1.5 for Poppins), not a trimmed 12px box. */
		line-height: normal; text-align: center;
		/* Absorb the slack so icon/price/button align across every card,
		   regardless of how many lines the description wraps to. */
		flex: 1 1 0; min-height: 0;
	}

	.card-icon-wrap {
		height: clamp(22px, 15cqw, 40px);
		display: flex; align-items: center; justify-content: center;
		flex-shrink: 0;
	}
	.card-icon {
		max-height: 100%; max-width: 100%;
		width: auto; height: auto;
		object-fit: contain;
		filter: drop-shadow(0 2px 5px rgba(0,0,0,0.55));
		/* Static — no swing (per design). */
	}
	@keyframes card-icon-swing {
		0% { transform: rotate(0deg); }
		25% { transform: rotate(6deg); }
		50% { transform: rotate(0deg); }
		75% { transform: rotate(-6deg); }
		100% { transform: rotate(0deg); }
	}

	.card-price {
		font-family: 'Cinzel', serif; font-size: clamp(9px, 5cqw, 14px); font-weight: 700;
		color: #fff; letter-spacing: 0.03em;
		display: block;
		flex-shrink: 0;
	}

	/* Card buttons */
	.card-btn {
		width: 82%; padding: clamp(3px, 1.4cqw, 5px) 0;
		font-family: 'Cinzel', serif; font-size: clamp(7px, 3.9cqw, 11px); font-weight: 700;
		letter-spacing: 0.04em; cursor: pointer;
		transition: filter 0.15s ease;
		margin-top: clamp(2px, 1.4cqw, 5px);
	}
	.card-btn:hover:not(:disabled) { filter: brightness(1.12); }
	.card-btn:disabled { opacity: 0.45; cursor: default; }

	/* ACTIVATE — dark plate, gold outline, gold-gradient text */
	.card-btn--activate {
		background: #241005;
		border: 1px solid #ffa90e;
		border-radius: 11px;
		filter: drop-shadow(0 0 2px #d98503);
	}
	.card-btn--activate .btn-label {
		background: linear-gradient(181deg, #ffa90e 15%, #ee960b 70%, #d18005 93%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
	}
	.card-btn--active {
		box-shadow: 0 0 10px rgba(255,169,14,0.45);
	}

	/* BUY — gold gradient plate, dark text */
	.card-btn--buy {
		border: 0;
		border-radius: 9px;
		background: linear-gradient(181deg, #ffa90e 15%, #ee960b 70%, #d18005 93%);
		filter: drop-shadow(0 0 2px #d98503);
	}
	.card-btn--buy .btn-label { color: #452b01; font-weight: 900; }

	/* Bottom bet bar: coins · BET amount · − · + */
	.bet-bar {
		margin: 16px auto 0;
		display: flex; align-items: center; justify-content: center;
		gap: 10px;
	}
	.bet-coin { width: 30px; height: 38px; object-fit: contain; flex-shrink: 0; }
	.bet-cell { display: flex; flex-direction: column; align-items: flex-start; min-width: 60px; }
	.bet-label {
		font-family: 'Poppins', sans-serif; font-weight: 500; font-size: 12px;
		letter-spacing: 0.04em;
		background: linear-gradient(181deg, #e2d981 8.6%, #fbc503 60%, #d98503 129%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
	}
	.bet-amount {
		font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 15px; color: #fff;
		letter-spacing: 0.02em;
	}
	.step-btn {
		width: 56px; height: 56px;
		background: var(--round) center / contain no-repeat;
		border: 0; padding: 0; cursor: pointer;
		display: grid; place-items: center;
		transition: filter 0.12s ease, transform 0.12s ease;
	}
	.step-btn:hover:not(:disabled) { filter: brightness(1.12); transform: translateY(-1px); }
	.step-btn:active:not(:disabled) { transform: translateY(1px) scale(0.95); }
	.step-btn:disabled { opacity: 0.45; cursor: default; }
	.step-btn img { width: 44%; height: 44%; object-fit: contain; }

	/* Confirm */
	.confirm-close {
		position: fixed; top: 22px; right: 22px; z-index: 73;
		width: 52px; height: 52px; border-radius: 50%;
		border: 2px solid rgba(217, 133, 3, 0.7);
		background: radial-gradient(circle at 50% 35%, #3a2a16, #140d06);
		color: #e8c878; font-size: 1.1rem; font-weight: 700;
		cursor: pointer; display: grid; place-items: center;
		box-shadow: 0 4px 12px rgba(0,0,0,0.5);
		transition: filter 0.12s ease;
	}
	.confirm-close:hover { filter: brightness(1.2); }

	.confirm {
		position: fixed; left: 50%; top: 50%;
		transform: translate(-50%, -50%);
		z-index: 71;
		width: min(680px, 94vw);
		font-family: 'Cinzel', serif;
	}

	.confirm-panel {
		aspect-ratio: 505 / 301;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		display: flex; align-items: center; justify-content: center;
		padding: 15% 13%;
		box-sizing: border-box;
	}

	.confirm-content {
		width: 100%;
		display: flex; flex-direction: column; align-items: center;
		gap: clamp(14px, 2.6vw, 26px);
		text-align: center;
	}

	.confirm-title {
		font-weight: 900; font-size: clamp(1.4rem, 3.2vw, 2.1rem);
		letter-spacing: 0.06em;
		background: linear-gradient(180deg, #ffd84a 10%, #ffa90e 60%, #d18005 95%);
		-webkit-background-clip: text; background-clip: text;
		-webkit-text-fill-color: transparent; color: transparent;
		text-shadow: 0 2px 6px rgba(0,0,0,0.5);
	}
	.confirm-text {
		font-size: clamp(0.95rem, 2vw, 1.25rem); font-weight: 700;
		color: #fff; line-height: 1.45;
		text-shadow: 0 2px 4px rgba(0,0,0,0.7);
	}
	.confirm-row { display: flex; gap: 16px; justify-content: center; width: 100%; }
	.confirm-btn {
		flex: 1 1 0; border-radius: 11px; padding: clamp(11px, 2vw, 16px);
		font-family: 'Cinzel', serif; font-size: clamp(0.85rem, 1.7vw, 1.05rem); font-weight: 900;
		letter-spacing: 0.06em; cursor: pointer;
		transition: filter 0.12s ease;
	}
	.confirm-btn:hover { filter: brightness(1.08); }
	.confirm-btn--cancel {
		border: 1px solid rgba(217,133,3,0.5);
		background: rgba(20, 14, 6, 0.6); color: #e8c878;
	}
	.confirm-btn--ok {
		border: 0;
		background: linear-gradient(180deg, #ffa90e 15%, #ee960b 70%, #d18005 93%);
		color: #452b01;
		box-shadow: 0 0 4px #d98503;
	}

	/* Compact one-row mode — applied via the MEASURED isCompactShort flag (Stake popup S, landscape
	   phones), never a guessed media breakpoint: all four cards stay visible in one row with a slim
	   title and bet bar. Viewports where the regular layout fits (Stake popup L, desktop) never get
	   this class. */
	.panel--compact {
		height: 96dvh;
		max-height: 96dvh;
		/* Nearly the full viewport width so the four cards get as wide as possible. */
		width: calc(100vw - 8px);
		display: flex;
		flex-direction: column;
		padding: 4px 8px 6px;
		box-sizing: border-box;
	}
	/* Slim header/footer so the cards get as much height as possible. */
	.panel--compact .title {
		flex: 0 0 auto;
		margin-bottom: 3px;
		font-size: 0.6rem;
	}
	.panel--compact .close-btn {
		width: 32px;
		height: 32px;
		top: 5px;
		right: 8px;
	}
	.panel--compact .grid {
		flex: 1 1 auto;
		min-height: 0;
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		grid-template-rows: minmax(0, 1fr);
		align-items: center;
		justify-items: center;
		gap: 6px;
	}
	.panel--compact .grid .card {
		/* Figma popup-S spec (2712-9693): cards slightly taller than wide, filling the row.
		   Width-driven with a max-height cap: when the cap bites, the width follows the
		   aspect-ratio back down, so the frame art never stretches. */
		width: 100%;
		height: auto;
		max-height: 100%;
		aspect-ratio: 4 / 5;
	}
	/* A too-long description clips inside its slot instead of piling onto the price/button. */
	.panel--compact .grid .card-desc {
		overflow: hidden;
	}
	/* Tiny popups (Stake popup S ≈ 434×294): the cards are only ~95px wide but there is spare
	   vertical room — stretch them taller (2:3) and drop the decorative icon so the FULL
	   description text fits (it's the informative part). Fixed small font sizes: the cqw clamps
	   were tuned for larger cards. Wider compact viewports (landscape phones ≥ 640px) keep the
	   Figma 4:5 cards with icons. */
	@media (max-width: 640px) {
		.panel--compact .grid .card {
			aspect-ratio: 3 / 5;
		}
		.panel--compact .grid .card-inner {
			width: 75%;
			/* Bigger bottom padding lifts the ACTIVATE/BUY buttons off the corner leaves. */
			padding: 16% 0 14%;
			gap: 5px;
		}
		.panel--compact .grid .card-icon-wrap {
			height: 14px;
		}
		.panel--compact .grid .card-title {
			font-size: 8px;
			padding: 2px;
		}
		.panel--compact .grid .card-desc {
			font-size: 6px;
			line-height: 1.2;
			padding: 1px;
		}
		.panel--compact .grid .card-price {
			font-size: 8px;
		}
		.panel--compact .grid .card-btn {
			width: 65%;
			font-size: 7px;
			padding: 1px 0;
			margin-bottom: 4px;
		}
		.panel--compact .close-btn {
			width: 28px;
			height: 28px;
			top: 4px;
			right: 6px;
		}
		.panel--compact .close-btn__x {
			font-size: 0.8rem;
		}
	}
	/* Compact bet row: smaller coin, labels and − / + buttons (they were HUD-sized). */
	.panel--compact .bet-bar {
		flex: 0 0 auto;
		margin-top: 3px;
		gap: 8px;
	}
	.panel--compact .bet-bar .step-btn {
		width: 26px;
		height: 26px;
	}
	.panel--compact .bet-bar .bet-coin {
		width: 18px;
		height: 23px;
	}
	.panel--compact .bet-bar .bet-label {
		font-size: 8px;
	}
	.panel--compact .bet-bar .bet-amount {
		font-size: 9px;
	}

	/* ==================== Portrait: full-screen scrollable card list (Figma 2483-2681) ==================== */
	/* Fixed header (title + ×), vertically scrollable stack of the 4 cards, fixed bottom bet bar. */
	.panel--portrait {
		position: fixed; inset: 0;
		transform: none;
		width: 100%; height: 100dvh; max-width: none;
		padding: 0;
		display: flex; flex-direction: column;
		background: rgba(4, 7, 4, 0.3);
	}
	.panel--portrait .title {
		margin: 0;
		padding: 16px 0 8px;
		flex: 0 0 auto;
		font-size: 1.2rem;
	}
	.panel--portrait .close-btn { top: 12px; right: 14px; z-index: 2; }

	.grid--portrait {
		flex: 1 1 auto; min-height: 0;
		flex-direction: column;
		align-items: center;
		justify-content: flex-start; /* override base center — else first card overflows above, unreachable */
		gap: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
		width: 100%;
		padding: 2px 18px 10px;
		box-sizing: border-box;
	}
	.grid--portrait .card {
		flex: 0 0 auto;
		width: 100%;
		max-width: 340px;
	}
	.grid--portrait .card:not(:first-child) { margin-top: -3%; } /* slight leaf overlap (Figma) */

	.bet-bar--portrait {
		flex: 0 0 auto;
		margin: 0;
		width: 100%;
		box-sizing: border-box;
		display: flex; align-items: center; justify-content: center;
		padding: 10px 18px calc(14px + env(safe-area-inset-bottom, 0px));
		background: linear-gradient(to top, rgba(6, 9, 5, 0.98), rgba(6, 9, 5, 0.92) 60%, rgba(6, 9, 5, 0));
	}
	/* Wooden bet box holding the − / + buttons + coins·BET·amount inside */
	.bet-box {
		width: min(324px, 90vw);
		aspect-ratio: 252 / 51;
		background: var(--betbox) center / 100% 100% no-repeat;
		display: flex; align-items: center; justify-content: space-between;
		padding: 0 3.5%;
		box-sizing: border-box;
	}
	.bet-box .step-btn {
		width: 44px; height: 44px;
		flex: 0 0 auto;
	}
	.bet-box .bet-pill {
		flex: 1 1 0; min-width: 0;
		display: flex; align-items: center; justify-content: center; gap: 8px;
	}
</style>
