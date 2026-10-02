<script lang="ts">
	import { Container, Graphics, Rectangle } from 'pixi-svelte';

	import AnimatedSymbol from './AnimatedSymbol.svelte';
	import { getContext } from '../game/context';
	import { getSymbolInfo } from '../game/utils';
	import { SYMBOL_PARTS, fallbackConfig } from '../game/symbolParts';
	import { SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	// Each locked/active cell is drawn ON TOP of the (possibly spinning) board so the held symbol
	// stays pinned to its box instead of scrolling with the reel — the light background is opaque and
	// covers the reel behind it. `lockedPositions.row` is 1-based (grid row = row - 1, and it doubles
	// as the symbols-array index used to read the held symbol when no single lockSymbol is set).
	// Configured symbols animate part-by-part; the rest get a whole-sprite fallback wiggle.
	const cells = $derived(
		context.stateGame.lockedPositions.map(({ reel, row }) => {
			const name =
				context.stateGame.lockSymbol ??
				context.stateGame.board[reel]?.reelState.symbols[row]?.rawSymbol?.name;
			const info = name ? getSymbolInfo({ rawSymbol: { name }, state: 'static' }) : undefined;
			const config = name
				? (SYMBOL_PARTS[name] ?? fallbackConfig(info!.assetKey))
				: undefined;
			return { reel, gridRow: row - 1, config, scale: info?.sizeRatios.width ?? 0.92, name: name ?? '' };
		}),
	);

	// "Order up!" — a newly locked box SLAMS down onto the pass like a plate (drops in a touch big,
	// squashes, rebounds), flashes, and splats a little of its own sauce; the boxes already held do a
	// small sympathetic hop rippling out from it. While held, each box sits under the heat lamp: a
	// warm amber glow that breathes slowly and the odd wisp of steam off the top.
	const SAUCE: Record<string, number> = {
		L1: 0xc81a0d, // ketchup
		L2: 0xf3ead2, // mayo
		L3: 0xf2b21c, // mustard
		L4: 0x7a2a12, // BBQ
		L5: 0x9dbb3c, // avocado ranch
	};
	const sauceOf = (name: string) => SAUCE[name] ?? 0xc81a0d;
	const SLAM_MS = 650;
	const IMPACT = 0.35; // share of the slam spent dropping in
	let clock = $state(0);
	const lockStart: Record<string, number> = $state({});
	$effect(() => {
		const keys = new Set(cells.map((c) => `${c.reel}:${c.gridRow}`));
		const t = performance.now();
		for (const k of keys) if (!(k in lockStart)) lockStart[k] = t;
		for (const k of Object.keys(lockStart)) if (!keys.has(k)) delete lockStart[k];
	});
	$effect(() => {
		if (!cells.length) return;
		let raf = 0;
		const loop = (ts: number) => {
			clock = ts;
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const cellAnim = (reel: number, gridRow: number) => {
		const S = SYMBOL_SIZE;
		const t = clock - (lockStart[`${reel}:${gridRow}`] ?? -1e9);
		let y = 0;
		let sx = 1;
		let sy = 1;
		let flash = 0;
		if (t >= 0 && t < SLAM_MS) {
			const u = t / SLAM_MS;
			if (u < IMPACT) {
				const q = u / IMPACT; // falling onto the pass: accelerating, a touch big
				y = -0.13 * S * (1 - q * q);
				sx = sy = 1.1 - 0.1 * q;
			} else {
				const v = (u - IMPACT) / (1 - IMPACT);
				const d = Math.exp(-5 * v) * Math.cos(v * Math.PI * 3); // squash → rebound → settle
				sx = 1 + 0.09 * d;
				sy = 1 - 0.11 * d;
				y = (S * (1 - sy)) / 2; // squash onto its base
				flash = Math.max(0, 1 - v * 2.2);
			}
		}
		// sympathetic hop from boxes that just landed nearby (delayed + weaker with distance)
		for (const c of cells) {
			if (c.reel === reel && c.gridRow === gridRow) continue;
			const tt = clock - (lockStart[`${c.reel}:${c.gridRow}`] ?? -1e9) - SLAM_MS * IMPACT;
			const dist = Math.hypot(c.reel - reel, c.gridRow - gridRow);
			const u = (tt - dist * 70) / 380;
			if (u > 0 && u < 1 && t > SLAM_MS) y -= (0.035 * S * Math.sin(Math.PI * u)) / dist;
		}
		return { y, sx, sy, flash, t };
	};
	// Splat + heat-lamp glow + steam, drawn per cell (box-local coords, origin at the cell centre).
	const drawCellFx = (reel: number, gridRow: number, name: string) => (g: any) => {
		const t = clock - (lockStart[`${reel}:${gridRow}`] ?? -1e9);
		const W = SYMBOL_WIDTH - 18;
		const H = SYMBOL_SIZE - 18;
		const seed = reel * 3.7 + gridRow * 1.3;
		// heat lamp: a warm glow around the box, breathing slowly (each box on its own phase)
		const glow = 0.5 + 0.5 * Math.sin(clock / 1100 + seed);
		const fadeIn = Math.min(1, Math.max(0, (t - SLAM_MS * 0.5) / 600));
		for (let i = 3; i >= 1; i--) {
			const pad = i * 3.2;
			g.roundRect(-W / 2 - pad, -H / 2 - pad, W + pad * 2, H + pad * 2, 10 + pad).fill({
				color: 0xffa640,
				alpha: (0.05 + 0.05 * glow) * fadeIn * (1 - i * 0.22),
			});
		}
		// splat at the impact: a flat ring of sauce + droplets thrown outward, fading
		const ta = t - SLAM_MS * IMPACT;
		if (ta >= 0 && ta < 700) {
			const u = ta / 700;
			const col = sauceOf(name);
			const a = 1 - u;
			g.ellipse(0, H * 0.46, W * (0.34 + 0.24 * Math.sqrt(u)), H * (0.06 + 0.03 * u)).fill({ color: col, alpha: 0.55 * a });
			for (let i = 0; i < 8; i++) {
				const ang = (i / 8) * Math.PI * 2 + seed;
				const dist = (0.5 + 0.22 * Math.sqrt(u)) * W * (0.9 + 0.2 * Math.sin(seed + i * 2.1));
				const x = Math.cos(ang) * dist;
				const yy = Math.sin(ang) * dist * (H / W) + 0.18 * H * u * u;
				const r = (3.2 + 2.2 * Math.abs(Math.sin(seed * 1.7 + i))) * (1 - 0.5 * u);
				g.circle(x, yy, r).fill({ color: col, alpha: a });
				g.circle(x - r * 0.3, yy - r * 0.3, r * 0.32).fill({ color: 0xffffff, alpha: 0.45 * a });
			}
		}
		// steam: every few seconds two soft wisps rise off the top edge and fade
		if (t > SLAM_MS) {
			const P = 3600;
			const p = ((clock + seed * 977) % P) / P;
			if (p < 0.45) {
				const q = p / 0.45;
				// soft wisps: each a short column of small overlapping puffs (no hard disc edge)
				for (let i = 0; i < 2; i++) {
					const a = 0.045 * Math.sin(Math.PI * q);
					for (let j = 0; j < 4; j++) {
						const qq = Math.max(0, q - j * 0.06);
						const x = (i ? 0.18 : -0.14) * W + Math.sin(qq * 6 + i * 2 + seed + j) * (3 + 4 * qq);
						const yy = -H / 2 + 4 - qq * H * 0.32;
						const r = 2.5 + qq * 5;
						g.circle(x, yy, r * 1.6).fill({ color: 0xffffff, alpha: a * 0.5 });
						g.circle(x, yy, r).fill({ color: 0xffffff, alpha: a });
					}
				}
			}
		}
	};

	// DEV previews:
	//   key 9 — toggle a small mixed demo row.
	//   key 0 — "gallery": put one of every symbol type on the board and lock them all, so every
	//           animation can be checked at once without hunting for symbols.
	import { onMount } from 'svelte';
	onMount(() => {
		if (!import.meta.env.DEV) return;
		const demo = [
			{ reel: 0, row: 3 }, // soup pot
			{ reel: 1, row: 3 }, // sausage
			{ reel: 2, row: 3 }, // cheese
			{ reel: 3, row: 2 }, // BBQ bottle
			{ reel: 4, row: 3 }, // burger
		];
		const onDev = (e: KeyboardEvent) => {
			if (e.code === 'Digit9') {
				context.stateGame.lockedPositions =
					context.stateGame.lockedPositions.length > 0 ? [] : demo;
			} else if (e.code === 'Digit0') {
				if (context.stateGame.lockedPositions.length > 0) {
					context.stateGame.lockedPositions = [];
					return;
				}
				const types = ['H1', 'H2', 'H3', 'H4', 'H5', 'L1', 'L2', 'L3', 'L4', 'L5', 'W', 'S', 'M'] as const;
				const all: { reel: number; row: number }[] = [];
				context.stateGame.lockSymbol = undefined;
				context.stateGame.board.forEach((reel, r) => {
					for (let vr = 0; vr < 5; vr++) {
						reel.reelState.symbols[vr + 1].rawSymbol = {
							name: types[(r * 5 + vr) % types.length] as (typeof reel.reelState.symbols)[number]['rawSymbol']['name'],
						};
						all.push({ reel: r, row: vr + 1 });
					}
				});
				context.stateGame.lockedPositions = all;
			}
		};
		window.addEventListener('keydown', onDev);
		return () => window.removeEventListener('keydown', onDev);
	});
</script>

<Container x={board.x} y={board.y} pivot={board.pivot} zIndex={5}>
	<!-- Pass 1 — opaque covers FIRST, drawn EDGE-TO-EDGE (a hair oversized) in the board's own cell
	     colour. Because every cover is laid down before any held symbol, a run of adjacent locked cells
	     forms one seamless mask: a symbol on the spinning reel behind — even one much bigger than its
	     cell — can never peek through the seams or around a held symbol. (The old per-cell inset cover
	     left a thin gap at every boundary where a big symbol behind showed through.) -->
	{#each cells as { reel, gridRow } (`cover:${reel}:${gridRow}`)}
		<Rectangle
			x={reel * SYMBOL_WIDTH - 1}
			y={gridRow * SYMBOL_SIZE - 1}
			width={SYMBOL_WIDTH + 2}
			height={SYMBOL_SIZE + 2}
			borderRadius={0}
			backgroundColor={0x2e2a27}
		/>
	{/each}
	<!-- Pass 2 — the locked-cell decoration on top of the mask: light background + held symbol (no lock badge). -->
	{#each cells as { reel, gridRow, config, scale, name } (`cell:${reel}:${gridRow}`)}
		{@const cx = reel * SYMBOL_WIDTH + SYMBOL_WIDTH / 2}
		{@const cy = gridRow * SYMBOL_SIZE + SYMBOL_SIZE / 2}
		{@const an = cellAnim(reel, gridRow)}
		<Container x={cx} y={cy + an.y} scale={{ x: an.sx, y: an.sy }}>
			<!-- heat-lamp glow + lock splat + steam (behind the box) -->
			<Graphics draw={drawCellFx(reel, gridRow, name)} />
			<!-- Opaque light background (inset so adjacent locked cells keep a gap). -->
			<Rectangle
				x={-SYMBOL_WIDTH / 2 + 9}
				y={-SYMBOL_SIZE / 2 + 9}
				width={SYMBOL_WIDTH - 18}
				height={SYMBOL_SIZE - 18}
				borderRadius={10}
				backgroundColor={0xe8b574}
				borderColor={0xffc383}
				borderWidth={4}
			/>
			{#if an.flash > 0}
				<Rectangle
					x={-SYMBOL_WIDTH / 2 + 9}
					y={-SYMBOL_SIZE / 2 + 9}
					width={SYMBOL_WIDTH - 18}
					height={SYMBOL_SIZE - 18}
					borderRadius={10}
					backgroundColor={0xffffff}
					backgroundAlpha={0.35 * an.flash}
				/>
			{/if}
			{#if config}
				<!-- Held symbol, pinned to the box, animating while it stays locked. -->
				<AnimatedSymbol {config} x={0} y={0} {scale} winning={true} />
			{/if}
		</Container>
	{/each}
</Container>
