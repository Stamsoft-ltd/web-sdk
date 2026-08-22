<script lang="ts" module>
	/**
	 * Lights the marquee bulbs on a symbol.
	 *
	 * Most of this game's art is fairground signage — the royals, the wheel, both wilds, all three
	 * feature facades — and every one of them used to win by swapping to a lit still and playing a
	 * short webm: a dozen video files that could only ever do the one canned thing and that had to be
	 * re-authored whenever the art was re-drawn. The bulbs are baked into the art unlit and their
	 * positions measured off it (see `symbolBulbs.ts`), so the whole presentation is a handful of
	 * additive circles drawn over the symbol that is already on the board. Nothing to load, nothing to
	 * decode, and it lands in step with the win pulse the board is already applying.
	 *
	 * Two modes, and the gap between them is the point:
	 *
	 * - `idle`, on every settled symbol. A real fairground sign is never off, and a board of signs with
	 *   dead bulbs reads as artwork rather than as lights. A slow warm shimmer, each bulb on its own
	 *   phase, so the light crawls around the sign instead of pulsing as one.
	 * - `win`. Every bulb slams to full on the hit, then a bright chase runs around the sign over a
	 *   warm resting glow.
	 *
	 * A resting bulb travels between roughly 0.09 and 0.52 alpha at the core, so the blink is plainly
	 * visible on its own; a winning one rests at 0.20 and peaks at 1.0. What separates the two is not
	 * the brightness so much as the MOTION — idle drifts, a win flashes and then chases.
	 */
	const TAU = Math.PI * 2;

	// --- win ---------------------------------------------------------------------------------------
	/** The opening flash, where every bulb is at full before the chase takes over. */
	const FLASH_SECONDS = 0.26;
	/** One trip of the chase around the letter. */
	const CHASE_SECONDS = 0.85;
	/** How much of the loop the travelling highlight covers — wider reads as a sweep, not a dot. */
	const CHASE_WIDTH = 0.3;
	/**
	 * What a bulb sits at between passes, so the letter stays lit rather than blinking off.
	 *
	 * It sits just under the top of the idle swing below, not above it, because the chase needs the
	 * headroom — the two are far enough apart on screen anyway, since the board drops every non-winning
	 * symbol to 0.35 alpha while the winner stays at 1.
	 */
	const REST_LEVEL = 0.45;

	// --- idle --------------------------------------------------------------------------------------
	/**
	 * Where a resting bulb sits at its dimmest, and how far it swings above that.
	 *
	 * These have to be read together with CONTRAST below, which squares them, so the numbers are much
	 * bigger than the alphas they produce: 0.30 + 0.42 travels from 0.09 to 0.52. The swing is what
	 * has to be big, not the floor — a bulb that doubles reads as BLINKING, where one that sits at a
	 * steady level just reads as a slightly brighter still.
	 */
	const IDLE_BASE = 0.3;
	const IDLE_TWINKLE = 0.42;
	/** Slow enough to be ambient, fast enough that a bulb visibly turns over while you watch a spin. */
	const IDLE_HZ = 0.38;
	/** Radians of phase between neighbouring bulbs, so the shimmer crawls instead of pulsing as one. */
	const IDLE_SPREAD = 1.9;
	/**
	 * The whole idle halo, on top of the per-bulb level — the one number to reach for if the shimmer
	 * ever competes with the reels. At 1 it is doing nothing; the separation from a win is carried by
	 * the levels above and by the flash and chase, not by holding idle down.
	 */
	const IDLE_GAIN = 1;

	/**
	 * The core saturates to white long before its alpha reaches 1, so a linear ramp made the resting
	 * bulbs look exactly as bright as the ones under the sweep and the chase read as a static glow.
	 * Squaring pushes the resting level back down the curve and leaves the peak where it was.
	 */
	const CONTRAST = 2;
	/** How much wider a bulb blooms at full than at rest — the halo grows as well as brightens. */
	const BLOOM = 0.4;

	// Concentric discs, outermost first: a wide amber bloom, a tighter one, then the hot core. Drawn
	// additively, so these stack into a filament rather than three visible rings — and so a bulb over
	// the letter's dark outline still blooms.
	const HALO = [
		{ scale: 4.2, alpha: 0.11, colour: 0xff8c10 },
		{ scale: 2.4, alpha: 0.2, colour: 0xffc247 },
		{ scale: 1.35, alpha: 0.46, colour: 0xffe9a8 },
		{ scale: 0.78, alpha: 0.95, colour: 0xfffdf0 },
	];
	/**
	 * Idle draws the SAME rings as a win, and it has to.
	 *
	 * A bulb's measured radius is about 0.0094 of the symbol frame, which at the size a symbol is drawn
	 * on the board is a core of barely one pixel. An earlier pass dropped the two widest rings here on
	 * the grounds that a resting symbol should not bloom past the letter's outline — but the wide rings
	 * are the only thing giving the glow any size at all, so what was left was a sub-pixel dot that
	 * showed up in a frame diff and in nothing else. The idle/win separation is carried entirely by
	 * brightness and by the flash and chase.
	 */
	const IDLE_HALO = HALO;

	/**
	 * How white each ring of the ramp above is, on the way in from the outermost to the core.
	 *
	 * Read off HALO rather than chosen: taking each ring's colour as its outermost one mixed some way
	 * toward white gives 0, 0.35, 0.72 and 0.96, near enough the same amount in both of the channels
	 * that are free to move. So the ramp is not four colours, it is ONE colour and a fade to white —
	 * which is the only reason a bulb of some other colour can be built from it at all.
	 */
	const WHITEN = [0, 0.35, 0.72, 0.96];

	/** `colour` mixed `amount` of the way to white. */
	const whiten = (colour: number, amount: number) => {
		const mix = (channel: number) => Math.round(channel + (255 - channel) * amount);
		return (
			(mix((colour >> 16) & 255) << 16) | (mix((colour >> 8) & 255) << 8) | mix(colour & 255)
		);
	};

	/**
	 * The rings for one bulb.
	 *
	 * A bulb with no colour of its own gets the amber ramp EXACTLY as authored, not a reconstruction
	 * of it — every royal, the wheel and both wilds are lit by that ramp and none of them should shift
	 * because the Mega Wild's jewels needed a different one.
	 */
	const ringsFor = (colour: number | undefined, rings: typeof HALO) =>
		colour === undefined
			? rings
			: rings.map((ring, index) => ({ ...ring, colour: whiten(colour, WHITEN[index]) }));
</script>

<script lang="ts">
	import { Graphics, PIXI } from 'pixi-svelte';

	import type { SymbolBulb } from '../game/symbolBulbs';

	type Props = {
		/**
		 * The bulbs to light, in chase order. Passed in rather than looked up by symbol name, because
		 * the caller is the only thing that knows whether this pattern belongs on what is actually being
		 * drawn: 'W' renders as three different sprites (the marquee wild, the Coaster Wild tile and the
		 * Mega Wild plaque) and the W's bulb pattern only matches the first, while the Mega Wild's own
		 * bulbs belong to a full-reel plaque that has no board symbol at all.
		 */
		bulbs: SymbolBulb[];
		x: number;
		y: number;
		/** The size the symbol sprite itself is being drawn at, so the bulbs ride the win pulse. */
		width: number;
		height: number;
		/**
		 * Seconds. Since this win started when winning; the board's free-running idle clock otherwise —
		 * which the board QUANTISES, so the shimmer redraws a few times a second rather than every
		 * frame. Nothing at 0.21Hz needs 60fps.
		 */
		clock: number;
		win: boolean;
		/** Spreads the shimmer across the grid so the cells are not a single metronome. */
		phase?: number;
		alpha?: number;
		/**
		 * Radians about the symbol's centre, so the bulbs ride the board's idle rock with the sprite
		 * they are lighting. Free: every bulb is already drawn relative to the centre, so this is one
		 * transform rather than a redraw.
		 */
		rotation?: number;
	};

	const props: Props = $props();

	const bulbs = $derived(props.bulbs);

	/** 0..1 for one bulb at this instant. */
	const winLevel = (index: number) => {
		if (props.clock < FLASH_SECONDS) return 1;
		const sweep = ((props.clock - FLASH_SECONDS) / CHASE_SECONDS) % 1;
		const own = index / bulbs.length;
		// Distance around the loop, so the sweep wraps from the last bulb back to the first.
		let gap = Math.abs(sweep - own);
		if (gap > 0.5) gap = 1 - gap;
		if (gap > CHASE_WIDTH) return REST_LEVEL;
		const peak = Math.cos((gap / CHASE_WIDTH) * Math.PI) * 0.5 + 0.5;
		return REST_LEVEL + (1 - REST_LEVEL) * peak;
	};

	const idleLevel = (index: number) => {
		const swing =
			Math.sin(TAU * IDLE_HZ * props.clock + (props.phase ?? 0) + index * IDLE_SPREAD) * 0.5 + 0.5;
		return IDLE_BASE + IDLE_TWINKLE * swing;
	};

	const draw = (graphics: InstanceType<typeof PIXI.Graphics>) => {
		if (bulbs.length === 0) return;
		const { width, height, win } = props;
		const ramp = win ? HALO : IDLE_HALO;
		const gain = win ? 1 : IDLE_GAIN;
		for (const [index, bulb] of bulbs.entries()) {
			const brightness = win ? winLevel(index) : idleLevel(index);
			const lit = brightness ** CONTRAST * gain;
			const cx = (bulb.x - 0.5) * width;
			const cy = (bulb.y - 0.5) * height;
			const radius = bulb.r * width * (1 - BLOOM + BLOOM * brightness);
			for (const ring of ringsFor(bulb.colour, ramp)) {
				graphics
					.circle(cx, cy, radius * ring.scale)
					.fill({ color: ring.colour, alpha: ring.alpha * lit });
			}
		}
	};
</script>

<Graphics
	x={props.x}
	y={props.y}
	rotation={props.rotation ?? 0}
	alpha={props.alpha ?? 1}
	blendMode="add"
	{draw}
/>
