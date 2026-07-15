<script lang="ts" module>
	export type EmitterEventFreeSpinCounter =
		| { type: 'freeSpinCounterShow' }
		| { type: 'freeSpinCounterHide' }
		| { type: 'freeSpinCounterUpdate'; current?: number; total?: number };
</script>

<script lang="ts">
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { stateI18nDerived } from 'state-shared';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';

	import { getContext } from '../game/context';
	import { SYMBOL_SIZE } from '../game/constants';
	import { GOLD_GRADIENT } from '../game/goldGradient';
	import { anchorToPivot, Container, Sprite, Text, type Sizes } from 'pixi-svelte';

	const context = getContext();
	const t = (key: string) => stateI18nDerived.translate(key);

	// Free-spins board (card_pad.png, 372×248) — full leaf corners on all four sides, matches the
	// Figma design. The old confirm_frame had a plank seam that cut through the text.
	const PANEL_RATIO = 372 / 248;
	const WOOD_CENTER_Y = 0.5;
	// Scale of the whole board (and its text). Widened so the board matches the FOREST GANG
	// logo width above it (Figma) — the logo frame mirrors this factor.
	const SIZE = 0.96;
	const panelWidth = $derived(SYMBOL_SIZE * 2.0 * SIZE);
	const panelSizes = $derived({
		width: panelWidth,
		height: panelWidth / PANEL_RATIO,
	});
	const scale = 1;
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	// Mobile-landscape: the FS card is the 3rd box of the LEFT bonus column (see landscapeRail).
	const isLandscape = $derived(context.stateLayoutDerived.layoutType() === 'landscape');
	const lsRail = $derived(context.stateGameDerived.landscapeRail());
	const position = $derived(
		isLandscape
			? {
					// landscapeRail gives the column centre; the card is drawn from its top-left.
					x: lsRail.x - panelSizes.width * 0.5,
					y: lsRail.fsY - panelSizes.height * 0.5,
				}
			: {
					// Mirror the scatter card CSS: left: max(18px, calc(50% - 702px)); nudge right in portrait.
					x:
						Math.max(
							18 / context.stateLayoutDerived.mainLayout().scale,
							context.stateLayoutDerived.mainLayout().width / 2 - 702 / context.stateLayoutDerived.mainLayout().scale,
						) + (isPortrait ? SYMBOL_SIZE * 0.7 : 0),
					y:
						context.stateGameDerived.boardLayout().y -
						context.stateGameDerived.boardLayout().height * 0.5 * context.stateGameDerived.boardLayout().boardScale +
						SYMBOL_SIZE * 0.15,
				},
	);

	const titleFont = $derived(SYMBOL_SIZE * 0.14 * SIZE);
	const counterFont = $derived(SYMBOL_SIZE * 0.36 * SIZE);
	const GAP = $derived(SYMBOL_SIZE * 0.12 * SIZE);

	let show = $state(false);
	let current = $state(0);
	let total = $state(0);
	let titleSizes: Sizes = $state({ width: 0, height: 0 });
	// The counter is split so only the current-spin number pops on change ("6" in "6/10").
	let curSizes: Sizes = $state({ width: 0, height: 0 });
	let restSizes: Sizes = $state({ width: 0, height: 0 });
	const counterSizes = $derived({
		width: curSizes.width + restSizes.width,
		height: Math.max(curSizes.height, restSizes.height),
	});

	// Pop: the new number appears enlarged and settles back to normal size.
	const popScale = new Tween(1, { duration: 450, easing: cubicOut });

	// Stack the two lines and centre the group on the board's wood centre.
	const groupSizes = $derived({
		width: Math.max(titleSizes.width, counterSizes.width),
		height: titleSizes.height + GAP + counterSizes.height,
	});

	const visible = $derived(show && context.stateGame.bonusMode !== 'feature');

	context.eventEmitter.subscribeOnMount({
		freeSpinCounterShow: () => {
			show = false;
			current = 0;
		},
		freeSpinCounterHide: () => {
			show = false;
		},
		freeSpinCounterUpdate: (emitterEvent) => {
			if (emitterEvent.current !== undefined) {
				const changed = emitterEvent.current !== current;
				current = emitterEvent.current;
				show = true;
				if (changed) {
					popScale.set(1.8, { duration: 0 });
					popScale.set(1, { duration: 450, easing: cubicOut });
				}
			}
			if (emitterEvent.total !== undefined) total = emitterEvent.total;
		},
	});
</script>

<MainContainer>
	<FadeContainer show={visible} {...position} {scale}>
		<Sprite key="cardPadLs" {...panelSizes} />

		<Container
			x={panelSizes.width * 0.5}
			y={panelSizes.height * WOOD_CENTER_Y}
			pivot={anchorToPivot({ sizes: groupSizes, anchor: { x: 0.5, y: 0.5 } })}
		>
			<!-- FREE SPINS title — Cinzel 700, gold gradient -->
			<Text
				x={groupSizes.width / 2}
				y={0}
				anchor={{ x: 0.5, y: 0 }}
				text={t('FS FREE SPINS')}
				onresize={(sizes) => (titleSizes = sizes)}
				style={{
					fontFamily: 'Cinzel',
					fontWeight: '700',
					fontSize: titleFont,
					fill: GOLD_GRADIENT,
					align: 'center',
					letterSpacing: titleFont * 0.03,
					wordWrap: false,
				}}
			/>

			<!-- current / total counter — Cinzel 700, gold gradient, large. The current number is a
			     separate Text so it can pop (appear enlarged, settle to normal) on every change;
			     it is anchored at its right edge so the growth never pushes into the "/total". -->
			{@const counterY = titleSizes.height + GAP}
			{@const counterX = groupSizes.width / 2 - counterSizes.width / 2}
			{@const counterStyle = {
				fontFamily: 'Cinzel',
				fontWeight: '700',
				fontSize: counterFont,
				fill: GOLD_GRADIENT,
				align: 'center',
				letterSpacing: counterFont * 0.03,
			}}
			<Container
				x={counterX + curSizes.width}
				y={counterY + counterSizes.height / 2}
				scale={popScale.current}
			>
				<Text
					anchor={{ x: 1, y: 0.5 }}
					text={`${current}`}
					onresize={(sizes) => (curSizes = sizes)}
					style={counterStyle}
				/>
			</Container>
			<Text
				x={counterX + curSizes.width}
				y={counterY}
				anchor={{ x: 0, y: 0 }}
				text={`/${total}`}
				onresize={(sizes) => (restSizes = sizes)}
				style={counterStyle}
			/>
		</Container>
	</FadeContainer>
</MainContainer>
