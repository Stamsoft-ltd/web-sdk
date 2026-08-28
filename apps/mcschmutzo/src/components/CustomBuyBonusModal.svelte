<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const scatterIcon = ap('/assets/mcschmutzo/symbols/S.png');
	const lockIcon = ap('/assets/mcschmutzo/symbols/H1.png');
	const wheelIcon = ap('/assets/mcschmutzo/bonus-wheel.png');
	const actionButton = ap('/assets/mcschmutzo/buy-bonus-button.png');
	const closeButton = ap('/assets/mcschmutzo/spin-button.png');
	const iconCoins = ap('/assets/hud/icon-coins.webp');
	const iconMinus = ap('/assets/hud/icon-minus.webp');
	const iconPlus = ap('/assets/hud/icon-plus.webp');
	const btnRoundBg = ap('/assets/components/navbar/btn_bg_round.webp');
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { stateBet, stateBetDerived, stateConfig, stateUrlDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { fitLabel } from '../lib/fitLabel';
	import { mcschmutzoStakeDerived } from '../state/mcschmutzoStake.svelte';
	import CustomConfirmModal from './CustomConfirmModal.svelte';

	type ModeId = 'enhancer1' | 'featureSpin' | 'bonus1' | 'bonus2';
	type Mode = {
		id: ModeId;
		multiplier: 2 | 20 | 100 | 500;
		title: string;
		description: string;
		action: 'activate' | 'buy';
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
			description: 'Enhanced chance to trigger the bonus.',
			action: 'activate',
		},
		{
			id: 'featureSpin',
			multiplier: 20,
			title: 'LOCK FEATURE SPIN',
			description: 'Guaranteed paying spin followed by Lock & Re-Spin.',
			action: 'activate',
		},
		{
			id: 'bonus1',
			multiplier: 100,
			title: 'NORMAL BONUS',
			description: 'Enter the bonus with three Scatter symbols.',
			action: 'buy',
		},
		{
			id: 'bonus2',
			multiplier: 500,
			title: 'SUPER BONUS',
			description: 'Enter the Super Bonus with four Scatter symbols.',
			action: 'buy',
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

	const confirmLabel = $derived(confirmMode ? modeById(confirmMode).title : '');
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

<button class="backdrop" type="button" aria-label="Close" tabindex="-1" onclick={props.onclose}></button>

<section class="mode-panel" role="dialog" aria-modal="true" aria-labelledby="mode-title">
	<button
		class="close-button"
		type="button"
		aria-label="Close"
		style={`--close-bg:url('${closeButton}')`}
		onclick={props.onclose}
	>✕</button>

	<header class="panel-header">
		<span class="eyebrow">McSCHMUTZO</span>
		<h2 id="mode-title">CHOOSE YOUR MODE</h2>
		<p>Select a feature or buy direct entry to a bonus.</p>
	</header>

	<div class="mode-grid">
		{#each modes as mode (mode.id)}
			<article class="mode-card" class:mode-card--active={isActive(mode.id)}>
				<div class="mode-heading">
					<span class="mode-tag">{mode.multiplier}X BET</span>
					<h3>{mode.title}</h3>
				</div>

				<div class="mode-art" class:mode-art--lock={mode.id === 'featureSpin'}>
					{#if mode.id === 'enhancer1'}
						<img class="single-symbol" src={scatterIcon} alt="Scatter" />
						<span class="chance-badge">2X</span>
					{:else if mode.id === 'featureSpin'}
						<div class="lock-cell"><img src={lockIcon} alt="Locked winning symbol" /></div>
					{:else if mode.id === 'bonus1'}
						<div class="scatter-stack" aria-label="Three Scatter symbols">
							<img src={scatterIcon} alt="" />
							<img src={scatterIcon} alt="" />
							<img src={scatterIcon} alt="" />
						</div>
					{:else}
						<img class="wheel-symbol" src={wheelIcon} alt="Super Bonus wheel" />
					{/if}
				</div>

				<p class="mode-description">{mode.description}</p>
				<div class="mode-cost">
					<span>{mode.multiplier}X</span>
					<strong>{formatCost(mode.multiplier)}</strong>
				</div>
				<button
					class="mode-action"
					class:mode-action--active={isActive(mode.id)}
					type="button"
					disabled={isDisabled(mode)}
					style={`--action-bg:url('${actionButton}')`}
					onclick={() => chooseMode(mode.id)}
				>
					<span use:fitLabel={buttonLabel(mode)}>{buttonLabel(mode)}</span>
				</button>
			</article>
		{/each}
	</div>

	<footer class="bet-bar">
		<span class="bet-caption">BASE BET</span>
		<button
			class="step-button"
			type="button"
			disabled={!canDec}
			aria-label={decBetLabel}
			style={`--round-bg:url('${btnRoundBg}')`}
			onclick={() => stepBet(-1)}
		><img src={iconMinus} alt="" /></button>
		<div class="bet-value"><img src={iconCoins} alt="" /><strong>{formattedBet}</strong></div>
		<button
			class="step-button"
			type="button"
			disabled={!canInc}
			aria-label={incBetLabel}
			style={`--round-bg:url('${btnRoundBg}')`}
			onclick={() => stepBet(1)}
		><img src={iconPlus} alt="" /></button>
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
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		border: 0;
		background: rgba(25, 10, 4, 0.78);
		backdrop-filter: blur(7px);
	}

	.mode-panel {
		position: fixed;
		left: 50%;
		top: 50%;
		z-index: 61;
		width: min(1160px, 95vw);
		max-height: 94dvh;
		box-sizing: border-box;
		padding: 24px 24px 18px;
		transform: translate(-50%, -50%);
		overflow: auto;
		border: 4px solid #1a1714;
		border-radius: 24px;
		background:
			linear-gradient(180deg, rgba(255, 195, 131, 0.08), transparent 24%),
			#151515;
		box-shadow:
			0 0 0 3px #65411f,
			0 24px 80px rgba(0, 0, 0, 0.68);
		color: #fff8ea;
		font-family: 'Poppins', sans-serif;
	}

	.close-button {
		position: absolute;
		top: 12px;
		right: 14px;
		width: 52px;
		height: 52px;
		border: 0;
		background: var(--close-bg) center / contain no-repeat;
		color: #fff4d2;
		font-size: 18px;
		font-weight: 900;
		cursor: pointer;
	}

	.panel-header {
		text-align: center;
	}
	.eyebrow,
	.confirm-kicker {
		color: #e8a62b;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.22em;
	}
	.panel-header h2 {
		margin: 1px 0 2px;
		font-family: 'Cinzel', serif;
		font-size: clamp(24px, 2.4vw, 38px);
		line-height: 1;
		color: #ffc74f;
		text-shadow: 0 3px 0 #5a1d0c;
	}
	.panel-header p {
		margin: 5px 0 16px;
		color: #c7b9a6;
		font-size: 13px;
	}

	.mode-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 14px;
	}

	.mode-card {
		position: relative;
		display: grid;
		grid-template-rows: auto 132px minmax(42px, auto) auto 54px;
		gap: 8px;
		min-width: 0;
		padding: 14px;
		border: 2px solid #735125;
		border-radius: 16px;
		background: linear-gradient(160deg, #32160c, #171311 66%);
		box-shadow: inset 0 0 0 2px rgba(255, 195, 131, 0.06);
		text-align: center;
	}
	.mode-card--active {
		border-color: #ffc383;
		box-shadow: 0 0 18px rgba(255, 195, 131, 0.35), inset 0 0 0 2px #e8b574;
	}

	.mode-heading {
		min-height: 56px;
	}
	.mode-tag {
		display: inline-block;
		padding: 2px 8px;
		border-radius: 10px;
		background: #4a1c08;
		color: #ffc383;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.08em;
	}
	.mode-heading h3 {
		margin: 6px 0 0;
		font-family: 'Cinzel', serif;
		font-size: clamp(14px, 1.3vw, 19px);
		line-height: 1.05;
		color: #fff1d0;
	}

	.mode-art {
		position: relative;
		display: grid;
		place-items: center;
		min-height: 0;
		overflow: hidden;
		border-radius: 12px;
		background: radial-gradient(circle, rgba(232, 181, 116, 0.18), transparent 68%);
	}
	.single-symbol {
		width: 126px;
		height: 126px;
		object-fit: contain;
	}
	.chance-badge {
		position: absolute;
		right: 18%;
		bottom: 8px;
		padding: 4px 8px;
		border: 2px solid #ffc383;
		border-radius: 50%;
		background: #b7150d;
		color: #fff3c6;
		font-weight: 900;
	}
	.lock-cell {
		display: grid;
		place-items: center;
		width: 118px;
		height: 108px;
		border: 4px solid #ffc383;
		border-radius: 4px;
		background: #e8b574;
	}
	.lock-cell img {
		width: 104px;
		height: 104px;
		object-fit: contain;
	}
	.scatter-stack {
		position: relative;
		width: 178px;
		height: 126px;
	}
	.scatter-stack img {
		position: absolute;
		top: 7px;
		left: 36px;
		width: 112px;
		height: 112px;
		object-fit: contain;
	}
	.scatter-stack img:first-child { transform: translateX(-38px) rotate(-10deg) scale(0.88); }
	.scatter-stack img:last-child { transform: translateX(38px) rotate(10deg) scale(0.88); }
	.wheel-symbol {
		width: 130px;
		height: 130px;
		object-fit: contain;
	}

	.mode-description {
		margin: 0;
		color: #c8b9a6;
		font-size: 12px;
		line-height: 1.3;
	}
	.mode-cost {
		display: flex;
		align-items: baseline;
		justify-content: center;
		gap: 8px;
	}
	.mode-cost span {
		color: #ffc383;
		font-size: 22px;
		font-weight: 900;
	}
	.mode-cost strong {
		color: #fff;
		font-size: 13px;
	}

	.mode-action {
		width: 100%;
		height: 54px;
		padding: 0 18%;
		border: 0;
		background: var(--action-bg) center / 100% 100% no-repeat;
		color: #fff4d2;
		font-family: 'Poppins', sans-serif;
		font-size: 14px;
		font-weight: 900;
		letter-spacing: 0.05em;
		cursor: pointer;
	}
	.mode-action:hover:not(:disabled) { filter: brightness(1.12); }
	.mode-action:active:not(:disabled) { transform: scale(0.97); }
	.mode-action:disabled { opacity: 0.42; cursor: default; }
	.mode-action--active { filter: saturate(0.55); }

	.bet-bar {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		margin-top: 14px;
	}
	.bet-caption {
		color: #e8a62b;
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.12em;
	}
	.bet-value {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 122px;
		color: #fff;
		font-size: 18px;
	}
	.bet-value img {
		width: 30px;
		height: 30px;
		object-fit: contain;
	}
	.step-button {
		display: grid;
		place-items: center;
		width: 42px;
		height: 42px;
		padding: 0;
		border: 0;
		background: var(--round-bg) center / contain no-repeat;
		cursor: pointer;
	}
	.step-button img { width: 42%; height: 42%; object-fit: contain; }
	.step-button:disabled { opacity: 0.4; cursor: default; }

	.backdrop--confirm { z-index: 70; }
	.confirm-panel {
		position: fixed;
		left: 50%;
		top: 50%;
		z-index: 71;
		width: min(430px, 90vw);
		box-sizing: border-box;
		padding: 28px;
		transform: translate(-50%, -50%);
		border: 3px solid #ffc383;
		border-radius: 18px;
		background: #171412;
		box-shadow: 0 24px 70px rgba(0, 0, 0, 0.75);
		color: #fff;
		font-family: 'Poppins', sans-serif;
		text-align: center;
	}
	.confirm-panel h2 {
		margin: 5px 0 8px;
		font-family: 'Cinzel', serif;
		color: #ffc74f;
	}
	.confirm-panel p { margin: 0 0 20px; color: #c8b9a6; }
	.confirm-panel strong { color: #fff; }
	.confirm-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	.confirm-actions button {
		height: 46px;
		border-radius: 10px;
		font-weight: 900;
		cursor: pointer;
	}
	.confirm-cancel { border: 1px solid #806444; background: #29231e; color: #fff; }
	.confirm-accept { border: 1px solid #ffc383; background: #b7150d; color: #fff4d2; }

	@media (max-width: 900px) {
		.mode-panel { width: min(760px, 95vw); }
		.mode-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}

	@media (max-width: 560px) {
		.mode-panel {
			width: 94vw;
			max-height: 92dvh;
			padding: 18px 12px 14px;
		}
		.close-button { width: 42px; height: 42px; top: 8px; right: 8px; }
		.panel-header p { margin-bottom: 12px; }
		.mode-grid { grid-template-columns: 1fr; }
		.mode-card {
			grid-template-columns: 110px 1fr;
			grid-template-rows: auto auto auto 48px;
			text-align: left;
		}
		.mode-heading { grid-column: 2; min-height: 0; }
		.mode-art { grid-column: 1; grid-row: 1 / span 3; height: 124px; }
		.mode-description { grid-column: 2; }
		.mode-cost { grid-column: 2; justify-content: flex-start; }
		.mode-action { grid-column: 1 / -1; height: 48px; }
		.single-symbol,
		.wheel-symbol { width: 104px; height: 104px; }
		.scatter-stack { transform: scale(0.62); }
		.lock-cell { width: 96px; height: 92px; }
		.lock-cell img { width: 88px; height: 88px; }
		.bet-caption { display: none; }
	}
</style>
