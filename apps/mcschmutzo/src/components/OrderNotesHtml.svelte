<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const ticketArt = ap('/assets/mcschmutzo/note-ticket.webp'); // 520×713
	const pinkArt = ap('/assets/mcschmutzo/note-pink.webp'); // 720×452
</script>

<script lang="ts">
	import { onMount } from 'svelte';

	import { getContext } from '../game/context';

	// Diner order notes pinned on the wall in the free space LEFT of the board (desktop base game only —
	// in free games that column holds the printer / FREE SPINS / TOTAL WIN). The cream ticket shows a
	// handwritten kitchen order that gets WRITTEN line by line and TICKED off as done; the next order
	// is pinned on top of it (the finished one stays underneath); the pink sticky carries a short kitchen memo that changes less often.
	const context = getContext();
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const isFreegame = $derived(context.stateGame.gameType === 'freegame');
	const show = $derived(layoutType === 'desktop' && !isFreegame);

	const ORDERS = [
		{ no: 127, table: 4, items: ['2x Smutz Burger', '1x Onion Rings', '1x Sausage', 'Large Smutz Cola'] },
		{ no: 128, table: 9, items: ['1x Cheese Melt', '1x Soup of the Day', 'extra KETCHUP!'] },
		{ no: 129, table: 2, items: ['3x Smutz Burger', '2x Onion Rings', '3x Smutz Cola', 'no mayo'] },
		{ no: 130, table: 6, items: ['1x Sausage', '1x Cheese Melt', 'Avocado Ranch dip', 'to go'] },
		{ no: 131, table: 1, items: ['2x Soup of the Day', '1x Smutz Burger', 'BBQ on the side'] },
	];
	const MEMOS = [
		['NO MAYO', 'on #6!'],
		["Grill's HOT", '- careful!'],
		['Ketchup', 'refill ASAP'],
		['Table 4 =', 'VIP :)'],
	];

	const CYCLE = 7200; // ms per order: pin on top → write → hold → tick
	const WRITE = 1600; // ms to write the lines
	const TICK = 5200; // when the order is ticked off
	let clock = $state(0);
	onMount(() => {
		let raf = 0;
		const t0 = performance.now();
		const loop = (ts: number) => {
			clock = Math.max(0, ts - t0); // first rAF can land before t0
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const k = $derived(Math.floor(clock / CYCLE));
	const u = $derived(clock % CYCLE);
	const order = $derived(ORDERS[k % ORDERS.length]);
	const memo = $derived(MEMOS[Math.floor(clock / (CYCLE * 2.5)) % MEMOS.length]);
	// Each line reveals left→right (a pen writing it), one after another.
	const lineReveal = (i: number, n: number) => {
		const per = WRITE / (n + 1); // header counts as a line
		return Math.max(0, Math.min(1, (u - i * per) / per));
	};
	const ticked = $derived(u > TICK);
	// A new ticket is pinned ON TOP of the finished one: it drops in from a little above with a small
	// swing and settles on its tape. The previous (ticked) ticket stays pinned underneath, slightly
	// offset + tilted, so orders pile up instead of vanishing (only the one below that is removed).
	const PIN = 420;
	const pinStyle = (rest: number) => {
		if (u < PIN) {
			const p = u / PIN;
			const e = 1 - (1 - p) ** 3;
			return `transform: translateY(${(-14 * (1 - e)).toFixed(1)}%) rotate(${(rest + 5 * (1 - e)).toFixed(2)}deg); opacity:${Math.min(1, p * 3).toFixed(2)}`;
		}
		const sw = Math.exp(-(u - PIN) / 500) * Math.sin((u - PIN) / 90) * 1.6; // settle swing on its tape
		return `transform: rotate(${(rest + sw).toFixed(2)}deg)`;
	};
	// Per-order resting offset/tilt so the pile looks hand-pinned (deterministic per slot).
	const restOf = (n: number) => ({ x: ((n * 37) % 7) - 3, r: (((n * 53) % 9) - 4) * 0.9 });
	// The pile: the oldest (fading out underneath while the new one lands), the finished one, and the
	// new one being pinned on top. Every ticket keeps its OWN element + resting pose for its whole
	// life, so nothing jumps when the next order arrives — the loop repeats seamlessly.
	const pile = $derived(
		[k - 2, k - 1, k]
			.filter((n) => n >= 0)
			.map((n) => {
				const o = ORDERS[n % ORDERS.length];
				const r = restOf(n);
				const top = n === k;
				let style = `transform: rotate(${r.r}deg)`;
				if (top) style = pinStyle(r.r);
				else if (n === k - 2) style += `; opacity:${Math.max(0, 1 - u / PIN).toFixed(2)}`;
				return { n, o, x: r.x, style, top };
			}),
	);

	// Place the pair in the gutter between the screen's left edge and the board.
	const box = $derived.by(() => {
		const canvas = context.stateLayoutDerived.canvasSizes();
		const main = context.stateLayoutDerived.mainLayout();
		const b = context.stateGameDerived.boardLayout();
		const boardLeft = main.x - (main.width * main.scale) / 2 + (b.x - b.width / 2) * main.scale;
		const boardTop = main.y - (main.height * main.scale) / 2 + (b.y - b.height / 2) * main.scale;
		const boardH = b.height * main.scale;
		const gutter = boardLeft;
		const w = Math.min(gutter * 0.6, boardH * 0.34, 230);
		return { left: gutter / 2, top: boardTop + boardH * 0.2, w, canvasH: canvas.height };
	});
	const winDim = $derived(context.stateGame.winDim);
</script>

{#if show && box.w > 70}
	<div
		class="notes"
		style={`left:${box.left}px;top:${box.top}px;--w:${box.w}px;filter:brightness(${1 - winDim})`}
		aria-hidden="true"
	>
		<!-- Pink kitchen memo, stuck behind the ticket's top-right. -->
		<div class="pink" style={`background-image:url('${pinkArt}')`}>
			{#key memo}
				<p class="hand pink__text"><span>{memo[0]}</span><span>{memo[1]}</span></p>
			{/key}
		</div>
		<div class="stack">
			{#each pile as t (t.n)}
				<div class="ticket" style={`background-image:url('${ticketArt}');left:${t.x}%;${t.style}`}>
					<div class="ticket__body hand">
						<p class="ticket__head" style={`--r:${t.top ? lineReveal(0, t.o.items.length) : 1}`}>
							<span>ORDER #{127 + t.n}</span><span class="ticket__table">T{t.o.table}</span>
						</p>
						<hr style={`--r:${t.top ? lineReveal(0, t.o.items.length) : 1}`} />
						{#each t.o.items as item, i (i)}
							<p
								class="ticket__line"
								class:ticket__line--done={!t.top || ticked}
								style={`--r:${t.top ? lineReveal(i + 1, t.o.items.length) : 1}`}
							>
								{item}
							</p>
						{/each}
					</div>
					{#if !t.top || ticked}<span class="ticket__tick hand">✓</span>{/if}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.notes {
		position: absolute;
		z-index: 4;
		width: var(--w);
		transform: translateX(-50%);
		pointer-events: none;
		transition: filter 0.25s ease;
	}
	.hand {
		font-family: 'Caveat', 'Comic Sans MS', cursive;
		font-weight: 600;
		color: #2c2320;
	}
	.stack {
		position: relative;
		width: 100%;
		aspect-ratio: 520 / 713;
	}
	.ticket {
		position: absolute;
		top: 0;
		width: 100%;
		aspect-ratio: 520 / 713;
		background: center / 100% 100% no-repeat;
		transform-origin: 50% 3%; /* hangs from its tape */
		filter: drop-shadow(0 6px 8px rgba(0, 0, 0, 0.35));
	}
	.ticket__body {
		position: absolute;
		left: 13%;
		right: 12%;
		top: 16%;
		font-size: calc(var(--w) * 0.105);
		line-height: 1.12;
		transform: rotate(-1.5deg);
	}
	.ticket__body p {
		margin: 0;
		white-space: nowrap;
		/* A pen writing the line: reveal left → right. */
		clip-path: inset(0 calc((1 - var(--r)) * 100%) 0 0);
	}
	.ticket__head {
		display: flex;
		justify-content: space-between;
		font-size: 1.12em;
		color: #7a1a10;
	}
	.ticket__table {
		color: #2c2320;
	}
	.ticket__body hr {
		border: 0;
		border-top: 2px solid rgba(60, 40, 30, 0.55);
		margin: 0.15em 0 0.3em;
		transform-origin: 0 50%;
		transform: scaleX(var(--r));
	}
	/* Done: each line gets struck through (a quick pen stroke). */
	.ticket__line {
		position: relative;
	}
	.ticket__line::after {
		content: '';
		position: absolute;
		left: -2%;
		top: 55%;
		height: 2px;
		width: 104%;
		background: rgba(40, 30, 25, 0.75);
		transform-origin: 0 50%;
		transform: scaleX(0);
		transition: transform 0.25s ease-out;
	}
	.ticket__line--done::after {
		transform: scaleX(1);
	}
	.ticket__line--done:nth-child(4)::after { transition-delay: 0.08s; }
	.ticket__line--done:nth-child(5)::after { transition-delay: 0.16s; }
	.ticket__line--done:nth-child(6)::after { transition-delay: 0.24s; }
	.ticket__tick {
		position: absolute;
		right: 10%;
		bottom: 12%;
		font-size: calc(var(--w) * 0.36);
		line-height: 1;
		color: #1f7a2a;
		transform: rotate(-8deg);
		animation: tick-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
	}
	@keyframes tick-in {
		from {
			transform: rotate(-8deg) scale(2);
			opacity: 0;
		}
		to {
			transform: rotate(-8deg) scale(1);
			opacity: 1;
		}
	}
	.pink {
		position: absolute;
		width: 78%;
		aspect-ratio: 720 / 452;
		left: 48%;
		top: 88%;
		background: center / 100% 100% no-repeat;
		transform: rotate(6deg);
		filter: drop-shadow(0 5px 7px rgba(0, 0, 0, 0.3));
	}
	.pink__text {
		position: absolute;
		inset: 28% 10% 12% 12%;
		margin: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		font-size: calc(var(--w) * 0.11);
		line-height: 1.05;
		color: #6a1830;
		transform: rotate(-3deg);
		animation: memo-in 0.6s ease-out both;
	}
	@keyframes memo-in {
		from {
			clip-path: inset(0 100% 0 0);
		}
		to {
			clip-path: inset(0 0 0 0);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ticket,
		.pink__text,
		.ticket__tick {
			animation: none;
		}
	}
</style>
