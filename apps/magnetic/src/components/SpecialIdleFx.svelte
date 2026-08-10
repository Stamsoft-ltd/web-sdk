<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	// Idle life for the two SPECIAL symbols, which are static art and sat completely still between
	// spins — the first thing a reviewer looks for on a slot, and the cheapest to fix in-engine.
	//
	// Procedural rather than a flipbook: there is no source video for either symbol, and a sheet
	// would add texture memory to art that is already on the board. Everything below is a pure
	// function of the parent's clock and the cell's own phase, drawn into ONE captured Graphics per
	// board (the caller passes each cell in turn), so nothing accumulates and no reactivity sits in
	// the render path.
	//
	//   WILD (horseshoe magnet)  — the field between its poles: arcs that snap pole to pole with a
	//                              stutter, plus a soft charge glow at each tip.
	//   SCATTER (vortex core)    — a ring that breathes and a counter-rotating inner spin, so the
	//                              core reads as spooling rather than lit.
	export type SpecialKind = 'wild' | 'scatter';

	type G = {
		destroyed: boolean;
		clear: () => void;
		circle: (x: number, y: number, r: number) => unknown;
		ellipse: (x: number, y: number, rx: number, ry: number) => unknown;
		moveTo: (x: number, y: number) => void;
		lineTo: (x: number, y: number) => void;
		stroke: (s: object) => void;
		fill: (s: object) => void;
	};

	const props: {
		/** Captured Graphics to draw into — shared by every special on the board. */
		g: G;
		kind: SpecialKind;
		x: number;
		y: number;
		w: number;
		h: number;
		/** Seconds. */
		t: number;
		/** 0..1 per-cell hash so two specials never pulse in lockstep. */
		phase: number;
	} = $props();
</script>
