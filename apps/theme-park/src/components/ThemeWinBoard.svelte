<script lang="ts">
	import { Container, Text } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { backOut, cubicInOut } from 'svelte/easing';
	import LoopingAssetSprite from './LoopingAssetSprite.svelte';

	type Props = {
		boardKey: string;
		finalKey: string;
		winId: number;
		boardSize: number;
		amountText: string;
		fontSize: number;
		breatheScale: number;
	};

	const { boardKey, finalKey, winId, boardSize, amountText, fontSize, breatheScale }: Props =
		$props();

	const FADE_MS = 360;
	const POP_MS = 420;
	const pop = new Tween(0, { duration: POP_MS, easing: backOut });
	const fade = new Tween(1, { duration: FADE_MS, easing: cubicInOut });
	let displayedKey = $state<string | null>(null);
	let outgoingKey = $state<string | null>(null);
	let animating = $state(false);
	let seenWinId = -1;

	const ORDER = ['winSweet', 'winWild', 'winEpic', 'winMythic', 'winLegendary'];
	const tierIndex = (key: string | null) => ORDER.indexOf(key ?? '');
	const animationKey = (key: string) => `${key}Anim`;

	$effect(() => {
		const next = boardKey;
		const isNewWin = winId !== seenWinId;
		if (animating || (!isNewWin && next === displayedKey)) return;
		seenWinId = winId;
		animating = true;

		(async () => {
			const first = isNewWin || !displayedKey || tierIndex(next) < tierIndex(displayedKey);
			if (first) {
				outgoingKey = null;
				displayedKey = next;
				fade.set(1, { duration: 0 });
				pop.set(0, { duration: 0 });
				await pop.set(1, { duration: POP_MS, easing: backOut });
			} else {
				outgoingKey = displayedKey;
				displayedKey = next;
				fade.set(0, { duration: 0 });
				if (next === finalKey) pop.set(0.88, { duration: 0 });
				await Promise.all([
					fade.set(1, { duration: FADE_MS, easing: cubicInOut }),
					next === finalKey ? pop.set(1, { duration: POP_MS, easing: backOut }) : Promise.resolve(),
				]);
				outgoingKey = null;
			}
			animating = false;
		})();
	});

	const shownKey = $derived(displayedKey ?? boardKey);
	let amountWidth = $state(0);
	const amountScale = $derived(amountWidth > 0 ? Math.min(1, (boardSize * 0.58) / amountWidth) : 1);
</script>

{#if shownKey}
	<Container scale={pop.current * breatheScale}>
		{#if outgoingKey}
			<LoopingAssetSprite
				animationKey={animationKey(outgoingKey)}
				fallbackKey={outgoingKey}
				restartKey={`${winId}:${outgoingKey}`}
				anchor={0.5}
				width={boardSize}
				height={boardSize}
				alpha={1 - fade.current}
			/>
		{/if}
		<LoopingAssetSprite
			animationKey={animationKey(shownKey)}
			fallbackKey={shownKey}
			restartKey={`${winId}:${shownKey}`}
			anchor={0.5}
			width={boardSize}
			height={boardSize}
			alpha={outgoingKey ? fade.current : 1}
		/>
		<Container y={boardSize * 0.405} scale={amountScale}>
			<Text
				anchor={0.5}
				text={amountText}
				onresize={({ width }) => (amountWidth = width)}
				style={{
					fontFamily: 'Cinzel',
					fontWeight: '900',
					fontSize,
					align: 'center',
					fill: 0xffffff,
					stroke: { color: 0x2b082f, width: Math.max(3, Math.round(fontSize * 0.08)) },
				}}
			/>
		</Container>
	</Container>
{/if}
