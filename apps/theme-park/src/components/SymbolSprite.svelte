<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { backOut, cubicOut } from 'svelte/easing';

	import { getSymbolInfo } from '../game/utils';
	import { SYMBOL_H, SYMBOL_W } from '../game/constants';
	import type { SymbolState } from '../game/types';

	type Props = {
		x?: number;
		y?: number;
		state: SymbolState;
		symbolInfo: ReturnType<typeof getSymbolInfo>;
		oncomplete?: () => void;
	};

	const props: Props = $props();
	const assetKey = $derived(props.symbolInfo.assetKey);
	const scale = new Tween(1);
	const rotation = new Tween(0);
	let runId = 0;

	const playState = async (state: SymbolState) => {
		const id = ++runId;

		if (state === 'win') {
			scale.set(0.76, { duration: 0 });
			rotation.set(-0.045, { duration: 0 });
			await Promise.all([
				scale.set(1.14, { duration: 260, easing: backOut }),
				rotation.set(0.035, { duration: 210, easing: cubicOut }),
			]);
			if (id !== runId) return;
			await Promise.all([
				scale.set(1, { duration: 240, easing: cubicOut }),
				rotation.set(0, { duration: 240, easing: cubicOut }),
			]);
			if (id === runId) props.oncomplete?.();
			return;
		}

		if (state === 'land') {
			scale.set(0.84, { duration: 0 });
			await scale.set(1.08, { duration: 130, easing: backOut });
			if (id !== runId) return;
			await scale.set(1, { duration: 110, easing: cubicOut });
			if (id === runId) props.oncomplete?.();
			return;
		}

		scale.set(1, { duration: 0 });
		rotation.set(0, { duration: 0 });
		props.oncomplete?.();
	};

	$effect(() => {
		if (!assetKey) return;
		void playState(props.state);
	});
</script>

<Container x={props.x} y={props.y} scale={scale.current} rotation={rotation.current}>
	<Sprite
		anchor={0.5}
		key={assetKey}
		width={SYMBOL_W * props.symbolInfo.sizeRatios.width}
		height={SYMBOL_H * props.symbolInfo.sizeRatios.height}
	/>
</Container>
