<script lang="ts" module>
	export type EmitterEventFreeSpinIntro =
		| { type: 'freeSpinIntroShow' }
		| { type: 'freeSpinIntroHide' }
		| { type: 'freeSpinIntroUpdate'; totalFreeSpins: number; title?: string };
</script>

<script lang="ts">
	import { CanvasSizeRectangle } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { BitmapText, Sprite } from 'pixi-svelte';
	import { stateI18nDerived } from 'state-shared';

	import { getContext } from '../game/context';
	import { getSpecialSymbolKey } from '../game/utils';
	import PressToContinue from './PressToContinue.svelte';
	import FreeSpinAnimation from './FreeSpinAnimation.svelte';

	const context = getContext();

	let show = $state(false);
	let freeSpinsFromEvent = $state(0);
	let title = $state('FREE SPINS');
	let oncomplete = $state(() => {});
	const layoutType = $derived(context.stateLayoutDerived.layoutType());
	const badgeKey = $derived(
		getSpecialSymbolKey(title === 'MEGA COASTER' ? 'coasterScatter' : 'rollerScatter', layoutType),
	);

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => {
			show = true;
			context.stateGame.freeSpinPopupShowing = true;
		},
		freeSpinIntroHide: () => {
			show = false;
			context.stateGame.freeSpinPopupShowing = false;
		},
		freeSpinIntroUpdate: async (emitterEvent) => {
			freeSpinsFromEvent = emitterEvent.totalFreeSpins;
			title = emitterEvent.title ?? 'FREE SPINS';
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />

	<FreeSpinAnimation xOffset={0}>
		{@const BW = 900}

		<Sprite
			key={badgeKey}
			anchor={0.5}
			y={Math.round(-BW * 0.13)}
			width={Math.round(BW * 0.36)}
			height={Math.round(BW * 0.29)}
		/>

		<!-- Spin count -->
		<BitmapText
			anchor={{ x: 0.5, y: 0.5 }}
			text={`${freeSpinsFromEvent}`}
			style={{ fontFamily: 'silver', fontSize: Math.round(BW * 0.12) }}
			y={Math.round(BW * 0.08)}
		/>

		<!-- SPINS label -->
		<BitmapText
			anchor={{ x: 0.5, y: 0.5 }}
			text={stateI18nDerived.translate('SPINS')}
			style={{ fontFamily: 'gold', fontSize: Math.round(BW * 0.045) }}
			y={Math.round(BW * 0.2)}
		/>
	</FreeSpinAnimation>

	<PressToContinue onpress={() => oncomplete()} />
</FadeContainer>
