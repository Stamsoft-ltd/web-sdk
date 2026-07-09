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
	import { Container, Graphics, Sprite, Text } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import LightningStorm from './LightningStorm.svelte';

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

	// Which bonus was won + its blurb (same wording as the buy-bonus cards). bonusMode is set
	// before this intro shows: superspin = ALL IN, freegame = DEAL IT.
	const isAllIn = $derived(context.stateGame.bonusMode === 'superspin');
	const bonusName = $derived(isAllIn ? 'ALL IN BONUS' : 'DEAL IT BONUS');
	const bonusDesc = $derived(
		isAllIn
			? '10 Free Spins with random expanding symbol and multiplier start at 2x and doubles on every'
			: '10 Free Spins with random expanding simbol and a random multiplier up to 1024x',
	);

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
	// Wrapped paragraph for the bonus description (lighter than the headings).
	const descStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '400' as const,
		fontSize,
		fill: 0xd7d7d7,
		align: 'center' as const,
		letterSpacing: fontSize * 0.02,
		wordWrap: true,
		wordWrapWidth: PW * 0.82,
		lineHeight: fontSize * 1.3,
	});
</script>

<FadeContainer {show}>
	<CanvasSizeRectangle backgroundColor={0x000000} backgroundAlpha={0.6} />

	<MainContainer>
		<Container x={main.width / 2} y={main.height / 2}>
			<!-- Lightning storm UNDER the card: full-height random strikes behind the panel. -->
			<LightningStorm active={show} panelWidth={PW} screenHeight={main.height} count={18} />

			<!-- Opaque backing: the panel art is semi-transparent, so without this the additive
			     bolts shine THROUGH the dialog instead of staying behind it. -->
			<Graphics
				draw={(g) => {
					g.clear();
					g.rect(-PW * 0.48, -PH * 0.48, PW * 0.96, PH * 0.96);
					g.fill(0x08122b);
				}}
			/>

			<!-- Dark-blue tech panel -->
			<Sprite key="fsPanel" anchor={0.5} width={PW} height={PH} />

			<!-- CONGRATULATIONS / YOU WON / bonus name + description -->
			<Text anchor={0.5} y={-PH * 0.38} text="CONGRATULATIONS" style={congratsStyle(PH * 0.066)} />
			<Text anchor={0.5} y={-PH * 0.3} text="YOU WON" style={blueStyle(PH * 0.036)} />
			<Text anchor={0.5} y={-PH * 0.235} text={bonusName} style={congratsStyle(PH * 0.046)} />
			<Text anchor={{ x: 0.5, y: 0 }} y={-PH * 0.19} text={bonusDesc} style={descStyle(PH * 0.032)} />

			<!-- Full magnet element (magnet + base + blue/orange energy baked in) -->
			<Container y={PH * 0.04}>
				<Sprite
					key="popupMagnet"
					anchor={0.5}
					width={magnetW * 0.9}
					height={magnetW * 0.9 * (103 / 114)}
				/>
			</Container>

			<!-- Free-spins count in its frame -->
			<Container y={PH * 0.27}>
				<Sprite key="panelBorder" anchor={0.5} width={numBoxW} height={numBoxH} />
				<Text
					anchor={0.5}
					y={-numBoxH * 0.04}
					text={`${freeSpinsFromEvent}`}
					style={numberStyle(numBoxH * 0.62)}
				/>
			</Container>

			<!-- FREE SPINS -->
			<Text anchor={0.5} y={PH * 0.395} text="FREE SPINS" style={blueStyle(PH * 0.036)} />

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
