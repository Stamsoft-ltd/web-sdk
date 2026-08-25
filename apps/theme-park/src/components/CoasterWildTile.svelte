<script lang="ts">
	import { Container, FillGradient, Sprite, Text } from 'pixi-svelte';

	import { SYMBOL_H } from '../game/constants';
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

	/**
	 * The splat's own proportions (512x391), so it is never squeezed into the symbol frame's box: this
	 * art is not a reel symbol, it is a sign laid over one, and the frame is a different shape.
	 */
	const SLIME_ASPECT = 512 / 391;
	const SLIME_H = SYMBOL_H * 0.82;
	const SLIME_W = SLIME_H * SLIME_ASPECT;
	/**
	 * Where the multiplier goes, measured off the art: WILD occupies its upper half and the clear
	 * green below runs to about four fifths of the way down. Both are fractions of SYMBOL_H, and both
	 * move if the splat is re-drawn a different shape — so re-measure rather than nudge.
	 */
	const MULTIPLIER_Y = (0.793 - 0.5) * SLIME_H;

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

<!-- Setup and persistent phases share this exact presentation. No handoff size pop. -->
<CoasterWildBackground
	reel={props.reel}
	row={props.row}
	underScrim={props.underScrim}
	occupied={props.occupied}
/>
<!-- Pop only the Wild and its multiplier. The opaque reel cover must remain cell-sized. -->
<Container scale={props.contentScale ?? 1}>
	<Sprite key="tpCoasterWild" anchor={0.5} width={SLIME_W} height={SLIME_H} />
	<Container y={MULTIPLIER_Y}>
		<Text
			anchor={{ x: 0.5, y: 0.5 }}
			text={`${props.multiplier}X`}
			style={{
				fontFamily: 'Cinzel',
				fontSize: SYMBOL_H * 0.22,
				fontWeight: '900',
				fill: multiplierFill,
				stroke: { color: 0x4d1d00, width: Math.max(3, SYMBOL_H * 0.035) },
				dropShadow: {
					color: 0x062900,
					alpha: 0.95,
					angle: Math.PI * 0.5,
					distance: Math.max(2, SYMBOL_H * 0.026),
					blur: Math.max(1, SYMBOL_H * 0.009),
				},
			}}
		/>
	</Container>
</Container>
