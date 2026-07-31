<script lang="ts">
	import { OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { onDestroy } from 'svelte';

	import { getContext } from '../game/context';

	type Props = {
		onpress: () => void;
		showText?: boolean;
	};

	const { onpress, showText = true }: Props = $props();
	const context = getContext();

	// The words live in <PressAnywhereCaption>, an HTML sibling of the HUD — the design runs them
	// across the HUD bar, and the HUD is a DOM layer above the canvas, so a pixi Text can only ever
	// sit behind it. That is what left the old caption half hidden on every screen that used this.
	$effect(() => {
		context.stateGame.pressToContinueShowing = showText;
	});
	onDestroy(() => (context.stateGame.pressToContinueShowing = false));
</script>

<OnHotkey hotkey="Space" onpress={() => onpress()} />
<OnPressFullScreen onpress={() => onpress()} />
