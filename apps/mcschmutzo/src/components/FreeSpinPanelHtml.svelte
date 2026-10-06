<script lang="ts" module>
	// Module scope so the art preloads during the loading screen.
	import { ap } from '../lib/preloadArt';

	// Mobile: the soup pot carries the multiplier (desktop draws it next to the chef, SpecialMascot).
	const potArt = ap('/assets/mcschmutzo/special-pot-v2.webp');
</script>

<script lang="ts">
	import { stateBet, stateUi } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { flushPot, potState, queuePotShots } from '../game/potState.svelte';

	const context = getContext();

	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isFreegame = $derived(context.stateGame.gameType === 'freegame');
	const show = $derived(isFreegame || stateUi.freeSpinCounterShow);

	const current = $derived(stateUi.freeSpinCounterCurrent ?? 0);
	const total = $derived(stateUi.freeSpinCounterTotal ?? 0);
	// The accordion reveals the running win multiplier once it climbs above 1x.
	const mult = $derived(context.stateGame.globalMultiplier);
	const hasMult = $derived(mult > 1);
	// Publish the mobile pot's box to potState (canvas px) so the soup shots aim at it.
	let potEl: HTMLDivElement | undefined = $state();
	$effect(() => {
		const el = potEl;
		if (!el) return;
		let raf = 0;
		const measure = () => {
			const r = el.getBoundingClientRect();
			const c = document.querySelector('.mcschmutzo-stage canvas')?.getBoundingClientRect();
			const ox = c?.left ?? 0;
			const oy = c?.top ?? 0;
			const next = { x: r.left - ox, y: r.top - oy, w: r.width, h: r.height };
			const cur = potState.rect;
			if (!cur || Math.abs(cur.x - next.x) + Math.abs(cur.y - next.y) + Math.abs(cur.w - next.w) > 0.5) potState.rect = next;
			raf = requestAnimationFrame(measure);
		};
		raf = requestAnimationFrame(measure);
		return () => {
			cancelAnimationFrame(raf);
			potState.rect = null;
		};
	});
	// Running bonus total — the sum of every free-spin win (the bottom-right WIN shows only the
	// latest spin's win, this sums them). Set via the setTotalWin book event.
	const totalWin = $derived(bookEventAmountToCurrencyString(stateBet.winBookEventAmount));

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
		style={`--win-dim:${1 - context.stateGame.winDim};` + (row ? `--row-top:${row.top}px;--row-h:${row.h}px;--acc-top:${row.c - row.accH / 2}px;--acc-h:${row.accH}px` : '')}
	>
		<!-- FREE SPINS counter -->
		<div class="fp-card fp-fs">
			<span class="fp-card__label">{i18nDerived.translate('FREE SPINS')}</span>
			<span class="fp-card__value">{current}/{total}</span>
		</div>

		<!-- TOTAL WIN — the running sum of the free-spin wins. -->
		<div class="fp-card fp-total">
			<span class="fp-card__label">{i18nDerived.translate('TOTAL WIN')}</span>
			<span class="fp-card__value">{totalWin}</span>
		</div>

		<!-- Mobile: the soup pot with the multiplier on its front (same design as desktop: "MULTIPLIER"
		     printed on the pot, under it a #BCB7AF box with a 1 px #C10C01 border holding only the value —
		     in cqw of the pot, so it scales with it). Soup shots fly into it (potState.rect). -->
		{#if layoutType !== 'desktop'}
		<div class="fp-acc fp-pot" bind:this={potEl}>
			<img class="fp-pot__img" src={potArt} alt="" draggable="false" />
			<div class="fp-pot__front">
				<span class="fp-pot__label">{i18nDerived.translate('POT MULTIPLIER')}</span>
				{#key potState.mult}
					<div class="fp-pot__plaque" class:fp-pot__plaque--stamp={potState.mult > 1}>
						<span class="fp-pot__value">×{potState.mult}</span>
					</div>
				{/key}
			</div>
		</div>
		{/if}
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

	.fp-card,
	.fp-acc {
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
	/* FREE SPINS + TOTAL WIN cards (design 8274:11443): a heavier label and a much bigger value in the
	   game's display face (Bowlby One SC), so the spins left / the win read at a glance. */
	.fp-fs .fp-card__label,
	.fp-total .fp-card__label {
		font-weight: 800;
		font-size: clamp(11px, 1.3vw, 19px);
		opacity: 1;
	}
	.fp-fs .fp-card__value,
	.fp-total .fp-card__value {
		font-family: 'Bowlby One SC', sans-serif;
		font-weight: 400;
		font-size: clamp(22px, 2.6vw, 38px);
		letter-spacing: 0.03em;
	}

	/* Mobile soup pot + multiplier plaque (cqw = % of the pot width; the design pot is 376 px wide, so
	   1 design px = 0.266cqw). */
	.fp-pot {
		container-type: inline-size;
		aspect-ratio: 1271 / 914 !important;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
	}
	.fp-pot__img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	/* label + box block, centred on the pot body's front (body: 54% → 97% of the sprite, axis 49.8%) */
	.fp-pot__front {
		position: absolute;
		left: 49.8%;
		top: 78%;
		translate: -50% -50%;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.8cqw;
		font-family: 'Bowlby One SC', sans-serif;
		color: #c10c01;
		line-height: 1;
		white-space: nowrap;
	}
	.fp-pot__plaque {
		min-width: 29cqw; /* the design's 128 px box at a 438 px pot */
		box-sizing: border-box;
		display: flex;
		justify-content: center;
		padding: 3cqw 4.4cqw;
		background: #bcb7af;
		border: 1px solid #c10c01;
		border-radius: 6cqw;
	}
	.fp-pot__label {
		font-size: 7cqw; /* the design's 18 px, enlarged — the mobile pot is small */
		text-box: trim-both cap alphabetic;
	}
	.fp-pot__value {
		font-size: 16cqw;
		text-box: trim-both cap alphabetic;
	}
	.fp-pot__plaque--stamp {
		animation: fp-pot-stamp 0.6s cubic-bezier(0.2, 1.5, 0.4, 1) both;
	}
	@keyframes fp-pot-stamp {
		from {
			scale: 1.45;
		}
		to {
			scale: 1;
		}
	}

	/* Multiplier accordion machine. */
	.fp-acc {
		container-type: inline-size;
		aspect-ratio: 1127 / 794;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.4));
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
	.fp[data-layout='portrait'] .fp-total,
	.fp[data-layout='portrait'] .fp-acc {
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
	.fp[data-layout='portrait'] .fp-acc {
		top: var(--acc-top, 70%);
		height: var(--acc-h, 56px);
		right: 3%;
		width: auto;
		aspect-ratio: 1127 / 794;
		max-width: 36%;
	}

	/* ── Desktop / landscape: FREE SPINS + TOTAL WIN stacked on the LEFT of the board, accordion above.
	   Sized in vmin (short side) so the pills shrink on tiny popouts (400x225) and clear the board's
	   left column, while staying full-size on normal mobile-landscape. ── */
	.fp:not([data-layout='portrait']) .fp-acc {
		left: 3%;
		top: 12%;
		width: clamp(96px, 34vmin, 230px);
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
		.fp:not([data-layout='portrait']) .fp-acc {
			top: 8%;
			width: clamp(70px, 32vmin, 140px);
		}
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
	.fp--dim {
		filter: brightness(var(--win-dim));
	}
</style>
