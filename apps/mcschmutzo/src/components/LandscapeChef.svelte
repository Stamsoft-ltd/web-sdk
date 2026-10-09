<script lang="ts">
	import { Container, Graphics, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { chefMood, chefPose, idleSnicker, setChefMood } from '../game/chefMood.svelte';
	import { landscapeLayout } from '../game/landscapeLayout';

	type Props = {
		/** Free games: he holds the salt shaker over the soup pot (FreeSpinPanelHtml draws the pot). */
		freegame: boolean;
	};
	const props: Props = $props();

	// The phone-LANDSCAPE chef — Figma 8295:22703 (base) / 8302:23371 (free games), his other arm
	// hanging straight (8779:1769): a bust in the bottom-left corner, cut by the screen's bottom edge,
	// the ketchup (base) or the salt shaker (free games) held up towards the board, each prop hand its
	// own layer behind the body (scripts/build-landscape-chef.py). Placed by landscapeLayout. He wears the same moods as the
	// other chefs (chefPose) on a slow breath, waggles / salts with his prop, and rises from below the
	// screen edge whenever he comes on.
	const context = getContext();

	type Box = { x: number; y: number; w: number; h: number };
	// layer boxes in Figma units of the (mirrored) chef node, printed by build-landscape-chef.py
	const BODY: Record<'base' | 'free', Box & { key: string }> = {
		base: { key: 'landChefBaseBody', x: 7.55, y: 0, w: 129.67, h: 240 },
		free: { key: 'landChefFreeBody', x: 7.25, y: 0, w: 128, h: 240 },
	};
	// the bow tie, lifted off the body: it wobbles on its knot (kx, ky)
	const BOW: Record<'base' | 'free', Box & { key: string; kx: number; ky: number }> = {
		base: { key: 'landChefBaseBow', x: 70.22, y: 115.33, w: 39.33, h: 20.67, kx: 92.2, ky: 125.6 },
		free: { key: 'landChefFreeBow', x: 69.58, y: 114, w: 38.67, h: 20.33, kx: 91.16, ky: 124.18 },
	};
	const HAND: Record<'base' | 'free', Box & { key: string; px: number; py: number }> = {
		// bottle hand: the forearm turns about the elbow, hidden behind his body at (100, 200) — a wrist
		// pivot spun the hand on a nail and swung its cuff out beside the strap
		base: { key: 'landChefBaseHand', x: 101.55, y: 89.5, w: 68.33, h: 95, px: -0.0227, py: 1.1632 },
		// salt hand: the forearm comes in from the body, so it flicks about the elbow at the left
		free: { key: 'landChefFreeHand', x: 109, y: 58.75, w: 76.67, h: 96.33, px: 0.03, py: 0.85 },
	};

	const phase = $derived(props.freegame ? 'free' : 'base');
	const place = $derived(landscapeLayout(context, props.freegame).chef);
	const body = $derived.by(() => {
		const r = BODY[phase];
		const s = place.unit;
		return { key: r.key, x: place.x + r.x * s, y: place.y + r.y * s, w: r.w * s, h: r.h * s };
	});
	// everything hangs off the body's bottom centre (below the screen edge), so scaling breathes /
	// squashes about it and the bust never slides off its spot
	const footX = $derived(body.x + body.w / 2);
	const footY = $derived(body.y + body.h);
	const hand = $derived.by(() => {
		const r = HAND[phase];
		const s = place.unit;
		const w = r.w * s;
		const h = r.h * s;
		return {
			key: r.key,
			x: place.x + r.x * s + r.px * w - footX,
			y: place.y + r.y * s + r.py * h - footY,
			w,
			h,
			px: r.px,
			py: r.py,
		};
	});

	const bow = $derived.by(() => {
		const r = BOW[phase];
		const s = place.unit;
		const w = r.w * s;
		const h = r.h * s;
		return {
			key: r.key,
			x: place.x + r.kx * s - footX,
			y: place.y + r.ky * s - footY,
			w,
			h,
			ax: (r.kx - r.x) / r.w,
			ay: (r.ky - r.y) / r.h,
		};
	});

	let clock = $state(0);
	$effect(() => {
		let raf = 0;
		const loop = (ts: number) => {
			clock = ts;
			if (!props.freegame) idleSnicker(ts);
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const react = $derived(chefPose(clock));

	// Entrance: up from below the screen edge (back-out, a squash as he tops out), then a hello nod.
	// Replays when the phase swaps his prop.
	const ENTER_MS = 650;
	let enterAt = $state(-1);
	let firstShow = true;
	$effect(() => {
		void phase;
		if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		const delay = firstShow ? 150 : 250;
		firstShow = false;
		enterAt = performance.now() + delay;
		const id = setTimeout(() => chefMood.mood === 'idle' && setChefMood('win'), delay + ENTER_MS * 0.7);
		return () => clearTimeout(id);
	});
	const enter = $derived.by(() => {
		if (enterAt < 0) return { dy: body.h * 0.8, sy: 1 };
		const t = clock - enterAt;
		if (t >= ENTER_MS + 300) return { dy: 0, sy: 1 };
		const u = Math.max(0, Math.min(1, t / ENTER_MS));
		const back = 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2;
		const land = t - ENTER_MS * 0.55;
		const sy = land > 0 && land < 380 ? 1 - 0.04 * Math.exp(-land / 110) * Math.sin((land / 380) * Math.PI * 2.5) : 1;
		return { dy: body.h * 0.8 * (1 - back), sy };
	});

	const pose = $derived.by(() => {
		const breathe = Math.sin(clock / 580);
		const sy = (1 + 0.006 * breathe) * react.sy * enter.sy;
		const sx = ((1 - 0.002 * breathe) * react.sx) / Math.sqrt(enter.sy);
		return {
			x: footX + react.dx * body.w,
			y: footY + react.dy * body.h + enter.dy,
			sx,
			sy,
			// mirrored art: the head leans the other way round
			rot: 0.012 * Math.sin(clock / 1700 + 0.4) - react.headTilt * 0.35,
		};
	});

	// The bottle gets a damped waggle every few seconds; the salt shaker rests over the soup with a
	// slow sway and two unhurried tips, and on a win goes up high in triumph and shakes. Mirrored
	// art, so the turns are sign-flipped against MobileChef's.
	const waggle = (t: number, period: number, dur: number, amp: number, n: number) => {
		const u = (t % period) / dur;
		if (u > 1) return 0;
		return amp * Math.exp(-2.4 * u) * Math.sin(u * 2 * Math.PI * n);
	};
	const CHEER_MS: Partial<Record<string, number>> = { win: 1200, bigWin: 1900, hugeWin: 2700 };
	let cheer: [number, number] = [-1e9, 0];
	$effect(() => {
		const dur = CHEER_MS[chefMood.mood];
		if (dur) cheer = [chefMood.at, dur];
	});
	const smooth = (x: number) => x * x * (3 - 2 * x);
	const saltRot = (t: number) => {
		const ms = t - cheer[0];
		const dur = cheer[1];
		let up = 0;
		let shake = 0;
		if (ms >= 0 && ms <= dur) {
			up = ms < 230 ? smooth(ms / 230) * 1.08 : ms < 360 ? 1.08 - 0.08 * smooth((ms - 230) / 130) : ms < dur - 420 ? 1 : smooth((dur - ms) / 420);
			if (ms > 360 && ms < dur - 420) shake = 0.06 * Math.sin(((ms - 360) / 520) * Math.PI * 2); // ~2 a second: quicker read as trembling
		}
		const u = (t % 4200) / 520;
		// a tip pours: the shaker's cap (right) goes down
		const tip = u < 2 ? 0.07 * Math.sin((u % 1) * Math.PI) : 0;
		return (1 - up) * (0.025 * Math.sin(t / 950) + tip) - up * 0.1 + shake * 0.6;
	};
	// The bottle: every few seconds the forearm lifts it (− turns up about the elbow), gives it a couple
	// of shakes and lowers it again. Lowering it below rest would open a gap at the cuff, so the turn
	// stays within [−0.12, 0.03].
	const bottleRot = (t: number) => {
		const u = (t % 2800) / 1100;
		if (u > 1) return 0;
		return -0.05 * Math.sin(Math.PI * u) + waggle(t, 2800, 1100, 0.025, 1.5);
	};
	const handRot = $derived(
		props.freegame
			? saltRot(clock) - react.propRot * 0.3
			: Math.max(-0.12, Math.min(0.03, bottleRot(clock) - react.propRot * 0.5)),
	);
	// Salt: every tip and every cheer shake throws a puff of grains out of the shaker's cap (its holes
	// face, measured on the hand texture at (0.22, 0.60), pointing down-left); they fall into the pot
	// (FreeSpinPanelHtml's HTML pot, over the canvas, swallows them at the soup). Drawn in this
	// container, so they leave from the cap wherever the hand is.
	const CAP = { u: 0.22, v: 0.6 };
	const PUFF_MS = 850;
	const capAt = (rot: number) => {
		const lx = (CAP.u - hand.px) * hand.w;
		const ly = (CAP.v - hand.py) * hand.h;
		return { x: hand.x + lx * Math.cos(rot) - ly * Math.sin(rot), y: hand.y + lx * Math.sin(rot) + ly * Math.cos(rot) };
	};
	const puffTimes = (t: number) => {
		const out: number[] = [];
		// the two tips of every 4.2 s salting beat peak 260 / 780 ms in (saltRot)
		for (const base of [Math.floor(t / 4200) * 4200, Math.floor(t / 4200) * 4200 - 4200])
			for (const off of [260, 780]) if (t - (base + off) >= 0 && t - (base + off) < PUFF_MS) out.push(base + off);
		// a cheer pours (the shaker only lifts a little — a big swing put it in front of his mouth): a puff per shake (every 520 ms) while it is held up
		const [at, dur] = cheer;
		for (let p = at + 360; p < at + dur - 420; p += 520) if (t - p >= 0 && t - p < PUFF_MS) out.push(p);
		return out;
	};
	const drawSalt = (g: any) => {
		if (!props.freegame) return;
		const s = place.unit;
		for (const p of puffTimes(clock)) {
			const age = (clock - p) / 1000;
			const from = capAt(saltRot(p));
			for (let i = 0; i < 14; i++) {
				const r1 = ((i * 37 + Math.floor(p)) % 17) / 17;
				const r2 = ((i * 53 + Math.floor(p) * 3) % 13) / 13;
				// out of the cap and down into the pot (gravity), spreading a little
				const vx = (-6 + 10 * r1) * s;
				const vy = (4 + 10 * r2) * s;
				const x = from.x + vx * age;
				const y = from.y + vy * age + 0.5 * 240 * s * age * age;
				const a = Math.max(0, 1 - (age * 1000) / PUFF_MS);
				const r = (1.5 + 1 * r2) * s;
				g.circle(x, y, r + 0.8 * s).fill({ color: 0x3a2d22, alpha: 0.9 * a });
				g.circle(x, y, r).fill({ color: 0xffffff, alpha: a });
			}
		}
	};

	// The bow tie sways on its knot with the breath, follows the arm a little (late) and the head's moods.
	const bowRot = $derived(
		Math.max(
			-0.06,
			Math.min(
				0.06,
				0.014 * Math.sin(clock / 1150 + 0.8) +
					0.006 * Math.sin(clock / 530) +
					0.3 * (props.freegame ? saltRot(clock - 80) * 0.3 : bottleRot(clock - 80)) -
					0.3 * react.headTilt,
			),
		),
	);
</script>

<Container x={pose.x} y={pose.y} scale={{ x: pose.sx, y: pose.sy }} rotation={pose.rot} zIndex={-0.2}>
	<!-- the prop hand behind the body (the design's layer order) -->
	<Sprite
		key={hand.key}
		x={hand.x}
		y={hand.y}
		anchor={{ x: hand.px, y: hand.py }}
		width={hand.w}
		height={hand.h}
		rotation={handRot}
	/>
	<Sprite key={body.key} x={body.x - footX} y={body.y - footY} width={body.w} height={body.h} />
	<Sprite key={bow.key} x={bow.x} y={bow.y} anchor={{ x: bow.ax, y: bow.ay }} width={bow.w} height={bow.h} rotation={bowRot} />
	<!-- salt falling from the shaker's cap (in front of him, into the pot) -->
	<Graphics draw={drawSalt} />
</Container>
