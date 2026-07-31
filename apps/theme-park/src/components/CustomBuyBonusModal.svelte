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

<!-- Screen-corner close, matching every other popup. Hidden while the confirm dialog is up, which
     brings its own in the same spot. -->
{#if !confirmMode}
	<PopupCloseButton onclick={props.onclose} label={t('CLOSE')} />
{/if}

<!-- Panel -->
<div class="panel" role="dialog" aria-modal="true">
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
		width: min(760px, 96vw);
		max-height: 92dvh;
		overflow-y: auto;
		padding: 28px 24px 28px;
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
		grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
		gap: 16px;
	}

	.card {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 22px 18px 18px;
		background: linear-gradient(0deg, #1a0535 0%, #05010c 100%);
		border: 1px solid #d836fc;
		box-shadow:
			inset 0 0 22px rgba(216, 54, 252, 0.1),
			0 10px 26px rgba(0, 0, 0, 0.45);
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
		font-family: Helvetica, Arial, sans-serif;
		font-size: 1rem;
		font-weight: 700;
		letter-spacing: 0.03em;
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
		font-size: 0.52rem;
		color: rgba(255, 255, 255, 0.75);
		letter-spacing: 0.02em;
		line-height: 1.45;
		display: block;
		min-height: 2.9em;
	}

	.card-price {
		font-family: Helvetica, Arial, sans-serif;
		font-size: 0.88rem;
		font-weight: 700;
		color: #fff;
		letter-spacing: 0.03em;
		display: block;
	}

	.card-btn {
		width: 100%;
		padding: 9px 0;
		border-radius: 12px;
		font-family: Helvetica, Arial, sans-serif;
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		cursor: pointer;
		border: 1px solid #b65df3;
		background-image: linear-gradient(0deg, #1a0535 0%, #000 100%);
		color: #fff;
		transition:
			background 0.2s,
			border-color 0.2s,
			color 0.2s;
		margin-top: 4px;
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
