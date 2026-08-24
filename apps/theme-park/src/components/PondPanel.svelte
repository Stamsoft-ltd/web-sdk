<script lang="ts">
	import { Graphics } from 'pixi-svelte';

	// The Duck Your Luck chrome plate, drawn to Figma 7032:19188: a flat deep-purple rounded rect
	// with a second, slightly smaller plate inset inside it, outlined in a thin orchid keyline.
	// Two flat fills and one hairline — no gradient, and no running border lights.
	//
	// It replaces a neon-gradient stroke with the confirm dialogs' chasing lights on it. The design
	// asks for a plate that sits still behind the copy, and the pond already has plenty moving on
	// it: 25 bobbing ducks and their splashes.
	//
	// Procedural rather than art because the pond needs it at three very different aspects (pick,
	// total, and the 5:1 counter strip) and stretching a panel export smears its painted edges.

	type Props = { width: number; height: number };
	const props: Props = $props();

	// The design's plate is 241x110: a 14px outer radius, the inner plate inset ~3.5px with its own
	// 13px radius and a 1px keyline. Held against the SHORT side so the counter strip — five times
	// longer than the pick panel is — gets the same corner and the same border weight, rather than
	// a corner scaled off its length.
	const OUTER_RADIUS_FRACTION = 14 / 110;
	const INNER_RADIUS_FRACTION = 13 / 110;
	const INSET_FRACTION = 3.5 / 110;
	const KEYLINE_FRACTION = 1 / 110;

	const OUTER_FILL = 0x310463;
	const INNER_FILL = 0x1d013c;
	const KEYLINE = 0xbd46c6;

	const short = $derived(Math.min(props.width, props.height));
	const outerRadius = $derived(short * OUTER_RADIUS_FRACTION);
	const innerRadius = $derived(short * INNER_RADIUS_FRACTION);
	const inset = $derived(short * INSET_FRACTION);
	// Never allowed to thin out below a pixel: at the counter strip's height the design's 1px would
	// come out fainter than a hairline and the inner plate would lose its edge entirely.
	const keyline = $derived(Math.max(1, short * KEYLINE_FRACTION));
</script>

<Graphics
	draw={(graphics) => {
		const halfW = props.width / 2;
		const halfH = props.height / 2;
		graphics
			.roundRect(-halfW, -halfH, props.width, props.height, outerRadius)
			.fill({ color: OUTER_FILL })
			.roundRect(
				-halfW + inset,
				-halfH + inset,
				props.width - inset * 2,
				props.height - inset * 2,
				innerRadius,
			)
			.fill({ color: INNER_FILL })
			.stroke({ color: KEYLINE, width: keyline, alignment: 0.5 });
	}}
/>
