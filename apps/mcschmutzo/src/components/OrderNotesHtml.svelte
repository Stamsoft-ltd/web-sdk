<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const ticketArt = ap('/assets/mcschmutzo/note-ticket.webp'); // 520×713
	const pinkArt = ap('/assets/mcschmutzo/note-pink.webp'); // 720×452
</script>

<script lang="ts">

	import { stateUi } from 'state-shared';

	import { getContext } from '../game/context';

	// Diner order notes pinned on the wall in the free space LEFT of the board (desktop base game only —
	// in free games that column holds the printer / FREE SPINS / TOTAL WIN). The cream ticket shows a
	// handwritten kitchen order that gets WRITTEN line by line and TICKED off as done; the next order
	// is pinned on top of it (the finished one stays underneath); the pink sticky carries a short kitchen memo that changes less often.
	const context = getContext();
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	// Same test as Background.svelte's special-bg switch (free-spin counter shown for the whole bonus,
	// even while the per-spin gameType flips) — the notes belong to the REGULAR diner bg only.
	const isFreegame = $derived(context.stateGame.gameType === 'freegame' || stateUi.freeSpinCounterShow);
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
	// Only tick while the notes are on screen (they're unmounted during free games / non-desktop);
	// the clock still counts from the same t0, so the orders resume exactly where they'd be.
	const t0 = typeof performance === 'undefined' ? 0 : performance.now();
	$effect(() => {
		if (!show) return;
		let raf = 0;
		const loop = (ts: number) => {
			clock = Math.max(0, ts - t0); // first rAF can land before t0
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	// Hide (fade) while ANY popup or win screen is up: the notes are HTML above the game canvas, so
	// otherwise they'd sit on top of the pixi win pad / splashes and peek over modal backdrops.
	const POPUPS = '.bb-backdrop,.ap-backdrop,.cf-backdrop,.tu-backdrop,.fs-backdrop,.fo-backdrop,.wb-scene';
	let popupUp = $state(false);
	$effect(() => {
		if (!show) return;
		const id = setInterval(() => (popupUp = !!document.querySelector(POPUPS)), 200);
		return () => clearInterval(id);
	});
	const hidden = $derived(popupUp || context.stateGame.winDim > 0);
	// Entrance (they used to snap in): each time the notes come on — the splash handing over, back
	// from free games — the ticket drops onto the wall and swings on its tape, then the pink memo is
	// slapped on over its corner and its text written. CSS animations on mount (the {#if} remounts).
	const MEMO_WRITE_DELAY = 1050; // ms: the memo's text waits for the memo to land (first time only)
	let entering = $state(true);
	$effect(() => {
		if (!show) {
			entering = true;
			return;
		}
		const id = setTimeout(() => (entering = false), MEMO_WRITE_DELAY + 700);
		return () => clearTimeout(id);
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
		// Pinned on the plain cream WALL, not the red/white awning: the desktop diner art is
		// cover-scaled (1678×937), and in it the awning ends at 25% of the height and the darker lower
		// wall panel starts at ~62%. The notes start just under the awning (27.5%) and are sized so the
		// whole stack (ticket + pink sticky ≈ 1.45 × width tall) ends above that lower panel.
		const artAsp = 1678 / 937;
		const coverH = canvas.width / canvas.height > artAsp ? canvas.width / artAsp : canvas.height;
		const artTop = (canvas.height - coverH) / 2;
		const top = artTop + coverH * 0.275;
		const room = coverH * (0.6 - 0.275);
		const w = Math.min(gutter * 0.6, room / 1.45, 230);
		void boardTop;
		void boardH;
		return { left: gutter / 2, top, w, canvasH: canvas.height };
	});
</script>

{#if show && box.w > 70}
	<div
		class="notes"
		style={`left:${box.left}px;top:${box.top}px;--w:${box.w}px;opacity:${hidden ? 0 : 1}`}
		aria-hidden="true"
	>
		<div class="stack notes-enter">
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
		<!-- Pink kitchen memo, stuck OVER the ticket's lower-right corner (on top, so the memo reads). -->
		<div class="pink notes-enter" style={`background-image:url('${pinkArt}')`}>
			{#key memo}
				<p class="hand pink__text" style={entering ? `animation-delay:${MEMO_WRITE_DELAY}ms` : ''}><span>{memo[0]}</span><span>{memo[1]}</span></p>
			{/key}
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
		transition: opacity 0.25s ease;
	}
	.hand {
		font-family: 'Nunito', sans-serif;
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
		/* (Nunito runs wider than a handwriting face: sized so the longest line fits the ticket) */
		font-size: calc(var(--w) * 0.08);
		/* airier than a single-spaced list so the order fills the ticket down to the tick */
		line-height: 1.6;
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
		left: 14%;
		bottom: 9%; /* lower-left: clear of the order lines and of the pink sticky on the right */
		font-size: calc(var(--w) * 0.3);
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
		width: 72%;
		aspect-ratio: 720 / 452;
		left: 46%;
		top: 76%; /* over the ticket's lower-right corner (keeps the stack short) */
		z-index: 5;
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
	/* Entrance: the ticket drops in from above, swings on its tape and settles; the memo slaps on. */
	.stack.notes-enter {
		transform-origin: 50% 3%;
		animation: ticket-pin 0.85s cubic-bezier(0.3, 0.7, 0.4, 1) 0.45s both;
	}
	.pink.notes-enter {
		animation: memo-slap 0.45s cubic-bezier(0.5, 0, 0.75, 0.3) 0.8s both;
	}
	@keyframes ticket-pin {
		0% {
			transform: translateY(-40%) rotate(9deg);
			opacity: 0;
		}
		25% {
			opacity: 1;
		}
		45% {
			transform: translateY(0) rotate(-4deg);
		}
		65% {
			transform: rotate(2.5deg);
		}
		82% {
			transform: rotate(-1deg);
		}
		100% {
			transform: none;
		}
	}
	/* comes at the wall big and tilted (ease-in), hits flat with a squash, settles on its 6° rest */
	@keyframes memo-slap {
		0% {
			transform: scale(1.5) rotate(-10deg);
			opacity: 0;
		}
		30% {
			opacity: 1;
		}
		70% {
			transform: scale(0.94) rotate(7deg);
			animation-timing-function: ease-out;
		}
		100% {
			transform: scale(1) rotate(6deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.notes-enter,
		.ticket,
		.pink__text,
		.ticket__tick {
			animation: none;
		}
	}
</style>
