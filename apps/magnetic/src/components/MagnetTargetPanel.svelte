<script lang="ts">
	import { Container, Sprite } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';

	import BoardContainer from './BoardContainer.svelte';
	import { getContext } from '../game/context';
	import { SYMBOL_H, SYMBOL_SIZE, SYMBOL_W } from '../game/constants';
	import { getSpriteKeyByName } from '../game/utils';

	const PAD_ASPECT = 624 / 420;
	const PANEL_W = SYMBOL_W * 1.1;
	const PANEL_H = PANEL_W / PAD_ASPECT;
	const SYM_SIZE = PANEL_W * 0.52;

	const context = getContext();
	const selectedSymbol = $derived(context.stateGame.magnetTargetSymbol);
	const show = $derived(!!selectedSymbol);
	const scale = $derived(context.stateLayoutDerived.isStacked() ? 1.28 : 1);
	const boardW = $derived(context.stateGameDerived.boardLayout().width);
	const position = $derived(
		context.stateLayoutDerived.isStacked()
			? { x: boardW - PANEL_W * 0.5 - 10, y: SYMBOL_SIZE * 0.18 }
			: { x: boardW + 40, y: SYMBOL_SIZE * 0.3 },
	);
	const spriteKey = $derived(selectedSymbol ? getSpriteKeyByName({ name: selectedSymbol, state: 'static' }) : 'aTile');
</script>

<BoardContainer>
	<FadeContainer {show}>
		<Container
			x={position.x}
			y={position.y}
			{scale}
			pivot={{ x: PANEL_W * 0.5, y: PANEL_H * 0.5 }}
		>
			<Sprite key="symbolPad" anchor={{ x: 0.5, y: 0.5 }} x={PANEL_W * 0.5} y={PANEL_H * 0.5} width={PANEL_W} height={PANEL_H} />

			{#if selectedSymbol}
				<Sprite
					key={spriteKey}
					anchor={{ x: 0.5, y: 0.5 }}
					x={PANEL_W * 0.5}
					y={PANEL_H * 0.5}
					width={SYM_SIZE}
					height={SYM_SIZE * (SYMBOL_H / SYMBOL_W)}
				/>
			{/if}
		</Container>
	</FadeContainer>
</BoardContainer>
