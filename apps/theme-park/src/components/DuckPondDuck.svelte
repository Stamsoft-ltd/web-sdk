<script lang="ts">
	import {
		Container,
		FillGradient,
		Graphics,
		SpineEventEmitterProvider,
		SpineProvider,
		SpineSlot,
		SpineTrack,
		Sprite,
		Text,
	} from 'pixi-svelte';
	import { stateBetDerived, stateI18nDerived } from 'state-shared';
	import { bookEventAmountToCurrencyString } from 'utils-shared/amount';

	import { getContext } from '../game/context';
	import { stripEmptyCurrencyDecimals } from '../game/currency';
	import type { DuckKind } from '../game/types';

	type Prize = { kind: DuckKind; value: number };
	type Props = {
		x?: number;
		y?: number;
		size: number;
		variant: number;
		look: number;
		prize: Prize | null;
		revealing: boolean;
		turned?: boolean;
		batch?: boolean;
		/** Unpicked fake duck: darkened once it has turned so it reads as "not yours". */
		dimmed?: boolean;
		alpha?: number;
		onrevealcomplete?: () => void;
	};

	const props: Props = $props();
	const context = getContext();
	const ready = $derived(!!context.stateApp.loadedAssets?.duckPondTurn);
	let animationName = $state(`idle_${props.variant}`);
	let lookAnimationName = $state(`look_idle_${props.look}`);

	const idleName = $derived(`idle_${props.variant}`);
	const turnName = $derived(`${props.batch ? 'turn_batch' : 'turn'}_${props.variant}`);
	const backIdleName = $derived(`back_idle_${props.variant}`);
	const lookIdleName = $derived(`look_idle_${props.look}`);
	const lookTurnName = $derived(`look_${props.batch ? 'turn_batch' : 'turn'}_${props.look}`);
	const lookBackIdleName = $derived(`look_back_idle_${props.look}`);
	const loop = $derived(animationName === idleName || animationName === backIdleName);
	const formattedCurrencyLabel = $derived(
		bookEventAmountToCurrencyString((props.prize?.value ?? 0) * 100),
	);
	const label = $derived(
		props.prize?.kind === 'multmult'
			? `${props.prize.value}x`
			: stripEmptyCurrencyDecimals(formattedCurrencyLabel),
	);
	// Use the old +N.00 character count as the baseline, then enlarge the actual value by 30%.
	const previousLabelLength = $derived(
		props.prize?.kind === 'multmult' ? label.length : formattedCurrencyLabel.length + 1,
	);
	const labelSize = $derived(
		Math.round(Math.max(18, Math.min(42, 180 / previousLabelLength)) * 1.3),
	);

	$effect(() => {
		if (props.revealing) {
			animationName = turnName;
			lookAnimationName = lookTurnName;
		} else if (props.prize || props.turned) {
			animationName = backIdleName;
			lookAnimationName = lookBackIdleName;
		} else {
			animationName = idleName;
			lookAnimationName = lookIdleName;
		}
	});

	/** How big the prize badge reads on the duck, against the size the spine slot was laid out at. */
	const PRIZE_SCALE = 2;

	// Multiply tint for unpicked ducks. Pixi tints the whole rig, prize badge included, so this is
	// deliberately a soft shade rather than a heavy one: the decoy prizes must stay readable.
	const DIM_TINT = 0x8d88a4;
	const tint = $derived(props.dimmed ? DIM_TINT : 0xffffff);

	const prizeFill = new FillGradient({
		type: 'linear',
		start: { x: 0, y: 0 },
		end: { x: 1, y: 1 },
		colorStops: [
			{ offset: 0, color: 0xd836fc },
			{ offset: 1, color: 0x272fdd },
		],
		textureSpace: 'local',
	});
	const multAllFill = new FillGradient({
		type: 'linear',
		start: { x: 0, y: 0 },
		end: { x: 1, y: 1 },
		colorStops: [
			{ offset: 0, color: 0xffdc4f },
			{ offset: 0.48, color: 0xff5bc8 },
			{ offset: 1, color: 0x7c39ff },
		],
		textureSpace: 'local',
	});

	const completeTurn = (entry: { animation?: { name?: string } }) => {
		if (!props.revealing || entry.animation?.name !== turnName) return;
		animationName = backIdleName;
		props.onrevealcomplete?.();
	};
</script>

{#if ready}
	<SpineProvider
		x={props.x}
		y={props.y}
		key="duckPondTurn"
		height={props.size}
		alpha={props.alpha ?? 1}
		{tint}
	>
		<SpineTrack
			trackIndex={0}
			{animationName}
			{loop}
			timeScale={stateBetDerived.timeScale()}
			listener={{ complete: completeTurn }}
		/>
		<SpineTrack
			trackIndex={1}
			animationName={lookAnimationName}
			{loop}
			timeScale={stateBetDerived.timeScale()}
		/>
		<SpineEventEmitterProvider>
			<SpineSlot slotName="prize">
				{#if props.prize}
					<!-- Scaled as one piece rather than by re-sizing the circle, the value and the ALL
					     line separately: the badge is laid out in the spine slot's own units, and the
					     only thing that has to change is how big the whole thing reads on the duck. -->
					<Container scale={PRIZE_SCALE}>
						<Graphics
							draw={(graphics) => {
								graphics
									.circle(0, 0, 57)
									.fill({
										fill: props.prize?.kind === 'multmult' ? multAllFill : prizeFill,
									})
									.stroke({ color: 0xffffff, width: 4 });
							}}
						/>
						<Text
							anchor={0.5}
							y={props.prize.kind === 'multmult' ? -8 : 0}
							text={label}
							style={{
								fontFamily: 'Lilita One',
								fontWeight: '400',
								fontSize: labelSize,
								align: 'center',
								fill: 0xffffff,
								letterSpacing: labelSize * 0.01,
								stroke: { color: 0x2b0838, width: 3 },
								dropShadow: {
									color: 0x160525,
									alpha: 0.7,
									angle: Math.PI / 2,
									distance: 3,
									blur: 3,
								},
							}}
						/>
						{#if props.prize.kind === 'multmult'}
							<Text
								anchor={0.5}
								y={28}
								text={stateI18nDerived.translate('ALL')}
								style={{
									fontFamily: 'Lilita One',
									fontWeight: '400',
									fontSize: 18,
									align: 'center',
									fill: 0xffffff,
									letterSpacing: 2,
									stroke: { color: 0x5b176f, width: 2 },
								}}
							/>
						{/if}
					</Container>
				{/if}
			</SpineSlot>
		</SpineEventEmitterProvider>
	</SpineProvider>
{:else}
	<Sprite
		key={`duckPondDuck${props.variant}`}
		x={props.x}
		y={props.y}
		anchor={0.5}
		width={props.size * 0.97}
		height={props.size}
		alpha={props.alpha ?? 1}
		{tint}
	/>
{/if}
