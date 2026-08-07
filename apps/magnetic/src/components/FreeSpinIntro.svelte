<script lang="ts" module>
	export type EmitterEventFreeSpinIntro =
		| { type: 'freeSpinIntroShow' }
		| { type: 'freeSpinIntroHide' }
		| { type: 'freeSpinIntroUpdate'; totalFreeSpins: number };
</script>

<script lang="ts">
	import { CanvasSizeRectangle, MainContainer, OnPressFullScreen } from 'components-layout';
	import { OnHotkey } from 'components-shared';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';
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
	<!-- The design blacks the game out almost completely behind this screen (measured mean 7/255
	     outside the frame vs 88 undimmed), so the dim is much heavier than the old 0.6. -->
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.88} />

	<MainContainer>
		<WonPanel {show} big={`${freeSpinsFromEvent}`} caption={i18nDerived.translate('FREE SPINS')} />
	</MainContainer>

	<OnHotkey hotkey="Space" onpress={() => oncomplete()} />
	<OnPressFullScreen onpress={() => oncomplete()} />
</FadeContainer>
