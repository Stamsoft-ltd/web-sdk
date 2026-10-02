<script lang="ts">
	import { Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	const context = getContext();
	const board = $derived(context.stateGameDerived.boardLayout());
	// Portrait draws its logo (+ Press Play) as an HTML header above the board (see HudHtml .pt-top),
	// so the pixi board logo is desktop/landscape only. (The old pixi bonus wheel that lived here was
	// replaced by the HTML WheelBonus overlay and has been removed.)
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');

	// Desktop's board sits right under the screen top (≈33 main units free), so the taller new logo is a
	// bit smaller there and its top is clamped just inside the main area; landscape has room above.
	const logoW = $derived(board.width * (context.stateLayoutDerived.layoutType() === 'desktop' ? 0.36 : 0.46));
	const logoBottom = $derived(
		Math.max(board.y - board.height * 0.5 + board.height * 0.075 - board.width * 0.03, 4 + logoW / 3.97),
	);
</script>

<!-- Board logo (logo-v3: tight-cropped 1800×453, aspect 3.97): sized as a fraction of the board
     width so it never overflows a narrow board. Its bottom (the drips under the banner) dips just over
     the board's top edge, where the old logo's lettering ended. Portrait uses the HTML .pt-top header. -->
{#if !isPortrait}
	<Sprite
		key="mcschmutzoLogo"
		x={board.x}
		y={logoBottom}
		anchor={{ x: 0.5, y: 1 }}
		width={logoW}
		height={logoW / 3.97}
		zIndex={1000}
	/>
{/if}
