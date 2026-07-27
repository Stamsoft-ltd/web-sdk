<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const modeAsset = (icon: string, variant: 'desktop' | 'mobile' | 'mobile-landscape') =>
		ap(`/assets/theme-park/v2/modes/${icon}-${variant}.png`);

	for (const icon of ['duck-your-luck', 'roller-wilds', 'mega-coaster']) {
		for (const variant of ['desktop', 'mobile', 'mobile-landscape'] as const) modeAsset(icon, variant);
	}
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { stateBet } from 'state-shared';
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { templateStakeDerived } from '../state/templateStake.svelte';
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

	const betAmount = $derived(stateBet.betAmount);
	const canAfford = (multiplier: number) => stateBet.balanceAmount >= betAmount * multiplier;

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

<!-- Panel -->
<div class="panel" role="dialog" aria-modal="true">
	<button class="close-btn" type="button" onclick={props.onclose}>✕</button>

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
				<picture class="mode-art">
					<source
						media="(max-width: 900px) and (orientation: landscape)"
						srcset={modeAsset(card.icon, 'mobile-landscape')}
					/>
					<source media="(max-width: 900px)" srcset={modeAsset(card.icon, 'mobile')} />
					<img src={modeAsset(card.icon, 'desktop')} alt="" />
				</picture>
				<span class="card-title">{t(card.title)}</span>
				<span class="card-desc">{t(card.desc)}</span>
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
</div>

<!-- Confirm -->
{#if confirmMode && confirmCard}
	<button
		class="backdrop backdrop--z2"
		type="button"
		aria-label={t('CLOSE')}
		tabindex="-1"
		onclick={closeConfirm}
	></button>
	<div class="confirm" role="dialog" aria-modal="true">
		<div class="confirm-title">{t('CONFIRM')} {t(confirmCard.title)}</div>
		<div class="confirm-text">
			{i18nDerived.translateVars('CONFIRM TEXT', {
				mode: t(confirmCard.title),
				cost: cost(confirmCard.costMultiplier),
			})}
		</div>
		<div class="confirm-row">
			<button class="confirm-btn confirm-btn--cancel" type="button" onclick={closeConfirm}
				>{t('CANCEL')}</button
			>
			<button
				class="confirm-btn confirm-btn--ok"
				type="button"
				onclick={confirmAccept}>{t('CONFIRM')}</button
			>
		</div>
	</div>
{/if}

<style>
	/* Backdrops */
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 60;
		background: rgba(0, 0, 0, 0.72);
		backdrop-filter: blur(5px);
		border: 0;
		padding: 0;
		cursor: pointer;
	}
	.backdrop--z2 {
		z-index: 70;
	}

	/* Panel */
	.panel {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 61;
		width: min(760px, 96vw);
		max-height: 92dvh;
		overflow-y: auto;
		padding: 28px 24px 28px;
	}

	.title {
		margin: 0 0 20px;
		font-family: 'Cinzel', serif;
		font-size: 1.35rem;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-align: center;
		background: linear-gradient(180deg, #e2d981 8.6%, #fbc503 60.4%, #d98503 129.3%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}

	.close-btn {
		position: absolute;
		top: 10px;
		right: 14px;
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: rgba(12, 8, 3, 0.93);
		border: 2px solid #9a7018;
		box-shadow:
			0 0 0 1px rgba(210, 175, 55, 0.25),
			0 4px 14px rgba(0, 0, 0, 0.75);
		color: rgba(255, 255, 255, 0.85);
		font-size: 1rem;
		display: flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
		padding: 0;
		transition: background 0.2s;
	}
	.close-btn:hover {
		background: rgba(30, 20, 8, 0.97);
		color: #fff;
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 16px;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 22px 18px 18px;
		background: linear-gradient(160deg, rgba(37, 9, 68, 0.98), rgba(7, 5, 31, 0.98));
		border: 2px solid rgba(255, 193, 47, 0.7);
		box-shadow:
			inset 0 0 22px rgba(255, 79, 216, 0.12),
			0 10px 26px rgba(0, 0, 0, 0.42);
		border-radius: 18px;
		gap: 8px;
	}

	.mode-art {
		display: grid;
		place-items: center;
		width: 100%;
		height: 104px;
	}

	.mode-art img {
		display: block;
		width: min(100%, 180px);
		height: 100%;
		object-fit: contain;
		filter: drop-shadow(0 7px 8px rgba(0, 0, 0, 0.62));
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
		font-family: 'Cinzel', serif;
		font-size: 1rem;
		font-weight: 900;
		letter-spacing: 0.06em;
		background: linear-gradient(180deg, #e2d981 8.6%, #fbc503 60.4%, #d98503 129.3%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
		display: block;
	}

	.card-desc {
		font-family: 'Cinzel', serif;
		font-size: 0.52rem;
		color: rgba(255, 255, 255, 0.75);
		letter-spacing: 0.02em;
		line-height: 1.45;
		display: block;
		min-height: 2.9em;
	}

	.card-price {
		font-family: 'Cinzel', serif;
		font-size: 0.88rem;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.9);
		letter-spacing: 0.04em;
		display: block;
	}

	.card-btn {
		width: 100%;
		padding: 9px 0;
		border-radius: 8px;
		font-family: 'Cinzel', serif;
		font-size: 0.78rem;
		font-weight: 900;
		letter-spacing: 0.1em;
		cursor: pointer;
		border: 2px solid rgba(200, 158, 80, 0.6);
		background: transparent;
		color: rgba(210, 170, 60, 0.9);
		transition:
			background 0.2s,
			border-color 0.2s,
			color 0.2s;
		margin-top: 4px;
	}
	.card-btn--active {
		background: linear-gradient(180deg, #f5cc50 0%, #c08a10 100%);
		color: #1f1000;
	}
	.card-btn--buy {
		background: linear-gradient(180deg, #4ecb2e 0%, #2a8a10 100%);
		border-color: rgba(80, 200, 50, 0.5);
		color: #fff;
		box-shadow: 0 0 12px rgba(60, 180, 30, 0.35);
	}
	.card-btn--buy:hover:not(:disabled) {
		background: linear-gradient(180deg, #5fd93e 0%, #348f18 100%);
		color: #fff;
	}
	.card-btn--buy:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* Confirm */
	.confirm {
		position: fixed;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		z-index: 71;
		width: min(340px, 88vw);
		border-radius: 18px;
		background: linear-gradient(160deg, rgba(30, 20, 8, 0.97), rgba(12, 8, 2, 0.98));
		border: 1px solid rgba(200, 155, 40, 0.5);
		box-shadow:
			0 24px 48px rgba(0, 0, 0, 0.7),
			inset 0 1px 0 rgba(255, 220, 100, 0.1);
		padding: 22px 22px 18px;
		text-align: center;
	}
	.confirm-title {
		font-family: 'Cinzel', serif;
		font-size: 1rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		margin-bottom: 10px;
		background: linear-gradient(180deg, #e2d981 8.6%, #fbc503 60.4%, #d98503 129.3%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
	}
	.confirm-text {
		font-family: 'Cinzel', serif;
		font-size: 0.85rem;
		color: rgba(255, 255, 255, 0.88);
		line-height: 1.45;
		margin-bottom: 18px;
	}
	.confirm-row {
		display: flex;
		gap: 10px;
		justify-content: center;
	}
	.confirm-btn {
		border-radius: 12px;
		padding: 10px 20px;
		font-family: 'Cinzel', serif;
		font-size: 0.82rem;
		font-weight: 900;
		letter-spacing: 0.08em;
		cursor: pointer;
	}
	.confirm-btn--cancel {
		border: 1px solid rgba(200, 155, 40, 0.35);
		background: rgba(255, 255, 255, 0.07);
		color: rgba(255, 255, 255, 0.82);
	}
	.confirm-btn--ok {
		border: 1px solid rgba(220, 170, 40, 0.6);
		background: linear-gradient(180deg, #f5cc50, #c08a10);
		color: #1f1000;
	}
</style>
