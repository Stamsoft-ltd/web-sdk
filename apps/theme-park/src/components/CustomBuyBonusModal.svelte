<script lang="ts" module>
	import { ap } from '../lib/preloadArt';
	import { fitLabel } from '../lib/fitLabel';

	// `-marquee` is the cache-bust suffix the flat redraws of these three facades ship under; the
	// filename is the cache key on Stake's CDN and they replaced art that shipped under the old
	// names. Safe to bake into the template here because every card on this screen is a redrawn
	// facade — unlike <CustomInfoModal>, which also lists art that never went through the redraw.
	const modeAsset = (icon: string, variant: 'desktop' | 'mobile' | 'mobile-landscape') =>
		ap(`/assets/theme-park/v2/modes/${icon}-${variant}-marquee.png`);
	// Neon gradient frame (download "S pad") — the glowing card border from the design, and the plate
	// behind the bet stepper. The design stretches this one image to fill each box and lets its own
	// rounded corners do the shaping, so the neon line stays proportional to the card at any size.
	// The de-lit variant (scripts/info/build_neon_frame.py): this screen runs real marching lights
	// round the same line, and the blobs painted into the original read as bulbs stuck on.
	const neonFrame = ap('/assets/theme-park/v2/hud/neon-frame-plain.png');
	// Stepper glyphs and coin — the very same SVGs the main HUD's bet row uses, so the lifted stepper
	// reads as that row rather than as a second, different control.
	const iconMinus = ap('/assets/theme-park/v2/hud/icon_minus.svg');
	const iconPlus = ap('/assets/theme-park/v2/hud/icon_plus.svg');
	const coinIcon = ap('/assets/theme-park/v2/hud/icon_coin.svg');

	for (const icon of ['duck-your-luck', 'roller-wilds', 'mega-coaster']) {
		for (const variant of ['desktop', 'mobile', 'mobile-landscape'] as const)
			modeAsset(icon, variant);
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
	import InfoBorderLights from './InfoBorderLights.svelte';
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

	// The marching lights are a canvas, so their radius and glow have to be real pixels rather than
	// the stylesheet's --u. A 100-unit-wide ruler element is measured instead of hard-coding the
	// relationship: --u is defined differently in landscape and portrait, and the ruler is right in
	// both without this file having to know which.
	let rulerWidth = $state(0);
	const u = $derived(rulerWidth / 100);

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

	// Row 1 of the design's grid: per-spin toggles, priced "/ SPIN". ANTE leads (node 6695:4876).
	const FEATURE_CARDS: {
		mode: ToggleMode;
		costMultiplier: number;
		title: string;
		desc: string;
	}[] = [
		{
			mode: 'ANTE',
			costMultiplier: 3,
			title: 'BET MODE ANTE TITLE',
			desc: 'BET MODE ANTE DIALOG',
		},
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

	// Row 2: one-shot bonus buys, each with its logo (node 6695:4894).
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
		FEATURE_CARDS.find((card) => card.mode === confirmMode) ??
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

<!-- Scrim + stage. The stage is the design's own 1200x670 frame scaled to fit, so every number in
     the stylesheet below is the Figma pixel straight off node 6695:4781. -->
<div class="buy-overlay" class:is-portrait={isPortrait} role="presentation" onclick={props.onclose}>
	<div
		class="stage"
		role="dialog"
		aria-modal="true"
		aria-label={t('BUY BONUS')}
		onclick={(e) => e.stopPropagation()}
	>
		<span class="unit-ruler" aria-hidden="true" bind:clientWidth={rulerWidth}></span>
		<h2 class="title">{t('BUY BONUS')}</h2>

		<div class="grid">
			{#each FEATURE_CARDS as card (card.mode)}
				<div class="card card--toggle">
					<img class="card-bg" src={neonFrame} alt="" aria-hidden="true" />
					{#if u}
						<InfoBorderLights radius={21 * u} inset={0} pad={14 * u} glow={7 * u} />
					{/if}
					<span class="card-title" use:fitLabel={{ dep: t(card.title) }}>{t(card.title)}</span>
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

			{#each BUY_CARDS as card (card.mode)}
				<div class="card card--buy">
					<img class="card-bg" src={neonFrame} alt="" aria-hidden="true" />
					{#if u}
						<InfoBorderLights radius={24 * u} inset={0} pad={14 * u} glow={7 * u} />
					{/if}
					<span class="card-title" use:fitLabel={{ dep: t(card.title) }}>{t(card.title)}</span>
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
						class="card-btn card-btn--primary"
						type="button"
						disabled={!canAfford(card.costMultiplier)}
						onclick={() => openConfirm(card.mode)}>{t('BUY')}</button
					>
				</div>
			{/each}
		</div>

		<!-- Bet stepper, lifted above the scrim at the design's spot (nodes 6695:4861-4873): the HUD's
		     own bet readout flanked by its two stepper circles, on the neon plate. The bar underneath
		     is dimmed by HudHtml for the duration, so this is the only live control down there. -->
		<div class="betrow">
			<img class="card-bg" src={neonFrame} alt="" aria-hidden="true" />
			{#if u}
				<InfoBorderLights radius={12 * u} inset={0} pad={12 * u} glow={6 * u} />
			{/if}
			<button
				class="bet-step"
				type="button"
				disabled={disableDecrease}
				onclick={() => stepBet(-1)}
				aria-label={t('DECREASE BET')}
			>
				<img class="bet-step__glyph bet-step__glyph--minus" src={iconMinus} alt="" />
			</button>
			<div class="bet-mid">
				<span class="bet-coin"><img src={coinIcon} alt="" /></span>
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
				<img class="bet-step__glyph bet-step__glyph--plus" src={iconPlus} alt="" />
			</button>
		</div>
	</div>
</div>

<!-- Screen-corner close, matching every other popup. Hidden while the confirm dialog is up, which
     brings its own in the same spot. -->
{#if !confirmMode}
	<PopupCloseButton onclick={props.onclose} label={t('CLOSE')} />
{/if}

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
	/* The overlay fills the game frame (not the viewport): the frame is what the design's 1200x670
	   maps onto, and container-type makes cqw/cqh mean "of that frame". */
	.buy-overlay {
		position: absolute;
		inset: 0;
		z-index: 60;
		container-type: size;
		background: rgba(4, 1, 12, 0.8);
		font-family: 'Nunito Sans', sans-serif;
		/* The shared close button sits in the viewport's top-right corner and is floored to a 40px tap
		   target, so on small screens it is proportionally BIGGER than the --u-scaled modal and drops
		   over the top-right card. This is the y its bottom edge reaches (its own formula × 84 ≈ bottom
		   + a small gap); the grid keeps its top row clear of it. */
		--close-clear: calc(clamp(0.8214px, 100vw / 1200, 1.25px) * 84);
	}

	/* One design pixel. `min` fits the 1200x670 frame inside whatever shape the game has — the game
	   itself scales its board by height, so on a normal desktop this resolves to the height term and
	   the whole screen lines up with the design. Everything below is then a literal Figma number. */
	.stage {
		--u: min(calc(100cqw / 1200), calc(100cqh / 670));
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: calc(var(--u) * 1200);
		height: calc(var(--u) * 670);
	}

	/* Measured, never seen: 100 design units wide and nothing tall, so `u` in the script is whatever
	   --u currently resolves to. */
	.unit-ruler {
		position: absolute;
		top: 0;
		left: 0;
		width: calc(var(--u) * 100);
		height: 0;
		pointer-events: none;
	}

	/* Node 6695:4860 — 26px Lilita One, white, centred, 27 down. White rather than the brand gradient
	   because it lands on the game logo, which the gradient disappeared into. */
	.title {
		position: absolute;
		left: 0;
		right: 0;
		top: calc(var(--u) * 27);
		margin: 0;
		font-family: 'Lilita One', sans-serif;
		font-size: calc(var(--u) * 26);
		line-height: calc(var(--u) * 30);
		font-weight: 400;
		letter-spacing: calc(var(--u) * 0.78);
		text-transform: uppercase;
		text-align: center;
		color: #fff;
		text-shadow: 0 calc(var(--u) * 2) calc(var(--u) * 8) rgba(0, 0, 0, 0.75);
	}

	/* Node 6695:4874 — 1041x453 at (80, 91), two rows of three with a 12 gutter. The rows are
	   deliberately unequal: the buys are taller because they carry a logo. */
	.grid {
		position: absolute;
		left: calc(var(--u) * 80);
		/* Start below the close button when it (floored) reaches lower than the design's 91u top, so the
		   top-right card never sits under it. Pinned by top+bottom (not height) with proportional rows,
		   so the cards simply shrink to the room that leaves instead of overrunning the bet row. */
		top: max(calc(var(--u) * 91), var(--close-clear));
		bottom: calc(var(--u) * 126);
		width: calc(var(--u) * 1041);
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		grid-template-rows: 1fr 1.27fr;
		gap: calc(var(--u) * 12);
	}

	/* The card is the neon frame stretched to fill, exactly as the design places it — so the glow
	   line stays proportional to the card instead of being a fixed pixel thickness that swamps it on
	   a small screen. The art carries its own dark interior and transparent corners. */
	.card {
		position: relative;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		/* The backdrop below is absolutely positioned, and a positioned element paints ABOVE static
		   inline content however early it sits in the DOM — without a stacking context of its own the
		   card art buried its own title, copy and price. Isolating keeps the two z-indexes local. */
		isolation: isolate;
	}

	/* The art does NOT fill its own canvas: measured against neon-frame.png (615x309) the neon line
	   peaks at x 21..590 and y 18..270, i.e. dead margin of 3.4/3.9% at the sides, 5.8% at the top and
	   12.3% at the bottom. Simply stretching it to the card box therefore drew the card ~7% narrower
	   and ~18% shorter than the box, which turned the design's 12px gutter into a ~70px canyon and
	   squashed every card's aspect. The design crops that margin off (its own image is placed at
	   104.78%/105.87% and clipped); these numbers are the same crop computed for THIS file, so the
	   neon line lands exactly on the card's edge. Left unclipped on purpose — the little bloom that
	   spills into the gutter is what the design shows between cards. */
	.card-bg {
		position: absolute;
		left: -3.691%; /* -21 / 569 */
		top: -7.143%; /* -18 / 252 */
		width: 108.084%; /* 615 / 569 */
		height: 122.619%; /* 309 / 252 */
		object-fit: fill;
		pointer-events: none;
		z-index: 0;
	}

	.card > :not(.card-bg, canvas) {
		position: relative;
		z-index: 1;
	}

	/* Paddings and the margins below add up to the design's exact stack:
	   toggle 16+29+5+48+4+19+9+44+20 = 194; buy 16+29+5+45+5+55+5+19+8+44+16 = 247. */
	.card--toggle {
		padding: calc(var(--u) * 16) calc(var(--u) * 20) calc(var(--u) * 20);
	}
	.card--buy {
		padding: calc(var(--u) * 16) calc(var(--u) * 20) calc(var(--u) * 16);
	}

	/* 24px Lilita One on the brand ramp (nodes 6695:4879 etc). */
	.card-title {
		font-family: 'Lilita One', sans-serif;
		font-size: calc(var(--u) * 24);
		line-height: calc(var(--u) * 29);
		font-weight: 400;
		letter-spacing: calc(var(--u) * 0.72);
		text-transform: uppercase;
		background-image: linear-gradient(171deg, #d836fc 0%, #272fdd 100%);
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		color: transparent;
		white-space: nowrap;
		max-width: 100%;
		overflow: hidden;
	}

	/* 12px Nunito Sans #d7d7d7 (nodes 6695:4880 etc). The height is fixed so a long description can
	   never push its card taller than its row-mates; three lines is what the design allows. */
	.card-desc {
		margin-top: calc(var(--u) * 5);
		font-size: calc(var(--u) * 12);
		/* 14.8, not Nunito's ~16.4 default: the design fits three lines into a 45-tall box, and at the
		   browser's own leading the third line was clipped in half. */
		line-height: calc(var(--u) * 14.8);
		letter-spacing: calc(var(--u) * 0.36);
		color: #d7d7d7;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.card--toggle .card-desc {
		height: calc(var(--u) * 48);
	}
	.card--buy .card-desc {
		height: calc(var(--u) * 45);
	}

	/* 55x55 logo box (nodes 6695:5007 etc). */
	.mode-art {
		margin-top: calc(var(--u) * 5);
		width: calc(var(--u) * 55);
		height: calc(var(--u) * 55);
		display: grid;
		place-items: center;
	}
	.mode-art img {
		display: block;
		max-width: 100%;
		max-height: 100%;
		object-fit: contain;
		filter: drop-shadow(0 calc(var(--u) * 3) calc(var(--u) * 5) rgba(0, 0, 0, 0.6));
		animation: mode-art-idle 3s ease-in-out infinite;
	}
	.card:nth-child(2n) .mode-art img {
		animation-delay: -1.5s;
	}
	.card:hover .mode-art img {
		animation-duration: 1.2s;
		filter: brightness(1.08) drop-shadow(0 0 calc(var(--u) * 10) rgba(255, 67, 220, 0.5));
	}
	@keyframes mode-art-idle {
		0%,
		100% {
			transform: translateY(0) scale(1);
		}
		50% {
			transform: translateY(-4%) scale(1.03);
		}
	}

	/* 16px Lilita One white (nodes 6695:4881 etc). */
	.card-price {
		font-family: 'Lilita One', sans-serif;
		font-size: calc(var(--u) * 16);
		line-height: calc(var(--u) * 19);
		font-weight: 400;
		color: #fff;
		white-space: nowrap;
	}
	.card--toggle .card-price {
		margin-top: calc(var(--u) * 4);
	}
	.card--buy .card-price {
		margin-top: calc(var(--u) * 5);
	}

	/* 300x44 button, radius 12, 1px #b65df3 (nodes 6695:4878 etc). The toggles are the dark fill and
	   the buys the brand gradient; an armed toggle takes the gradient too, to read as "on". */
	.card-btn {
		width: calc(var(--u) * 300);
		height: calc(var(--u) * 44);
		box-sizing: border-box;
		padding: 0;
		border: 1px solid #b65df3;
		border-radius: calc(var(--u) * 12);
		background-image: linear-gradient(0deg, #1a0535 0%, #000 100%);
		color: #fff;
		font-family: 'Lilita One', sans-serif;
		font-size: calc(var(--u) * 14);
		line-height: calc(var(--u) * 20);
		font-weight: 400;
		letter-spacing: calc(var(--u) * 1.4);
		text-transform: uppercase;
		cursor: pointer;
		filter: drop-shadow(0 calc(var(--u) * 4) calc(var(--u) * 2) rgba(0, 0, 0, 0.25));
		transition: filter 0.2s;
	}
	.card--toggle .card-btn {
		margin-top: calc(var(--u) * 9);
	}
	.card--buy .card-btn {
		margin-top: calc(var(--u) * 8);
	}
	.card-btn--active,
	.card-btn--primary {
		background-image: linear-gradient(171.66deg, #d836fc 0%, #272fdd 100%);
	}
	.card-btn:not(:disabled):hover {
		filter: brightness(1.14);
	}
	.card-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	/* Bet stepper on its 287x83 plate at (457, 568), centred on the frame (node 6695:4861). */
	.betrow {
		position: absolute;
		left: 50%;
		top: calc(var(--u) * 568);
		transform: translateX(-50%);
		box-sizing: border-box;
		width: calc(var(--u) * 287);
		height: calc(var(--u) * 83);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: calc(var(--u) * 14);
		/* Cropped the same way the cards are, so its own marching lights ride the neon line. */
		isolation: isolate;
	}

	.betrow > :not(.card-bg, canvas) {
		position: relative;
		z-index: 1;
	}

	/* 48.696 circles carrying the HUD's own -/+ glyphs at their designed sizes. */
	.bet-step {
		flex: 0 0 auto;
		width: calc(var(--u) * 48.696);
		height: calc(var(--u) * 48.696);
		padding: 0;
		box-sizing: border-box;
		border: 1px solid #d836fc;
		border-radius: 9999px;
		background-image: linear-gradient(0deg, #1a0535 0%, #000 100%);
		display: grid;
		place-items: center;
		cursor: pointer;
		transition:
			transform 0.12s ease,
			filter 0.12s ease;
	}
	.bet-step__glyph {
		display: block;
		object-fit: contain;
	}
	.bet-step__glyph--minus {
		width: calc(var(--u) * 13.854);
		height: calc(var(--u) * 2.13);
	}
	.bet-step__glyph--plus {
		width: calc(var(--u) * 13.854);
		height: calc(var(--u) * 13.854);
	}
	.bet-step:disabled {
		cursor: default;
		opacity: 0.45;
	}
	.bet-step:not(:disabled):hover {
		filter: brightness(1.2);
	}
	.bet-step:not(:disabled):active {
		transform: translateY(1px) scale(0.96);
	}

	.bet-mid {
		display: flex;
		align-items: center;
		gap: calc(var(--u) * 12);
		min-width: 0;
	}
	/* The glyph is 24 inside a 40 box, as in the HUD (node 6695:4866). */
	.bet-coin {
		flex: 0 0 auto;
		width: calc(var(--u) * 40);
		height: calc(var(--u) * 40);
		display: grid;
		place-items: center;
	}
	.bet-coin img {
		display: block;
		width: calc(var(--u) * 24);
		height: calc(var(--u) * 24);
		object-fit: contain;
	}
	.bet-readout {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		min-width: 0;
	}
	.bet-readout__label {
		font-size: calc(var(--u) * 10);
		line-height: calc(var(--u) * 15);
		letter-spacing: calc(var(--u) * 2);
		font-weight: 800;
		text-transform: uppercase;
		color: #bd46c6;
	}
	.bet-readout__value {
		font-family: 'Lilita One', sans-serif;
		font-size: calc(var(--u) * 24);
		line-height: calc(var(--u) * 32);
		font-weight: 400;
		color: #fff;
		white-space: nowrap;
	}

	/* Portrait: no design of its own, so the same cards run as one scrolling column sized off the
	   frame's WIDTH — a card is 92cqw across, which is what makes --u resolve to readable type here
	   (the landscape height term would give a card barely a third of the screen). Card heights go
	   auto so the full description shows rather than being clipped to three lines. */
	.buy-overlay.is-portrait {
		.stage {
			--u: calc(92cqw / 339);
			left: 0;
			top: 0;
			transform: none;
			width: 100%;
			height: 100%;
			display: flex;
			flex-direction: column;
			align-items: center;
			padding: calc(var(--u) * 20) 0;
			box-sizing: border-box;
		}
		.title {
			position: static;
			flex: 0 0 auto;
			margin-bottom: calc(var(--u) * 14);
		}
		.grid {
			position: static;
			flex: 1 1 auto;
			width: calc(var(--u) * 339);
			height: auto;
			min-height: 0;
			overflow-y: auto;
			grid-template-columns: 1fr;
			grid-template-rows: none;
			grid-auto-rows: min-content;
			/* overflow-y:auto makes overflow-x compute to auto too, so the scroll column CLIPS sideways
			   at its padding edge. The card's neon frame (card-bg) and its InfoBorderLights glow each
			   extend ~14u past the card, so without side padding the right (and left) border was sliced
			   off — this reserves the room the glow needs inside the clip. */
			padding: calc(var(--u) * 2) calc(var(--u) * 16);
			/* Drop the first full-width card clear of the floored close button (the title above the grid
			   already accounts for ~60u of the clearance). */
			margin-top: max(0px, calc(var(--close-clear) - var(--u) * 60));
			/* Six full-width cards never fit, so the column always scrolls. Fading the last few pixels
			   stops the card at the cut from reading as a broken one. */
			mask-image: linear-gradient(to bottom, #000 calc(100% - 24px), transparent);
		}
		.card-desc {
			height: auto;
			-webkit-line-clamp: initial;
		}
		/* Relative, NOT static: the plate art inside is absolutely positioned against this box, and a
		   static betrow handed it the overlay instead — so the neon frame stretched over the whole
		   screen and, because `isolation` keeps it inside this element's stacking context and this
		   element is last in the DOM, painted right over the title and the cards. The row itself is
		   laid out by the flex column, so relative costs nothing. */
		.betrow {
			position: relative;
			/* The landscape rule pins this row with left/top, and `relative` does not ignore those the
			   way `static` did — it offsets from the flow position instead, which pushed the row 568u
			   below the cards and half a screen to the right, i.e. off the bottom of the modal. */
			inset: auto;
			flex: 0 0 auto;
			transform: none;
			margin-top: calc(var(--u) * 12);
		}
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
