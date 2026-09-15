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

	// Pad art is exported ~1302x455 (plaque centred). The amount sits in the dedicated win-box-amount
	// plaque (1536x1024 art; red panel + gold frame + ketchup/mustard splashes).
	const PAD_ASPECT = 1302 / 455;
	const BOX_ASPECT = 1536 / 1024;
	// Portrait: the board fills almost the whole layout, so the desktop banner multiplier makes the
	// pad overflow the phone — use a smaller fraction that still reads big.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const padW = $derived(board.width * (isPortrait ? 1.15 : 1.5));
	const padH = $derived(padW / PAD_ASPECT);
	// The visible plaque is ~88% of the art width, so scale the box up a touch to keep it prominent.
	const boxW = $derived(board.width * (isPortrait ? 0.52 : 0.57));
	const boxH = $derived(boxW / BOX_ASPECT);
	// Red panel centre measured at (50.2%, 49.2%) of the art — essentially the box centre, so the
	// amount only needs a hair of lift (the old -4% left it hugging the top of the panel).
	const amountY = $derived(-boxH * 0.008);
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

	<!-- Win-amount plaque with the count-up amount centred inside its red panel. -->
	<Container y={padH * 0.44}>
		<Sprite key="winBoxAmount" anchor={{ x: 0.5, y: 0.5 }} width={boxW} height={boxH} />
		<Container y={amountY}>
			{@render props.children()}
		</Container>
	</Container>
</Container>
