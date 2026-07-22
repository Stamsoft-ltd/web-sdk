<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	import { getSymbolInfo } from '../game/utils';
	import { SYMBOL_H, SYMBOL_W } from '../game/constants';
	import { onMount } from 'svelte';

	type Props = {
		x?: number;
		y?: number;
		symbolInfo: ReturnType<typeof getSymbolInfo>;
		oncomplete?: () => void;
	};

	const props: Props = $props();
	const assetKey = $derived(props.symbolInfo.assetKey);

	onMount(() => {
		props.oncomplete?.();
	});

	$effect(() => {
		if (assetKey) props.oncomplete?.();
	});
</script>

<Sprite
	x={props.x}
	y={props.y}
	anchor={0.5}
	key={assetKey}
	width={SYMBOL_W * props.symbolInfo.sizeRatios.width}
	height={SYMBOL_H * props.symbolInfo.sizeRatios.height}
/>
