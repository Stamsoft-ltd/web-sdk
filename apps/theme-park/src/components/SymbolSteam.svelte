<script lang="ts" module>
	/**
	 * Steam out of the Mega Wild locomotive's funnel.
	 *
	 * IT NEVER STOPS. An engine sitting on the board with nothing coming out of its funnel is a
	 * picture of an engine, and this plaque is the rarest thing the base game puts on the reels — it
	 * only appears on a roller trigger — so it is the last symbol that should be holding still when
	 * the player finally sees one. At rest the plume is slower and much fainter, which is enough of
	 * a gap that a win still reads as the engine opening up rather than as more of the same.
	 *
	 * The plaque is a locomotive (Figma 7057:7990) and the design ships a cartoon steam cloud beside it
	 * (7057:7989) as the thing it does when it wins. One cloud, not a strip: what makes a run of puffs
	 * read as steam is that each one is a different size, leans a different way and thins out at its
	 * own rate, none of which needs a second drawing.
	 *
	 * Nothing here is random at runtime. A puff's size and lean come from its index through `wobble`
	 * below, so the same plaque steams the same way every time — which matters because this is drawn
	 * per winning cell, and two cells side by side puffing in lockstep would read as one animation
	 * playing twice rather than as two engines.
	 */
	const TAU = Math.PI * 2;

	/** How long one puff takes to leave the funnel, climb and thin out to nothing. */
	const LIFETIME = 1.5;
	/** And at rest: half again as long to make the climb, at a third of the opacity. */
	const IDLE_SLOWER = 1.6;
	const IDLE_ALPHA = 0.34;
	/** Puffs alive at once. Each is a `LIFETIME / PUFFS` step behind the one in front of it. */
	const PUFFS = 5;
	/**
	 * How far a puff climbs, as a fraction of the symbol's height.
	 *
	 * Deliberately short of the top of the cell. A puff that carried on past it would be cut off by
	 * the board mask rather than fading, and would spend its last half drifting across whatever symbol
	 * is in the cell above — a plume belonging to nothing.
	 */
	const RISE = 0.46;
	/** Sideways lean by the top of the climb, as a fraction of the symbol's width. Signed per puff. */
	const DRIFT = 0.13;
	/** A puff leaves the funnel small and opens out as it cools. Fractions of the symbol's width. */
	const START_SCALE = 0.16;
	const END_SCALE = 0.62;
	/** The share of a puff's life spent coming up from nothing, so none of them pops into existence. */
	const FADE_IN = 0.18;
	const PEAK_ALPHA = 0.72;

	/**
	 * The funnel's mouth on the plaque, as a fraction of the 448x360 symbol frame — measured off the
	 * art, where the gold cap sits at x 165..280 and its lip at y 27.
	 */
	const FUNNEL = { x: 0.496, y: 0.072 };

	/** The steam-puff art's own aspect, so a puff is never stretched by being sized off its width. */
	const PUFF_ASPECT = 113 / 256;

	/** A stable -1..1 per puff, so each one has its own size and leans its own way. */
	const wobble = (index: number, salt: number) => {
		const hashed = Math.sin((index + 1) * 12.9898 + salt) * 43758.5453;
		return (hashed - Math.floor(hashed)) * 2 - 1;
	};
</script>

<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';

	type Props = {
		x: number;
		y: number;
		/** The size the symbol sprite is being drawn at, so the plume rides the win pulse with it. */
		width: number;
		height: number;
		/** Seconds since this win started, or the board's idle clock when `idle`. */
		clock: number;
		/** Ticking over rather than winning: slower, fainter, and never ending. */
		idle?: boolean;
		alpha?: number;
		/** Radians about the symbol's centre, so the plume rocks with the sprite it belongs to. */
		rotation?: number;
	};

	const props: Props = $props();

	const puffs = $derived.by(() => {
		const out: {
			x: number;
			y: number;
			size: number;
			alpha: number;
			rotation: number;
		}[] = [];
		const lifetime = LIFETIME * (props.idle ? IDLE_SLOWER : 1);
		const peak = PEAK_ALPHA * (props.idle ? IDLE_ALPHA : 1);
		for (let index = 0; index < PUFFS; index += 1) {
			// Counted from when this puff FIRST leaves the funnel rather than wrapped from zero, so the
			// plume builds up over its first second instead of arriving fully formed on the win frame.
			// The idle plume runs on the board's clock, which has been going since the game loaded, so
			// there it is simply always at full — nothing to build up from.
			const started = props.clock / lifetime - index / PUFFS;
			if (started < 0) continue;
			const age = started % 1;

			const lean = wobble(index, 0);
			const fat = 1 + 0.28 * wobble(index, 4.7);
			const scale = START_SCALE + (END_SCALE - START_SCALE) * age;
			out.push({
				// The lean grows with the climb and curls, so the plume trails off rather than shearing
				// straight sideways.
				x: (FUNNEL.x - 0.5) * props.width + DRIFT * lean * age * age * props.width,
				y: (FUNNEL.y - 0.5) * props.height - RISE * age * props.height,
				size: scale * fat * props.width,
				alpha: Math.min(1, age / FADE_IN) * (1 - age) ** 1.3 * peak,
				rotation: 0.35 * lean * age + 0.05 * Math.sin(TAU * age + index),
			});
		}
		return out;
	});
</script>

<Container x={props.x} y={props.y} rotation={props.rotation ?? 0} alpha={props.alpha ?? 1}>
	{#each puffs as puff, index (index)}
		<Sprite
			key="tpSteamPuff"
			anchor={0.5}
			x={puff.x}
			y={puff.y}
			rotation={puff.rotation}
			width={puff.size}
			height={puff.size * PUFF_ASPECT}
			alpha={puff.alpha}
		/>
	{/each}
</Container>
