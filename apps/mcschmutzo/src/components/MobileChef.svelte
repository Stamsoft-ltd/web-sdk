<script lang="ts">
	import { Container, Graphics, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { chefMood, chefPose, idleSnicker, setChefMood } from '../game/chefMood.svelte';

	type Props = {
		/** Free games: he holds the salt shaker (the pot with the multiplier sits in front of him). */
		freegame: boolean;
	};
	const props: Props = $props();

	// The phone chef (portrait only) — Figma McShmutzo 8870:32978 (base) / 8870:33637 (free games): a
	// pointing bust peeking over the board's top-right corner, his lower body behind the board frame,
	// the bottle (base) or the salt shaker (free games) held up behind his shoulder. Placed in
	// fractions of the board FRAME (BoardFrame's sprite: 1.043 × 1.0473 of the board, inset
	// 0.0206 / 0.0224) measured off the design, so he scales and moves with the board on every phone.
	// He wears the same moods as the other two chefs (chefPose: lean, hop, squash, the snicker's
	// shoulder pops, the prop waggle) on top of a slow breath, waggles his prop now and then, and pops
	// up from behind the board whenever he comes on.
	const context = getContext();

	type Box = { x: number; y: number; w: number; h: number };
	// design px → board-frame fractions (frame: x −4, y 105, 380.17 × 346.55 in both designs)
	const BODY: Record<'base' | 'free', Box> = {
		base: { x: 0.7387, y: -0.2741, w: 0.2161, h: 0.4059 },
		// free games: 0.065 right of the design so the shaker hangs over the soup (user ask 2026-10-06)
		free: { x: 0.8177, y: -0.2886, w: 0.2021, h: 0.3796 },
	};
	const HAND: Record<'base' | 'free', Box & { key: string; px: number; py: number }> = {
		// bottle hand: turns about the wrist (the cuff, bottom right of the layer)
		base: { key: 'mobileBottle', x: 0.6885, y: -0.1211, w: 0.1072, h: 0.1645, px: 0.72, py: 0.93 },
		// salt hand: the forearm comes in from the right, so it flicks about the elbow there
		free: { key: 'mobileSalt', x: 0.7446, y: -0.1927, w: 0.1131, h: 0.1551, px: 0.97, py: 0.82 },
	};

	const frame = $derived.by(() => {
		const main = context.stateLayoutDerived.mainLayout();
		const b = context.stateGameDerived.boardLayout();
		const s = main.scale;
		const left = main.x + (b.x - b.width / 2 - main.width / 2) * s;
		const top = main.y + (b.y - b.height / 2 - main.height / 2) * s;
		return {
			x: left - b.width * 0.0206 * s,
			y: top - b.height * 0.0224 * s,
			w: b.width * 1.043 * s,
			h: b.height * 1.0473 * s,
		};
	});
	const phase = $derived(props.freegame ? 'free' : 'base');
	const body = $derived.by(() => {
		const r = BODY[phase];
		return { x: frame.x + r.x * frame.w, y: frame.y + r.y * frame.h, w: r.w * frame.w, h: r.h * frame.h };
	});
	// everything hangs off the body's bottom centre (behind the board), so scaling breathes / squashes
	// about it and the visible bust never slides off its spot
	const footX = $derived(body.x + body.w / 2);
	const footY = $derived(body.y + body.h);
	const hand = $derived.by(() => {
		const r = HAND[phase];
		const w = r.w * frame.w;
		const h = r.h * frame.h;
		return {
			key: r.key,
			// pivot point, relative to the foot
			x: frame.x + r.x * frame.w + r.px * w - footX,
			y: frame.y + r.y * frame.h + r.py * h - footY,
			w,
			h,
			px: r.px,
			py: r.py,
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

	// Entrance: up from behind the board (back-out, a squash as he tops out), then a hello nod.
	// Mounted only once the board's drop-in has landed (Background's boardLanded), so a short beat on
	// the first show; replays when the phase swaps his prop.
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
		if (enterAt < 0) return { dy: body.h * 0.75, sy: 1 };
		const t = clock - enterAt;
		if (t >= ENTER_MS + 300) return { dy: 0, sy: 1 };
		const u = Math.max(0, Math.min(1, t / ENTER_MS));
		const back = 1 + 2.4 * (u - 1) ** 3 + 1.4 * (u - 1) ** 2;
		const land = t - ENTER_MS * 0.55;
		const sy = land > 0 && land < 380 ? 1 - 0.04 * Math.exp(-land / 110) * Math.sin((land / 380) * Math.PI * 2.5) : 1;
		return { dy: body.h * 0.75 * (1 - back), sy };
	});

	// Body: a slow breath + weight shift, the mood offsets, the entrance. In free games every win
	// fires a mood, and the board chef's hops / laughing bounces (made for a full figure) read as a
	// jittery up-and-down on this small bust behind the pot — so there they are damped well down.
	const moodK = $derived(props.freegame ? 0.3 : 1);
	const pose = $derived.by(() => {
		const breathe = Math.sin(clock / 580);
		const sy = (1 + 0.006 * breathe) * (1 + (react.sy - 1) * moodK) * enter.sy;
		const sx = ((1 - 0.002 * breathe) * (1 + (react.sx - 1) * moodK)) / Math.sqrt(enter.sy);
		return {
			x: footX + react.dx * moodK * body.w,
			y: footY + react.dy * moodK * body.h + enter.dy,
			sx,
			sy,
			// the whole bust leans a touch with the head's moods (no separate head layer at this size)
			rot: 0.012 * Math.sin(clock / 1700 + 0.4) + react.headTilt * 0.35,
		};
	});

	// The prop: the bottle gets the board chef's damped waggle every few seconds; the salt shaker
	// salts — three quick flicks — on its own beat. Plus the mood's prop turn.
	const waggle = (t: number, period: number, dur: number, amp: number, n: number) => {
		const u = (t % period) / dur;
		if (u > 1) return 0;
		return amp * Math.exp(-2.4 * u) * Math.sin(u * 2 * Math.PI * n);
	};
	// Free games: he salts the soup the way a hand does it — the shaker held over the pot, a slow sway,
	// and every few seconds two unhurried up-down jerks of the hand (the shaker tipping a touch with
	// each); on a win he lifts it a little higher and shakes it faster. Small turns about the elbow
	// only (a big swing pulled the forearm off his sleeve); the jerk is the hand moving, not turning.
	const CHEER_MS: Partial<Record<string, number>> = { win: 1200, bigWin: 1900, hugeWin: 2700 };
	let cheer: [number, number] = [-1e9, 0];
	$effect(() => {
		const dur = CHEER_MS[chefMood.mood];
		if (dur) cheer = [chefMood.at, dur];
	});
	const smooth = (x: number) => x * x * (3 - 2 * x);
	const salt = (t: number) => {
		const ms = t - cheer[0];
		const dur = cheer[1];
		// cheer: up by 0 → 1 over 250 ms, held, back down over the last 400 ms
		const up = ms >= 0 && ms <= dur ? Math.min(smooth(Math.min(1, ms / 250)), smooth(Math.min(1, (dur - ms) / 400))) : 0;
		// salting: 2 jerks over 900 ms every 3.6 s (all the time, ~2 a second, while cheering) —
		// quicker jerks read as the hand trembling
		const u = (t % 3600) / 900;
		const jerk = up > 0 ? Math.abs(Math.sin(t / 150)) * up : u < 1 ? Math.abs(Math.sin(u * Math.PI * 2)) : 0;
		return {
			rot: 0.02 * Math.sin(t / 950) + 0.035 * jerk + 0.12 * up,
			dy: -0.05 * jerk - 0.04 * up,
		};
	};
	const hand2 = $derived.by(() => {
		if (!props.freegame) return { rot: waggle(clock, 2800, 1100, 0.05, 1.5) + react.propRot, dy: 0 };
		const s = salt(clock);
		return { rot: Math.max(-0.04, Math.min(0.17, s.rot + react.propRot * 0.15)), dy: s.dy * hand.h };
	});

	// Salt: each jerk of the shaker throws a puff of grains out of its cap (the holes, measured on the
	// hand texture at (0.72, 0.51), face down-right), falling into the soup — as LandscapeChef's.
	// Drawn in this container, so they leave from the cap wherever the hand is.
	const CAP = { u: 0.72, v: 0.51 };
	const PUFF_MS = 800;
	const handRotAt = (t: number) => {
		const s = salt(t);
		return { rot: Math.max(-0.04, Math.min(0.17, s.rot)), dy: s.dy * hand.h };
	};
	const capAt = (t: number) => {
		const { rot, dy } = handRotAt(t);
		const lx = (CAP.u - hand.px) * hand.w;
		const ly = (CAP.v - hand.py) * hand.h;
		return { x: hand.x + lx * Math.cos(rot) - ly * Math.sin(rot), y: hand.y + dy + lx * Math.sin(rot) + ly * Math.cos(rot) };
	};
	const puffTimes = (t: number) => {
		const out: number[] = [];
		// the two jerks of every 3.6 s beat peak 225 / 675 ms in (salt)
		for (const base of [Math.floor(t / 3600) * 3600, Math.floor(t / 3600) * 3600 - 3600])
			for (const off of [225, 675]) if (t - (base + off) >= 0 && t - (base + off) < PUFF_MS) out.push(base + off);
		// a cheer shakes all the time (a jerk every 150π ms)
		const [at, dur] = cheer;
		const step = 150 * Math.PI;
		for (let p = at + 250; p < at + dur - 400; p += step) if (t - p >= 0 && t - p < PUFF_MS) out.push(p);
		return out;
	};
	const drawSalt = (g: any) => {
		if (!props.freegame) return;
		// one design px of the board frame (380.17 wide in the design)
		const s = frame.w / 380;
		for (const p of puffTimes(clock)) {
			const age = (clock - p) / 1000;
			const from = capAt(p);
			for (let i = 0; i < 14; i++) {
				const r1 = ((i * 37 + Math.floor(p)) % 17) / 17;
				const r2 = ((i * 53 + Math.floor(p) * 3) % 13) / 13;
				// out of the cap (down-right) and down into the pot, spreading a little
				const vx = (2 + 12 * r1) * s;
				const vy = (6 + 10 * r2) * s;
				const x = from.x + vx * age;
				const y = from.y + vy * age + 0.5 * 220 * s * age * age;
				const a = Math.max(0, 1 - (age * 1000) / PUFF_MS);
				const r = (1.5 + 1 * r2) * s;
				g.circle(x, y, r + 0.8 * s).fill({ color: 0x3a2d22, alpha: 0.9 * a });
				g.circle(x, y, r).fill({ color: 0xffffff, alpha: a });
			}
		}
	};
</script>

<Container x={pose.x} y={pose.y} scale={{ x: pose.sx, y: pose.sy }} rotation={pose.rot} zIndex={-0.2}>
	<!-- the hand + prop behind the body (as in the design's layer order) -->
	<Sprite
		key={hand.key}
		x={hand.x}
		y={hand.y + hand2.dy}
		anchor={{ x: hand.px, y: hand.py }}
		width={hand.w}
		height={hand.h}
		rotation={hand2.rot}
	/>
	<Sprite key="mobileBody" x={-body.w / 2} y={-body.h} width={body.w} height={body.h} />
	<!-- salt falling from the shaker's cap (in front of him, into the pot) -->
	<Graphics draw={drawSalt} />
</Container>
