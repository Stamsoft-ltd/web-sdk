<script lang="ts">
	import { OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { stateBet } from 'state-shared';

	type Props = {
		onpress: () => void;
	};

	const props: Props = $props();

	// While a hold-to-spin is active (spin button or Space), presses must not advance the popup:
	// a held Space auto-repeats keydowns ~30/s, so the second repeat dismissed a win board
	// 30-60ms after the first finished its count-up — the celebration never rendered a frame.
	// Ignoring presses for the duration of the hold gives both hold paths the button's behavior:
	// win boards play out and auto-dismiss, the free-spin panels wait for a press after release.
	const press = () => {
		if (stateBet.isSpaceHold) return;
		props.onpress();
	};
</script>

<!-- Tap / Space anywhere to continue. The visible "PRESS ANYWHERE TO CONTINUE" prompt was a
     leftover yellow sprite (MM_pressanywhere, from the original game) and has been removed — the
     interaction stays, and each popup that still wants a prompt renders its own. -->
<OnHotkey hotkey="Space" onpress={press} />
<OnPressFullScreen onpress={press} />
