<script lang="ts" module>
	import { stateBet, stateBetDerived } from 'state-shared';
</script>

<script lang="ts">
	import OnHotkey from './OnHotkey.svelte';

	type Props = {
		/** Jurisdiction `disabledSpacebar` (or any other reason Space must do nothing). */
		disabled?: boolean;
		/** Whether holding Space also switches turbo on. Off when the jurisdiction disables turbo. */
		turbo?: boolean;
	};

	const props: Props = $props();

	const spaceHoldOn = () => {
		stateBet.autoSpinsCounter = 0;
		stateBet.isSpaceHold = true;
		if (props.turbo !== false) stateBetDerived.updateIsTurbo(true, { persistent: true });
	};

	const spaceHoldOff = () => {
		stateBet.isSpaceHold = false;
		if (props.turbo !== false) stateBetDerived.updateIsTurbo(false, { persistent: true });
	};
</script>

<OnHotkey hotkey="Space" disabled={props.disabled} onhold={spaceHoldOn} onholdend={spaceHoldOff} />
