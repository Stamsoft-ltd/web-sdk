<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const wheelBaseArt = ap('/assets/mcschmutzo/wheel/wheel-base.svg'); // cream 7-segment disc + red rim
	const hatArt = ap('/assets/mcschmutzo/wheel/wheel-hat.svg'); // chef-hat hub
	const spatulaArt = ap('/assets/mcschmutzo/wheel/wheel-spatula.svg'); // pointer at the top
	const spinBoxArt = ap('/assets/mcschmutzo/wheel/spin-button-box.svg'); // SPIN button frame

	// Segment centre angles (deg, clockwise from top) for the 7-segment wheel-base (top segment at 0°,
	// then every 360/7). Each carries its free-games value + steps.
	const STEP = 360 / 7;
	const SEGMENTS = [
		{ a: 0 * STEP, fg: 6, st: 3 },
		{ a: 1 * STEP, fg: 30, st: 15 },
		{ a: 2 * STEP, fg: 20, st: 10 },
		{ a: 3 * STEP, fg: 15, st: 8 },
		{ a: 4 * STEP, fg: 12, st: 3 },
		{ a: 5 * STEP, fg: 10, st: 5 },
		{ a: 6 * STEP, fg: 8, st: 4 },
	];
	const SPIN_MS = 2600;
</script>

<script lang="ts">
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	const context = getContext();
	const wheel = $derived(context.stateGame.wheel);

	let rotation = $state(0);
	let spinning = $state(false);
	let spun = $state(false);

	// Reset each time the wheel appears (or is cleared). No auto-spin — the player presses SPIN.
	$effect(() => {
		context.stateGame.wheel;
		rotation = 0;
		spinning = false;
		spun = false;
	});

	// Spin to the RGS-resolved segment: bring that segment under the top pointer after a few turns.
	const onSpin = () => {
		const w = context.stateGame.wheel;
		if (!w || spun) return;
		spun = true;
		const idx = Math.max(
			0,
			SEGMENTS.findIndex((s) => s.fg === w.freeSpins),
		);
		spinning = true;
		context.eventEmitter.broadcast({ type: 'soundOnce', name: 'sfx_multiplier_up' });
		requestAnimationFrame(() => {
			rotation = 360 * 6 - SEGMENTS[idx].a;
		});
	};

	// Once the wheel has physically settled, let the bonus flow continue into the free games.
	const onSettled = (e: TransitionEvent) => {
		if (e.propertyName !== 'transform' || !spinning) return;
		spinning = false;
		context.stateGame.wheelResolve?.();
	};
</script>

{#if wheel}
	<div class="wb-backdrop">
		<div class="wb-stage" role="dialog" aria-modal="true">
			<div class="wb-wheel-wrap">
				<div class="wb-wheel">
					<div
						class="wb-rotor"
						ontransitionend={onSettled}
						style={`background-image:url('${wheelBaseArt}'); transform: rotate(${rotation}deg); transition: transform ${spinning ? SPIN_MS : 0}ms cubic-bezier(0.16, 0.86, 0.22, 1)`}
					>
						{#each SEGMENTS as seg (seg.a)}
							<div class="wb-seg" style={`transform: rotate(${seg.a}deg)`}>
								<span class="wb-fg-num">{seg.fg}</span>
								<span class="wb-fg-text">{i18nDerived.translate('FREE GAMES')}</span>
								<span class="wb-steps">+{seg.st} {i18nDerived.translate('STEPS')}</span>
							</div>
						{/each}
					</div>

					<img class="wb-hat" src={hatArt} alt="" draggable="false" />
				</div>

				<!-- Spatula pointer, straddling the top edge of the wheel and aimed down into it. -->
				<img class="wb-spatula" src={spatulaArt} alt="" draggable="false" />
			</div>

			<button
				class="wb-spin"
				type="button"
				style={`background-image:url('${spinBoxArt}')`}
				disabled={spun}
				onclick={onSpin}
			>
				<span>{i18nDerived.translate('SPIN')}</span>
			</button>
		</div>
	</div>
{/if}

<style>
	.wb-backdrop {
		position: fixed;
		inset: 0;
		z-index: 45;
		display: grid;
		place-items: center;
		background: rgba(0, 0, 0, 0.5);
		backdrop-filter: blur(3px);
		pointer-events: auto;
	}

	/* Fill the whole viewport height: the spatula sits near the top of the screen and the SPIN button
	   at the bottom, with the wheel as big as the height (or width) allows in between. */
	.wb-stage {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: space-between;
		height: 100dvh;
		/* Top pad clears the overhanging spatula; bottom pad keeps the SPIN button off the edge. */
		padding: clamp(10px, 6dvh, 64px) 0 clamp(8px, 3dvh, 32px);
		box-sizing: border-box;
		width: min(96vw, 96dvh);
	}

	/* Wheel + its overhanging spatula pointer — sized to fill the available height (or width on a
	   narrow portrait screen). */
	.wb-wheel-wrap {
		position: relative;
		width: min(94vw, 84dvh);
		aspect-ratio: 1;
	}

	.wb-wheel {
		position: absolute;
		inset: 0;
	}

	/* Rotating disc: the wheel art + the segment labels turn together. */
	.wb-rotor {
		position: absolute;
		inset: 0;
		border-radius: 50%;
		background-size: 100% 100%;
		background-repeat: no-repeat;
		container-type: size;
		will-change: transform;
	}

	/* Each label spans from the centre (pivot) out to the rim, rotated to its segment. */
	.wb-seg {
		position: absolute;
		left: 50%;
		bottom: 50%;
		width: 30%;
		height: 50%;
		margin-left: -15%;
		box-sizing: border-box;
		transform-origin: bottom center;
		display: flex;
		flex-direction: column;
		align-items: center;
		/* Top padding clears the red rim so the number lands in the cream; bottom padding keeps the
		   STEPS chip clear of the chef-hat hub. */
		padding: 18% 0 21%;
		text-align: center;
		pointer-events: none;
	}
	/* Segment type is sized in cqw so it scales with the wheel; the floors are kept low so a small
	   wheel (portrait phones, the 400×225 landscape popout) keeps the same proportions as the big
	   desktop wheel instead of the floor blowing the text past the narrow wedges. */
	.wb-fg-num {
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-size: clamp(7px, 4.7cqw, 30px);
		line-height: 0.9;
		color: #a5210f;
		text-shadow: 0 1px 0 rgba(255, 244, 224, 0.6);
	}
	.wb-fg-text {
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(3px, 1.7cqw, 12px);
		letter-spacing: 0.02em;
		line-height: 1;
		color: #4a2c18;
		text-transform: uppercase;
	}
	.wb-steps {
		margin-top: auto;
		padding: 3% 6%;
		border-radius: 999px;
		background: linear-gradient(180deg, #c62d1a 0%, #9c1c0d 100%);
		color: #ffffff;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(3px, 1.5cqw, 11px);
		line-height: 1.05;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.35);
		white-space: nowrap;
	}

	/* Chef-hat hub over the wheel centre. */
	.wb-hat {
		position: absolute;
		left: 50%;
		top: 50%;
		transform: translate(-50%, -50%);
		width: 24%;
		height: auto;
		z-index: 2;
		filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.4));
		pointer-events: none;
	}

	/* Spatula pointer straddling the top edge, aimed down into the wheel. */
	.wb-spatula {
		position: absolute;
		left: 50%;
		top: -6%;
		width: 19%;
		height: auto;
		transform: translateX(-50%);
		z-index: 3;
		filter: drop-shadow(0 3px 5px rgba(0, 0, 0, 0.4));
		pointer-events: none;
	}

	/* SPIN button below the wheel (spin-button-box art + centred label), ~half the wheel width. */
	.wb-spin {
		width: min(200px, 45vw);
		aspect-ratio: 203 / 40;
		border: 0;
		padding: 0;
		background: transparent center / 100% 100% no-repeat;
		cursor: pointer;
		display: grid;
		place-items: center;
		/* Query context so the SPIN label scales with the button, not the viewport — the vmin sizing
		   floored the text far too big on the tiny landscape button. */
		container-type: inline-size;
		transition:
			filter 0.12s ease,
			transform 0.08s ease;
	}
	.wb-spin span {
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-weight: 400;
		font-size: clamp(7px, 10.5cqw, 20px);
		letter-spacing: 0.08em;
		color: #fff;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
		text-transform: uppercase;
	}
	.wb-spin:not(:disabled):hover {
		filter: brightness(1.08);
	}
	.wb-spin:not(:disabled):active {
		transform: scale(0.97);
	}
	.wb-spin:disabled {
		opacity: 0.5;
		cursor: default;
	}

	/* Short screens (mobile landscape): tighten the padding and cap the square wheel a bit lower so the
	   spatula + wheel + SPIN button all still fit the height. */
	@media (max-height: 500px) {
		.wb-stage {
			padding: clamp(6px, 4dvh, 26px) 0 clamp(4px, 2dvh, 14px);
		}
		.wb-wheel-wrap {
			width: min(94vw, 76dvh);
		}
		.wb-spin {
			width: min(170px, 34dvh);
		}
	}
</style>
