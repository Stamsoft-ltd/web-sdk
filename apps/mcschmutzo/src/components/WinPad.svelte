<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Container, Sprite, Graphics, PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = {
		/** Sprite key of the tier pad art (plaque + wordmark + sauce + stars). */
		padKey: string;
		/** Amount text, rendered centred in the wooden box. */
		children: Snippet;
	};

	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	// Pad art is exported ~1030x450.
	const PAD_ASPECT = 1030 / 450;
	const padW = $derived(board.width * 1.22);
	const padH = $derived(padW / PAD_ASPECT);
	const boxW = $derived(board.width * 0.52);
	const boxH = $derived(boxW * 0.26);

	// Wooden amount box: gold border with rivets over a wine interior (no art asset for it).
	const drawBox = (g: InstanceType<typeof PIXI.Graphics>, w: number, h: number) => {
		const r = h * 0.24;
		const b = h * 0.14;
		g.roundRect(-w / 2, -h / 2, w, h, r).fill({ color: 0xcaa23c });
		g.roundRect(-w / 2, -h / 2, w, h, r).stroke({ width: h * 0.03, color: 0x7a5a1c });
		g.roundRect(-w / 2 + b, -h / 2 + b, w - 2 * b, h - 2 * b, r * 0.72).fill({ color: 0x5a1518 });
		const rr = h * 0.06;
		const px = w / 2 - b * 1.15;
		const py = h / 2 - b * 1.15;
		for (const [sx, sy] of [
			[-1, -1],
			[1, -1],
			[-1, 1],
			[1, 1],
		] as const)
			g.circle(sx * px, sy * py, rr).fill({ color: 0xead08a });
	};
</script>

<Container>
	<!-- Pad (plaque + wordmark + sauce + stars), sitting above the amount box. -->
	<Sprite
		key={props.padKey}
		anchor={{ x: 0.5, y: 0.5 }}
		width={padW}
		height={padH}
		y={-padH * 0.26}
	/>

	<!-- Wooden amount box with the count-up amount centred inside it. -->
	<Container y={padH * 0.42}>
		<Graphics draw={(graphics) => drawBox(graphics, boxW, boxH)} />
		{@render props.children()}
	</Container>
</Container>
