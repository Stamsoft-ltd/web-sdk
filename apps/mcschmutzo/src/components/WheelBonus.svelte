<script lang="ts" module>
	import { ap } from '../lib/preloadArt';

	const wheelArt = ap('/assets/mcschmutzo/wheel/wheel.webp');
	const hatArt = ap('/assets/mcschmutzo/autoplay/hat.webp');

	// Segment centre angles (deg, clockwise from top) measured off the wheel art, with the
	// free-games value + steps for each (top = 6, then clockwise).
	const SEGMENTS = [
		{ a: 1.5, fg: 6, st: 3 },
		{ a: 53, fg: 30, st: 15 },
		{ a: 104.5, fg: 20, st: 10 },
		{ a: 155.5, fg: 15, st: 8 },
		{ a: 208.5, fg: 12, st: 3 },
		{ a: 260.5, fg: 10, st: 5 },
		{ a: 311.5, fg: 8, st: 4 },
	];
	const SPIN_MS = 2200;
</script>

<script lang="ts">
	import { getContext } from '../game/context';
	import { i18nDerived } from '../i18n/i18nDerived';

	const context = getContext();
	const wheel = $derived(context.stateGame.wheel);

	let rotation = $state(0);
	let spinning = $state(false);

	// Auto-spin to the RGS-resolved segment whenever a wheel result appears.
	$effect(() => {
		const w = context.stateGame.wheel;
		if (!w) {
			rotation = 0;
			spinning = false;
			return;
		}
		const idx = Math.max(
			0,
			SEGMENTS.findIndex((s) => s.fg === w.freeSpins),
		);
		rotation = 0;
		spinning = false;
		const frame = requestAnimationFrame(() => {
			spinning = true;
			rotation = 360 * 6 - SEGMENTS[idx].a; // bring that segment under the top pointer
		});
		return () => cancelAnimationFrame(frame);
	});
</script>

{#if wheel}
	<div class="wb-backdrop">
		<div class="wb-stage" role="dialog" aria-modal="true">
			<div class="wb-pointer"></div>

			<div class="wb-wheel">
				<div
					class="wb-rotor"
					style={`background-image:url('${wheelArt}'); transform: rotate(${rotation}deg); transition: transform ${spinning ? SPIN_MS : 0}ms cubic-bezier(0.16, 0.84, 0.24, 1)`}
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
		pointer-events: none;
	}

	.wb-stage {
		position: relative;
		display: flex;
		flex-direction: column;
		align-items: center;
		width: min(560px, 92vw);
	}

	.wb-wheel {
		position: relative;
		width: min(480px, 86vw);
		aspect-ratio: 1;
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
		padding: 13% 0 15%;
		text-align: center;
		pointer-events: none;
	}
	.wb-fg-num {
		font-family: 'Bowlby One SC', 'Bowlby One', sans-serif;
		font-size: clamp(15px, 4.4cqw, 30px);
		line-height: 0.9;
		color: #a5210f;
	}
	.wb-fg-text {
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(7px, 2cqw, 13px);
		letter-spacing: 0.03em;
		line-height: 1;
		color: #4a2c18;
		text-transform: uppercase;
	}
	.wb-steps {
		margin-top: auto;
		padding: 4% 8%;
		border-radius: 999px;
		background: linear-gradient(180deg, #c62d1a 0%, #9c1c0d 100%);
		color: #ffffff;
		font-family: 'Inter', sans-serif;
		font-weight: 700;
		font-size: clamp(7px, 1.9cqw, 12px);
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
		width: 20%;
		height: auto;
		z-index: 2;
		filter: drop-shadow(0 3px 4px rgba(0, 0, 0, 0.4));
		pointer-events: none;
	}

	/* Fixed pointer at the top, aimed down into the wheel. */
	.wb-pointer {
		position: absolute;
		left: 50%;
		top: -2%;
		z-index: 3;
		width: 5.5%;
		aspect-ratio: 3 / 4;
		transform: translateX(-50%);
		background: linear-gradient(180deg, #f2ede0 0%, #d9d2c2 100%);
		border: 2px solid #6d3b2a;
		border-radius: 30% 30% 12% 12%;
		clip-path: polygon(0 0, 100% 0, 100% 62%, 50% 100%, 0 62%);
		box-shadow: 0 3px 6px rgba(0, 0, 0, 0.4);
	}
</style>
