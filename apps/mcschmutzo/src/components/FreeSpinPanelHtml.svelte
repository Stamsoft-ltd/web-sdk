<script lang="ts">
	import { stateBet, stateUi } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { flushPot, potState, queuePotShots } from '../game/potState.svelte';
	import { landscapeLayout } from '../game/landscapeLayout';

	const context = getContext();

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isFreegame = $derived(context.stateGame.gameType === 'freegame');
	const show = $derived(isFreegame || stateUi.freeSpinCounterShow);

	const current = $derived(stateUi.freeSpinCounterCurrent ?? 0);
	const total = $derived(stateUi.freeSpinCounterTotal ?? 0);
	// Tension near the end: the card warms up over the last spins, and burns red on the final one.
	const tension = $derived(total <= 1 || current <= 0 ? 0 : current >= total ? 2 : total - current <= 2 ? 1 : 0);
	// The accordion reveals the running win multiplier once it climbs above 1x.
	const mult = $derived(context.stateGame.globalMultiplier);
	const hasMult = $derived(mult > 1);
	// Running bonus total — the sum of every free-spin win (the bottom-right WIN shows only the
	// latest spin's win, this sums them). The book only sets it (setTotalWin) AFTER a spin's win
	// screen, so on its own it sat on the old total while WIN counted the new win up. It now counts
	// along: the total before this spin (taken while the spin's win is still 0) plus exactly what
	// the WIN readout shows (HudHtml's winShown), never below the book's total.
	let spinBase = $state(0);
	$effect(() => {
		if (context.stateGame.roundWin === 0) spinBase = stateBet.winBookEventAmount;
	});
	// (only inside the free spins - a lock re-spin there runs as gameType 'respin' and is part of the
	// same spin's win; the bonus total's own count-up at the end runs through the same readout, and
	// must not be added on top of the total)
	const inBonusSpin = $derived(
		isFreegame || (context.stateGame.gameType === 'respin' && context.stateGame.bonusMode === 'freegame'),
	);
	const shownSpinWin = $derived(inBonusSpin ? context.stateGame.winShown : 0);
	const totalWin = $derived(
		bookEventAmountToCurrencyString(Math.max(stateBet.winBookEventAmount, spinBase + shownSpinWin)),
	);

	// Portrait: the three panels sit in ONE row in the gap between the board's bottom edge and the
	// control bar — measured live (board from the pixi layout, bar from the DOM) so they never
	// collide with either on any phone (the fixed % positions overlapped both on short screens).
	let row = $state<{ top: number; h: number; c: number; accH: number } | null>(null);
	$effect(() => {
		if (!show || layoutType !== 'portrait') return;
		let raf = 0;
		const measure = () => {
			const main = context.stateLayoutDerived.mainLayout();
			const b = context.stateGameDerived.boardLayout();
			const boardBottom = main.y - (main.height * main.scale) / 2 + (b.y + b.height / 2) * main.scale;
			const bar = document.querySelector('.pt-controls')?.getBoundingClientRect();
			// The round spin button bulges above the bar in the middle — the row is centred between the
			// board and the BAR, and only its height is limited so it still clears the spin disc.
			const spin = document.querySelector('.pt-spin')?.getBoundingClientRect();
			if (bar) {
				const c = (boardBottom + bar.top) / 2;
				const clearSpin = spin ? 2 * (spin.top - 4 - c) : Infinity;
				const h = Math.max(24, Math.min(64, bar.top - boardBottom - 10, clearSpin));
				const top = c - h / 2;
				// The printer sits at the right, clear of the spin disc: a bit taller than the pills, but
				// always with ≥8px of air to the board above and the nav bar below.
				const accH = Math.max(h, Math.min(92, bar.top - boardBottom - 10, h * 1.7));
				if (!row || Math.abs(row.top - top) > 0.5 || Math.abs(row.h - h) > 0.5 || Math.abs(row.accH - accH) > 0.5)
					row = { top, h, c, accH };
			}
			raf = requestAnimationFrame(measure);
		};
		raf = requestAnimationFrame(measure);
		return () => cancelAnimationFrame(raf);
	});

	// Phone landscape (Figma 8302:23371): FREE SPINS over TOTAL WIN top-left, the pot bottom-left in
	// front of the chef (LandscapeChef) — game/landscapeLayout.
	const lsVars = $derived.by(() => {
		if (layoutType !== 'landscape') return '';
		const { cards: c, pot: p, u } = landscapeLayout(context, true);
		return (
			`;--ls-u:${u.toFixed(3)}px;--lc-left:${c.left.toFixed(1)}px;--lc-top:${c.top.toFixed(1)}px` +
			`;--lc-w:${c.w.toFixed(1)}px;--lc-h:${c.h.toFixed(1)}px;--lc-gap:${c.gap.toFixed(1)}px;--lc-s:${(c.w / (114 * u)).toFixed(3)}` +
			`;--pot-cx:${p.cx.toFixed(1)}px;--pot-cy:${p.cy.toFixed(1)}px;--pot-w:${p.w.toFixed(1)}px`
		);
	});

	// DEV preview: press 8 to force a free-games state (special bg + counter + multiplier + total).
	import { onMount } from 'svelte';

	onMount(() => {
		if (!import.meta.env.DEV) return;
		const onDev = (e: KeyboardEvent) => {
			// P: preview the end-of-round soup shots (two soups → +1 and +2 into the pot)
			if (e.code === 'KeyP') {
				queuePotShots(1, [{ reel: 1, row: 2 }]);
				queuePotShots(2, [{ reel: 3, row: 4 }]);
				void flushPot(potState.mult + 3);
				return;
			}
			if (e.code !== 'Digit8') return;
			context.stateGame.gameType = 'freegame';
			context.stateGame.globalMultiplier = context.stateGame.globalMultiplier > 1 ? 1 : 3;
			potState.mult = context.stateGame.globalMultiplier;
			stateUi.freeSpinCounterShow = true;
			stateUi.freeSpinCounterCurrent = 2;
			stateUi.freeSpinCounterTotal = 15;
			stateBet.winBookEventAmount = 20000; // preview a running total
		};
		window.addEventListener('keydown', onDev);
		return () => window.removeEventListener('keydown', onDev);
	});
</script>

{#if show}
	<div
		class="fp"
		data-layout={layoutType}
		class:fp--dim={context.stateGame.winDim > 0}
		class:fp--hidden={context.stateGame.freeSpinPopupShowing}
		class:fp--win-over={context.stateGame.winOver}
		style={`--win-dim:${1 - context.stateGame.winDim};` + (row ? `--row-top:${row.top}px;--row-h:${row.h}px;--acc-top:${row.c - row.accH / 2}px;--acc-h:${row.accH}px` : '') + lsVars}
	>
		<!-- FREE SPINS counter -->
		<div class="fp-card fp-fs" class:fp-fs--tense={tension === 1} class:fp-fs--final={tension === 2}>
			<span class="fp-card__label">{i18nDerived.translate('FREE SPINS')}</span>
			<!-- flips over and punches on every change (the {#key} replays it) -->
			{#key `${current}/${total}`}
				<span class="fp-card__value fp-flip">{current}/{total}</span>
			{/key}
		</div>

		<!-- TOTAL WIN — the running sum of the free-spin wins. -->
		<div class="fp-card fp-total">
			<span class="fp-card__label">{i18nDerived.translate('TOTAL WIN')}</span>
			<span class="fp-card__value">{totalWin}</span>
		</div>

	</div>
{/if}

<style>
	.fp {
		position: absolute;
		inset: 0;
		z-index: 6;
		pointer-events: none;
		font-family: 'Nunito', sans-serif;
	}
	/* out of the way while the CONGRATS card is up (its PRESS TO CONTINUE sits over this row) */
	.fp--hidden {
		opacity: 0;
		transition: opacity 0.2s ease;
	}

	.fp-card{
		position: absolute;
	}

	/* FREE SPINS / TOTAL WIN — small dark #1F1F1F card with a lighter top bevel, matching the HUD
	   readouts (BALANCE / WIN). Sizes to its content. */
	.fp-card {
		box-sizing: border-box;
		padding: clamp(6px, 0.9vw, 14px) clamp(10px, 1.4vw, 20px);
		border-radius: 4.21px;
		background: #1f1f1f;
		border-top: 1.28px solid #605553;
		box-shadow: 0 5px 12px rgba(0, 0, 0, 0.5);
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: clamp(2px, 0.4vw, 6px);
	}
	.fp-card__label,
	.fp-card__value {
		color: #ffffff;
		font-family: 'Nunito', sans-serif;
		font-weight: 600;
		letter-spacing: 0.03em;
		text-align: center;
		line-height: 1;
		white-space: nowrap;
	}
	.fp-card__label {
		font-size: clamp(9px, 1vw, 14px);
		text-transform: uppercase;
		opacity: 0.85;
	}
	.fp-card__value {
		font-size: clamp(17px, 1.9vw, 27px);
	}
	/* FREE SPINS + TOTAL WIN cards (design 8274:11443): the label in the brush face (the design's
	   Comica Brush → --font-brush) over a much bigger value in Nunito Regular, so the spins left / the
	   win read at a glance. */
	.fp-fs .fp-card__label,
	.fp-total .fp-card__label {
		font-family: var(--font-brush);
		-webkit-text-stroke: var(--brush-stroke) currentColor;
		font-weight: 400;
		font-size: clamp(11px, 1.3vw, 19px);
		opacity: 1;
	}
	.fp-fs .fp-card__value,
	.fp-total .fp-card__value {
		font-family: 'Nunito', sans-serif;
		font-weight: 400;
		font-size: clamp(22px, 2.6vw, 38px);
		letter-spacing: 0.03em;
	}

	/* The spin count flips over (top edge towards the player) and punches past full size, back-out. */
	.fp-flip {
		display: inline-block;
		animation: fp-flip 0.42s cubic-bezier(0.34, 1.56, 0.64, 1) both;
		transform-origin: 50% 60%;
	}
	@keyframes fp-flip {
		from {
			transform: perspective(200px) rotateX(-95deg) scale(1.3);
			opacity: 0;
		}
		45% {
			opacity: 1;
		}
		to {
			transform: perspective(200px) rotateX(0deg) scale(1);
		}
	}
	/* last spins: a warm pulsing rim; the final spin: red, faster */
	.fp-fs--tense {
		animation: fp-tense 1.1s ease-in-out infinite;
	}
	.fp-fs--final {
		animation: fp-final 0.6s ease-in-out infinite;
	}
	.fp-fs--final .fp-card__value {
		color: #ffd36b;
	}
	@keyframes fp-tense {
		0%,
		100% {
			box-shadow: 0 5px 12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 140, 40, 0.35);
		}
		50% {
			box-shadow: 0 5px 12px rgba(0, 0, 0, 0.5), 0 0 14px 2px rgba(255, 140, 40, 0.65);
		}
	}
	@keyframes fp-final {
		0%,
		100% {
			box-shadow: 0 5px 12px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(225, 30, 12, 0.6);
			scale: 1;
		}
		50% {
			box-shadow: 0 5px 12px rgba(0, 0, 0, 0.5), 0 0 20px 4px rgba(255, 50, 20, 0.85);
			scale: 1.04;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.fp-flip,
		.fp-fs--tense,
		.fp-fs--final {
			animation: none;
		}
	}
	/* The value "prints/stamps" onto the ticket: drops in big + tilted with an overshoot, then
	   settles — replayed whenever the multiplier value changes (the {#key} remounts it). */

	/* Indicator lights — soft glows layered over the painted lamps so they pulse/blink (machine alive).
	   `screen` blend brightens the underlying dot rather than covering it. */
	/* Glow overlays sit EXACTLY on the art's painted LED lenses (centres + lens size measured from
	   accordion.webp's black rings: green (17.66%, 10.33%), red (81.28%, 10.33%), lens ≈ 5% wide). */

	/* ── Portrait: FREE SPINS · TOTAL WIN · printer in one row, filling the board-to-control-bar gap
	   (--row-top / --row-h measured in the script). Everything scales off the row height. ── */
	.fp[data-layout='portrait'] .fp-fs,
	.fp[data-layout='portrait'] .fp-total {
		top: var(--row-top, 70%);
		height: var(--row-h, 56px);
	}
	.fp[data-layout='portrait'] .fp-card {
		box-sizing: border-box;
		width: 34%;
		padding: 0 4px;
		justify-content: center;
		gap: calc(var(--row-h, 56px) * 0.08);
	}
	.fp[data-layout='portrait'] .fp-fs {
		left: 3%;
		width: 27%;
	}
	.fp[data-layout='portrait'] .fp-total {
		left: 32%;
		width: 38%;
	}
	.fp[data-layout='portrait'] .fp-card__label {
		font-size: calc(var(--row-h, 56px) * 0.2);
	}
	.fp[data-layout='portrait'] .fp-card__value {
		font-size: calc(var(--row-h, 56px) * 0.36);
		white-space: nowrap;
	}
	.fp[data-layout='portrait'] .fp-fs .fp-card__label,
	.fp[data-layout='portrait'] .fp-total .fp-card__label {
		font-size: calc(var(--row-h, 56px) * 0.23);
	}
	.fp[data-layout='portrait'] .fp-fs .fp-card__value {
		font-size: min(calc(var(--row-h, 56px) * 0.44), 6.2vw);
	}
	/* the win can be long ($12,345.67): capped by the card's own width (cqw) so it never overflows */
	.fp[data-layout='portrait'] .fp-total {
		container-type: inline-size;
	}
	.fp[data-layout='portrait'] .fp-total .fp-card__value {
		font-size: min(calc(var(--row-h, 56px) * 0.44), 11.5cqw);
	}
	.fp:not([data-layout='portrait']) .fp-fs {
		left: 3.5%;
		top: 44%;
		min-width: clamp(84px, 28vmin, 210px);
	}
	.fp:not([data-layout='portrait']) .fp-total {
		left: 3.5%;
		top: 62%;
		min-width: clamp(84px, 28vmin, 210px);
	}

	/* Smallest landscape popouts (~400x225, ≤300px tall): shrink the FREE SPINS / TOTAL WIN pills and
	   the multiplier accordion so they don't dominate the tiny screen. Placed LAST so it wins over the
	   base rules (equal specificity → later wins). 812x375 (height 375) is unaffected. */
	@media (max-height: 300px) {
		.fp:not([data-layout='portrait']) .fp-fs {
			top: 42%;
			min-width: clamp(56px, 22vmin, 150px);
		}
		.fp:not([data-layout='portrait']) .fp-total {
			top: 60%;
			min-width: clamp(56px, 22vmin, 150px);
		}
		.fp-card {
			padding: 3px 7px;
			gap: 1px;
			border-radius: 3px;
		}
		.fp-card__label {
			font-size: clamp(6px, 3vmin, 9px);
		}
		.fp-card__value {
			font-size: clamp(11px, 5vmin, 16px);
		}
		.fp-fs .fp-card__label,
		.fp-total .fp-card__label {
			font-size: clamp(7px, 3.4vmin, 11px);
		}
		.fp-fs .fp-card__value {
			font-size: clamp(14px, 6.4vmin, 21px);
		}
		/* (the win is long in the wide display face — kept small enough to clear the board) */
		.fp-total .fp-card__value {
			font-size: clamp(9px, 4.2vmin, 14px);
		}
	}

	/* ── Phone landscape (Figma 8302:23371): FREE SPINS over TOTAL WIN in the top-left corner (114 × 52
	   design px each), the pot bottom-left in front of the chef. Placed by game/landscapeLayout; last
	   in the sheet so it wins over the shared desktop/landscape rules above. ── */
	.fp[data-layout='landscape'] .fp-fs,
	.fp[data-layout='landscape'] .fp-total {
		left: var(--lc-left);
		width: var(--lc-w);
		min-width: 0;
		height: var(--lc-h);
		padding: 0 calc(4 * var(--ls-u));
		gap: calc(4 * var(--ls-u) * var(--lc-s));
		container-type: inline-size;
	}
	.fp[data-layout='landscape'] .fp-fs {
		top: var(--lc-top);
	}
	.fp[data-layout='landscape'] .fp-total {
		top: calc(var(--lc-top) + var(--lc-h) + var(--lc-gap));
	}
	/* the same faces as every layout (8274:11443: brush label, Nunito Regular value) at the landscape
	   design's sizes (label 13.6, value 17.4 design px) */
	.fp[data-layout='landscape'] .fp-fs .fp-card__label,
	.fp[data-layout='landscape'] .fp-total .fp-card__label {
		font-size: calc(13.6 * var(--ls-u) * var(--lc-s));
		letter-spacing: 0.03em;
	}
	.fp[data-layout='landscape'] .fp-fs .fp-card__value,
	.fp[data-layout='landscape'] .fp-total .fp-card__value {
		font-size: min(calc(17.4 * var(--ls-u) * var(--lc-s)), 15cqw);
		letter-spacing: 0.03em;
	}
	.fp--dim {
		filter: brightness(var(--win-dim));
	}
	/* A BIG win screen: its splats are drawn on the canvas, under these cards, so the cards fade right
	   out and the win reads over them (the pot stays, dimmed, hiding the chef). */
	.fp-card {
		transition: opacity 0.3s ease;
	}
	.fp--win-over .fp-card {
		opacity: 0;
	}
</style>
