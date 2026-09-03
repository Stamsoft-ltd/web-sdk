<script lang="ts" module>
	export type EmitterEventFreeSpinIntro =
		| { type: 'freeSpinIntroShow' }
		| { type: 'freeSpinIntroHide' }
		| { type: 'freeSpinIntroUpdate'; totalFreeSpins: number };
</script>

<script lang="ts">
	import { CanvasSizeRectangle } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForResolve } from 'utils-shared/wait';
	import { Container, Rectangle, Text } from 'pixi-svelte';
	import { MainContainer } from 'components-layout';

	import { getContext } from '../game/context';
	import PressToContinue from './PressToContinue.svelte';

	const context = getContext();

	let show = $state(false);
	let freeSpinsFromEvent = $state(0);
	let oncomplete = $state(() => {});

	context.eventEmitter.subscribeOnMount({
		freeSpinIntroShow: () => (show = true),
		freeSpinIntroHide: () => (show = false),
		freeSpinIntroUpdate: async (emitterEvent) => {
			// if (emitterEvent.extraSpins) {
			// 	context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_fs_respins' });
			// }
			// freeSpinsFromEvent = emitterEvent.extraSpins ?? emitterEvent.totalFreeSpins;
			freeSpinsFromEvent = emitterEvent.totalFreeSpins;
			await waitForResolve((resolve) => (oncomplete = resolve));
		},
	});
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.5} />

	<MainContainer>
		<Container
			x={context.stateLayoutDerived.mainLayout().width * 0.5}
			y={context.stateLayoutDerived.mainLayout().height * 0.5}
		>
			<Rectangle x={-360} y={-190} width={720} height={380} backgroundColor={0x6d2b12} />
			<Rectangle x={-348} y={-178} width={696} height={356} backgroundColor={0xd69a2d} />
			<Rectangle x={-336} y={-166} width={672} height={332} backgroundColor={0x315318} />
			<Text
				anchor={0.5}
				y={-90}
				text="BONUS ENTER"
				style={{
					fontFamily: 'monospace',
					fontSize: 58,
					fontWeight: '900',
					fill: 0xffe24e,
					stroke: { color: 0x4c2008, width: 8 },
				}}
			/>
			<Text
				anchor={0.5}
				y={18}
				text={`${freeSpinsFromEvent} FREE SPINS`}
				style={{
					fontFamily: 'monospace',
					fontSize: 48,
					fontWeight: '900',
					fill: 0xffffff,
					stroke: { color: 0x4c2008, width: 7 },
				}}
			/>
		</Container>
	</MainContainer>

	<PressToContinue onpress={() => oncomplete()} />
</FadeContainer>
