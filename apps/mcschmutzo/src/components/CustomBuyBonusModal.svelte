<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const closeArt = ap('/assets/mcschmutzo/win/x-button.webp');
	const artExtraChance = ap('/assets/mcschmutzo/buybonus/extra-chance.webp');
	const artLockSpin = ap('/assets/mcschmutzo/buybonus/lock-spin.webp');
	const artNormalBonus = ap('/assets/mcschmutzo/buybonus/normal-bonus.webp');
	const artSuperBonus = ap('/assets/mcschmutzo/buybonus/super-bonus.webp');
	const minusArt = ap('/assets/mcschmutzo/autoplay/minus.svg');
	const plusArt = ap('/assets/mcschmutzo/autoplay/plus-icon.svg');
	const iconCoins = ap('/assets/hud/icon-coins.webp');
	const activateArt = ap('/assets/mcschmutzo/buybonus/activate.svg');
	const buyArt = ap('/assets/mcschmutzo/buybonus/buy.svg');
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { stateBet, stateBetDerived, stateConfig, stateUrlDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { mcschmutzoStakeDerived } from '../state/mcschmutzoStake.svelte';
	import CustomConfirmModal from './CustomConfirmModal.svelte';

	type ModeId = 'enhancer1' | 'featureSpin' | 'bonus1' | 'bonus2';
	type Mode = {
		id: ModeId;
		multiplier: 2 | 20 | 100 | 500;
		title: string;
		description: string;
		action: 'activate' | 'buy';
		art: string;
		badge: string | null;
	};
	type Props = {
		onclose: () => void;
		isChanceActive: boolean;
		isFeatureActive: boolean;
		onToggleChance: () => void;
		onToggleFeature: () => void;
	};

	const props: Props = $props();
	const context = getContext();
	const modes: Mode[] = [
		{
			id: 'enhancer1',
			multiplier: 2,
			title: 'EXTRA CHANCE',
			description: 'Activate to increase 3 times the chance of trigger a bonus round',
			action: 'activate',
			art: artExtraChance,
			badge: '2x',
		},
		{
			id: 'featureSpin',
			multiplier: 20,
			title: 'LOCK FEATURE SPIN',
			description: 'Guaranteed paying spin followed by Lock & Re-Spin.',
			action: 'activate',
			art: artLockSpin,
			badge: null,
		},
		{
			id: 'bonus1',
			multiplier: 100,
			title: 'NORMAL BONUS',
			description: 'Enter the bonus with three Scatter symbols.',
			action: 'buy',
			art: artNormalBonus,
			badge: '3x',
		},
		{
			id: 'bonus2',
			multiplier: 500,
			title: 'SUPER BONUS',
			description: 'Enter the Super Bonus with four Scatter symbols.',
			action: 'buy',
			art: artSuperBonus,
			badge: null,
		},
	];

	const betAmount = $derived(stateBet.betAmount);
	const betOptions = $derived(stateConfig.betAmountOptions);
	const currentBetIndex = $derived(Math.max(0, betOptions.indexOf(stateBet.betAmount)));
	const canDec = $derived(currentBetIndex > 0);
	const canInc = $derived(currentBetIndex < betOptions.length - 1);
	const formattedBet = $derived(mcschmutzoStakeDerived.formatCurrencyAmount(betAmount));
	const isSocial = $derived(stateConfig.jurisdiction.socialCasino || stateUrlDerived.social());
	const decBetLabel = $derived(isSocial ? 'Decrease play amount' : 'Decrease bet');
	const incBetLabel = $derived(isSocial ? 'Increase play amount' : 'Increase bet');

	let confirmMode = $state<'featureSpin' | 'bonus1' | 'bonus2' | null>(null);

	const modeById = (id: ModeId) => modes.find((mode) => mode.id === id)!;
	const formatCost = (multiplier: number) =>
		mcschmutzoStakeDerived.formatCurrencyAmount(betAmount * multiplier);
	const canAfford = (multiplier: number) => stateBet.balanceAmount >= betAmount * multiplier;
	const isActive = (id: ModeId) =>
		(id === 'enhancer1' && props.isChanceActive) ||
		(id === 'featureSpin' && props.isFeatureActive);
	const isDisabled = (mode: Mode) => !isActive(mode.id) && !canAfford(mode.multiplier);
	const buttonLabel = (mode: Mode) =>
		isActive(mode.id)
			? i18nDerived.deactivate()
			: mode.action === 'buy'
				? i18nDerived.buy()
				: i18nDerived.activate();

	const closeWithToggle = (toggle: () => void) => {
		toggle();
		props.onclose();
	};
	const chooseMode = (id: ModeId) => {
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		if (id === 'enhancer1') {
			closeWithToggle(props.onToggleChance);
			return;
		}
		if (id === 'featureSpin' && props.isFeatureActive) {
			closeWithToggle(props.onToggleFeature);
			return;
		}
		confirmMode = id;
	};

	const confirmCost = $derived(confirmMode ? formatCost(modeById(confirmMode).multiplier) : '');
	const closeConfirm = () => (confirmMode = null);
	const confirmAccept = () => {
		if (!confirmMode) return;
		if (confirmMode === 'featureSpin') {
			confirmMode = null;
			closeWithToggle(props.onToggleFeature);
			return;
		}
		stateBet.activeBetModeKey = confirmMode;
		confirmMode = null;
		props.onclose();
		context.eventEmitter.broadcast({ type: 'bet' });
	};

	const stepBet = (direction: -1 | 1) => {
		const index = Math.min(betOptions.length - 1, Math.max(0, currentBetIndex + direction));
		const next = betOptions[index];
		if (typeof next !== 'number' || next === stateBet.betAmount) return;
		context.eventEmitter.broadcast({ type: 'soundPressGeneral' });
		stateBetDerived.setBetAmount(next);
	};

	onMount(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== 'Escape') return;
			if (confirmMode) closeConfirm();
			else props.onclose();
		};
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div class="bb-backdrop" onclick={props.onclose}></div>

<button
	class="bb-close"
	type="button"
	style={`background-image:url('${closeArt}')`}
	onclick={props.onclose}
	aria-label="Close"
></button>

<section class="bb-panel" role="dialog" aria-modal="true" aria-labelledby="bb-title">
	<h2 id="bb-title" class="bb-title">{i18nDerived.buyBonus()}</h2>

	<div class="bb-grid">
		{#each modes as mode (mode.id)}
			<article class="bb-card" class:bb-card--active={isActive(mode.id)}>
				<h3 class="bb-card-title">{mode.title}</h3>
				<div class="bb-divider"></div>
				<p class="bb-desc">{mode.description}</p>

				<div class="bb-art">
					<img src={mode.art} alt="" draggable="false" />
					{#if mode.badge}<span class="bb-badge">{mode.badge}</span>{/if}
				</div>

				<div class="bb-amount">
					<span class="bb-mult">{mode.multiplier}x</span>
					<span class="bb-cost">{formatCost(mode.multiplier)}</span>
				</div>

				<button
					class="bb-btn"
					style={`background-image:url('${mode.action === 'buy' ? buyArt : activateArt}')`}
					type="button"
					disabled={isDisabled(mode)}
					onclick={() => chooseMode(mode.id)}
					aria-label={buttonLabel(mode)}
				></button>
			</article>
		{/each}
	</div>

	<footer class="bb-betbar">
		<div class="bb-betbox">
			<button
				class="bb-step"
				type="button"
				style={`background-image:url('${minusArt}')`}
				disabled={!canDec}
				aria-label={decBetLabel}
				onclick={() => stepBet(-1)}
			></button>
			<div class="bb-bet"><img src={iconCoins} alt="" /><strong>{formattedBet}</strong></div>
			<button
				class="bb-step"
				type="button"
				style={`background-image:url('${plusArt}')`}
				disabled={!canInc}
				aria-label={incBetLabel}
				onclick={() => stepBet(1)}
			></button>
		</div>
	</footer>
</section>

{#if confirmMode}
	<CustomConfirmModal
		title={i18nDerived.translate('CONFIRM IT ALL')}
		message={i18nDerived.translateVars('BUY ALL IN', { cost: confirmCost })}
		cancelLabel={i18nDerived.translate('CANCEL')}
		confirmLabel={i18nDerived.translate('CONFIRM')}
		oncancel={closeConfirm}
		onconfirm={confirmAccept}
		onclose={closeConfirm}
	/>
{/if}

<style>
	.bb-backdrop {
		position: fixed;
		inset: 0;
		z-index: 58;
		background: rgba(0, 0, 0, 0.64);
		backdrop-filter: blur(4px);
	}

	.bb-close {
		position: fixed;
		top: 20px;
		right: 20px;
		z-index: 63;
		width: clamp(42px, 6vmin, 52px);
		aspect-ratio: 1;
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.bb-close:hover {
		filter: brightness(1.2);
	}
	.bb-close:active {
		transform: scale(0.94);
	}

	/* Dark panel: 3px #444 border wrapped by #181818 (outer-most), matching the other modals. */
	.bb-panel {
		position: fixed;
		left: 50%;
		top: 50%;
		z-index: 59;
		transform: translate(-50%, -50%);
		width: min(1080px, 95vw);
		max-height: 94dvh;
		overflow-y: auto;
		box-sizing: border-box;
		padding: clamp(10px, 2vmin, 22px);
		font-family: 'Poppins', sans-serif;
	}

	.bb-title {
		margin: 0 0 clamp(14px, 2.4vmin, 24px);
		text-align: center;
		color: #ffffff;
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: clamp(1.4rem, 4vmin, 2.2rem);
		line-height: 1;
		letter-spacing: 1.4px;
		text-transform: uppercase;
		text-shadow: 0 2px 6px rgba(0, 0, 0, 0.6);
	}

	.bb-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: clamp(10px, 1.6vmin, 18px);
	}

	/* Card is the outer box (bg + radius); ::before is a #605553 border inset a few px,
	   so the card bg shows as padding around it (same bg, same rounded corners). */
	.bb-card {
		position: relative;
		display: grid;
		grid-template-rows: auto auto minmax(38px, auto) 1fr auto auto;
		gap: clamp(6px, 1.2vmin, 12px);
		min-width: 0;
		padding: clamp(16px, 2.4vmin, 26px) clamp(14px, 2vmin, 20px);
		border-radius: 16px;
		background: linear-gradient(180deg, #221e1b 0%, #191512 100%);
		text-align: center;
	}
	.bb-card::before {
		content: '';
		position: absolute;
		inset: 6px;
		border: 2.03px solid #605553;
		border-radius: 12px;
		pointer-events: none;
	}
	.bb-card--active::before {
		border-color: #e8b574;
	}
	.bb-card--active {
		box-shadow: 0 0 16px rgba(232, 181, 116, 0.25);
	}

	.bb-card-title {
		margin: 0;
		min-height: 2.2em;
		display: flex;
		align-items: center;
		justify-content: center;
		color: #ffffff;
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: clamp(0.8rem, 1.7vmin, 1.125rem); /* 18px @ design */
		line-height: 1;
		letter-spacing: 1.4px;
		text-transform: uppercase;
	}

	/* Fading rule under the title (same as the auto-spin modal). */
	.bb-divider {
		align-self: center;
		width: 88%;
		height: 0;
		border: solid;
		border-width: 2px 0 0 0;
		border-image-source: linear-gradient(
			90deg,
			rgba(96, 85, 83, 0) 0%,
			#605553 50%,
			rgba(96, 85, 83, 0) 100%
		);
		border-image-slice: 1;
	}

	.bb-desc {
		margin: 0;
		color: #c3b8ab;
		font-weight: 500;
		font-size: clamp(0.62rem, 1.2vmin, 0.8rem);
		line-height: 1.3;
	}

	.bb-art {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 0;
		padding: clamp(2px, 0.6vmin, 8px) 0;
	}
	.bb-art img {
		width: auto;
		height: clamp(66px, 12vmin, 108px);
		object-fit: contain;
		filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
	}
	.bb-badge {
		position: absolute;
		right: 22%;
		bottom: 8%;
		display: grid;
		place-items: center;
		width: clamp(24px, 4vmin, 34px);
		aspect-ratio: 1;
		border-radius: 50%;
		border: 2px solid #ffce6a;
		background: #c4281c;
		color: #fff4d2;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(0.6rem, 1.3vmin, 0.85rem);
	}

	/* Amount chip — small, borderless, sized to content (~half the card). */
	.bb-amount {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 6px;
		align-self: center;
		justify-self: center;
		padding: clamp(3px, 0.6vmin, 6px) clamp(10px, 1.8vmin, 18px);
		border-radius: 8px;
		background: #292624;
	}
	.bb-mult {
		color: #ffc264;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(0.68rem, 1.3vmin, 0.9rem);
	}
	.bb-cost {
		color: #ffffff;
		font-weight: 700;
		font-size: clamp(0.64rem, 1.2vmin, 0.84rem);
	}

	/* Buttons use the provided ACTIVATE / BUY art. */
	.bb-btn {
		width: 100%;
		aspect-ratio: 215 / 50;
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.bb-btn:hover:not(:disabled) {
		filter: brightness(1.1);
	}
	.bb-btn:active:not(:disabled) {
		transform: scale(0.97);
	}
	.bb-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* Bet stepper — a single #181818 box (2.03px #605553 border) holding − value +. */
	.bb-betbar {
		display: flex;
		justify-content: center;
		margin-top: clamp(14px, 2.4vmin, 24px);
	}
	.bb-betbox {
		display: flex;
		align-items: center;
		gap: clamp(8px, 1.4vmin, 16px);
		padding: clamp(6px, 1vmin, 10px) clamp(10px, 1.6vmin, 16px);
		border-radius: 14px;
		border: 2.03px solid #605553;
		background: #181818;
	}
	.bb-step {
		flex: 0 0 auto;
		width: clamp(38px, 5.4vmin, 48px);
		aspect-ratio: 1;
		padding: 0;
		border: none;
		background: transparent center / contain no-repeat;
		cursor: pointer;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.bb-step:hover:not(:disabled) {
		filter: brightness(1.15);
	}
	.bb-step:active:not(:disabled) {
		transform: scale(0.92);
	}
	.bb-step:disabled {
		opacity: 0.35;
		cursor: default;
	}
	.bb-bet {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: clamp(84px, 14vmin, 120px);
		justify-content: center;
		color: #ffffff;
		font-weight: 700;
		font-size: clamp(0.9rem, 1.8vmin, 1.15rem);
	}
	.bb-bet img {
		width: clamp(20px, 3vmin, 28px);
		height: auto;
		object-fit: contain;
	}

	@media (max-width: 900px) {
		.bb-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}
	@media (max-width: 520px) {
		.bb-grid {
			grid-template-columns: 1fr;
		}
		.bb-card {
			grid-template-columns: 96px 1fr;
			grid-template-rows: auto auto auto auto;
			align-items: center;
			text-align: left;
			gap: 4px 12px;
		}
		.bb-card-title {
			grid-column: 2;
			min-height: 0;
			justify-content: flex-start;
		}
		.bb-divider {
			display: none;
		}
		.bb-desc {
			grid-column: 2;
		}
		.bb-art {
			grid-column: 1;
			grid-row: 1 / span 3;
		}
		.bb-amount {
			grid-column: 2;
		}
		.bb-btn {
			grid-column: 1 / -1;
		}
	}
</style>
