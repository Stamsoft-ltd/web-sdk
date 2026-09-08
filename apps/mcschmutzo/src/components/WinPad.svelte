<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Container, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = {
		/** Sprite key of the tier pad art (plaque + wordmark + sauce + stars + burger). */
		padKey: string;
		/** Amount text, rendered centred in the wooden box. */
		children: Snippet;
	};

	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	// Pad art is exported ~1302x455 (plaque centred). The amount now sits in the red plaque frame
	// (congrats-cover-sm, 1241x623) instead of the gold wooden board.
	const PAD_ASPECT = 1302 / 455;
	const BOX_ASPECT = 1241 / 623;
	// Portrait: the board fills almost the whole layout, so the desktop banner multiplier makes the
	// pad overflow the phone — use a smaller fraction that still reads big.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const padW = $derived(board.width * (isPortrait ? 1.15 : 1.5));
	const padH = $derived(padW / PAD_ASPECT);
	const boxW = $derived(board.width * (isPortrait ? 0.46 : 0.5));
	const boxH = $derived(boxW / BOX_ASPECT);
</script>

<Container>
	<!-- Pad (plaque + wordmark + sauce + stars + burger), centred above the amount box. -->
	<Sprite
		key={props.padKey}
		anchor={{ x: 0.5, y: 0.5 }}
		width={padW}
		height={padH}
		y={-padH * 0.2}
	/>

	<!-- Red plaque amount box with the count-up amount centred inside its red interior. -->
	<Container y={padH * 0.44}>
		<Sprite key="winBoxRed" anchor={{ x: 0.5, y: 0.5 }} width={boxW} height={boxH} />
		{@render props.children()}
	</Container>
</Container>
