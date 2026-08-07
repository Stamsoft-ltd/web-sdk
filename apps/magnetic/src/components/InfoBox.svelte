<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';

	// Version2 left-rail info box (design node 7002:11132 — RESPIN / FREE SPINS / TOTAL WIN stacked
	// under the logo). Every number below comes from that frame's measured child nodes, expressed
	// as fractions of the box WIDTH so they hold whatever aspect the art is drawn at:
	//   box 201x90 | label text h22 (font ~18.3) | value text h39 (font ~32.5) | icon 33x33
	//   label centre +14 (RESPIN) / -17.5 (value boxes) | value centre +10.5 | icon centre -13.5
	type Props = {
		x: number;
		y: number;
		width: number;
		label: string;
		/** Big value line under the label (FREE SPINS / TOTAL WIN). */
		value?: string;
		/** Sprite key drawn above the label instead of a value (RESPIN's circular arrow). */
		iconKey?: string;
	};
	const props: Props = $props();

	// Aspect of the plate as the DESIGN renders it (node 7002:11363 exported at its 201x90
	// placement, trimmed to 781x335) — the art ships pre-stretched, so drawing it at this aspect
	// reproduces the design pixel for pixel. Re-keyed 2026-08-07: the first trim kept ~17px of the
	// export's grey drop shadow, which showed as a band under the plate in game.
	const BOX_ASPECT = 781 / 335;
	const h = $derived(props.width / BOX_ASPECT);
	const W = $derived(props.width);

	// Design font sizes as fractions of the box width (18.3/201 and 32.5/201).
	const LABEL_F = 0.091;
	const VALUE_F = 0.162;
	// Value shrinks as it lengthens so long currency strings stay inside the frame.
	const valueSize = $derived(
		W * VALUE_F * (!props.value ? 0 : props.value.length >= 9 ? 0.7 : props.value.length >= 7 ? 0.85 : 1),
	);
	const labelStyle = $derived({
		fontFamily: 'Chakra Petch',
		fontWeight: '700' as const,
		fontSize: W * LABEL_F,
		fill: 0xffffff,
		letterSpacing: W * 0.004,
		align: 'center' as const,
	});
	const valueStyle = $derived({
		fontFamily: 'Chakra Petch',
		fontWeight: '700' as const,
		fontSize: valueSize,
		fill: 0xffffff,
		align: 'center' as const,
	});
</script>

<Container x={props.x} y={props.y}>
	<Sprite key="infoBox" anchor={0.5} width={W} height={h} />
	{#if props.iconKey}
		<Sprite key={props.iconKey} anchor={0.5} y={-W * 0.067} width={W * 0.164} height={W * 0.164} />
		<Text anchor={0.5} y={W * 0.07} text={props.label} style={labelStyle} />
	{:else}
		<Text anchor={0.5} y={-W * 0.087} text={props.label} style={labelStyle} />
		<Text anchor={0.5} y={W * 0.054} text={props.value ?? ''} style={valueStyle} />
	{/if}
</Container>
