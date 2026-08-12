<script lang="ts" module>
	export type EmitterEventFreeSpinIntro =
		| { type: 'freeSpinIntroShow' }
		| { type: 'freeSpinIntroHide' }
		| { type: 'freeSpinIntroUpdate'; totalFreeSpins: number };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
	import PressToContinue from './PressToContinue.svelte';
	import WonPanel from './WonPanel.svelte';

	// Free-spins-won screen — Version2 (Figma node 7022-6844). The popup itself lives in WonPanel,
	// which the bonus-end screen (FreeSpinOutro, node 7069-9311) shares.
	const context = getContext();

	let show = $state(false);
	let freeSpinsFromEvent = $state(0);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => (show = true),
		freeSpinIntroHide: () => (show = false),
		freeSpinIntroUpdate: async (emitterEvent) => {
			freeSpinsFromEvent = emitterEvent.totalFreeSpins;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<FadeContainer {show}>
	<!-- No dim here: <BonusHandoffVeil> is already holding the design's 0.88 black over the whole
	     hand-off, and a second full-screen dim would stack with it to ~0.99. -->

	<MainContainer>
		<WonPanel {show} big={`${freeSpinsFromEvent}`} caption={i18nDerived.translate('FREE SPINS')} />
	</MainContainer>

	<PressToContinue onpress={() => oncomplete()} />
</FadeContainer>
