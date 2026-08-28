<script lang="ts">
	import { Container, Rectangle, Sprite, Text } from 'pixi-svelte';
	import { cubicOut } from 'svelte/easing';
	import { Tween } from 'svelte/motion';

	import { getContext } from '../game/context';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	const TAU = Math.PI * 2;
	const SECTOR_ANGLE = TAU / 7;
	const SPIN_DURATION = 2200;
	const FULL_ROTATIONS = 6;
	// Measured from the labelled wheel reference. The old 166px radius pulled all three
	// lines toward the hub instead of centring them inside the cream sectors.
	const SECTOR_LABEL_RADIUS = 187;
	const wheelSectors = [
		{ freeSpins: 30, steps: 15 },
		{ freeSpins: 20, steps: 10 },
		{ freeSpins: 15, steps: 8 },
		{ freeSpins: 12, steps: 6 },
		{ freeSpins: 10, steps: 5 },
		{ freeSpins: 8, steps: 4 },
		{ freeSpins: 6, steps: 3 },
	] as const;

	const wheelRotation = new Tween(0);
	const wheelScale = new Tween(0.78);
	const overlayAlpha = new Tween(0);
	const resultAlpha = new Tween(0);
	const resultScale = new Tween(0.82);

	const wheelStopAngle = (freeSpins: number) => {
		const sectorIndex = Math.max(
			0,
			wheelSectors.findIndex((sector) => sector.freeSpins === freeSpins),
		);
		// Sector 0 starts at twelve o'clock. Positive Pixi rotation is clockwise.
		return (TAU - sectorIndex * SECTOR_ANGLE) % TAU;
	};
	const wheelTargetRotation = $derived(
		context.stateGame.wheel
			? TAU * FULL_ROTATIONS + wheelStopAngle(context.stateGame.wheel.freeSpins)
			: 0,
	);
	const wheelSettled = $derived(
		Boolean(context.stateGame.wheel) &&
			Math.abs(wheelRotation.current - wheelTargetRotation) < 0.02,
	);
	const pointerRotation = $derived.by(() => {
		if (!context.stateGame.wheel || wheelSettled) return 0;
		const phase = (((wheelRotation.current / SECTOR_ANGLE) % 1) + 1) % 1;
		const dividerContact = 1 - Math.abs(phase - 0.5) * 2;
		const remainingTurns = Math.max(0, wheelTargetRotation - wheelRotation.current) / TAU;
		const strength = Math.min(1, 0.28 + remainingTurns * 0.38);
		return -0.18 * dividerContact ** 2 * strength;
	});

	$effect(() => {
		const wheel = context.stateGame.wheel;
		wheelRotation.set(0, { duration: 0 });
		wheelScale.set(0.78, { duration: 0 });
		overlayAlpha.set(0, { duration: 0 });
		resultAlpha.set(0, { duration: 0 });
		resultScale.set(0.82, { duration: 0 });
		if (!wheel) return;

		const frame = requestAnimationFrame(() => {
			overlayAlpha.set(1, { duration: 180, easing: cubicOut });
			wheelScale.set(1, { duration: 320, easing: cubicOut });
			wheelRotation.set(wheelTargetRotation, {
				duration: SPIN_DURATION,
				easing: cubicOut,
			});
		});
		return () => cancelAnimationFrame(frame);
	});

	$effect(() => {
		if (!wheelSettled) return;
		resultAlpha.set(1, { duration: 160, easing: cubicOut });
		resultScale.set(1, { duration: 260, easing: cubicOut });
	});
</script>

<!-- Board logo: sized as a fraction of the board width so it never overflows a narrow board
     (was a fixed 430×144). Keeps the art's 430:144 aspect. -->
<Sprite
	key="mcschmutzoLogo"
	x={board.x}
	y={board.y - board.height * 0.5 + 42}
	anchor={{ x: 0.5, y: 1 }}
	width={board.width * 0.52}
	height={(board.width * 0.52 * 144) / 430}
/>

{#if context.stateGame.gameType === 'freegame' || context.stateGame.globalMultiplier > 1}
	<Container x={board.x + board.width * 0.5 + 74} y={board.y - board.height * 0.5 + 42}>
		<Rectangle
			x={-54}
			y={-35}
			width={108}
			height={70}
			radius={18}
			backgroundColor={0x3a1404}
			alpha={0.96}
		/>
		<Text
			anchor={0.5}
			text={`${context.stateGame.globalMultiplier}x`}
			style={{ fill: 0xffc21b, fontSize: 34, fontWeight: '900' }}
		/>
	</Container>
{/if}

{#if false && context.stateGame.wheel}
	<!-- Replaced by the HTML WheelBonus overlay (new designed wheel). -->
	<Container x={board.x} y={board.y} alpha={overlayAlpha.current}>
		<Rectangle
			x={-345}
			y={-300}
			width={690}
			height={600}
			radius={28}
			backgroundColor={0x120603}
			alpha={0.97}
		/>
		<Container y={-24} scale={wheelScale.current}>
			<Container rotation={wheelRotation.current}>
				<Sprite key="bonusWheelDisc" anchor={0.5} width={510} height={522} />
				{#each wheelSectors as sector, sectorIndex (sector.freeSpins)}
					{@const angle = -Math.PI / 2 + sectorIndex * SECTOR_ANGLE}
					<Container
						x={Math.cos(angle) * SECTOR_LABEL_RADIUS}
						y={Math.sin(angle) * SECTOR_LABEL_RADIUS}
						rotation={angle + Math.PI / 2}
					>
						<Text
							anchor={0.5}
							y={-17}
							text={`${sector.freeSpins}`}
							style={{
								fill: 0xa22518,
								fontFamily: 'Poppins',
								fontSize: 30,
								fontWeight: '900',
								stroke: { color: 0xffe1a3, width: 2 },
							}}
						/>
						<Text
							anchor={0.5}
							y={7}
							text="FREE GAMES"
							style={{
								fill: 0x401c0d,
								fontFamily: 'Poppins',
								fontSize: 11,
								fontWeight: '900',
							}}
						/>
						<Text
							anchor={0.5}
							y={27}
							text={`+${sector.steps} STEPS`}
							style={{
								fill: 0xa22518,
								fontFamily: 'Poppins',
								fontSize: 15,
								fontWeight: '900',
							}}
						/>
					</Container>
				{/each}
			</Container>
			<Sprite key="mcschmutzoLogo" anchor={0.5} width={132} height={27} />
			<Sprite
				key="bonusWheelPointer"
				anchor={{ x: 0.5, y: 0.1 }}
				y={-300}
				width={118}
				height={110}
				rotation={pointerRotation}
			/>
		</Container>
		<Rectangle
			x={-245}
			y={222}
			width={490}
			height={62}
			radius={18}
			backgroundColor={0x2c0d02}
			alpha={wheelSettled ? 0.98 : 0.82}
		/>
		{#if wheelSettled}
			<Container y={253} alpha={resultAlpha.current} scale={resultScale.current}>
				<Text
					anchor={0.5}
					text={`${context.stateGame.wheel.freeSpins} FREE GAMES · +${context.stateGame.wheel.addedSteps} STEPS · ${context.stateGame.wheel.globalMult}x`}
					style={{
						fill: 0xffd34d,
						fontFamily: 'Poppins',
						fontSize: 23,
						fontWeight: '900',
					}}
				/>
			</Container>
		{:else}
			<Text
				anchor={0.5}
				y={253}
				text="SPINNING..."
				style={{
					fill: 0xffd34d,
					fontFamily: 'Poppins',
					fontSize: 24,
					fontWeight: '900',
				}}
			/>
		{/if}
	</Container>
{/if}
