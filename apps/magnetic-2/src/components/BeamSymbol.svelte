<script lang="ts">
	import type { PaySymbolName, RawSymbol } from '../game/types';
	import { SYMBOL_H, SYMBOL_W } from '../game/constants';
	import { getSymbolInfo } from '../game/utils';

	import CompassSymbol from './CompassSymbol.svelte';
	import LightningSymbol from './LightningSymbol.svelte';
	import PortalSymbol from './PortalSymbol.svelte';
	import EmDeviceSymbol from './EmDeviceSymbol.svelte';
	import CircuitSymbol from './CircuitSymbol.svelte';
	import CoilSymbol from './CoilSymbol.svelte';
	import MagnetSymbol from './MagnetSymbol.svelte';
	import BatterySymbol from './BatterySymbol.svelte';

	// ONE pay symbol, drawn anywhere — the cluster's target symbol held in the ship's tractor beam.
	//
	// It renders through the same per-cell components the board uses rather than through a flat
	// texture, for two reasons. The rebuilt symbols are ASSEMBLED from loose parts, so their base
	// texture alone is a bezel with no alien in it and a housing with no cell; and going through the
	// components means the symbol in the beam keeps its own idle life (the antennae sway, the eye
	// blinks, the slime runs) instead of hanging there as a still. The flat `*_full` composites
	// exist — scripts/build-paytable-symbols.py builds them — but they are for the HTML paytable,
	// which can only ever show one <img>, and they cost a texture each.
	//
	// `winning` is deliberately never set: this symbol is not winning, it is being carried.
	type Props = {
		name: PaySymbolName;
		x: number;
		y: number;
		/** The WIDTH of the box the artwork is fitted into; the symbol's own size ratios apply
		 *  within it, and the height follows the board cell's aspect. */
		cell: number;
		alpha?: number;
		zIndex?: number;
		scale?: number;
		/** 0..1 — de-phases the idle animation from the board's own cells. */
		phase?: number;
	};
	const props: Props = $props();

	const info = $derived(
		getSymbolInfo({ rawSymbol: { name: props.name } as RawSymbol, state: 'static' }),
	);
	// The board draws a symbol into SYMBOL_W x SYMBOL_H (114 x 94 — the 328x264 art's own aspect),
	// so applying the square `sizeRatios` to ONE `cell` for both axes squeezed the artwork 18%
	// horizontally: the alien in the beam came out taller and narrower than the same alien on the
	// board. Carry the board's aspect through and the shape is identical in both places.
	const CELL_ASPECT = SYMBOL_H / SYMBOL_W;
	const width = $derived(props.cell * info.sizeRatios.width * (props.scale ?? 1));
	const height = $derived(props.cell * CELL_ASPECT * info.sizeRatios.height * (props.scale ?? 1));
	const common = $derived({
		assetKey: info.assetKey,
		x: props.x,
		y: props.y,
		width,
		height,
		alpha: props.alpha ?? 1,
		zIndex: props.zIndex ?? 0,
		phase: props.phase ?? 0.37,
		winning: false,
	});
</script>

{#if props.name === 'H1'}
	<CompassSymbol {...common} />
{:else if props.name === 'H2'}
	<LightningSymbol {...common} />
{:else if props.name === 'H3'}
	<PortalSymbol {...common} />
{:else if props.name === 'H4'}
	<EmDeviceSymbol {...common} />
{:else if props.name === 'L1'}
	<BatterySymbol {...common} />
{:else if props.name === 'L2'}
	<MagnetSymbol {...common} />
{:else if props.name === 'L3'}
	<CoilSymbol {...common} />
{:else if props.name === 'L4'}
	<CircuitSymbol {...common} />
{/if}
