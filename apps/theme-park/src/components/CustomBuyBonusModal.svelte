<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const modeAsset = (icon: string, variant: 'desktop' | 'mobile' | 'mobile-landscape') =>
		ap(`/assets/theme-park/v2/modes/${icon}-${variant}.png`);
	// Neon gradient frame (download "S pad") — the glowing card border from the design.
	const neonFrame = ap('/assets/theme-park/v2/hud/neon-frame.png');
	// Circular neon +/- buttons — same art the main HUD bet stepper uses.
	const betMinus = ap('/assets/theme-park/v2/controls/btn-minus.png');
	const betMinusDisabled = ap('/assets/theme-park/v2/controls/btn-minus-disabled.png');
	const betPlus = ap('/assets/theme-park/v2/controls/btn-plus.png');
	const betPlusDisabled = ap('/assets/theme-park/v2/controls/btn-plus-disabled.png');
	// Money coin — same glyph the main HUD shows beside the bet amount.
	const coinIcon = ap('/assets/theme-park/v2/hud/icon_coin.svg');

	for (const icon of ['duck-your-luck', 'roller-wilds', 'mega-coaster']) {
		for (const variant of ['desktop', 'mobile', 'mobile-landscape'] as const) modeAsset(icon, variant);
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { stateBet, stateBetDerived, stateConfig } from 'state-shared';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { templateStakeDerived } from '../state/templateStake.svelte';
	import PopupFrame from './PopupFrame.svelte';
	import PopupCloseButton from './PopupCloseButton.svelte';
	import type { BetMode } from '../game/types';

	type ToggleMode = Extract<BetMode, 'ANTE' | 'FSPIN1' | 'FSPIN2'>;
	type BuyMode = Extract<BetMode, 'DUCK' | 'ROLLER' | 'COASTER'>;
	type ConfirmMode = ToggleMode | BuyMode;

	type Props = {
		onclose: () => void;
		activeToggleMode: ToggleMode | null;
		onToggleMode: (mode: ToggleMode) => void;
	};

	const props: Props = $props();
	const context = getContext();
	const t = (key: string) => i18nDerived.translate(key);
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	const betAmount = $derived(stateBet.betAmount);
	const canAfford = (multiplier: number) => stateBet.balanceAmount >= betAmount * multiplier;

	// Bet +/- stepper (mirrors the main HUD) so the player can retune the stake — and every card's
	// price — without leaving the buy screen.
	const betOptions = $derived(stateConfig.betAmountOptions);
	const smallestBet = $derived(betOptions[0]);
	const biggestBet = $derived(betOptions[betOptions.length - 1]);
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
	const disableDecrease = $derived(stateBet.betAmount === smallestBet);
	const disableIncrease = $derived(stateBet.betAmount === biggestBet);
	const formattedBet = $derived(templateStakeDerived.formatCurrencyAmount(betAmount));
	const stepBet = (direction: -1 | 1) => {
		if (direction < 0 && disableDecrease) return;
		if (direction > 0 && disableIncrease) return;
		const nextIndex = Math.min(betOptions.length - 1, Math.max(0, currentBetIndex + direction));
		const nextBet = betOptions[nextIndex];
		if (typeof nextBet !== 'number' || nextBet === stateBet.betAmount) return;
		stateBetDerived.setBetAmount(nextBet);
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
	};

	const FEATURE_CARDS: {
		mode: Exclude<ToggleMode, 'ANTE'>;
		costMultiplier: number;
		title: string;
		desc: string;
	}[] = [
		{
			mode: 'FSPIN1',
			costMultiplier: 20,
			title: 'BET MODE FSPIN1 TITLE',
			desc: 'BET MODE FSPIN1 DIALOG',
		},
		{
			mode: 'FSPIN2',
			costMultiplier: 60,
			title: 'BET MODE FSPIN2 TITLE',
			desc: 'BET MODE FSPIN2 DIALOG',
		},
	];

	const BUY_CARDS: {
		mode: BuyMode;
		costMultiplier: number;
		title: string;
		desc: string;
		icon: string;
	}[] = [
		{
			mode: 'DUCK',
			costMultiplier: 100,
			title: 'BET MODE DUCK TITLE',
			desc: 'BET MODE DUCK DIALOG',
			icon: 'duck-your-luck',
		},
		{
			mode: 'ROLLER',
			costMultiplier: 200,
			title: 'BET MODE ROLLER TITLE',
			desc: 'BET MODE ROLLER DIALOG',
			icon: 'roller-wilds',
		},
		{
			mode: 'COASTER',
			costMultiplier: 500,
			title: 'BET MODE COASTER TITLE',
			desc: 'BET MODE COASTER DIALOG',
			icon: 'mega-coaster',
		},
	];

	const cost = (multiplier: number) =>
		templateStakeDerived.formatCurrencyAmount(betAmount * multiplier);

	let confirmMode = $state<null | ConfirmMode>(null);
	const confirmCard = $derived(
		confirmMode === 'ANTE'
			? { mode: 'ANTE' as const, costMultiplier: 3, title: 'BET MODE ANTE TITLE' }
			: FEATURE_CARDS.find((card) => card.mode === confirmMode) ??
				BUY_CARDS.find((card) => card.mode === confirmMode) ??
				null,
	);

	const buyMode = (mode: BuyMode) => {
		const card = BUY_CARDS.find((item) => item.mode === mode);
		if (!card || !canAfford(card.costMultiplier) || !context.stateXstateDerived.isIdle()) {
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
	const toggleMode = (mode: ToggleMode) => {
		props.onToggleMode(mode);
		props.onclose();
	};
	const requestToggle = (mode: ToggleMode, multiplier: number) => {
		if (props.activeToggleMode === mode) {
			toggleMode(mode);
			return;
		}
		if (!canAfford(multiplier)) return;
		openConfirm(mode);
	};
	const confirmAccept = () => {
		const mode = confirmMode;
		if (!mode) return;
		if (mode === 'ANTE' || mode === 'FSPIN1' || mode === 'FSPIN2') {
			toggleMode(mode);
			return;
		}
		buyMode(mode);
	};

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
<button class="backdrop" type="button" aria-label={t('CLOSE')} tabindex="-1" onclick={props.onclose}
></button>

<!-- Screen-corner close, matching every other popup. Hidden while the confirm dialog is up, which
     brings its own in the same spot. -->
{#if !confirmMode}
	<PopupCloseButton onclick={props.onclose} label={t('CLOSE')} />
{/if}

<!-- Panel -->
<div
	class="panel"
	class:is-portrait={isPortrait}
	role="dialog"
	aria-modal="true"
	style={`--neon-frame:url('${neonFrame}')`}
>
	<h2 class="title">{t('BUY BONUS')}</h2>

	<div class="grid">
		<!-- Persistent per-spin toggles -->
		<div class="card">
			<span class="card-title">{t('BET MODE ANTE TITLE')}</span>
			<span class="card-desc">{t('BET MODE ANTE DIALOG')}</span>
			<span class="card-price">{cost(3)} {t('PER SPIN')}</span>
			<button
				class="card-btn"
				class:card-btn--active={props.activeToggleMode === 'ANTE'}
				type="button"
				disabled={props.activeToggleMode !== 'ANTE' && !canAfford(3)}
				onclick={() => requestToggle('ANTE', 3)}
				>{t(props.activeToggleMode === 'ANTE' ? 'DEACTIVATE' : 'ACTIVATE')}</button
			>
		</div>

		{#each FEATURE_CARDS as card (card.mode)}
			<div class="card">
				<span class="card-title">{t(card.title)}</span>
				<span class="card-desc">{t(card.desc)}</span>
				<span class="card-price">{cost(card.costMultiplier)} {t('PER SPIN')}</span>
				<button
					class="card-btn"
					class:card-btn--active={props.activeToggleMode === card.mode}
					type="button"
					disabled={props.activeToggleMode !== card.mode && !canAfford(card.costMultiplier)}
					onclick={() => requestToggle(card.mode, card.costMultiplier)}
					>{t(props.activeToggleMode === card.mode ? 'DEACTIVATE' : 'ACTIVATE')}</button
				>
			</div>
		{/each}

		<!-- One-time bonus buys -->
		{#each BUY_CARDS as card (card.mode)}
			<div class="card">
				<span class="card-title">{t(card.title)}</span>
				<span class="card-desc">{t(card.desc)}</span>
				<picture class="mode-art">
					<source
						media="(max-width: 900px) and (orientation: landscape)"
						srcset={modeAsset(card.icon, 'mobile-landscape')}
					/>
					<source media="(max-width: 900px)" srcset={modeAsset(card.icon, 'mobile')} />
					<img src={modeAsset(card.icon, 'desktop')} alt="" />
				</picture>
				<span class="card-price">{cost(card.costMultiplier)}</span>
				<button
					class="card-btn card-btn--buy"
					type="button"
					disabled={!canAfford(card.costMultiplier)}
					onclick={() => openConfirm(card.mode)}>{t('BUY')}</button
				>
			</div>
		{/each}
	</div>

	<!-- Bet stepper — same neon frame as the cards; retunes the stake that drives every card price. -->
	<div class="bet-setter">
		<button
			class="bet-step"
			type="button"
			disabled={disableDecrease}
			onclick={() => stepBet(-1)}
			aria-label={t('DECREASE BET')}
		>
			<img src={disableDecrease ? betMinusDisabled : betMinus} alt="" />
		</button>
		<div class="bet-mid">
			<img class="bet-coin" src={coinIcon} alt="" />
			<div class="bet-readout">
				<span class="bet-readout__label">{i18nDerived.betLabel()}</span>
				<span class="bet-readout__value">{formattedBet}</span>
			</div>
		</div>
		<button
			class="bet-step"
			type="button"
			disabled={disableIncrease}
			onclick={() => stepBet(1)}
			aria-label={t('INCREASE BET')}
		>
			<img src={disableIncrease ? betPlusDisabled : betPlus} alt="" />
		</button>
	</div>
</div>

<!-- Confirm — Figma 6094-4364. Same frame, type and buttons as BonusResumeModal. -->
{#if confirmMode && confirmCard}
	<PopupFrame variant="confirm" ondismiss={closeConfirm} dismissLabel={t('CLOSE')}>
		<div class="confirm-title tp-popup__title">{t('CONFIRM')} {t(confirmCard.title)}</div>
		<div class="confirm-text tp-popup__body">
			{i18nDerived.translateVars('CONFIRM TEXT', {
				mode: t(confirmCard.title),
				cost: cost(confirmCard.costMultiplier),
			})}
		</div>
		<div class="confirm-row">
			<button class="tp-popup__btn" type="button" onclick={closeConfirm}>{t('CANCEL')}</button>
			<button class="tp-popup__btn tp-popup__btn--primary" type="button" onclick={confirmAccept}
				>{t('CONFIRM')}</button
			>
		</div>
	</PopupFrame>
{/if}

<style>
	/* Backdrops */
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgba(0, 0, 0, 0.7);
		border: 0;
		padding: 0;
		cursor: pointer;
	}
	/* Panel */
	.panel {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 61;
		width: min(760px, 97vw);
		max-height: 92dvh;
		overflow-y: auto;
		padding: 20px 12px;
	}

	/* Mobile portrait: stack the modes in a single scrolling column, with the bet bar pinned near
	   the screen bottom instead of scrolling away with the cards. */
	.panel.is-portrait {
		display: flex;
		flex-direction: column;
		height: 92dvh;
		overflow: hidden;
	}
	.panel.is-portrait .title {
		flex: 0 0 auto;
		margin-bottom: 12px;
	}
	.panel.is-portrait .grid {
		grid-template-columns: 1fr;
		gap: 12px;
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 2px 4px 8px;
	}
	.panel.is-portrait .bet-setter {
		flex: 0 0 auto;
		margin: 12px auto 0;
	}
	/* Full-width column cards can carry bigger type and a bigger icon than the 3-up grid. */
	.panel.is-portrait .card {
		padding: 16px 20px 18px;
	}
	.panel.is-portrait .card-title {
		font-size: clamp(1rem, 4.8vw, 1.3rem);
	}
	.panel.is-portrait .card-desc {
		font-size: clamp(0.66rem, 3.3vw, 0.82rem);
		display: block;
		overflow: visible;
	}
	.panel.is-portrait .card-price {
		font-size: clamp(0.92rem, 4.2vw, 1.1rem);
	}
	.panel.is-portrait .card-btn {
		font-size: clamp(0.82rem, 3.9vw, 1rem);
		padding: 11px 0;
	}
	.panel.is-portrait .mode-art img {
		height: clamp(58px, 16vw, 82px);
	}

	.title {
		margin: 0 0 20px;
		font-family: Helvetica, Arial, sans-serif;
		font-size: 1.35rem;
		font-weight: 700;
		letter-spacing: 0.03em;
		text-transform: uppercase;
		text-align: center;
		background: linear-gradient(173.06deg, #d836fc 0%, #272fdd 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}

	.grid {
		display: grid;
		/* Fixed 3-up so the six modes lay out as three-per-row on two rows. */
		grid-template-columns: repeat(3, 1fr);
		gap: 4px;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		box-sizing: border-box;
		padding: clamp(6px, 1.4vw, 12px) clamp(6px, 1.4vw, 14px) clamp(4px, 1vw, 10px);
		gap: clamp(5px, 1.4vw, 10px);
		/* Neon gradient frame (download "S pad") drawn as a 9-slice border-image, NOT a stretched
		   background: on a tall narrow card `background-size:100% 100%` distorts the frame and pushes
		   its border inward, so the button spilled past it. A 9-slice keeps the border a constant
		   thickness at any aspect ratio; `fill` paints the dark interior. Slices measured off the PNG
		   (interior starts at 22/20/39/17 px, T/R/B/L of the 615×309 image). */
		border-style: solid;
		border-width: 16px 15px 28px 14px;
		border-image-source: var(--neon-frame);
		border-image-slice: 22 20 39 17 fill;
		border-image-repeat: stretch;
	}

	.mode-art {
		display: grid;
		place-items: center;
		width: 100%;
		margin: 1px 0;
	}

	.mode-art img {
		display: block;
		/* Explicit height (not %) so it resolves against the grid — a % height falls back to the
		   image's intrinsic size and overflows, colliding with the neighbouring rows. */
		height: clamp(38px, 10vw, 62px);
		width: auto;
		max-width: 100%;
		object-fit: contain;
		filter: drop-shadow(0 5px 6px rgba(0, 0, 0, 0.62));
		animation: mode-art-idle 3s ease-in-out infinite;
	}

	.card:nth-child(2n) .mode-art img {
		animation-delay: -1.5s;
	}

	.card:hover .mode-art img {
		animation-duration: 1.2s;
		filter: brightness(1.08) drop-shadow(0 0 12px rgba(255, 67, 220, 0.5));
	}

	@keyframes mode-art-idle {
		0%,
		100% {
			transform: translateY(0) scale(1);
		}
		50% {
			transform: translateY(-4px) scale(1.025);
		}
	}

	.card-title {
		font-family: Helvetica, Arial, sans-serif;
		font-size: clamp(0.62rem, 2.9vw, 1.05rem);
		line-height: 1.1;
		font-weight: 700;
		letter-spacing: 0.02em;
		text-transform: uppercase;
		background: linear-gradient(173.06deg, #d836fc 0%, #272fdd 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
		display: block;
	}

	.card-desc {
		font-family: Helvetica, Arial, sans-serif;
		font-size: clamp(0.42rem, 1.95vw, 0.6rem);
		color: rgba(255, 255, 255, 0.75);
		letter-spacing: 0.01em;
		line-height: 1.32;
		/* Clamp so long copy can't blow one card's height out relative to its row-mates. */
		display: -webkit-box;
		-webkit-line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-price {
		font-family: Helvetica, Arial, sans-serif;
		font-size: clamp(0.66rem, 2.8vw, 0.95rem);
		font-weight: 700;
		color: #fff;
		letter-spacing: 0.02em;
		display: block;
		/* Push the price+button bet group to the card bottom so bets line up across a row. */
		margin-top: auto;
	}

	.card-btn {
		width: 100%;
		padding: clamp(7px, 1.8vw, 11px) 0;
		border-radius: 10px;
		font-family: Helvetica, Arial, sans-serif;
		font-size: clamp(0.56rem, 2.4vw, 0.85rem);
		font-weight: 700;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		cursor: pointer;
		border: 1px solid #b65df3;
		background-image: linear-gradient(0deg, #1a0535 0%, #000 100%);
		color: #fff;
		transition:
			background 0.2s,
			border-color 0.2s,
			color 0.2s;
	}
	.card-btn--active,
	.card-btn--buy {
		background-image: linear-gradient(167.38deg, #d836fc 0%, #272fdd 100%);
		color: #fff;
	}
	.card-btn:not(:disabled):hover {
		filter: brightness(1.14);
	}
	.card-btn--buy:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* Bet stepper under the cards — wrapped in the same neon gradient frame as the cards. */
	.bet-setter {
		margin: 3px auto 0;
		box-sizing: border-box;
		width: min(240px, 78%);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		/* More vertical breathing room; bottom padding stays a touch bigger to clear the frame's
		   larger bottom-border inset. */
		padding: 12px 18px 15px;
		background: var(--neon-frame) center / 100% 100% no-repeat;
	}

	.bet-mid {
		display: flex;
		align-items: center;
		gap: 7px;
		min-width: 0;
	}

	.bet-coin {
		flex: 0 0 auto;
		width: 26px;
		height: 26px;
		object-fit: contain;
		display: block;
	}

	.bet-step {
		flex: 0 0 auto;
		width: 36px;
		height: 36px;
		padding: 0;
		border: 0;
		background: none;
		cursor: pointer;
		transition: filter 0.15s;
	}
	.bet-step img {
		display: block;
		width: 100%;
		height: 100%;
	}
	.bet-step:disabled {
		cursor: default;
	}
	.bet-step:not(:disabled):hover {
		filter: brightness(1.12);
	}
	.bet-step:not(:disabled):active {
		transform: translateY(1px);
	}

	.bet-readout {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		min-width: 0;
	}
	.bet-readout__label {
		font-family: Helvetica, Arial, sans-serif;
		font-size: 0.58rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		/* Pink/purple gradient, matching the card titles. */
		background: linear-gradient(173.06deg, #d836fc 0%, #272fdd 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.bet-readout__value {
		font-family: Helvetica, Arial, sans-serif;
		font-size: 1.1rem;
		font-weight: 700;
		letter-spacing: 0.02em;
		color: #fff;
	}

	/* Confirm dialog — the design's own spacing, converted to flow so a long mode name (e.g.
	   "CONFIRM DUCK YOUR LUCK") wraps and pushes the body down instead of running through it. See
	   the matching note in BonusResumeModal (Figma 6401:2082-2084). */
	.confirm-title,
	.confirm-text {
		width: 74.303%; /* 303.899 of the 409 content box */
	}

	.confirm-text {
		margin-top: calc(16 / var(--pop-w) * 100cqw);
	}

	.confirm-row {
		margin-top: auto;
		padding-top: calc(24 / var(--pop-w) * 100cqw);
		width: 100%; /* the content box is already the 409 row */
		display: flex;
		align-items: center;
		gap: calc(16 / var(--pop-w) * 100cqw);
	}
</style>
