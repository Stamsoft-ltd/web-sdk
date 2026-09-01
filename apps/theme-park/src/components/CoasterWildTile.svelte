<script lang="ts" module>
	/**
	 * The idle the persistent Coaster Wild runs, and the one clock every tile on the board shares.
	 *
	 * IT IS ALWAYS RUNNING. This Wild is not a reel symbol that comes and goes: once it lands it
	 * stays put for the rest of the feature, and there can be a dozen of them sitting on the board
	 * for a dozen spins. Drawn as a plain sprite it was the only dead thing on a board where every
	 * other symbol breathes, and a dozen dead things read as a broken render rather than as art
	 * (reviewer, 2026-08-28).
	 *
	 * Nearly all of that motion is now the splat's own — <SlimeSplat> recomputes its outline every
	 * frame, so the blob genuinely churns rather than being a picture that gets moved about. What is
	 * left here is a much smaller settle applied to the WHOLE tile, lettering included: it squashes
	 * and swells on a slow beat, WIDER AS IT GETS SHORTER so it holds its area rather than pumping
	 * like a balloon, and rolls about a degree on a second, slower beat that does not divide into the
	 * first. Small on purpose — the gold WILD has to stay legible, so it rides the slime rather than
	 * deforming with it.
	 *
	 * ONE rAF FOR THE WHOLE BOARD. The clock is module state with a mount count around it, not an
	 * `onMount` per tile like <LampGlow>: up to twenty-five of these can be on screen at once, both
	 * of the places that mount them do so in a loop, and one of them (<CoasterSetupPresenter>) also
	 * animates them itself. A ticker each would be twenty-five rAF callbacks doing one addition.
	 */
	const WOBBLE = 0.014;
	const WOBBLE_SECONDS = 2.9;
	const ROLL = 0.012;
	const ROLL_SECONDS = 4.3;

	let elapsed = $state(0);
	let mounted = 0;
	let handle = 0;

	/** Starts the shared clock on the first tile and stops it with the last. */
	const useIdleClock = () => {
		mounted += 1;
		if (mounted === 1) {
			let previous = performance.now();
			const tick = (now: number) => {
				// Clamped so a backgrounded tab does not resume mid-squash.
				elapsed += Math.min((now - previous) / 1000, 0.1);
				previous = now;
				handle = requestAnimationFrame(tick);
			};
			handle = requestAnimationFrame(tick);
		}
		return () => {
			mounted -= 1;
			if (mounted === 0) cancelAnimationFrame(handle);
		};
	};
</script>

<script lang="ts">
	import { Container, FillGradient, Sprite, Text } from 'pixi-svelte';
	import { onMount } from 'svelte';

	import SlimeSplat from './SlimeSplat.svelte';

	import { CELL_H } from '../game/constants';
	import type { CoasterCellKey } from '../game/coasterWildCells';
	import CoasterWildBackground from './CoasterWildBackground.svelte';

	type Props = {
		reel?: number;
		row?: number;
		/** True while <CoasterSetupPresenter> owns this tile, i.e. it is drawn above the setup dim. */
		underScrim?: boolean;
		/** Every cell currently carrying a Wild, so this cover closes against its neighbours. */
		occupied?: ReadonlySet<CoasterCellKey>;
		multiplier: number;
		contentScale?: number;
	};
	const props: Props = $props();

	onMount(useIdleClock);

	/**
	 * Its own beat, so a board of Wilds settles as a dozen blobs rather than as one animation played
	 * a dozen times. Off the cell rather than off a random, so a tile keeps its phase across the
	 * handoff from <CoasterSetupPresenter> to <PersistentWildBadges> instead of jumping.
	 */
	const phase = $derived((props.reel ?? 0) * 1.31 + (props.row ?? 0) * 0.77);
	const wobble = $derived(WOBBLE * Math.sin((elapsed / WOBBLE_SECONDS) * Math.PI * 2 + phase));
	const roll = $derived(ROLL * Math.sin((elapsed / ROLL_SECONDS) * Math.PI * 2 + phase * 0.6));

	/**
	 * The splat's own proportions, so it is never squeezed into the symbol frame's box: this is not a
	 * reel symbol, it is a sign laid over one, and the frame is a different shape. 1.309 is the
	 * design's own splat measured across against down.
	 *
	 * It is sized off the CELL and not off SYMBOL_H any more. <SlimeSplat> sizes its box against the
	 * furthest a lobe ever reaches, so the blob a player sees is smaller than its box by that margin
	 * — at the old 0.82 of a symbol the sign read as a small green stain in a large purple cell
	 * (reviewer, 2026-08-28). At the cell it fills the tile the way the baked art used to.
	 */
	const SLIME_ASPECT = 1.309;
	const SLIME_H = CELL_H * 0.97;
	const SLIME_W = SLIME_H * SLIME_ASPECT;
	/**
	 * Where the two pieces of the sign go, as fractions of the splat's box height.
	 *
	 * NOT eyeballed and not carried over from the baked art: the splat is drawn now and its outline
	 * is a different shape every frame, so the only question that matters is whether these still sit
	 * on slime at every moment of the churn. `scripts/coaster-wild/build_coaster_wild.py` assembles
	 * all three and renders them minutes apart — change any of these four numbers there first, look
	 * at the sheet, and only then bring them back here.
	 */
	const WORD_W = SLIME_H * 0.64;
	const WORD_H = WORD_W * (106 / 278);
	const WORD_Y = SLIME_H * -0.15;
	const MULTIPLIER_Y = SLIME_H * 0.17;
	/**
	 * The multiplier sits straight on the slime, with no plaque behind it. It briefly had one — a
	 * purple field with a neon rim — for the contrast the churning green does not give away, and the
	 * purple read as a foreign object dropped on the sign rather than as part of it. The contrast is
	 * bought with the lettering instead, the way the WILD wordmark baked into the splat buys it: a
	 * brown keyline and a near-black shadow under it, which is also what <RollerMultiplierText> does.
	 *
	 * Free of the rim it no longer has to fit a field, so it is sized against the splat directly and
	 * is larger than it was on the plaque.
	 */
	const MULTIPLIER_SIZE = SLIME_H * 0.185;

	// Sampled from the WILD lettering baked into the splat: pale bevel highlight -> vivid
	// yellow -> amber base. The brown keyline and deep-green shadow match its outer edge.
	const multiplierFill = new FillGradient({
		type: 'linear',
		start: { x: 0.5, y: 0 },
		end: { x: 0.5, y: 1 },
		colorStops: [
			{ offset: 0, color: 0xfff7a0 },
			{ offset: 0.12, color: 0xffe243 },
			{ offset: 0.3, color: 0xfff01d },
			{ offset: 0.5, color: 0xffe607 },
			{ offset: 0.68, color: 0xffcf06 },
			{ offset: 0.84, color: 0xfabc0a },
			{ offset: 1, color: 0xdf9700 },
		],
		textureSpace: 'local',
	});
</script>

<!-- Setup and persistent phases share this exact presentation. No handoff size pop, and the same
     idle beat either side of it — see `phase`. -->
<CoasterWildBackground
	reel={props.reel}
	row={props.row}
	underScrim={props.underScrim}
	occupied={props.occupied}
/>
<!-- Pop only the Wild and its multiplier. The opaque reel cover must remain cell-sized. -->
<Container
	scale={{
		x: (props.contentScale ?? 1) * (1 + wobble),
		y: (props.contentScale ?? 1) * (1 - wobble),
	}}
	rotation={roll}
>
	<SlimeSplat width={SLIME_W} height={SLIME_H} clock={elapsed} {phase} />
	<Sprite key="tpWildWord" anchor={0.5} y={WORD_Y} width={WORD_W} height={WORD_H} />
	<Container y={MULTIPLIER_Y}>
		<Text
			anchor={{ x: 0.5, y: 0.5 }}
			text={`${props.multiplier}X`}
			style={{
				fontFamily: 'Cinzel',
				fontSize: MULTIPLIER_SIZE,
				fontWeight: '900',
				fill: multiplierFill,
				// The keyline and shadow the plaque used to stand in for. Brown rather than black so it
				// belongs to the gold, and the shadow is offset straight down and barely blurred, which
				// is what lifts the digits off a green that is a different shape every frame.
				stroke: { color: 0x4b1700, width: Math.max(2, MULTIPLIER_SIZE * 0.11) },
				dropShadow: {
					color: 0x130018,
					alpha: 0.9,
					angle: Math.PI / 2,
					distance: MULTIPLIER_SIZE * 0.1,
					blur: 1,
				},
			}}
		/>
	</Container>
</Container>
