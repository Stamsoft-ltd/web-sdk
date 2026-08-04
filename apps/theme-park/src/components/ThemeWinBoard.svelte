<script lang="ts">
	import { Container, FillGradient, Text } from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { backOut, cubicInOut } from 'svelte/easing';
	import LoopingSheetSprite from './LoopingSheetSprite.svelte';

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
	// Sheet fps / 60 fps ticker. Every sheet is 36 frames; the sweet/wild/epic sources run 3.04 s
	// (73 frames @ 24), mythic/legendary 4.04 s (97 @ 24) — speeds keep the authored loop duration.
	const SHEET_SPEED: Record<string, number> = {
		winSweet: 0.197,
		winWild: 0.197,
		winEpic: 0.197,
		winMythic: 0.148,
		winLegendary: 0.148,
	};

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
	const amountScale = $derived(amountWidth > 0 ? Math.min(1, (boardSize * 0.62) / amountWidth) : 1);

	// Figma: linear-gradient(182deg, #E2D981 17.62%, #FBC503 60.04%, #D98503 102.47%).
	const amountFill = new FillGradient({
		type: 'linear',
		start: { x: 0.52, y: 0 },
		end: { x: 0.48, y: 1 },
		colorStops: [
			{ offset: 0.1762, color: 0xe2d981 },
			{ offset: 0.6004, color: 0xfbc503 },
			{ offset: 1, color: 0xd98503 },
		],
		textureSpace: 'local',
	});
</script>

{#if shownKey}
	<!-- sortableChildren: the sheet sprite mounts LATE (deferred asset landing mid-win) and pixi
	     appends late-mounted nodes above earlier siblings — the card painted over the amount. -->
	<Container scale={pop.current * breatheScale} sortableChildren={true}>
		{#if outgoingKey}
			<LoopingSheetSprite
				animationKey={animationKey(outgoingKey)}
				fallbackKey={outgoingKey}
				animationSpeed={SHEET_SPEED[outgoingKey] ?? 0.197}
				anchor={0.5}
				width={boardSize}
				height={boardSize}
				alpha={1 - fade.current}
			/>
		{/if}
		<LoopingSheetSprite
			animationKey={animationKey(shownKey)}
			fallbackKey={shownKey}
			animationSpeed={SHEET_SPEED[shownKey] ?? 0.197}
			anchor={0.5}
			width={boardSize}
			height={boardSize}
			alpha={outgoingKey ? fade.current : 1}
		/>
		<!-- The amount sits centred in the card's bottom marquee plate. 0.366 is calibrated from
		     in-game screenshots (pixel-measured: at 0.375 the glyph extent rendered 6.5px low on
		     a 705px card), NOT from the art — the Text bbox centre vs glyph-mass centre offset
		     makes art-space measurement land wrong. Style per Figma: Cinzel 900, gold gradient
		     fill, 1px black stroke and 3% letter-spacing at the 64px design size. -->
		<Container y={boardSize * 0.366} scale={amountScale} zIndex={1}>
			<Text
				anchor={0.5}
				text={amountText}
				onresize={({ width }) => (amountWidth = width)}
				style={{
					fontFamily: 'Cinzel',
					fontWeight: '900',
					fontSize,
					align: 'center',
					fill: amountFill,
					letterSpacing: fontSize * 0.03,
					stroke: { color: 0x000000, width: Math.max(1, Math.round(fontSize / 64)) },
				}}
			/>
		</Container>
	</Container>
{/if}
