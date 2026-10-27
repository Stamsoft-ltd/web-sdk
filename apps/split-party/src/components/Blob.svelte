<script lang="ts">
	import { untrack } from 'svelte';
	import EYES from '../lib/eyes.json';
	import FACES from '../lib/face-layers.json';
	import GEAR from '../lib/gear.json';
	import LiveEyes, { type Eye } from './LiveEyes.svelte';

	let {
		symbol = 'ORANGE',
		units = 1,
		uid = 'blob',
	}: { symbol?: string; units?: number; uid?: string } = $props();
	const palettes: Record<string, [string, string, string]> = {
		WATERMELON: ['#83ff46', '#27ca43', 'sleep'],
		CHERRIES: ['#ff6c89', '#f62d4b', 'angry'],
		GRAPES: ['#dd87ff', '#a234f4', 'happy'],
		STRAWBERRY: ['#ffaddf', '#ff58b6', 'happy'],
		BLUEBERRY: ['#7de1ff', '#279eed', 'sad'],
		ORANGE: ['#ffd55e', '#ff941c', 'wow'],
		LEMON: ['#ffed71', '#ffc327', 'happy'],
		KIWI: ['#6ffff1', '#11cfb8', 'happy'],
		PLUM: ['#999baa', '#45485e', 'wow'],
		APPLE: ['#fff1cf', '#ffdb8f', 'sleep'],
		BASKET: ['#fff7a4', '#e9a820', 'happy'],
	};
	// Figma 11003:24523 symbol art (public/symbols/hd, scripts/build-symbols.py). Boxes are the design's symbol frames
	// in a 74-unit pad scaled to the 100-unit viewBox; PLUM's frame is drawn taller.
	const ART: Record<string, [number, number, number, number]> = {
		WATERMELON: [0, 0, 100, 100],
		CHERRIES: [0, 0, 100, 100],
		GRAPES: [0, -0.7, 100, 101.4],
		STRAWBERRY: [0, 0, 100, 100],
		BLUEBERRY: [0, -0.7, 100, 101.4],
		ORANGE: [0, 0, 100, 100],
		LEMON: [0, -0.7, 100, 101.4],
		KIWI: [0, -0.7, 100, 101.4],
		PLUM: [0.7, -6.5, 98.6, 113],
		APPLE: [0, 0, 100, 100],
		// The scatter (math name BASKET) is the spotted egg (scripts/build-scatter-egg.py).
		BASKET: [0, 0, 100, 100],
	};
	let palette = $derived(palettes[symbol] ?? palettes.ORANGE);
	let art = $derived(ART[symbol]);
	// Live eyes (scripts/build-eyes.py): only on full-size and half-size blobs, where they read.
	let eyes = $derived(units <= 2 ? ((EYES as Record<string, Eye[]>)[symbol] ?? []) : []);
	// Each blob gets its own look/blink phase so the board doesn't move in lockstep.
	// FNV-1a plus a final avalanche: neighbouring uids (b-2-3, b-2-4) must land on unrelated
	// phases, or the board breathes and blinks in column-by-column waves.
	let seed = $derived.by(() => {
		let h = 2166136261;
		for (const c of uid) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
		h = Math.imul(h ^ (h >>> 16), 0x85ebca6b);
		h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
		return (h ^ (h >>> 16)) >>> 0;
	});
	let lookDelay = $derived(`${-((seed % 97) / 97) * 5.6}s`);
	let blinkDelay = $derived(`${-(((seed >>> 7) % 89) / 89) * 4.4}s`);
	// Brows + mouth cut out of the art (scripts/build-face-layers.py) so they can move too.
	type Part = { src: string; x: number; y: number; w: number; h: number; cx: number; cy: number };
	type Cheek = { cx: number; cy: number; rx: number; ry: number };
	type Face = { base: string; brows: Part[]; mouth: Part | null; cheeks: Cheek[]; closed?: Part[] };
	let face = $derived(units <= 2 ? (FACES as Record<string, Face>)[symbol] : undefined);
	// Premium symbols (the top five in paytable.json) always look happy, low ones always
	// unhappy. The painted faces don't all agree, so their own cut-out parts are re-posed:
	// [flip the mouth (frown <-> smile), brow turn in degrees (+ = inner ends up, worried),
	// brow lift]. Faces that already fit (Grapes, Strawberry, Apple) are left alone.
	const MOOD: Record<string, [boolean, number, number]> = {
		WATERMELON: [true, 16, -1.5],
		CHERRIES: [true, 40, -3],
		BLUEBERRY: [true, -14, 0],
		ORANGE: [false, 18, 0],
		LEMON: [true, 16, 0],
		KIWI: [true, 16, 0],
		PLUM: [true, 16, 0],
	};
	let mood = $derived(MOOD[symbol]);
	// The premium blobs' gear (scripts/build-premium-gear.py): crest, horns, antennae, flower,
	// behind or over the body, each moving round where it meets it (BoardView's tickGear).
	type Gear = { src: string; part: string; front: boolean; cx: number; cy: number; rot: number; flip: boolean; x: number; y: number; w: number; h: number; px: number; py: number };
	let gear = $derived((GEAR as Record<string, Gear[]>)[symbol] ?? []);
	// Angry faces scowl (brows dip inward); everyone else raises theirs.
	let scowl = $derived(palette[2] === 'angry' || symbol === 'WATERMELON');
	let faceDelay = $derived(`${-(((seed >>> 13) % 83) / 83) * 6.2}s`);
	// Idle body: a slow jelly breath (2.8–3.7s) on the blob's own phase. Fright, win bounce and
	// falls set `animation` on the art and replace it meanwhile.
	let idle = $derived(
		`--breathe:${(2.8 + ((seed >>> 3) % 10) * 0.1).toFixed(1)}s;` +
			`--breathe-delay:${(-((seed >>> 11) % 997) / 997 * 3.7).toFixed(2)}s;` +
			`--relief-delay:${(((seed >>> 17) % 101) * 2.2).toFixed(0)}ms`,
	);
	// Split layouts: [x, y, scale] per blob in the 100-unit box. The painted blob fills about
	// 8–91.5% x 11.6–90.2% of its box, and the cell shows x -9..109, y 2..98 of this space, so
	// each layout leaves a 12–16 unit channel centred on every crack line (Crack.svelte).
	const layout = (units: number) =>
		units === 1
			? [[0, 0, 1]]
			: units === 2
				? // Channel x 43–57.
					[
						[-7.3, 22, 0.55],
						[52.6, 22, 0.55],
					]
				: units === 3
					? // Arms run under the top blob (y 40–56), the stem between the pair (x 39–61).
						[
							[25.5, -4, 0.49],
							[-6, 50, 0.49],
							[57, 50, 0.49],
						]
					: units === 4
						? // Cross at x 33–66, y 38–60.
							[
								[-4, -3, 0.45],
								[62, -3, 0.45],
								[-4, 55, 0.45],
								[62, 55, 0.45],
							]
						: units === 5
							? // Ring (r 22) round the centre blob, spokes between the corners. The centre
								// blob's art sits ~4 units low in its box (measured), so it is raised to
								// look centred in the ring.
								[
									[-9, 2, 0.38],
									[71, 2, 0.38],
									[31, 27, 0.38],
									[-9, 60, 0.38],
									[71, 60, 0.38],
								]
							: // Channels at x 23–35 and 65–77, y 41–59.
								[
									[-10, 8, 0.36],
									[32.1, 8, 0.36],
									[74.2, 8, 0.36],
									[-10, 55, 0.36],
									[32.1, 55, 0.36],
									[74.2, 55, 0.36],
								];
	let positions = $derived(layout(units));
	// Split = cell division of ONE blob: the tile swells, the blobs already there slide to their
	// nearest spots in the new layout (the pairing with the least total travel), and every blob
	// that is new pinches out of a single parent (the old blob nearest to the new ones) at the
	// parent's size, then the tile settles back. Only a units increase on a live blob plays it,
	// never a mount.
	// split: the parent and its newborns (they pinch apart); slide: the rest just move over.
	type Daughter = { dx: number; dy: number; s: number; axis: number; split: boolean };
	// big: 0–1, how much smaller the newborns are than their parent (1 → 2 takes the scale
	// from 1 to 0.55). It turns the division into a cleavage: an even zoom and round halves
	// pinching apart, instead of the squash-and-stretch the same-size splits use.
	let divide = $state<{
		id: number;
		big: number;
		from: Daughter[];
		pop: { x: number; y: number; r: number };
	} | null>(null);
	let shownUnits = units;
	const centre = ([x, y, s]: number[]) => [x + 50 * s, y + 50 * s];
	const dist = (a: number[], b: number[]) => {
		const [ax, ay] = centre(a);
		const [bx, by] = centre(b);
		return Math.hypot(bx - ax, by - ay);
	};
	// old[i] -> new index, the injective pairing with the least total travel (at most 6P5 = 720).
	function pairing(old: number[][], next: number[][]) {
		let best: number[] = [];
		let bestCost = Infinity;
		const walk = (i: number, used: number[], cost: number) => {
			if (cost >= bestCost) return;
			if (i === old.length) return void ((best = [...used]), (bestCost = cost));
			for (let j = 0; j < next.length; j++)
				if (!used.includes(j)) walk(i + 1, [...used, j], cost + dist(old[i], next[j]));
		};
		walk(0, [], 0);
		return best;
	}
	$effect(() => {
		const next = units;
		const prev = shownUnits;
		shownUnits = next;
		if (next === prev) return;
		if (next < prev) return void (divide = null);
		const old = layout(prev);
		const fresh = layout(next);
		const pair = pairing(old, fresh);
		const born = fresh.map((_, j) => j).filter((j) => !pair.includes(j));
		// The one that divides: the old blob nearest the middle of the newborns.
		const [bx, by] = born
			.map((j) => centre(fresh[j]))
			.reduce(([sx, sy], [x, y]) => [sx + x / born.length, sy + y / born.length], [0, 0]);
		const parent = old.reduce((a, b) => {
			const [ax, ay] = centre(a);
			const [cx, cy] = centre(b);
			return Math.hypot(cx - bx, cy - by) < Math.hypot(ax - bx, ay - by) ? b : a;
		});
		const [qx, qy] = centre(parent);
		const born0 = fresh[born[0] ?? 0];
		divide = {
			id: (untrack(() => divide?.id) ?? 0) + 1,
			big: Math.min(1, Math.max(0, (parent[2] / born0[2] - 1) / 0.8)),
			pop: { x: qx, y: qy, r: 50 * parent[2] },
			from: fresh.map((p, j) => {
				const i = pair.indexOf(j);
				const from = i >= 0 ? old[i] : parent;
				const split = from === parent;
				const [cx, cy] = centre(p);
				const [px, py] = centre(from);
				// A parent that keeps its spot still stretches: away from its newborns.
				const still = Math.hypot(cx - px, cy - py) < 1;
				return {
					dx: px - cx,
					dy: py - cy,
					s: from[2] / p[2],
					axis: (Math.atan2(still ? py - by : cy - py, still ? px - bx : cx - px) * 180) / Math.PI,
					split,
				};
			}),
		};
	});
</script>

{#snippet gearPart(g: Gear)}
	<g transform={`translate(${g.cx} ${g.cy}) rotate(${g.rot}) scale(${g.flip ? -1 : 1} 1)`}>
		<g class={`gear gear-${g.part}`} style={`transform-origin:${g.px}px ${g.py}px`}>
			<image href={g.src} x={g.x} y={g.y} width={g.w} height={g.h} preserveAspectRatio="none" />
		</g>
	</g>
{/snippet}

<svg viewBox="0 0 100 100" aria-hidden="true" class="blob-art" class:has-art={!!art} style={idle}>
	<defs
		><linearGradient id={`${uid}-g`} x1="0" y1="0" x2=".7" y2="1"
			><stop stop-color={palette[0]} /><stop offset="1" stop-color={palette[1]} /></linearGradient
		><radialGradient id={`${uid}-blush`}
			><stop stop-color="#fff" stop-opacity=".8" /><stop offset=".45" stop-color="#fff" stop-opacity=".45" /><stop
				offset="1"
				stop-color="#fff"
				stop-opacity="0"
			/></radialGradient
		></defs
	>
	{#key divide?.id}
	<g class="divide-body" class:dividing={!!divide} style={`--big:${(divide?.big ?? 0).toFixed(2)}`}>
	{#each positions as [x, y, scale], m}
		{@const d = divide?.from[m]}
		<g
			class="daughter"
			class:dividing={!!d?.split}
			class:sliding={!!d && !d.split}
			style={d
				? `--dx:${d.dx.toFixed(2)}px;--dy:${d.dy.toFixed(2)}px;--ds:${d.s.toFixed(3)};--axis:${d.axis.toFixed(1)}deg`
				: undefined}
		>
		<g transform={`translate(${x} ${y}) scale(${scale})`}>
			{#if art}
				<g
					transform={`translate(${art[0]} ${art[1]}) scale(${art[2] / 100} ${art[3] / 100})`}
				>
					{#each gear.filter((g) => !g.front) as g}{@render gearPart(g)}{/each}
					<image href={face?.base ?? `./symbols/hd/${symbol}.webp`} width="100" height="100" />
					{#each face?.cheeks ?? [] as c}
						<ellipse
							class="blush"
							cx={c.cx}
							cy={c.cy}
							rx={c.rx * 1.5}
							ry={c.ry * 1.25}
							fill={`url(#${uid}-blush)`}
							style={`animation-delay:${faceDelay}`}
						/>
					{/each}
					<LiveEyes {eyes} id={`${uid}-${m}`} {lookDelay} {blinkDelay} joy />
					{#if face}
						{#each face.brows as b, j}
							<g
								class="brow"
								class:scowl
								style={`transform-origin:${b.cx}px ${b.cy}px;--tilt:${j ? 1 : -1};animation-delay:${faceDelay}`}
							>
								<g
									transform={mood
										? `translate(0 ${mood[2]}) rotate(${(j ? 1 : -1) * mood[1]} ${b.cx} ${b.cy})`
										: undefined}
									><image href={b.src} x={b.x} y={b.y} width={b.w} height={b.h} preserveAspectRatio="none" /></g
								>
							</g>
						{/each}
						{#if face.mouth}
							{@const mo = face.mouth}
							<g
								class="mouth"
								style={`transform-origin:${mo.cx}px ${mo.y}px;animation-delay:${faceDelay}`}
							>
								<g transform={mood?.[0] ? `translate(0 ${2 * mo.y + mo.h}) scale(1 -1)` : undefined}
									><image href={mo.src} x={mo.x} y={mo.y} width={mo.w} height={mo.h} preserveAspectRatio="none" /></g
								>
							</g>
						{/if}
						<!-- GRAPES' painted ^^ is a layer under drawn-open eyes that glance about; it shows
						     only while they're shut (blinks, winning). After the mouth, whose top corner
						     reaches under the right eye's white. -->
						{#each face.closed ?? [] as c}
							<image
								class="closed-eye"
								href={c.src}
								x={c.x}
								y={c.y}
								width={c.w}
								height={c.h}
								preserveAspectRatio="none"
								style={`animation-delay:${blinkDelay}`}
							/>
							<g class="open-eye" style={`animation-delay:${blinkDelay}`}>
								<ellipse
									cx={c.x + c.w / 2}
									cy={c.y + c.h * 0.7}
									rx={c.w * 0.42}
									ry={c.w * 0.47}
									fill="#fff"
									stroke="#6d27a8"
									stroke-opacity=".35"
									stroke-width=".8"
								/>
								<g class="pupil open-pupil" style={`animation-delay:${lookDelay}`}>
									<circle cx={c.x + c.w / 2} cy={c.y + c.h * 0.78} r={c.w * 0.21} fill="#2b1140" />
									<circle cx={c.x + c.w * 0.56} cy={c.y + c.h * 0.66} r={c.w * 0.07} fill="#fff" />
								</g>
							</g>
						{/each}
					{/if}
					{#each gear.filter((g) => g.front) as g}{@render gearPart(g)}{/each}
				</g>
			{:else}
			<ellipse cx="50" cy="89" rx="36" ry="5" fill="#422267" opacity=".15" />
			<path
				d="M18 51 Q20 24 37 24 Q34 12 47 13 Q58 10 63 25 Q82 25 83 49 Q97 70 88 82 Q81 93 49 92 Q16 93 11 80 Q7 67 18 51Z"
				fill={`url(#${uid}-g)`}
				stroke={palette[1]}
				stroke-width="2"
			/>
			<ellipse
				cx="28"
				cy="42"
				rx="6"
				ry="9"
				fill="white"
				opacity=".38"
				transform="rotate(32 28 42)"
			/>
			<ellipse cx="42" cy="20" rx="6" ry="3" fill="white" opacity=".4" />
			<ellipse cx="23" cy="76" rx="6" ry="5" fill="white" opacity=".18" />
			{#if palette[2] === 'sleep'}
				<path d="M29 49h15M57 49h15" stroke="#344435" stroke-width="4" stroke-linecap="round" />
				<path d="M36 53v5M63 53v5" stroke="#273131" stroke-width="5" stroke-linecap="round" />
				<path
					d="M41 71q9-7 18 0"
					fill="none"
					stroke="#344435"
					stroke-width="3"
					stroke-linecap="round"
				/>
			{:else}
				<ellipse cx="36" cy="54" rx="10" ry="12" fill="#fff9f0" /><ellipse
					cx="63"
					cy="54"
					rx="10"
					ry="12"
					fill="#fff9f0"
				/>
				<ellipse cx="38" cy="55" rx="5" ry="7" fill="#30294a" /><ellipse
					cx="61"
					cy="55"
					rx="5"
					ry="7"
					fill="#30294a"
				/>
				<circle cx="39" cy="52" r="2" fill="white" /><circle cx="62" cy="52" r="2" fill="white" />
				{#if palette[2] === 'angry'}<path
						d="m27 39 16 7m14 0 15-7"
						fill="none"
						stroke="#593147"
						stroke-width="5"
						stroke-linecap="round"
					/>{/if}
				{#if palette[2] === 'wow'}<ellipse cx="50" cy="73" rx="6" ry="8" fill="#5a2c43" />
				{:else if palette[2] === 'sad' || palette[2] === 'angry'}<path
						d="M40 76q10-13 20 0"
						fill="#522842"
					/>
				{:else}<path d="M38 68q12 4 24 0q-2 18-13 15q-10-1-11-15" fill="#5c244c" /><ellipse
						cx="50"
						cy="79"
						rx="7"
						ry="4"
						fill="#ff7eaa"
					/>{/if}
			{/if}
			<ellipse cx="24" cy="65" rx="6" ry="4" fill="#ff5e85" opacity=".36" /><ellipse
				cx="77"
				cy="65"
				rx="6"
				ry="4"
				fill="#ff5e85"
				opacity=".36"
			/>
			{/if}
		</g>
		</g>
	{/each}
	{#if divide}
		<!-- The moment the halves break apart: a ring and droplets burst off the parent. -->
		{@const q = divide.pop}
		<g class="split-pop" style={`--r:${q.r.toFixed(1)}px`}>
			<circle class="split-ring" cx={q.x} cy={q.y} r={q.r * 0.55} fill="none" stroke="#fff" stroke-width="3" />
			{#each [0, 1, 2, 3, 4, 5] as k}
				<circle
					class="split-drop"
					cx={q.x}
					cy={q.y}
					r={2.4}
					fill="#fff"
					style={`--a:${k * 60 + 30}deg`}
				/>
			{/each}
		</g>
	{/if}
	</g>
	{/key}
</svg>

<style>
	.blob-art {
		width: 100%;
		height: 100%;
		display: block;
		filter: drop-shadow(0 3px 1px #66408a25);
	}
	.blob-art.has-art {
		overflow: visible;
		filter: none;
	}
	.blob-art {
		transform-origin: 50% 92%;
		animation: blob-breathe var(--breathe, 3.2s) ease-in-out var(--breathe-delay, 0s) infinite;
	}
	/* Idle breath (BoardView's BREATH): a slow inhale, taller and narrower with the chest up off
	   the feet, a short hold, a sigh out that settles a touch wide, then rest. */
	@keyframes blob-breathe {
		0%,
		100% {
			scale: 1 1;
			translate: 0 0;
		}
		40%,
		50% {
			scale: 0.972 1.04;
			translate: 0 -0.9px;
		}
		78% {
			scale: 1.015 0.988;
			translate: 0 0;
		}
	}
	/* Cell division, one beat of --divide-ms (App sets it per turbo level and waits the same):
	   swell (0–30%), pinch apart (30–75%), settle back with a jelly overshoot. */
	.divide-body.dividing {
		transform-box: view-box;
		transform-origin: 50% 60%;
		animation: divide-swell var(--divide-ms, 900ms) both;
	}
	/* --big 0→1 blends to a cleavage (1 → 2): the tile zooms up evenly instead of squashing,
	   holds while the furrow pinches, then settles. */
	@keyframes divide-swell {
		0% {
			scale: 1;
			animation-timing-function: cubic-bezier(0.2, 0.8, 0.3, 1);
		}
		30% {
			scale: calc(1.24 - 0.04 * var(--big)) calc(1.18 + 0.02 * var(--big));
		}
		45% {
			scale: 1.2 calc(1.22 - 0.02 * var(--big));
		}
		70% {
			scale: calc(1.18 + 0.02 * var(--big));
			animation-timing-function: cubic-bezier(0.4, 0, 0.6, 1);
		}
		84% {
			scale: calc(0.93 + 0.04 * var(--big)) calc(1.05 - 0.08 * var(--big));
		}
		93% {
			scale: calc(1.03 - 0.02 * var(--big)) calc(0.98 + 0.03 * var(--big));
		}
		100% {
			scale: 1;
		}
	}
	.daughter.dividing,
	.daughter.sliding {
		transform-box: fill-box;
		transform-origin: 50% 50%;
		animation: divide-apart var(--divide-ms, 900ms) both;
	}
	.daughter.sliding {
		animation-name: divide-slide;
	}
	/* translate runs in the cell's 100-unit viewBox; the stretch is along the split axis.
	   Stacked on the parent the halves bulge along the axis (one blob getting long), stretch
	   out into a peanut that pinches, snap apart with an overshoot and settle. */
	/* At --big 1 it is a cleavage: the stacked halves (still the parent) elongate a touch, a
	   furrow pinches them into a figure-8 as they slide apart, each shrinking evenly to its size,
	   and they part with a small round overshoot. No squash-and-stretch. */
	@keyframes divide-apart {
		0% {
			transform: translate(var(--dx), var(--dy)) scale(var(--ds));
			animation-timing-function: cubic-bezier(0.3, 0.6, 0.4, 1);
		}
		26% {
			transform: translate(var(--dx), var(--dy)) scale(var(--ds)) rotate(var(--axis))
				scale(calc(1.22 - 0.16 * var(--big)), calc(0.84 + 0.13 * var(--big))) rotate(calc(-1 * var(--axis)));
			animation-timing-function: cubic-bezier(0.5, 0, 0.7, 0.4);
		}
		46% {
			transform: translate(calc(var(--dx) * (0.62 - 0.07 * var(--big))), calc(var(--dy) * (0.62 - 0.07 * var(--big))))
				scale(calc(var(--ds) * (0.92 - 0.12 * var(--big)))) rotate(var(--axis))
				scale(calc(1.5 - 0.5 * var(--big)), calc(0.7 + 0.3 * var(--big))) rotate(calc(-1 * var(--axis)));
			animation-timing-function: cubic-bezier(0.2, 0.8, 0.3, 1);
		}
		62% {
			transform: translate(calc(var(--dx) * (-0.14 + 0.08 * var(--big))), calc(var(--dy) * (-0.14 + 0.08 * var(--big))))
				scale(calc(1 + 0.04 * var(--big))) rotate(var(--axis))
				scale(calc(0.78 + 0.22 * var(--big)), calc(1.2 - 0.2 * var(--big))) rotate(calc(-1 * var(--axis)));
		}
		76% {
			transform: translate(calc(var(--dx) * 0.05), calc(var(--dy) * 0.05)) scale(calc(1 - 0.02 * var(--big)))
				rotate(var(--axis)) scale(calc(1.08 - 0.08 * var(--big)), calc(0.94 + 0.06 * var(--big)))
				rotate(calc(-1 * var(--axis)));
		}
		88% {
			transform: rotate(var(--axis)) scale(calc(0.97 + 0.03 * var(--big)), calc(1.03 - 0.03 * var(--big)))
				rotate(calc(-1 * var(--axis)));
		}
		100% {
			transform: none;
		}
	}
	/* The blobs that aren't dividing make room: an easy slide, no stretch. */
	@keyframes divide-slide {
		0%,
		30% {
			transform: translate(var(--dx), var(--dy)) scale(var(--ds));
			animation-timing-function: cubic-bezier(0.45, 0, 0.3, 1);
		}
		70% {
			transform: translate(calc(var(--dx) * -0.04), calc(var(--dy) * -0.04));
		}
		100% {
			transform: none;
		}
	}
	.split-ring,
	.split-drop {
		transform-box: fill-box;
		transform-origin: 50% 50%;
		opacity: 0;
		animation: split-ring var(--divide-ms, 900ms) both;
	}
	@keyframes split-ring {
		0%,
		44% {
			opacity: 0;
			transform: scale(0.4);
		}
		50% {
			opacity: 0.95;
		}
		80%,
		100% {
			opacity: 0;
			transform: scale(1.9);
		}
	}
	.split-drop {
		animation-name: split-drop;
	}
	@keyframes split-drop {
		0%,
		46% {
			opacity: 0;
			transform: rotate(var(--a)) translateX(0) scale(0.5);
		}
		52% {
			opacity: 1;
		}
		82%,
		100% {
			opacity: 0;
			transform: rotate(var(--a)) translateX(var(--r)) scale(1);
		}
	}
	/* GRAPES' drawn-open eyes over its painted ^^ (BoardView's open eyes): they glance about,
	   and shut (showing the painted ^^) for a blink every 4.4s. */
	.open-eye {
		animation: open-blink 4.4s ease-in-out infinite;
	}
	/* The painted ^^ only while they're shut: its arc ends peek past the drawn whites. */
	.closed-eye {
		animation: closed-blink 4.4s ease-in-out infinite;
	}
	@keyframes closed-blink {
		0%,
		92%,
		97%,
		100% {
			opacity: 0;
		}
		93%,
		96% {
			opacity: 1;
		}
	}
	.open-pupil {
		animation: open-look 5.6s ease-in-out infinite;
	}
	@keyframes open-blink {
		0%,
		92%,
		97%,
		100% {
			opacity: 1;
		}
		93%,
		96% {
			opacity: 0;
		}
	}
	@keyframes open-look {
		0%,
		24%,
		80%,
		100% {
			transform: none;
		}
		30%,
		46% {
			transform: translate(-1.8px, 1.3px);
		}
		54%,
		72% {
			transform: translate(1.8px, -0.6px);
		}
	}
	/* Winning: the painted ^^ (Pixi squints on the hops; the DOM keeps it shut). */
	:global(.cell.lit) .open-eye {
		animation: none;
		opacity: 0;
	}
	:global(.cell.lit) .closed-eye {
		animation: none;
		opacity: 1;
	}
	/* Gear (BoardView's GEAR_MOVE): degrees in the part's own frame, so a mirrored pair moves
	   symmetrically. Idle: a sway on the blob's breath. Winning: a damped boing from each
	   landing of the 0.96s bounce. Fright: set to its pose, quivering. */
	.gear-crest {
		--sway: 3deg;
		--kick: 7deg;
		--stretch: 0.2;
		--fright: 0deg;
		--quiver: 3deg;
		--shrink: -0.2;
	}
	.gear-antenna {
		--sway: 5deg;
		--kick: -20deg;
		--stretch: 0.05;
		--fright: 12deg;
		--quiver: 4deg;
		--shrink: 0;
	}
	.gear-horn {
		--sway: 0.8deg;
		--kick: 7deg;
		--stretch: 0.08;
		--fright: -10deg;
		--quiver: 1deg;
		--shrink: 0.1;
	}
	.gear-flower {
		--sway: 4deg;
		--kick: 12deg;
		--stretch: 0.1;
		--fright: -14deg;
		--quiver: 0deg;
		--shrink: 0.1;
	}
	.gear {
		animation: gear-sway var(--breathe, 3.2s) ease-in-out var(--breathe-delay, 0s) infinite;
	}
	@keyframes gear-sway {
		0%,
		100% {
			rotate: calc(var(--sway) * -0.7);
		}
		50% {
			rotate: calc(var(--sway) * 0.7);
		}
	}
	:global(.cell.lit) .gear {
		animation: gear-boing 0.96s linear infinite;
	}
	/* e^(-t/290ms)·sin(2πt/280ms) from each landing, sampled at its peaks and zeros. */
	@keyframes gear-boing {
		0%,
		15%,
		29%,
		44%,
		58%,
		73%,
		100% {
			rotate: 0deg;
			scale: 1;
		}
		7% {
			rotate: calc(var(--kick) * 0.78);
			scale: calc(1 + var(--stretch) * 0.31) calc(1 - var(--stretch) * 0.78);
		}
		22% {
			rotate: calc(var(--kick) * -0.47);
			scale: calc(1 - var(--stretch) * 0.19) calc(1 + var(--stretch) * 0.47);
		}
		36% {
			rotate: calc(var(--kick) * 0.29);
			scale: calc(1 + var(--stretch) * 0.12) calc(1 - var(--stretch) * 0.29);
		}
		51% {
			rotate: calc(var(--kick) * -0.17);
		}
	}
	/* The flower jumps (BoardView's FLOWER_HOP): crouch, take off, float, drop and bonk back onto
	   the head. Winning: every bounce, landing 50ms after the body (the 156ms delay). At rest: a
	   smaller hop at the end of every 5.6s, over the sway. */
	.gear-flower {
		animation:
			gear-sway var(--breathe, 3.2s) ease-in-out var(--breathe-delay, 0s) infinite,
			flower-idle-hop 5.6s linear var(--breathe-delay, 0s) infinite;
	}
	:global(.cell.lit) .gear-flower {
		animation: flower-hop 0.96s linear 156ms infinite;
	}
	@keyframes flower-hop {
		0% {
			translate: 0 0;
			scale: 1;
			rotate: 0deg;
			animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
		}
		5% {
			scale: 1.1 0.86;
			animation-timing-function: cubic-bezier(0, 0, 0.58, 1);
		}
		14% {
			translate: 0 -3px;
			scale: 0.92 1.12;
			rotate: -2deg;
			animation-timing-function: cubic-bezier(0, 0, 0.58, 1);
		}
		50% {
			translate: 0 -12px;
			scale: 1.02 0.98;
			rotate: -8deg;
			animation-timing-function: cubic-bezier(0.11, 0, 0.5, 0);
		}
		84% {
			translate: 0 0;
			scale: 0.95 1.08;
			rotate: 3deg;
			animation-timing-function: linear;
		}
		89% {
			translate: 0 0.8px;
			scale: 1.2 0.78;
			rotate: 0deg;
			animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
		}
		95% {
			translate: 0 0;
			scale: 0.96 1.06;
			animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
		}
		100% {
			translate: 0 0;
			scale: 1;
			rotate: 0deg;
		}
	}
	/* The same jump at 0.7, in the last 760ms of 5.6s (86.4%–100%); translate/scale only, so the
	   sway keeps the rotation. */
	@keyframes flower-idle-hop {
		0%,
		86.4% {
			translate: 0 0;
			scale: 1;
			animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
		}
		87.1% {
			scale: 1.07 0.9;
			animation-timing-function: cubic-bezier(0, 0, 0.58, 1);
		}
		88.3% {
			translate: 0 -2.1px;
			scale: 0.94 1.08;
			animation-timing-function: cubic-bezier(0, 0, 0.58, 1);
		}
		93.2% {
			translate: 0 -8.4px;
			scale: 1.01 0.99;
			animation-timing-function: cubic-bezier(0.11, 0, 0.5, 0);
		}
		97.8% {
			translate: 0 0;
			scale: 0.97 1.06;
			animation-timing-function: linear;
		}
		98.5% {
			translate: 0 0.6px;
			scale: 1.14 0.85;
			animation-timing-function: cubic-bezier(0.42, 0, 0.58, 1);
		}
		99.3% {
			translate: 0 0;
			scale: 0.97 1.04;
		}
		100% {
			translate: 0 0;
			scale: 1;
		}
	}
	:global(:is(.grid.scared, .grid.nervous .cell:not(.lit))) .gear:not(.gear-crest),
	:global(.grid.nervous .cell:not(.lit)) .gear-crest {
		scale: calc(1 - max(var(--shrink), 0) * 0.5) calc(1 - var(--shrink));
		animation: gear-fright 0.11s linear infinite;
	}
	/* The crest rides the roller coaster (BoardView's CREST_WIND / CREST_STOP): blown back and
	   flapping before the drop, streamed up while falling, whipped forward by the stop on landing
	   (then back to its sway). */
	:global(.grid.scared) .gear-crest {
		animation: crest-wind 0.3s ease-out both, crest-flap 0.29s linear 0.3s infinite;
	}
	/* Later animations win the property while they run: the stop takes over from the updraft
	   when the blob lands (forwards only, so it doesn't hold its first frame through the fall),
	   then the sway from the stop. */
	:global(.sym.falling) .gear-crest {
		animation:
			crest-updraft 0.18s linear infinite,
			crest-stop 1.1s linear var(--impact-delay, 0s) forwards,
			gear-sway var(--breathe, 3.2s) ease-in-out calc(var(--impact-delay, 0s) + 1.1s) infinite;
	}
	:global(.sym.exiting) .gear-crest {
		animation: crest-updraft 0.18s linear infinite;
	}
	@keyframes crest-wind {
		from {
			rotate: 0deg;
			scale: 1;
		}
		to {
			rotate: -30deg;
			scale: 0.9 1.08;
		}
	}
	@keyframes crest-flap {
		0%,
		100% {
			rotate: -35deg;
			scale: 0.9 1.06;
		}
		30% {
			rotate: -23deg;
			scale: 0.9 1.12;
		}
		60% {
			rotate: -34deg;
			scale: 0.9 1.05;
		}
		80% {
			rotate: -26deg;
			scale: 0.9 1.1;
		}
	}
	@keyframes crest-updraft {
		0%,
		100% {
			rotate: -4deg;
			scale: 0.86 1.26;
		}
		50% {
			rotate: 4deg;
			scale: 0.86 1.31;
		}
	}
	/* e^(-t/380ms)·sin(2πt/420ms) × 32deg at its peaks and zeros; the stretch drops away first. */
	@keyframes crest-stop {
		0% {
			rotate: 0deg;
			scale: 0.86 1.28;
		}
		9.5% {
			rotate: 24.3deg;
			scale: 1.07 0.84;
		}
		19% {
			rotate: 0deg;
			scale: 1;
		}
		28.6% {
			rotate: -14.4deg;
			scale: 1;
		}
		38% {
			rotate: 0deg;
		}
		47.7% {
			rotate: 8.5deg;
			scale: 1.03 0.96;
		}
		57% {
			rotate: 0deg;
			scale: 1;
		}
		66.8% {
			rotate: -4.9deg;
		}
		76%,
		100% {
			rotate: 0deg;
			scale: 1;
		}
	}
	@keyframes gear-fright {
		0%,
		100% {
			rotate: calc(var(--fright) - var(--quiver));
		}
		50% {
			rotate: calc(var(--fright) + var(--quiver));
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.gear,
		.divide-body,
		.daughter,
		.split-ring,
		.split-drop,
		.blob-art,
		.closed-eye,
		.open-eye,
		.open-pupil,
		.brow,
		.mouth,
		.blush {
			animation: none;
		}
	}
</style>
