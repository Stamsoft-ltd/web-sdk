<script lang="ts" module>
	import type { Position, DuckKind } from '../game/types';

	export type EmitterEventDuckCollect =
		| { type: 'duckCollectShow'; positions: Position[] }
		| {
				type: 'duckCollectReveal';
				position: Position;
				kind: DuckKind;
				value: number;
				runningTotal: number;
		  }
		| { type: 'duckCollectFinish'; amount: number }
		| { type: 'duckCollectHide' };
</script>

<script lang="ts">
	import { Tween } from 'svelte/motion';
	import { backOut } from 'svelte/easing';
	import {
		AnimatedSprite,
		BitmapText,
		Container,
		FillGradient,
		Graphics,
		Sprite,
		Text,
		type Texture,
	} from 'pixi-svelte';
	import { MainContainer } from 'components-layout';
	import { FadeContainer } from 'components-pixi';
	import { waitForTimeout } from 'utils-shared/wait';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { CELL_W, SYMBOL_H, BOARD_GRID_OFFSET_Y } from '../game/constants';

	type ActiveReveal = { position: Position; kind: DuckKind; value: number };

	const context = getContext();
	const layout = $derived(context.stateGameDerived.boardLayout());

	let show = $state(false);
	let runningTotal = $state(0);
	let finalAmount = $state<number | null>(null);
	let active = $state<ActiveReveal | null>(null);

	// Each reveal is the gift moment: the duck unwraps the box over the DC symbol's cell (36-frame
	// sheet from 'Duck present.mp4', 73 frames @24fps = 3.04s) and the value disc rises out of the
	// opened box. The whole thing — gift AND disc — clears together; nothing lingers over the duck
	// symbol afterwards. The banner above the board carries the running total.
	// Played 1.5× the authored rate — full speed dragged at ~3s per duck.
	const PRESENT_PLAYBACK = 1.5;
	const PRESENT_MS = Math.round(3040 / PRESENT_PLAYBACK);
	const PRESENT_SPEED = (36 / (3.04 * 60)) * PRESENT_PLAYBACK;
	const GIFT_SIZE = SYMBOL_H * 1.25;
	const REVEAL_HOLD_MS = 500;
	/** The open box's mouth inside the square sheet cell — see <DuckPondBonus>. */
	const BOX_MOUTH = { x: 0.445 - 0.5, y: (31 + 0.384 * 258) / 320 - 0.5 };
	let revealSpinning = $state(false);
	const discPop = new Tween(0);
	const presentFrames = $derived(
		(context.stateApp.loadedAssets?.duckPresentAnim ?? []) as Texture[],
	);

	const revealLabel = (reveal: ActiveReveal) =>
		reveal.kind === 'multmult' ? `×${reveal.value}` : `+${reveal.value}`;

	// Same disc as the pond reveal (Figma 6490:6675).
	const discFill = new FillGradient({
		type: 'linear',
		start: { x: 0, y: 0 },
		end: { x: 1, y: 1 },
		colorStops: [
			{ offset: 0, color: 0xd836fc },
			{ offset: 1, color: 0x272fdd },
		],
		textureSpace: 'local',
	});
	const discStyle = (fontSize: number) => ({
		fontFamily: 'Inter, Helvetica, Arial, sans-serif',
		fontWeight: '700' as const,
		fontSize,
		align: 'center' as const,
		fill: 0xffffff,
		letterSpacing: fontSize * 0.03,
	});

	context.eventEmitter.subscribeOnMount({
		duckCollectShow: () => {
			runningTotal = 0;
			finalAmount = null;
			active = null;
			revealSpinning = false;
			show = true;
		},
		// Sequential gift-open + disc rise per duck. Playback waits for each animation.
		duckCollectReveal: async (emitterEvent) => {
			active = {
				position: emitterEvent.position,
				kind: emitterEvent.kind,
				value: emitterEvent.value,
			};
			// <Board> hides the DC duck at this cell for the duration — the gift replaces it.
			context.stateGame.duckRevealPosition = emitterEvent.position;
			context.eventEmitter.broadcast({
				type: 'soundOnce',
				name: 'sfx_scatter_stop_1',
				forcePlay: true,
			});
			revealSpinning = true;
			discPop.set(0, { duration: 0 });
			// If the deferred sheet has not landed yet, don't stall the reveal on an empty stage.
			await waitForTimeout(presentFrames.length ? PRESENT_MS : 400);
			revealSpinning = false;
			await discPop.set(1, { duration: 380, easing: backOut });
			await waitForTimeout(REVEAL_HOLD_MS);
			runningTotal = emitterEvent.runningTotal;
			active = null;
			context.stateGame.duckRevealPosition = null;
		},
		duckCollectFinish: async (emitterEvent) => {
			finalAmount = emitterEvent.amount;
			runningTotal = emitterEvent.amount;
			await waitForTimeout(1400);
		},
		duckCollectHide: () => {
			show = false;
			finalAmount = null;
			active = null;
			revealSpinning = false;
			context.stateGame.duckRevealPosition = null;
		},
	});

	const cellX = (reel: number) => CELL_W * (reel + 0.5);
	const cellY = (row: number) => SYMBOL_H * (row + 0.5);

	const bannerY = $derived(layout.y - (layout.height / 2) * layout.boardScale - 46);
</script>

<FadeContainer {show}>
	<MainContainer>
		<!-- Board owns each DC symbol. The gift clip + rising disc play over the revealing one, then
		     clear together. -->
		<Container
			x={layout.x}
			y={layout.y + BOARD_GRID_OFFSET_Y}
			pivot={layout.pivot}
			scale={layout.boardScale}
		>
			{#if active}
				<Container x={cellX(active.position.reel)} y={cellY(active.position.row)}>
					{#if presentFrames.length}
						<AnimatedSprite
							textures={presentFrames}
							animationSpeed={PRESENT_SPEED}
							loop={false}
							play={revealSpinning}
							startFrame={revealSpinning ? 0 : presentFrames.length - 1}
							anchor={0.5}
							width={GIFT_SIZE}
							height={GIFT_SIZE}
						/>
					{/if}
					{#if !revealSpinning}
						{@const discR = GIFT_SIZE * 0.153}
						{@const rise = 1 - discPop.current}
						<Container
							x={GIFT_SIZE * BOX_MOUTH.x}
							y={GIFT_SIZE * BOX_MOUTH.y + GIFT_SIZE * 0.14 * rise}
							scale={Math.max(0.02, discPop.current)}
						>
							<Graphics
								draw={(graphics) => {
									graphics
										.circle(0, 0, discR)
										.fill({ fill: discFill })
										.stroke({ color: 0xffffff, width: Math.max(1, discR * 0.03) });
								}}
							/>
							<Text anchor={0.5} text={revealLabel(active)} style={discStyle(discR * 0.9)} />
						</Container>
					{/if}
				</Container>
			{/if}
		</Container>

		<!-- Running total banner above the board -->
		<Container x={layout.x} y={bannerY}>
			<Sprite key="forestBonusBadge" anchor={0.5} width={500} height={96} />
			<BitmapText
				anchor={{ x: 0.5, y: 0.5 }}
				y={-16}
				text={finalAmount !== null ? 'DUCKS COLLECTED!' : 'DUCK COLLECT'}
				style={{ fontFamily: 'gold', fontSize: 24 }}
			/>
			<BitmapText
				anchor={{ x: 0.5, y: 0.5 }}
				y={16}
				text={bookEventAmountToCurrencyString(runningTotal)}
				style={{ fontFamily: 'silver', fontSize: 28 }}
			/>
		</Container>
	</MainContainer>
</FadeContainer>
