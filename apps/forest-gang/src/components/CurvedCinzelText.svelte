<script lang="ts">
	import { Container, Text } from 'pixi-svelte';

	// Renders `text` along a shallow dome arc while keeping the passed Pixi text style (Cinzel,
	// gold, drop shadow). Each glyph is a real Text that reports its measured width, so spacing
	// stays proportional (unlike a fixed-width bitmap curve). A large `radius` = a subtle curve.
	type Props = {
		text: string;
		radius: number;
		/** Extra advance between glyphs (matches the straight text's letterSpacing). */
		gap?: number;
		style: Record<string, unknown>;
	};
	const { text, radius, gap = 0, style }: Props = $props();

	const chars = $derived([...text]);
	// Measured width per glyph index (spaces legitimately measure a small/zero width, so we key by
	// index and wait until every index has reported rather than requiring width > 0).
	let measured = $state<Record<number, number>>({});
	$effect(() => {
		// Reset when the string changes so stale measurements don't leak across texts.
		void chars;
		measured = {};
	});
	const setW = (i: number, w: number) => {
		if (measured[i] !== w) measured = { ...measured, [i]: w };
	};

	const layout = $derived.by(() => {
		if (Object.keys(measured).length !== chars.length) return null;
		const widths = chars.map((_, i) => measured[i] ?? 0);
		const advances = widths.map((w) => w + gap);
		const total = advances.reduce((a, b) => a + b, 0) - gap;
		let acc = 0;
		return chars.map((_, i) => {
			const centerOffset = acc + widths[i] / 2 - total / 2;
			const angle = centerOffset / radius;
			acc += advances[i];
			return {
				x: Math.sin(angle) * radius,
				// Dome: centre glyph at y=0, ends curve gently down.
				y: -Math.cos(angle) * radius + radius,
				rotation: angle,
			};
		});
	});
</script>

{#each chars as ch, i (i)}
	{@const p = layout?.[i]}
	<Container x={p?.x ?? 0} y={p?.y ?? 0} rotation={p?.rotation ?? 0} visible={layout != null}>
		<Text anchor={{ x: 0.5, y: 0.5 }} text={ch} {style} onresize={(s) => setW(i, s.width)} />
	</Container>
{/each}
