<script lang="ts">
	import { Container, Sprite, Text } from 'pixi-svelte';
	import { FadeContainer } from 'components-pixi';
	import { MainContainer } from 'components-layout';
	import { FillGradient } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	// RESPIN indicator (Figma 4504-3586): a blue tech panel in the LEFT rail under the logo with a
	// spinning circular-arrow icon and a cyan-gradient RESPIN label. Shown only while a BONUS
	// reveal is a cluster-growth respin — i.e. the cluster grew and the player was awarded a
	// free re-spin (stateGame.respinIndicator).
	const context = getContext();

	const main = $derived(context.stateLayoutDerived.mainLayout());
	const board = $derived(context.stateGameDerived.boardLayout());
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const show = $derived(context.stateGame.respinIndicator);

	// Same geometry family as the capsule's TOTAL WIN / FREE SPINS boxes (panel_border art).
	const PANEL_ASPECT = 200 / 98;
	const scale = $derived(board.boardScale);
	const PANEL_W = $derived(board.width * 0.32 * scale);
	const PANEL_H = $derived(PANEL_W / PANEL_ASPECT);

	// Centre of the LEFT rail (mirror of the capsule column): between the screen's left edge and
	// the board's left edge, below the logo (which occupies the top of the rail).
	const boardLeftX = $derived(board.x - board.width * 0.5 * scale);
	const canvasLeftX = $derived(
		main.width * 0.5 - context.stateLayoutDerived.canvasSizes().width / (2 * (main.scale || 1)),
	);
	const canvasTopY = $derived(
		main.height * 0.5 - context.stateLayoutDerived.canvasSizes().height / (2 * (main.scale || 1)),
	);
	const colX = $derived((canvasLeftX + boardLeftX) * 0.5);
	const LOGO_H = $derived(main.width * 0.3 / (1400 / 1098));
	const panelY = $derived(canvasTopY + LOGO_H * 0.78 + PANEL_H * 0.5);

	// Continuous icon spin while the panel is up.
	let iconRot = $state(0);
	$effect(() => {
		if (!show) return;
		let raf = 0;
		const tick = (now: number) => {
			iconRot = (now / 1000) * 2.4;
			raf = requestAnimationFrame(tick);
		};
		raf = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(raf);
	});

	// Figma: Inter Bold, uppercase, vertical gradient #00FCFF -> #0046A9.
	const RESPIN_GRADIENT = new FillGradient({
		type: 'linear',
		start: { x: 0, y: 0 },
		end: { x: 0, y: 1 },
		colorStops: [
			{ offset: 0, color: 0x00fcff },
			{ offset: 1, color: 0x0046a9 },
		],
		textureSpace: 'local',
	});
	const labelStyle = (fontSize: number) => ({
		fontFamily: 'Inter',
		fontWeight: '700' as const,
		fontSize,
		fill: RESPIN_GRADIENT,
		letterSpacing: fontSize * 0.03,
		align: 'center' as const,
	});
</script>

{#if !isPortrait}
	<MainContainer zIndex={25}>
		<FadeContainer {show}>
			<Container x={colX} y={panelY}>
				<Sprite key="panelBorder" anchor={0.5} width={PANEL_W} height={PANEL_H} />
				<Sprite
					key="respinIcon"
					anchor={0.5}
					y={-PANEL_H * 0.16}
					rotation={iconRot}
					width={PANEL_H * 0.3}
					height={PANEL_H * 0.3}
				/>
				<Text anchor={0.5} y={PANEL_H * 0.16} text={i18nDerived.translate('RESPIN')} style={labelStyle(PANEL_H * 0.2)} />
			</Container>
		</FadeContainer>
	</MainContainer>
{/if}
