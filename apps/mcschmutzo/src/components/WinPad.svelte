<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Container, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = {
		/** Sprite key of the tier pad art (plaque + wordmark + sauce + stars + burger). Omit for the
		 *  small-win case: just the red win-box plaque with the value on top (no tier wordmark). */
		padKey?: string;
		/** Amount text, rendered centred in the wooden box. */
		children: Snippet;
	};

	const props: Props = $props();
	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());

	// Pad art is exported ~1302x455 (plaque centred). The big-win amount sits in the win-box-amount
	// plaque (1536x1024; red panel + gold frame + splashes); small wins use the simpler wooden-board
	// value box (winBox, 810x243 — dark-red panel + gold frame).
	const PAD_ASPECT = 1302 / 455;
	const BOX_ASPECT = 1536 / 1024;
	const SMALL_ASPECT = 1241 / 623; // dedicated small-win plaque
	// Portrait: the board fills almost the whole layout, so the desktop banner multiplier makes the
	// pad overflow the phone — use a smaller fraction that still reads big.
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const boxOnly = $derived(!props.padKey);
	const padW = $derived(board.width * (isPortrait ? 1.15 : 1.5));
	const padH = $derived(padW / PAD_ASPECT);
	// The visible plaque is ~88% of the art width, so scale the box up a touch to keep it prominent.
	// Box-only (small wins) uses the dedicated small-win plaque, centred on the board where the gold
	// number used to sit.
	const boxW = $derived(
		boxOnly ? board.width * (isPortrait ? 0.82 : 0.66) : board.width * (isPortrait ? 0.52 : 0.57),
	);
	const boxH = $derived(boxW / (boxOnly ? SMALL_ASPECT : BOX_ASPECT));
	// Big-win: red panel centre measured at (50.2%, 49.2%) — a hair of lift. Small plaque is centred,
	// but the Bowlby glyphs render a touch high (font metrics) and a touch left (3% letter-spacing's
	// trailing gap), so nudge the value right + down to sit truly centred in the red panel.
	const amountX = $derived(boxOnly ? boxW * 0.013 : 0);
	const amountY = $derived(boxOnly ? boxH * 0.018 : -boxH * 0.008);
</script>

{#if boxOnly}
	<!-- Small-win case: the dedicated red plaque with the value on top (replaces the old gold bitmap
	     number, which came from a different game's font). -->
	<Container>
		<Sprite key="winBoxSmall" anchor={{ x: 0.5, y: 0.5 }} width={boxW} height={boxH} />
		<Container x={amountX} y={amountY}>
			{@render props.children()}
		</Container>
	</Container>
{:else}
	<Container>
		<!-- Pad (plaque + wordmark + sauce + stars + burger), centred above the amount box. -->
		<Sprite key={props.padKey} anchor={{ x: 0.5, y: 0.5 }} width={padW} height={padH} y={-padH * 0.2} />

		<!-- Win-amount plaque with the count-up amount centred inside its red panel. -->
		<Container y={padH * 0.44}>
			<Sprite key="winBoxAmount" anchor={{ x: 0.5, y: 0.5 }} width={boxW} height={boxH} />
			<Container y={amountY}>
				{@render props.children()}
			</Container>
		</Container>
	</Container>
{/if}
