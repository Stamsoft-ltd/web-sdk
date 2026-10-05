<script lang="ts">
	import SymbolSpine from './SymbolSpine.svelte';
	import SymbolSprite from './SymbolSprite.svelte';
	import AnimatedSymbol from './AnimatedSymbol.svelte';
	import { getSymbolInfo } from '../game/utils';
	import { SYMBOL_PARTS } from '../game/symbolParts';
	import type { SymbolState, RawSymbol } from '../game/types';
	import { getContext } from '../game/context';
	import { Container } from 'pixi-svelte';
	import { SYMBOL_SIZE } from '../game/constants';

	type Props = {
		x?: number;
		y?: number;
		state: SymbolState;
		rawSymbol: RawSymbol;
		winning?: boolean;
		oncomplete?: () => void;
		loop?: boolean;
		/** performance.now() when this symbol's reel last landed — drives the squash/hop. */
		landedAt?: number;
	};

	const props: Props = $props();
	const context = getContext();
	const symbolInfo = $derived(getSymbolInfo({ rawSymbol: props.rawSymbol, state: props.state }));
	const isSprite = $derived(symbolInfo.type === 'sprite');
	// Some symbols are reassembled from layered parts so they can animate when winning/locked.
	const partsConfig = $derived(isSprite ? SYMBOL_PARTS[props.rawSymbol?.name ?? ''] : undefined);

	// Landing bounce: as its reel stops, every symbol squashes onto its base from the impact, springs
	// off into a small hop (stretching as it rises), lands with a lighter squash and settles.
	// Volume-preserving and bottom-anchored. Timed from the reel's landing stamp (props.landedAt) —
	// robust to the reel swapping in fresh symbol objects around the landing.
	const BOUNCE_MS = 680;
	let now = $state(0);
	const landStart = $derived(props.landedAt ?? -1);
	$effect(() => {
		if (landStart < 0) return;
		let raf = 0;
		const loop = (ts: number) => {
			now = ts;
			if (ts - landStart < BOUNCE_MS) raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});
	const bounce = $derived.by(() => {
		if (landStart < 0 || now - landStart >= BOUNCE_MS || now < landStart) return { sx: 1, sy: 1, dy: 0 };
		const u = (now - landStart) / BOUNCE_MS;
		const smooth = (x: number) => x * x * (3 - 2 * x);
		let sy: number;
		let hop = 0;
		if (u < 0.13) {
			// impact: fully squashed on the stop frame, releasing into a stretch as it pushes off
			sy = 0.74 + 0.36 * smooth(u / 0.13);
		} else if (u < 0.6) {
			// airborne: parabolic hop; stretched on the way up, easing to a slight squash as it comes down
			const a = (u - 0.13) / 0.47;
			hop = 4 * a * (1 - a);
			sy = 1 + 0.1 * Math.cos(Math.PI * a);
		} else {
			// second landing: lighter squash, damped out
			const b = (u - 0.6) / 0.4;
			sy = 1 - 0.1 * Math.exp(-4 * b) * Math.cos(Math.PI * 2 * b);
		}
		return { sx: 1 / Math.sqrt(sy), sy, dy: (1 - sy) * SYMBOL_SIZE * 0.4 - hop * SYMBOL_SIZE * 0.15 };
	});
</script>

<Container x={props.x ?? 0} y={(props.y ?? 0) + bounce.dy} scale={{ x: bounce.sx, y: bounce.sy }}>
	{#if partsConfig}
		<AnimatedSymbol
			config={partsConfig}
			x={0}
			y={0}
			scale={symbolInfo.sizeRatios.width}
			state={props.state}
			winning={props.winning}
			oncomplete={props.oncomplete}
		/>
	{:else if isSprite}
		<SymbolSprite {symbolInfo} x={0} y={0} oncomplete={props.oncomplete} />
	{:else}
		<SymbolSpine
			loop={props.loop}
			{symbolInfo}
			x={0}
			y={0}
			showWinFrame={props.state === 'win' && !['S', 'M'].includes(props.rawSymbol.name)}
			listener={{
				complete: props.oncomplete,
			}}
		/>
	{/if}
</Container>

<!-- No per-symbol multiplier label: the template's gold "{N}X" bitmap text sat right across the
     Smutz cup's logo (read as a stray "X"); the running multiplier shows on the printer instead. -->
