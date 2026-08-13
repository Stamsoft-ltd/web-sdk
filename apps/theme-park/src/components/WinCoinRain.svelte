<script lang="ts" module>
	/**
	 * How many coins fall for a win of this size. The old pre-rendered sheets rained the same coins
	 * for a 20x as for a 5000x; scaling the count is what makes a big win feel bigger before the
	 * number has finished climbing.
	 *
	 * Anchored on the WIN TIERS rather than run as one smooth curve over the whole range. A single
	 * log ramp is what the first pass did, and it was not readable: it put a 20x at 12 coins and a
	 * 1000x at 34, and a couple of dozen coins scattered over the whole canvas look much like a
	 * dozen. What the player actually sees is the tier, so each tier gets a count clearly apart from
	 * its neighbours — a handful on SWEET, a downpour on LEGENDARY — with the multipliers inside a
	 * tier interpolated logarithmically so a 900x still out-rains a 260x.
	 */
	const COIN_STEPS: [multiplier: number, coins: number][] = [
		[20, 6], // SWEET
		[50, 14], // WILD
		[100, 26], // EPIC
		[250, 46], // MYTHIC
		[1000, 84], // LEGENDARY
		[25000, 150], // MAX
	];

	export const coinsForMultiplier = (multiplier: number) => {
		const value = Math.max(multiplier, COIN_STEPS[0][0]);
		for (let i = 1; i < COIN_STEPS.length; i += 1) {
			const [hi, hiCoins] = COIN_STEPS[i];
			if (value >= hi) continue;
			const [lo, loCoins] = COIN_STEPS[i - 1];
			const t = Math.log(value / lo) / Math.log(hi / lo);
			return Math.round(loCoins + (hiCoins - loCoins) * t);
		}
		return COIN_STEPS[COIN_STEPS.length - 1][1];
	};
</script>

<script lang="ts">
	import { Sprite, PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';

	// Coins raining down the big-win screen.
	//
	// The old pre-rendered win-card sheets had the rain baked into their 36 frames; rebuilding the
	// card from its separate parts lost it, so this puts it back as its own layer — falling across
	// the whole canvas rather than being trapped inside the card's square, and BEHIND the card so
	// it never comes between the player and the amount.
	//
	// A coin tumbles by having its WIDTH driven by a cosine while its height stays put: a disc
	// spinning about its vertical axis is exactly a horizontal squash, which is why one face-on
	// sprite covers every angle the design's coin-rain layer shows.
	//
	// The squash ALONE reads as a flat cutout being scaled, because a real coin turning does two
	// things a squash does not: it shows its thickness, and its face darkens as it swings away from
	// the light. Both are done here with a second sprite — the coin's FAR face, in a plain metal
	// texture with no P and no bevel (scripts/win-cards/build_rain_coin.py), drawn behind the near
	// one and offset sideways.
	//
	// Offsetting the same ellipse is the whole trick, and it took two wrong tries to get to. Drawing
	// the rim as its own lens BESIDE the face looked like a second coin peeking out: two ellipses
	// side by side both taper to nothing top and bottom, so their union pinches in the middle and
	// the rim reads as a detached blade. But the far face of a real coin IS the near face's ellipse,
	// shifted by the thickness — so shifting a copy leaves exactly the crescent that should be
	// visible, hugging the edge and tapering with it, because it is the same shape.

	type Props = {
		/** Coins on screen at once — see `coinsForMultiplier`. */
		count?: number;
		/** Coin width as a fraction of the canvas width, smallest to largest. */
		size?: [number, number];
		/** Seconds to fall the full height, slowest to fastest. */
		fall?: [number, number];
		alpha?: number;
		/** Deterministic seed, so two layers do not fall in identical lanes. */
		seed?: number;
		/** 0-1 gate, so the rain can be switched off without unmounting (mount order is paint order). */
		intensity?: number;
	};

	const {
		count = 24,
		size = [0.03, 0.075],
		fall = [0.95, 1.7],
		alpha = 1,
		seed = 1,
		intensity = 1,
	}: Props = $props();

	const context = getContext();
	const canvas = $derived(context.stateLayoutDerived.canvasSizes());
	/** The coin art's own proportions (Figma 6449:8830) — face-on, so very nearly round. */
	const COIN_ASPECT = 251 / 256;
	/**
	 * How the tumble is shaped. A spinning disc's apparent width is |cos|, which spends most of its
	 * time WELL under full — with the first (already tilted) coin art on top of that, every coin
	 * read as permanently squashed. The exponent below 1 pushes the curve towards face-on, so a
	 * coin shows its face most of the time and flicks quickly through edge-on.
	 *
	 * There is no floor any more. It used to stop the coin becoming an invisible sliver; now the rim
	 * is what the eye follows through edge-on, and holding the face open 20% through the turn just
	 * kept a squashed P on screen at the one moment there should not be one.
	 */
	const TUMBLE_SHAPE = 0.5;
	/** Turns per second, slowest coin to fastest. Raised with the fall speed so coins that now
	 * cross the screen in a second still show more than a single turn on the way down. */
	const SPIN_RATE = [2.2, 4.2];
	/** Coin thickness, as a fraction of its diameter. */
	const RIM = 0.16;
	/**
	 * How far apart the two faces are pushed, as a share of the thickness. Below the true half,
	 * because each face is drawn as a full sprite rather than as a plane of no width: at the exact
	 * half the coin measured twice its thickness when edge-on.
	 */
	const FACE_SPLIT = 0.38;
	/**
	 * Neither face is allowed thinner than this share of the thickness. Without it both vanish at
	 * edge-on and the coin flickers out for a frame; with it the two overlap into one clean sliver.
	 */
	const EDGE_FLOOR = 0.6;
	/** The rim art is already gold, so this only shades it back behind the lit face. */
	const RIM_SHADE = 0.78;
	/** How far the face darkens as it swings edge-on. */
	const FACE_SHADE = 0.42;
	/** The far side is a touch darker again, so the coin reads as having two faces, not one. */
	const BACK_SHADE = 0.88;

	const greyTint = (level: number) => {
		const v = Math.max(0, Math.min(255, Math.round(level * 255)));
		return (v << 16) | (v << 8) | v;
	};

	let elapsed = $state(0);
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		const tick = () => {
			if (intensity > 0) elapsed += app.ticker.deltaMS / 1000;
		};
		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
		return () => app.ticker.remove(tick, null);
	});

	/** Deterministic 0-1 from a coin index and a channel — no Math.random, so a resize is stable. */
	const rnd = (index: number, channel: number) => {
		const v = Math.sin((index + 1) * 12.9898 + channel * 78.233 + seed * 37.719) * 43758.5453;
		return v - Math.floor(v);
	};
	const mix = (a: number, b: number, t: number) => a + (b - a) * t;

	const coins = $derived.by(() => {
		const width = canvas.width;
		const height = canvas.height;
		return Array.from({ length: count }, (_, index) => {
			const w = mix(size[0], size[1], rnd(index, 0)) * width;
			const duration = mix(fall[1], fall[0], rnd(index, 1));
			const margin = w * 1.3;
			const span = height + margin * 2;
			// Each coin has its own start offset, so they do not all enter in one curtain.
			const t = (elapsed / duration + rnd(index, 2)) % 1;
			const sway = mix(0.008, 0.035, rnd(index, 3)) * width;
			const spin = elapsed * mix(SPIN_RATE[0], SPIN_RATE[1], rnd(index, 4)) + index * 1.7;
			const turn = Math.cos(spin);
			const facing = Math.abs(turn) ** TUMBLE_SHAPE;
			const coinW = Math.max(w * facing, w * RIM * EDGE_FLOOR);
			/**
			 * How far the near face sits from the coin's centre. Both faces are the same ellipse —
			 * only their separation changes — but WHICH ONE IS NEARER swaps every half turn, and
			 * that `Math.sign(turn)` is the whole difference between a coin rotating and a coin
			 * rocking. Without it the offset runs 0 → max → 0 along the same side, so the face
			 * slides out to the edge and then retreats the way it came: the coin visibly turns
			 * half way and unwinds. With it the far face takes over past edge-on and comes in from
			 * the other side, which is what turning through looks like.
			 */
			const split = w * RIM * FACE_SPLIT * Math.sin(spin) * (turn < 0 ? -1 : 1);
			// A lazy lean on top of the tumble, so they are not all falling bolt upright. Kept
			// small: the tumble is the motion, and stacking a big rotation on it just made every
			// coin look permanently askew.
			const rotation = Math.sin(elapsed * mix(0.4, 1.1, rnd(index, 7)) + index) * 0.18;
			// The offsets are along the coin's own x, so they turn with its lean.
			const alongX = Math.cos(rotation);
			const alongY = Math.sin(rotation);
			const x = rnd(index, 5) * width + Math.sin(elapsed * mix(0.7, 1.9, rnd(index, 6)) + index) * sway;
			const y = -margin + t * span;
			// Fade the ends of the fall so a coin does not pop in or out at the canvas edge.
			const coinAlpha = alpha * intensity * Math.min(1, (1 - t) * 8, t * 14);
			return {
				id: index,
				w: coinW,
				h: w / COIN_ASPECT,
				rotation,
				alpha: coinAlpha,
				faceX: x + split * alongX,
				faceY: y + split * alongY,
				// Darkest edge-on, full brightness face-on, and a shade down again on the far side.
				faceTint: greyTint((1 - FACE_SHADE + FACE_SHADE * facing) * (turn < 0 ? BACK_SHADE : 1)),
				rimX: x - split * alongX,
				rimY: y - split * alongY,
			};
		});
	});
</script>

<!-- Far faces first, as one pass, then near faces: two passes rather than interleaved so each
     texture is bound once and the whole rain stays two draw calls however many coins are falling. -->
{#each coins as coin (coin.id)}
	<Sprite
		key="winRainCoinRim"
		anchor={0.5}
		x={coin.rimX}
		y={coin.rimY}
		width={coin.w}
		height={coin.h}
		rotation={coin.rotation}
		alpha={coin.alpha}
		tint={greyTint(RIM_SHADE)}
	/>
{/each}

{#each coins as coin (coin.id)}
	<Sprite
		key="winRainCoin"
		anchor={0.5}
		x={coin.faceX}
		y={coin.faceY}
		width={coin.w}
		height={coin.h}
		rotation={coin.rotation}
		alpha={coin.alpha}
		tint={coin.faceTint}
	/>
{/each}
