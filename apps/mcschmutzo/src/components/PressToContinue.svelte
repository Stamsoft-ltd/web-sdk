<script lang="ts">
	import { OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';


	type Props = {
		onpress: () => void;
	};

	const props: Props = $props();
</script>

<!-- The prompt itself is HTML (HudHtml .win-continue, shown while context.stateGame.winDim > 0) so it
     matches the congrats screens' "PRESS TO CONTINUE →" and clears the portrait HUD; this component
     keeps only the Space / tap handlers. -->
<OnHotkey hotkey="Space" onpress={() => props.onpress()} />
<OnPressFullScreen onpress={() => props.onpress()} />
