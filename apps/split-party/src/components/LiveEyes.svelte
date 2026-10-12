<svelte:options namespace="svg" />

<script module lang="ts">
	export type Eye = {
		hull: string;
		top: number;
		bottom: number;
		left: number;
		right: number;
		white: string;
		lid: string;
		px: number;
		py: number;
		pr: number;
		pupil: string;
	};
</script>

<script lang="ts">
	// Live eyes over painted art (data from scripts/build-eyes.py). Each eye is clipped to the
	// hull of its painted white and gets a pupil that glances around and a body-coloured lid
	// that blinks; brows, half-lids and outlines stay painted. Both eyes share one phase.
	let {
		eyes,
		id,
		lookDelay = '0s',
		blinkDelay = '0s',
		rim = 0,
	}: { eyes: Eye[]; id: string; lookDelay?: string; blinkDelay?: string; rim?: number } = $props();

	// The measured radius stops at the dark core; the painted pupil's soft edge is ~30% wider.
	const PUPIL = 1.3;
	// Stroke widths were tuned on the symbols, whose eyes are ~16 units wide.
	const unit = (e: Eye) => (e.right - e.left) / 16;
	const look = (e: Eye) =>
		`--lx:${(((e.right - e.left) / 2 - e.pr * PUPIL) * 0.5).toFixed(2)}px;` +
		`--ly:${(((e.bottom - e.top) / 2 - e.pr * PUPIL) * 0.3).toFixed(2)}px;animation-delay:${lookDelay}`;
</script>

{#each eyes as e, i}
	<clipPath id={`${id}-eye${i}`}><polygon points={e.hull} /></clipPath>
	<!-- rim: widen the white past the hull to cover painted pupil edges the hull missed. -->
	<polygon
		points={e.hull}
		fill={e.white}
		stroke={rim ? e.white : 'none'}
		stroke-width={rim * unit(e)}
		stroke-linejoin="round"
	/>
	<g clip-path={`url(#${id}-eye${i})`}>
		<g class="pupil" style={look(e)}>
			<circle cx={e.px} cy={e.py} r={e.pr * PUPIL} fill={e.pupil} />
			<circle cx={e.px + e.pr * 0.42} cy={e.py - e.pr * 0.42} r={e.pr * 0.34} fill="#fff" />
		</g>
	</g>
	<!-- Unclipped, with a stroke, so it also covers the eye's antialiased rim. -->
	<g class="lid" style={`animation-delay:${blinkDelay}`}>
		<polygon
			points={e.hull}
			fill={e.lid}
			stroke={e.lid}
			stroke-width={3.2 * unit(e)}
			stroke-linejoin="round"
		/>
		<path
			d={`M${e.left + 0.5 * unit(e)} ${(e.top + e.bottom) / 2}Q${(e.left + e.right) / 2} ${e.bottom + 1.5 * unit(e)} ${e.right - 0.5 * unit(e)} ${(e.top + e.bottom) / 2}`}
			fill="none"
			stroke={e.pupil}
			stroke-width={1.5 * unit(e)}
			stroke-linecap="round"
		/>
	</g>
{/each}

<style>
	/* Glance left, then right, back to centre; blink every ~4.4s. */
	.pupil {
		animation: eye-look 5.6s ease-in-out infinite;
	}
	.lid {
		transform-box: fill-box;
		transform-origin: 50% 0;
		transform: scaleY(0);
		animation: eye-blink 4.4s ease-in-out infinite;
	}
	@keyframes eye-look {
		0%,
		24% {
			transform: none;
		}
		30%,
		46% {
			transform: translate(calc(var(--lx) * -1), var(--ly));
		}
		54%,
		72% {
			transform: translate(var(--lx), calc(var(--ly) * -0.5));
		}
		80%,
		100% {
			transform: none;
		}
	}
	@keyframes eye-blink {
		0%,
		91%,
		100% {
			transform: scaleY(0);
		}
		94%,
		95.5% {
			transform: scaleY(1);
		}
	}
</style>
