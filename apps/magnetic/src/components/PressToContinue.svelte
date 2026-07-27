<script lang="ts">
	import { OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';

	type Props = {
		onpress: () => void;
	};

	const props: Props = $props();
</script>

<!-- Tap / Space anywhere to continue. The visible "PRESS ANYWHERE TO CONTINUE" prompt was a
     leftover yellow sprite (MM_pressanywhere, from the original game) and has been removed — the
     interaction stays, and each popup that still wants a prompt renders its own. -->
<OnHotkey hotkey="Space" onpress={() => props.onpress()} />
<OnPressFullScreen onpress={() => props.onpress()} />
