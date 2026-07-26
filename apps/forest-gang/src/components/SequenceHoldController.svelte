<script lang="ts">
	import { getContext } from '../game/context';
	import { interruptHolds } from '../game/sequenceHold';

	// `bookEventHandlerMap` is a module object, not a mounted component, and `subscribeOnMount`
	// wraps `onMount` — so the handler map cannot subscribe to `stopButtonClick` itself. This is
	// the one mounted subscriber that forwards a stop press to the module-level hold controller.
	// It lives outside the loading-screen branch so it is mounted for the whole session, and the
	// controller is cleared at every `playBet` boundary rather than on unmount.
	getContext().eventEmitter.subscribeOnMount({ stopButtonClick: interruptHolds });
</script>
