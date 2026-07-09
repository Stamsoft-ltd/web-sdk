<script lang="ts" module>
	export type EmitterEventPortraitTopBar = { type: 'portraitTopBarNoop' };
</script>

<script lang="ts">
	import { onMount } from 'svelte';
	import { MainContainer } from 'components-layout';
	import { Container, Sprite, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { PAY_SYMBOLS } from '../game/constants';
	import { getSpriteKeyByName } from '../game/utils';
	import type { SymbolName } from '../game/types';

	const context = getContext();
	const main = $derived(context.stateLayoutDerived.mainLayout());
	// Only in portrait AND only for the two SPECIAL (bought) bonuses — same gate as the desktop
	// CapsulePanel. Base / chance / feature show no capsule bar (and the default background).
	const show = $derived(
		context.stateLayoutDerived.layoutType() === 'portrait' &&
			(context.stateGame.bonusMode === 'freegame' || context.stateGame.bonusMode === 'superspin'),
	);

	const globalMultiplier = $derived(context.stateGame.globalMultiplier || 1);

	// A random pay symbol sits inside the tube (mobile art picked automatically in portrait).
	let randomSymbol = $state<SymbolName>('H1');
	onMount(() => {
		randomSymbol = PAY_SYMBOLS[Math.floor(Math.random() * PAY_SYMBOLS.length)] as SymbolName;
	});
	const displaySymbol = $derived(
		(context.stateGame.magnetTargetSymbol ??
			context.stateGame.selectedBonusSymbol ??
			randomSymbol) as SymbolName,
	);
	const symbolKey = $derived(getSpriteKeyByName({ name: displaySymbol }));

	// Free-spins counter (mirrors FreeSpinCounter events).
	let fsCurrent = $state(0);
	context.eventEmitter.subscribeOnMount({
		freeSpinCounterShow: () => (fsCurrent = 0),
		freeSpinCounterUpdate: (e) => {
			if (e.current !== undefined) fsCurrent = e.current;
		},
	});

	// Horizontal bar centred at the top of the portrait area, above the board.
	const CY = $derived(main.height * 0.208);
	const TUBE_ASPECT = 692 / 232;
	const BOX_ASPECT = 323 / 228;
	const capsuleW = $derived(main.width * 0.44);
	const capsuleH = $derived(capsuleW / TUBE_ASPECT);
	const boxW = $derived(main.width * 0.22);
	const boxH = $derived(boxW / BOX_ASPECT);
	const gap = $derived(main.width * 0.01);
	const capsuleX = $derived(main.width * 0.5);
	const leftX = $derived(capsuleX - capsuleW * 0.5 - gap - boxW * 0.5);
	const rightX = $derived(capsuleX + capsuleW * 0.5 + gap + boxW * 0.5);
	const symSize = $derived(capsuleH * 0.9);

	const labelStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0x8ec7ff,
		letterSpacing: fontSize * 0.1,
		align: 'center' as const,
	});
	const valueStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xffffff,
		align: 'center' as const,
	});
</script>

{#if show}
	<MainContainer zIndex={25}>
		<!-- ALL WINS (global multiplier) -->
		<Container x={leftX} y={CY}>
			<Sprite key="smallPadMobile" anchor={0.5} width={boxW} height={boxH} />
			<Text anchor={0.5} y={-boxH * 0.17} text="ALL WINS" style={labelStyle(boxH * 0.16)} />
			<Text anchor={0.5} y={boxH * 0.15} text={`x${globalMultiplier}`} style={valueStyle(boxH * 0.28)} />
		</Container>

		<!-- Capsule (horizontal tube + a random symbol inside) -->
		<Container x={capsuleX} y={CY}>
			<Sprite key="capsuleTubeMobile" anchor={0.5} width={capsuleW} height={capsuleH} />
			<Sprite key={symbolKey} anchor={0.5} width={symSize} height={symSize * (152 / 184)} />
		</Container>

		<!-- FREE SPINS count -->
		<Container x={rightX} y={CY}>
			<Sprite key="smallPadMobile" anchor={0.5} width={boxW} height={boxH} />
			<Text anchor={0.5} y={-boxH * 0.17} text="FREE SPINS" style={labelStyle(boxH * 0.15)} />
			<Text anchor={0.5} y={boxH * 0.15} text={`${fsCurrent}`} style={valueStyle(boxH * 0.28)} />
		</Container>
	</MainContainer>
{/if}
