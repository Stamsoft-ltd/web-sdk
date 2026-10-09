<script lang="ts">
	import { untrack } from 'svelte';
	import { Container, Graphics, Rectangle } from 'pixi-svelte';

	import AnimatedSymbol from './AnimatedSymbol.svelte';
	import { potState } from '../game/potState.svelte';
	import { focusAlpha, isWinningCell } from '../game/winFocus.svelte';
	import { RELEASE_HOLD_MS, RELEASE_MS, RELEASE_RIDE_MS, lockRelease } from '../game/lockRelease.svelte';
	import { getContext } from '../game/context';
	import { getSymbolInfo } from '../game/utils';
	import { SYMBOL_PARTS, fallbackConfig } from '../game/symbolParts';
	import { LOCK_SLAM_MS, SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	// Each locked/active cell is drawn ON TOP of the (possibly spinning) board so the held symbol
	// stays pinned to its box instead of scrolling with the reel — the light background is opaque and
	// covers the reel behind it. `lockedPositions.row` is 1-based (grid row = row - 1, and it doubles
	// as the symbols-array index used to read the held symbol when no single lockSymbol is set).
	// Configured symbols animate part-by-part; the rest get a whole-sprite fallback wiggle.
	// A WILD that's part of the locked combination stays a wild (on the same yellow box) instead of being
	// redrawn as the connected symbol. What sat in each cell is captured ONCE, when the cell locks (the
	// reels have stopped then) — during the re-spin the reel underneath scrolls, so it can't be read live.
	const wildAt: Record<string, true> = $state({});
	const cells = $derived(
		context.stateGame.lockedPositions.map(({ reel, row }) => {
			const name = wildAt[`${reel}:${row - 1}`]
				? 'W'
				: (context.stateGame.lockSymbol ??
					context.stateGame.board[reel]?.reelState.symbols[row]?.rawSymbol?.name);
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
	const SLAM_MS = LOCK_SLAM_MS; // a slower, clearly visible arrival (was 650)
	const IMPACT = 0.4; // share of the slam spent dropping in (fading in as it falls)
	let clock = $state(0);
	const lockStart: Record<string, number> = $state({});
	// Triggered by the locked POSITIONS only (not `cells`, which reads wildAt); lockStart / wildAt are
	// written here, so they're read untracked.
	$effect(() => {
		const positions = context.stateGame.lockedPositions.map(({ reel, row }) => ({ reel, row }));
		untrack(() => {
			const t = performance.now();
			const keys = new Set<string>();
			for (const { reel, row } of positions) {
				const k = `${reel}:${row - 1}`;
				keys.add(k);
				if (k in lockStart) continue;
				lockStart[k] = t;
				const under = context.stateGame.board[reel]?.reelState.symbols[row]?.rawSymbol?.name;
				if (under === 'W') wildAt[k] = true;
			}
			for (const k of Object.keys(lockStart)) if (!keys.has(k)) delete lockStart[k];
			for (const k of Object.keys(wildAt)) if (!keys.has(k)) delete wildAt[k];
		});
	});
	// releaseLocks (next spin) needs what each box shows — the wild carry-over lives here
	$effect(() => {
		const held: typeof lockRelease.held = {};
		for (const c of cells) if (c.name) held[`${c.reel}:${c.gridRow}`] = c.name;
		lockRelease.held = held;
	});
	// The release (game/lockRelease): config per released symbol, built once per release.
	const released = $derived(
		lockRelease.cells.map((c) => {
			const info = c.name ? getSymbolInfo({ rawSymbol: { name: c.name }, state: 'static' }) : undefined;
			return {
				...c,
				config: c.name ? (SYMBOL_PARTS[c.name] ?? fallbackConfig(info!.assetKey)) : undefined,
				scale: info?.sizeRatios.width ?? 0.92,
			};
		}),
	);
	// The release, in two beats. HOLD (the reels wait — actor): the heat glow and light box ease off
	// the held symbol, which settles from the box's lift back to the reel's size. RIDE: the reels start,
	// and the symbol rides its reel down on its cover and fades as it goes. The ride never runs
	// backwards: once the reel starts its next pre-spin leg the reading restarts, but the copy has
	// left the board by then.
	let rideMax: Record<string, number> = {};
	let rideAt = 0;
	const releaseAnim = (c: (typeof released)[number]) => {
		if (rideAt !== lockRelease.at) (rideAt = lockRelease.at), (rideMax = {});
		const t = clock - lockRelease.at - c.delay * 0.5;
		const raw = c.ref ? c.ref.symbolY() - c.restY : 0;
		const ride = raw < -0.3 * SYMBOL_SIZE ? raw + c.span : raw;
		const k = `${c.reel}:${c.gridRow}`;
		const dy = (rideMax[k] = Math.max(rideMax[k] ?? 0, ride));
		const b = Math.min(1, Math.max(0, t / RELEASE_HOLD_MS));
		const eb = b * b * (3 - 2 * b); // ease in-out: no snap at either end
		const r = Math.min(1, Math.max(0, (t - RELEASE_HOLD_MS - 140) / (RELEASE_RIDE_MS - 140)));
		return { dy, box: 1 - eb, boxScale: 1 - 0.12 * eb, sym: 1 - r * r, done: t >= RELEASE_MS + c.delay };
	};
	$effect(() => {
		if (!cells.length && !lockRelease.cells.length) return;
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
		let alpha = 1;
		if (t < 0) alpha = 0;
		else if (t < SLAM_MS) {
			const u = t / SLAM_MS;
			if (u < IMPACT) {
				const q = u / IMPACT; // falling onto the pass: accelerating, a touch big, fading in
				y = -0.16 * S * (1 - q * q);
				sx = sy = 1.14 - 0.14 * q;
				alpha = Math.min(1, q * 1.6);
			} else {
				const v = (u - IMPACT) / (1 - IMPACT);
				const d = Math.exp(-4.2 * v) * Math.cos(v * Math.PI * 3); // squash → rebound → settle
				sx = 1 + 0.1 * d;
				sy = 1 - 0.12 * d;
				y = (S * (1 - sy)) / 2; // squash onto its base
				flash = Math.max(0, 1 - v * 1.6);
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
		return { y, sx, sy, flash, t, alpha };
	};
	// Heat lamp: a warm glow around the box, breathing slowly (each box on its own phase). The rings are
	// drawn ONCE at full strength; only the Graphics' alpha animates, so it costs no geometry rebuild.
	const drawGlow = (g: any) => {
		const W = SYMBOL_WIDTH - 18;
		const H = SYMBOL_SIZE - 18;
		for (let i = 3; i >= 1; i--) {
			const pad = i * 3.2;
			g.roundRect(-W / 2 - pad, -H / 2 - pad, W + pad * 2, H + pad * 2, 10 + pad).fill({
				color: 0xffa640,
				alpha: 1 - i * 0.22,
			});
		}
	};
	const glowAlpha = (reel: number, gridRow: number) => {
		const t = clock - (lockStart[`${reel}:${gridRow}`] ?? -1e9);
		const seed = reel * 3.7 + gridRow * 1.3;
		const glow = 0.5 + 0.5 * Math.sin(clock / 1100 + seed);
		const fadeIn = Math.min(1, Math.max(0, (t - SLAM_MS * IMPACT) / 300));
		// right after it lands the lamp flares up bright, then settles into the slow breathing
		const flare = Math.max(0, 1 - Math.max(0, t - SLAM_MS * IMPACT) / 1400);
		return (0.05 + 0.05 * glow) * fadeIn + 0.4 * flare * flare * fadeIn;
	};
	// Splat + heat-lamp glow + steam, drawn per cell (box-local coords, origin at the cell centre).
	const drawCellFx = (reel: number, gridRow: number, name: string) => (g: any) => {
		const t = clock - (lockStart[`${reel}:${gridRow}`] ?? -1e9);
		const W = SYMBOL_WIDTH - 18;
		const H = SYMBOL_SIZE - 18;
		const seed = reel * 3.7 + gridRow * 1.3;
		// (the heat-lamp glow is its own static Graphics — see drawGlow / glowAlpha)
		// splat at the impact: a flat ring of sauce + droplets thrown outward, fading
		const ta = t - SLAM_MS * IMPACT;
		// golden ring flying out from the box edge at the impact, so a new lock reads clearly
		if (ta >= 0 && ta < 620) {
			const u = ta / 620;
			const e = 1 - (1 - u) ** 3;
			const pad = 4 + 26 * e;
			g.roundRect(-W / 2 - pad, -H / 2 - pad, W + pad * 2, H + pad * 2, 10 + pad * 0.6).stroke({
				width: 6 * (1 - u) + 1,
				color: 0xffd36b,
				alpha: 0.85 * (1 - u),
			});
		}
		if (ta >= 0 && ta < 700) {
			const u = ta / 700;
			const col = sauceOf(name);
			const a = 1 - u;
			// Everything stays INSIDE this box (it used to fly out over the neighbouring locked boxes):
			// a puddle along the bottom edge + droplets splashed up off it, clamped to the box.
			g.ellipse(0, H * 0.4, W * (0.26 + 0.14 * Math.sqrt(u)), H * (0.05 + 0.025 * u)).fill({ color: col, alpha: 0.55 * a });
			for (let i = 0; i < 8; i++) {
				const ang = (i / 8) * Math.PI * 2 + seed;
				const dist = (0.18 + 0.2 * Math.sqrt(u)) * W * (0.9 + 0.2 * Math.sin(seed + i * 2.1));
				const r = (3.2 + 2.2 * Math.abs(Math.sin(seed * 1.7 + i))) * (1 - 0.5 * u);
				const x = Math.max(-W / 2 + r + 3, Math.min(W / 2 - r - 3, Math.cos(ang) * dist));
				const yy = Math.max(-H / 2 + r + 3, Math.min(H / 2 - r - 3, Math.sin(ang) * dist * (H / W) + 0.14 * H * u * u));
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
		<!-- (fades out to the plain cell while a soup shoots from under it — potState.hidden / PotShots) -->
		<Container
			x={cx}
			y={cy + an.y}
			scale={{ x: an.sx, y: an.sy }}
			alpha={an.alpha * focusAlpha(isWinningCell(reel, gridRow)) * (1 - (potState.hidden[`${reel}:${gridRow + 1}`] ?? 0))}
		>
			<!-- heat-lamp glow + lock splat + steam (behind the box) -->
			<Graphics draw={drawGlow} alpha={glowAlpha(reel, gridRow)} />
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
					backgroundAlpha={0.55 * an.flash}
				/>
			{/if}
			{#if config}
				<!-- Held symbol, pinned to the box, animating while it stays locked. -->
				<AnimatedSymbol {config} x={0} y={0} {scale} winning={true} />
			{/if}
		</Container>
	{/each}
	<!-- The release (next spin, game/lockRelease): each held symbol rides its reel down on its own
	     cover while the light box fades + shrinks off it. -->
	<!-- clipped to the board like the reels (BoardMask), so a copy riding its reel leaves the same way -->
	{#if released.length}
	<Container>
	<Rectangle isMask x={-SYMBOL_WIDTH} width={board.width + SYMBOL_WIDTH * 2} height={board.height} />
	{#each released as c (`rel:${c.reel}:${c.gridRow}:${lockRelease.at}`)}
		{@const ra = releaseAnim(c)}
		{#if !ra.done}
			<Container x={c.reel * SYMBOL_WIDTH + SYMBOL_WIDTH / 2} y={c.gridRow * SYMBOL_SIZE + SYMBOL_SIZE / 2 + ra.dy}>
				<!-- the cell's cover, riding along: hides the reel's own symbol in this slot -->
				<Rectangle
					x={-SYMBOL_WIDTH / 2 - 1}
					y={-SYMBOL_SIZE / 2 - 1}
					width={SYMBOL_WIDTH + 2}
					height={SYMBOL_SIZE + 2}
					backgroundColor={0x2e2a27}
					alpha={ra.sym}
				/>
				<Container scale={ra.boxScale} alpha={ra.box}>
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
				</Container>
				{#if c.config}
					<Container alpha={ra.sym}>
						<AnimatedSymbol config={c.config} x={0} y={0} scale={c.scale} winning={true} />
					</Container>
				{/if}
			</Container>
		{/if}
	{/each}
	</Container>
	{/if}
</Container>
