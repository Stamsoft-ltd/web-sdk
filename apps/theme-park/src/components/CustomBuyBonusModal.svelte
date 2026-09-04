<script lang="ts" module>
	import { ap } from '../lib/preloadArt';
	import { fitLabel, fitHeight, fitFont } from '../lib/fitLabel';

	// The suffix is the CACHE-BUST, and the three facades are NOT on the same one. Renaming is how
	// art is retired here — the filename is the cache key on Stake's CDN, so a browser holding the
	// old file goes on serving it — and Roller Wilds and Mega Coaster were redrawn and moved from
	// `-marquee` to `-still` (see game/assets.ts, which does the same for their in-game sprites)
	// while Duck Your Luck never went through that rebuild and still ships as `-marquee`.
	//
	// This screen asked all three for `-marquee`, so the two that had moved requested files that do
	// not exist and drew an empty 55x55 box at EVERY breakpoint — the <picture> below points all
	// three of its sources at the same basename. Hence one suffix per facade, not one for the set.
	const MODE_ART_SUFFIX: Record<string, string> = {
		'duck-your-luck': 'marquee',
		'roller-wilds': 'still',
		'mega-coaster': 'still',
	};
	const modeAsset = (icon: string, variant: 'desktop' | 'mobile' | 'mobile-landscape') =>
		ap(`/assets/theme-park/v2/modes/${icon}-${variant}-${MODE_ART_SUFFIX[icon]}.webp`);
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
	import config from '../game/config';
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
	// Prices come off the same `config.betModes` table the RGS is told about, never typed here — a
	// price on a card that disagrees with what the player is charged is R-03 in
	// STAKE_REVIEW_LESSONS.md, and it reached review once already.
	const costOf = (mode: BetMode) => config.betModes[mode].cost;

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
	const formattedBet = $derived(templateStakeDerived.formatWallet(betAmount));
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
			costMultiplier: costOf('ANTE'),
			title: 'BET MODE ANTE TITLE',
			desc: 'BET MODE ANTE DIALOG',
		},
		{
			mode: 'FSPIN1',
			costMultiplier: costOf('FSPIN1'),
			title: 'BET MODE FSPIN1 TITLE',
			desc: 'BET MODE FSPIN1 DIALOG',
		},
		{
			mode: 'FSPIN2',
			costMultiplier: costOf('FSPIN2'),
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
			costMultiplier: costOf('DUCK'),
			title: 'BET MODE DUCK TITLE',
			desc: 'BET MODE DUCK DIALOG',
			icon: 'duck-your-luck',
		},
		{
			mode: 'ROLLER',
			costMultiplier: costOf('ROLLER'),
			title: 'BET MODE ROLLER TITLE',
			desc: 'BET MODE ROLLER DIALOG',
			icon: 'roller-wilds',
		},
		{
			mode: 'COASTER',
			costMultiplier: costOf('COASTER'),
			title: 'BET MODE COASTER TITLE',
			desc: 'BET MODE COASTER DIALOG',
			icon: 'mega-coaster',
		},
	];

	const cost = (multiplier: number) =>
		templateStakeDerived.formatWallet(betAmount * multiplier);

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
		stateBetDerived.setNormalSpeed();
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
		<h2 class="title">{t('BUY BONUS')}</h2>

		<div class="grid">
			{#each FEATURE_CARDS as card (card.mode)}
				<div class="card card--toggle">
					<span class="card-title" use:fitLabel={{ dep: t(card.title) }}>{t(card.title)}</span>
					<span class="card-desc" use:fitHeight={t(card.desc)}>{t(card.desc)}</span>
					<span class="card-price" use:fitFont={`${cost(card.costMultiplier)} ${t('PER SPIN')}`}
						>{cost(card.costMultiplier)} {t('PER SPIN')}</span
					>
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
					<span class="card-title" use:fitLabel={{ dep: t(card.title) }}>{t(card.title)}</span>
					<span class="card-desc" use:fitHeight={t(card.desc)}>{t(card.desc)}</span>
					<picture class="mode-art">
						<source
							media="(max-width: 900px) and (orientation: landscape)"
							srcset={modeAsset(card.icon, 'mobile-landscape')}
						/>
						<source media="(max-width: 900px)" srcset={modeAsset(card.icon, 'mobile')} />
						<img src={modeAsset(card.icon, 'desktop')} alt="" />
					</picture>
					<span class="card-price" use:fitFont={cost(card.costMultiplier)}
						>{cost(card.costMultiplier)}</span
					>
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
					<span class="bet-readout__label" use:fitFont={i18nDerived.betLabel()}
						>{i18nDerived.betLabel()}</span
					>
					<span class="bet-readout__value" use:fitFont={formattedBet}>{formattedBet}</span>
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
	@media (pointer: coarse) {
		.buy-overlay {
			--close-clear: calc(max(min(100vw / 1200, 100vh / 670, 1.25px), 0.8214px) * 73);
		}
	}

	.buy-overlay {
		position: absolute;
		inset: 0;
		z-index: 60;
		container-type: size;
		background: rgba(4, 1, 12, 0.8);
		font-family: 'Nunito Sans', sans-serif;
		/* The shared close button sits in the viewport's top-right corner, and on a touch screen it is
		   floored to a 40px tap target — proportionally BIGGER than the --u-scaled modal, dropping over
		   the top-right card. This is the y its bottom edge reaches (its own formula × 84 ≈ bottom + a
		   small gap, now that the button sits at 18 rather than 29); the grid keeps its top row clear of
		   it. Keep the expression identical to
		   <PopupCloseButton>'s --close-u, floor included: with a mouse it now scales with this modal and
		   the clearance collapses to almost nothing on its own. */
		--close-clear: calc(min(100vw / 1200, 100vh / 670, 1.25px) * 73);
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

	/* Node 7058:10362/10381 — 1041 wide at x 80, two rows of three with a 12 gutter, the block
	   centred 17u above the frame's middle: 202-tall spin cards over 259-tall buy cards, i.e. 473
	   of height running 81.5..554.5. The rows are deliberately unequal: the buys are taller because
	   they carry a logo. */
	.grid {
		position: absolute;
		left: calc(var(--u) * 80);
		/* Start below the close button when it (floored) reaches lower than the design's top, so the
		   top-right card never sits under it. Pinned by top+bottom (not height) with proportional rows,
		   so the cards simply shrink to the room that leaves instead of overrunning the bet row. */
		top: max(calc(var(--u) * 81.5), var(--close-clear));
		/* 100.5, not the design's 115.5: the bet row below sat 27u clear of the stage floor doing
		   nothing while the buy cards had 1px of slack in them, so 15u of that band comes up here and
		   the row moves down to match. The row still keeps 12u under it. */
		bottom: calc(var(--u) * 100.5);
		width: calc(var(--u) * 1041);
		display: grid;
		/* minmax(0,1fr) — not 1fr — so a long nowrap title (localized) can't inflate a track past its
		   share and push the card off-screen; the title is then bounded and fitLabel shrinks it. */
		grid-template-columns: repeat(3, minmax(0, 1fr));
		/* 1.362, up from 1.282: the 15u above is handed to the BUY row alone. The toggle cards are
		   already the size their content wants — measured at 3.8px of slack — so growing them would
		   only open a gap under their button. */
		grid-template-rows: 1fr 1.362fr;
		gap: calc(var(--u) * 12);
	}

	/* A flat plate — the redesign (7058:10255) drops the neon frame art and the marching lights this
	   screen used to run round it: #270544 inside a 1px #5e4374 line, radius 13. Drawn rather than
	   an image, so there is no art to stretch and nothing to crop. */
	.card {
		position: relative;
		box-sizing: border-box;
		/* Let the card shrink to its grid track instead of being held open by a nowrap child (the
		   title): without this a long localized title inflates the 1fr track and the card runs off
		   the screen edge (e.g. ru "ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ"). Pairs with minmax(0,1fr) on the grid. */
		min-width: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		background: #270544;
		border: 1px solid #5e4374;
		border-radius: calc(var(--u) * 13);
	}

	/* Paddings and the margins below add up to the design's stack inside its 202 / 259 cards:
	   toggle 12+26+4+44+6+36+8+50+12 = 198; buy 12+26+4+42+5+55+5+36+8+50+12 = 255. */
	.card--toggle {
		padding: calc(var(--u) * 12) calc(var(--u) * 16);
	}
	/* Tighter than the toggle cards' 12: this card carries a block more than they do (the emblem),
	   and the 2u top and bottom go to the description below. */
	.card--buy {
		padding: calc(var(--u) * 10) calc(var(--u) * 16);
	}

	/* 21.9px Lilita One in the sign gold (nodes 7063:18660 etc). Flat gold, not the brand ramp the
	   old cards used: the redesign puts every card title in #ffba3e, the same gold as the marquee
	   headlines, and a gradient that fades to blue at the baseline was the least legible thing on
	   the screen at card size. Still uppercase — the design types these in title case, but the
	   titles are i18n strings shared with the HUD and the info modal in 18 locales. */
	.card-title {
		font-family: 'Lilita One', sans-serif;
		font-size: calc(var(--u) * 21.9);
		line-height: calc(var(--u) * 26);
		font-weight: 400;
		letter-spacing: calc(var(--u) * 0.66);
		text-transform: uppercase;
		color: #ffba3e;
		white-space: nowrap;
		/* No max-width: the box hugs the full (nowrap) title so fitLabel's transform shrinks the WHOLE
		   string to fit the card. With max-width:100% the text was truncated at the card edge first —
		   a Cyrillic/fallback title like ru "ДОПОЛНИТЕЛЬНАЯ ФУНКЦИЯ" lost its tail. overflow:hidden
		   stays (keeps the title's grid-track min-content at 0 so it can't re-inflate the column). */
		overflow: hidden;
	}

	/* Nunito #e6e3e9 (nodes 7063:18659 etc). The design sets 11px on the spin cards and 12 on the
	   taller buy cards; both run a step over that, because at the design sizes this copy reads small
	   against its own title. The height is fixed so a long description can never push its card
	   taller than its row-mates — see the box heights below for what that costs. */
	.card-desc {
		margin-top: calc(var(--u) * 4);
		/* Leading close under the font's own, so three lines land inside the box below rather than
		   having the third clipped in half. */
		line-height: 1.24;
		color: #e6e3e9;
		display: -webkit-box;
		-webkit-line-clamp: 3;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	/* 46u, not the design's 44: three lines of 12u type at this leading measure 44.6u, so the
	   authored box clipped its own third line and `fitHeight` shrank any description that ran the
	   full width. 46u is every pixel these cards have spare — measured at 3.7px of slack under the
	   button at 1600x900. The portrait column below has no such ceiling: its box is auto. */
	.card--toggle .card-desc {
		font-size: calc(var(--u) * 12);
		letter-spacing: calc(var(--u) * 0.36);
		height: calc(var(--u) * 46);
	}
	/* 70u — four lines of 13.5u type — where the design draws 42, and a fourth line where it allows
	   three. The longest description in the game (ROLLER, ~200 characters) is four lines wide at card
	   type, and in the old box `fitHeight` shrank it to 12.4px beside neighbours at 18. The room came
	   from the 15u of dead band under the bet row, handed to this row alone by the row ratio above,
	   plus 9u off this card's own paddings and margins. It now renders at 16.9px, one shrink step off
	   full size; the clamp matches the box, so a translation longer still is scaled rather than cut. */
	.card--buy .card-desc {
		margin-top: calc(var(--u) * 3);
		font-size: calc(var(--u) * 13.5);
		letter-spacing: calc(var(--u) * 0.4);
		height: calc(var(--u) * 70);
		-webkit-line-clamp: 4;
	}

	/* 55x55 logo box (nodes 6695:5007 etc). */
	.mode-art {
		margin-top: calc(var(--u) * 4);
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

	/* The price is a CHIP in the redesign (nodes 7063:18657 etc), not a bare line: Lilita One white
	   on a #341451 plate, radius 7, 10 of padding all round. */
	/* The pill hugs its text, but never past the card: a long currency ("RUB 50 000.00 / SPIN")
	   would otherwise widen it straight through the card's border. Capped here and shrunk by
	   fitFont, so the price stays readable and the pill keeps its designed padding and height. */
	.card-price {
		font-family: 'Lilita One', sans-serif;
		font-weight: 400;
		color: #fff;
		white-space: nowrap;
		box-sizing: border-box;
		max-width: 100%;
		overflow: hidden;
		background: #341451;
		border-radius: calc(var(--u) * 7);
		padding: calc(var(--u) * 8) calc(var(--u) * 14);
	}
	.card--toggle .card-price {
		margin-top: calc(var(--u) * 6);
		font-size: calc(var(--u) * 15);
		line-height: calc(var(--u) * 18);
	}
	.card--buy .card-price {
		margin-top: calc(var(--u) * 4);
		font-size: calc(var(--u) * 16);
		line-height: calc(var(--u) * 19);
	}

	/* 50-tall button, radius 12 (nodes 7063:18656 / 18718 etc). The toggles are a flat #21013d
	   inside a #63307d line; the buys keep the brand gradient, now edged in #d836fc. An armed
	   toggle takes the gradient too, to read as "on". */
	.card-btn {
		width: 100%;
		height: calc(var(--u) * 50);
		box-sizing: border-box;
		padding: 0;
		border: 1px solid #63307d;
		border-radius: calc(var(--u) * 12);
		background: #21013d;
		background-image: none;
		color: #fff;
		font-family: 'Lilita One', sans-serif;
		line-height: calc(var(--u) * 20);
		font-weight: 400;
		letter-spacing: calc(var(--u) * 1.4);
		text-transform: uppercase;
		cursor: pointer;
		filter: drop-shadow(0 calc(var(--u) * 4) calc(var(--u) * 2) rgba(0, 0, 0, 0.25));
		transition: filter 0.2s;
	}
	.card--toggle .card-btn {
		margin-top: calc(var(--u) * 8);
		font-size: calc(var(--u) * 16);
	}
	.card--buy .card-btn {
		margin-top: calc(var(--u) * 6);
		font-size: calc(var(--u) * 18);
	}
	.card-btn--active,
	.card-btn--primary {
		border-color: #d836fc;
		background-image: linear-gradient(170.57deg, #d836fc 0%, #272fdd 100%);
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
		/* 583, down from the design's 568, by the 15u the grid above took. */
		top: calc(var(--u) * 583);
		transform: translateX(-50%);
		box-sizing: border-box;
		width: calc(var(--u) * 268);
		height: calc(var(--u) * 75);
		display: flex;
		align-items: center;
		justify-content: center;
		/* The steppers are inset from the plate's line rather than pressed against it (design ask,
		   2026-08-27). It has to be padding, not slack: the readout between them is a `flex: 1 1 0`
		   slot that takes whatever is left, so any gap left to chance closes the moment the bet is a
		   long one — which is exactly when the row is most crowded. */
		padding: 0 calc(var(--u) * 10);
		gap: calc(var(--u) * 12);
		/* Flat, like the cards: #1d013c inside the same #5e4374 line (node 7058:10349). */
		background: #1d013c;
		border: 1px solid #5e4374;
		border-radius: calc(var(--u) * 7.3);
	}

	/* 48.696 circles carrying the HUD's own -/+ glyphs at their designed sizes. */
	.bet-step {
		flex: 0 0 auto;
		width: calc(var(--u) * 48.696);
		height: calc(var(--u) * 48.696);
		padding: 0;
		box-sizing: border-box;
		/* The same rim its twin in <CustomAutoSpinModal> wears — one control, two panels, and it was
		   the only one still on a flat magenta hairline. */
		border: 1px solid transparent;
		border-radius: 9999px;
		background:
			linear-gradient(0deg, #1a0535 0%, #000 100%) padding-box,
			linear-gradient(135deg, #d836fc 0%, #272fdd 100%) border-box;
		/* Resting rim glow (design ask, 2026-08-26); see .nav-btn in <HudHtml>. */
		box-shadow:
			0 0 calc(var(--u) * 5) calc(var(--u) * 0.5) rgba(197, 106, 255, 0.5),
			0 0 calc(var(--u) * 14) calc(var(--u) * 2) rgba(124, 48, 221, 0.32);
		display: grid;
		place-items: center;
		cursor: pointer;
		transition:
			transform 0.12s ease,
			filter 0.12s ease,
			box-shadow 0.12s ease;
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
	@media (hover: hover) {
		.bet-step:not(:disabled):hover {
			filter: brightness(1.2);
			box-shadow: 0 0 calc(var(--u) * 9) calc(var(--u) * 1.5) rgba(160, 96, 246, 0.85);
		}
	}
	.bet-step:not(:disabled):active {
		transform: translateY(1px) scale(0.96);
	}

	/* `flex: 1 1 0` rather than a content width: the slot is then exactly the room the two stepper
	   circles leave, whatever the readout says, and `justify-content: center` keeps the coin and the
	   readout where the design centres them. A content-sized slot is what let "RUB 100.00" run out
	   of the plate and under the + button — and it is also what makes a font-shrinking fitter
	   oscillate, since the slot would grow back the moment the text shrank to fit it. */
	.bet-mid {
		display: flex;
		flex: 1 1 0;
		align-items: center;
		justify-content: center;
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
	/* Stretch, not flex-start: the label and the value have to inherit this box's width for fitFont
	   to have anything to measure against — flex-start would size each of them to its own text and
	   let it hang out of the plate. They keep the design's left alignment by text-align. */
	.bet-readout {
		display: flex;
		flex: 0 1 auto;
		flex-direction: column;
		align-items: stretch;
		text-align: left;
		min-width: 0;
		overflow: hidden;
	}
	.bet-readout__label {
		white-space: nowrap;
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
			grid-template-columns: minmax(0, 1fr);
			grid-template-rows: none;
			grid-auto-rows: min-content;
			/* overflow-y:auto makes overflow-x compute to auto too, so the scroll column CLIPS sideways
			   at its padding edge. Kept as breathing room round the cards now that the frame they used
			   to carry (and the glow that spilled past it) is gone. */
			padding: calc(var(--u) * 2) calc(var(--u) * 8);
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
