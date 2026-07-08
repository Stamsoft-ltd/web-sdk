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
	import { Container, Sprite, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';

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

	// Popup sized to the screen (slightly portrait to fit the CONGRATULATIONS -> magnet -> FREE SPINS
	// vertical stack), centred on the stage.
	const main = $derived(context.stateLayoutDerived.mainLayout());
	const PW = $derived(Math.min(main.width, main.height) * 0.5);
	const PH = $derived(PW * 1.05);

	// Number-frame reuses the capsule/HUD panel border; box height drives the number size.
	const numBoxW = $derived(PW * 0.32);
	const numBoxH = $derived(numBoxW * (98 / 200));
	const magnetW = $derived(PW * 0.34);

	const congratsStyle = (fontSize: number) => ({
		fontFamily: 'Cinzel',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xffffff,
		letterSpacing: fontSize * 0.03,
		align: 'center' as const,
	});
	const blueStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0x4c9be0,
		letterSpacing: fontSize * 0.18,
		align: 'center' as const,
	});
	const numberStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xffffff,
		align: 'center' as const,
	});
	const pressStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: 0xbcd6f2,
		letterSpacing: fontSize * 0.16,
		align: 'center' as const,
	});
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.6} />

	<MainContainer>
		<Container x={main.width / 2} y={main.height / 2}>
			<!-- Big lightning UNDER the card: a full-height bolt behind the panel, placed DIAGONALLY so it
			     runs from the top-left corner down to the bottom-right (the opaque card hides its middle). -->
			<Sprite
				key="capsuleLightning"
				anchor={0.5}
				rotation={-0.55}
				width={PW * 0.5}
				height={main.height * 1.35}
				alpha={0.9}
			/>

			<!-- Dark-blue tech panel -->
			<Sprite key="fsPanel" anchor={0.5} width={PW} height={PH} />

			<!-- CONGRATULATIONS / YOU WON -->
			<Text anchor={0.5} y={-PH * 0.36} text="CONGRATULATIONS" style={congratsStyle(PH * 0.072)} />
			<Text anchor={0.5} y={-PH * 0.27} text="YOU WON" style={blueStyle(PH * 0.04)} />

			<!-- Full magnet element (magnet + base + blue/orange energy baked in) -->
			<Container y={-PH * 0.06}>
				<Sprite
					key="popupMagnet"
					anchor={0.5}
					width={magnetW * 1.28}
					height={magnetW * 1.28 * (103 / 114)}
				/>
			</Container>

			<!-- Free-spins count in its frame -->
			<Container y={PH * 0.24}>
				<Sprite key="panelBorder" anchor={0.5} width={numBoxW} height={numBoxH} />
				<Text
					anchor={0.5}
					y={-numBoxH * 0.04}
					text={`${freeSpinsFromEvent}`}
					style={numberStyle(numBoxH * 0.62)}
				/>
			</Container>

			<!-- FREE SPINS -->
			<Text anchor={0.5} y={PH * 0.38} text="FREE SPINS" style={blueStyle(PH * 0.04)} />

			<!-- Press-anywhere-to-continue hint (below the card) with the arrow -->
			<Container y={PH * 0.55}>
				<Text
					anchor={0.5}
					x={-PW * 0.03}
					text="PRESS ANYWHERE TO CONTINUE"
					style={pressStyle(PH * 0.028)}
				/>
				<Sprite
					key="pressArrow"
					anchor={0.5}
					x={PW * 0.32}
					width={PH * 0.038 * (18 / 15)}
					height={PH * 0.038}
				/>
			</Container>
		</Container>
	</MainContainer>

	<OnHotkey hotkey="Space" onpress={() => oncomplete()} />
	<OnPressFullScreen onpress={() => oncomplete()} />
</FadeContainer>
