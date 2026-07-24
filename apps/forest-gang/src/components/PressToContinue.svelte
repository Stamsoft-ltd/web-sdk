<script lang="ts">
	import { MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { Container } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import PressAnywhereText from './PressAnywhereText.svelte';

	type Props = {
		onpress: () => void;
		// When the screen anchors its own PressAnywhereText to the board (intro/outro in
		// landscape/desktop), set false so only the press handlers are mounted here.
		showText?: boolean;
		// Non-portrait clearance above the HUD bar, in font-heights (bigger = higher). Defaults to
		// 1.1; the outro passes a smaller value because its board sits lower than the intro's (the
		// intro shifts its whole popup up 0.06·BW), so its press needs to sit lower in the glow ledge.
		hudClearFactor?: number;
	};

	const props: Props = $props();
	const context = getContext();

	// Sit just BELOW the free-spin popup's wooden panel, clamped above the HTML HUD bar. The panel
	// is sized in FreeSpinAnimation as (min(mainW, mainH) × 0.72) and centred, so its bottom edge
	// is mainH/2 + 0.36·minDim; the 1.07 factor clears the corner leaves that overhang the frame.
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const y = $derived.by(() => {
		const ml = context.stateLayoutDerived.mainLayout();
		const scale = ml.scale || 1;
		// Portrait: sit in the glow gap below the popup panel but clear of the bottom HTML HUD bar,
		// which occupies roughly the bottom ~17% of the screen. 0.95/0.85 both landed on/behind the
		// bar (read as "no press text"); 0.78 sits lower in the visible glow gap under the board
		// (design ask "move it down") while still clearing the HUD bar.
		if (layoutType === 'portrait') return ml.height * 0.78;
		// Non-portrait (desktop/tablet — mobile landscape draws its own in-panel copy): sit in the
		// glow ledge just ABOVE the HTML HUD bar. Estimating the board bottom from a minDim fraction
		// kept landing the line back on the wooden planks (the free-spin board is much larger than
		// the estimate), so anchor to the REAL HUD top instead — same math as the desktop deer feet
		// in ExpandedSymbolPresenter: HUD height = 176·u, measured up from the game-area bottom, with
		// letterbox handled via `offset`, then converted back into main-layout coordinates.
		const canvas = context.stateLayoutDerived.canvasSizes();
		const u = Math.min(1860, canvas.width * 0.97) / 1860;
		const hudH = u * 176 + 8;
		const offset = (canvas.height - ml.height * scale) / 2;
		const gameBottom = offset + ml.height * scale;
		const hudTopMain = (gameBottom - hudH - offset) / scale;
		// A little clearance above the bar so the text sits in the glow, not on the bar top.
		return hudTopMain - fontSize * (props.hudClearFactor ?? 1.1);
	});
	// Portrait scales off screen width; other layouts (desktop/tablet — landscape draws its own
	// in-panel copy) scale off the short side so the below-board line stays readable on narrow
	// tablet windows instead of shrinking to ~13px as width*(18/1200) did.
	const fontSize = $derived.by(() => {
		const ml = context.stateLayoutDerived.mainLayout();
		if (layoutType === 'portrait') return ml.width * 0.03;
		return Math.min(ml.width, ml.height) * 0.028;
	});
</script>

{#if props.showText ?? true}
	<MainContainer alignVertical="bottom">
		<Container x={context.stateLayoutDerived.mainLayout().width * 0.5} {y}>
			<PressAnywhereText y={0} {fontSize} />
		</Container>
	</MainContainer>
{/if}
<OnHotkey hotkey="Space" onpress={() => props.onpress()} />
<OnPressFullScreen onpress={() => props.onpress()} />
