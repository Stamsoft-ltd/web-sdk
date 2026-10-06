<script lang="ts">
	import { Container, Graphics } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { BOARD_DIMENSIONS, SYMBOL_SIZE, SYMBOL_WIDTH } from '../game/constants';
	import { sauceOf } from '../game/sauces';
	import { winFocus } from '../game/winFocus.svelte';

	// Depth on the board's tiles, between the board art and the symbols (board space, like
	// LockedCells): all subtle, never competing with the symbols themselves.
	// - Win tiles light up: while a win is on show, the tiles under the winning symbols glow warm.
	// - Specials glow: a landed scatter / WILD / soup breathes a soft light of its own colour onto its
	//   tile.
	// - Sauce stains: a win leaves a splash of the paying symbol's sauce on its tiles, which fades
	//   away over a few seconds (it stays on the tile while the reels spin over it).
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	const SPECIAL_GLOW: Record<string, number> = { S: 0xffc94a, W: 0xff5a2a, M: 0x9fd431 };
	const STAIN_HOLD_MS = 1500;
	const STAIN_FADE_MS = 3200;

	type Stain = { reel: number; row: number; at: number; seed: number; body: number; rim: number };
	let stains: Stain[] = [];

	const cellKey = (reel: number, row: number) => `${reel}:${row}`;
	const winningCells = $derived(
		new Map(
			context.stateGame.paylineWins.flatMap((win) =>
				win.path.map((p) => [cellKey(p.reel, p.row), win.symbol] as const),
			),
		),
	);
	// a win leaves its stains (once per cell per win)
	$effect(() => {
		const cells = winningCells;
		if (!cells.size) return;
		const at = performance.now();
		const fresh = [...cells].map(([key, symbol], i) => {
			const [reel, row] = key.split(':').map(Number);
			const sauce = sauceOf(symbol);
			return { reel, row, at: at + i * 40, seed: (at % 997) + i * 13.7, body: sauce.body, rim: sauce.rim };
		});
		stains = [...stains.filter((s) => !cells.has(cellKey(s.reel, s.row))), ...fresh].slice(-30);
		wake();
	});

	// The visible specials on stopped reels (rows 1..5 of each reel's symbols are the board).
	const specials = $derived(
		context.stateGame.board.flatMap((reel, r) =>
			reel.reelState.motion !== 'stopped'
				? []
				: reel.reelState.symbols
						.map((s, row) => ({ reel: r, row: row - 1, name: s?.rawSymbol?.name ?? '' }))
						.filter((c) => c.row >= 0 && c.row < BOARD_DIMENSIONS.y && SPECIAL_GLOW[c.name] !== undefined),
		),
	);

	// Clock: runs only while something here is moving.
	let now = $state(0);
	let raf = 0;
	const busy = () =>
		specials.length > 0 ||
		winningCells.size > 0 ||
		stains.some((s) => now - s.at < STAIN_HOLD_MS + STAIN_FADE_MS);
	const loop = (ts: number) => {
		now = ts;
		raf = busy() ? requestAnimationFrame(loop) : 0;
	};
	const wake = () => {
		if (!raf) raf = requestAnimationFrame(loop);
	};
	$effect(() => {
		if (specials.length || winningCells.size) wake();
	});
	$effect(() => () => cancelAnimationFrame(raf));

	const cellX = (reel: number) => reel * SYMBOL_WIDTH;
	const cellY = (row: number) => row * SYMBOL_SIZE;
	const hash = (n: number) => {
		const x = Math.sin(n * 12.9898 + 78.233) * 43758.5453;
		return x - Math.floor(x);
	};

	const drawStains = (g: any) => {
		g.clear();
		const t = now;
		for (const s of stains) {
			const age = t - s.at;
			if (age < 0 || age > STAIN_HOLD_MS + STAIN_FADE_MS) continue;
			const a = 0.26 * (age < STAIN_HOLD_MS ? Math.min(1, age / 120) : 1 - (age - STAIN_HOLD_MS) / STAIN_FADE_MS);
			// a splash off-centre in the lower half of the tile: a body blob, a couple of lobes, spots
			const cx = cellX(s.reel) + SYMBOL_WIDTH * (0.3 + 0.4 * hash(s.seed));
			const cy = cellY(s.row) + SYMBOL_SIZE * (0.62 + 0.22 * hash(s.seed + 1));
			const r = SYMBOL_SIZE * (0.11 + 0.05 * hash(s.seed + 2));
			g.ellipse(cx, cy, r * 1.15, r * 0.8).fill({ color: s.rim, alpha: a * 0.6 });
			g.ellipse(cx, cy, r, r * 0.68).fill({ color: s.body, alpha: a });
			for (let k = 0; k < 4; k += 1) {
				const ang = hash(s.seed + 3 + k) * Math.PI * 2;
				const d = r * (1.1 + 0.9 * hash(s.seed + 7 + k));
				const rr = r * (0.16 + 0.22 * hash(s.seed + 11 + k));
				g.circle(cx + Math.cos(ang) * d, cy + Math.sin(ang) * d * 0.7, rr).fill({ color: s.body, alpha: a * 0.9 });
			}
		}
	};

	const drawLight = (g: any) => {
		g.clear();
		const t = now;
		// win tiles: a warm wash + a lit rim, breathing gently, in and out with the win focus
		const k = winFocus.current;
		if (k > 0.01) {
			const pulse = 0.75 + 0.25 * Math.sin(t / 260);
			for (const key of winningCells.keys()) {
				const [reel, row] = key.split(':').map(Number);
				const x = cellX(reel) + 4;
				const y = cellY(row) + 4;
				// nested, shrinking washes add up to a light that is brightest in the middle of the tile
				for (let i = 0; i < 4; i += 1) {
					const inset = i * 9;
					g.roundRect(x + inset, y + inset, SYMBOL_WIDTH - 8 - 2 * inset, SYMBOL_SIZE - 8 - 2 * inset, 12).fill({
						color: 0xffa940,
						alpha: 0.035 * k * pulse,
					});
				}
				g.roundRect(x, y, SYMBOL_WIDTH - 8, SYMBOL_SIZE - 8, 12).stroke({ color: 0xffd36b, width: 2, alpha: 0.3 * k * pulse });
			}
		}
		// specials: a soft radial light (stacked discs) that breathes, each on its own phase
		for (const c of specials) {
			const color = SPECIAL_GLOW[c.name];
			const breathe = 0.7 + 0.3 * Math.sin(t / 620 + c.reel * 1.3 + c.row * 0.7);
			const cx = cellX(c.reel) + SYMBOL_WIDTH / 2;
			const cy = cellY(c.row) + SYMBOL_SIZE / 2;
			for (let i = 0; i < 6; i += 1) {
				const f = 1 - i / 6;
				g.circle(cx, cy, SYMBOL_SIZE * 0.5 * f).fill({ color, alpha: 0.035 * breathe });
			}
		}
	};
</script>

<!-- Board-space (mirrors LockedCells): local (0,0) is the top-left of the reel grid. -->
<Container x={board.x} y={board.y} pivot={board.pivot}>
	<Graphics draw={drawStains} />
	<Graphics draw={drawLight} blendMode="add" />
</Container>
