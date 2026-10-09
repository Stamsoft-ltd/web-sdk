<script lang="ts">
	import { RULES_SCREWS, SCREW_FRAMES, type Screw } from '../game/popupScrews';

	type Props = {
		/** Which frame art the dialog draws (game/popupScrews, built by scripts/build-popup-screws.py). */
		frame: keyof typeof SCREW_FRAMES | 'rules';
		/** ms before the first screw turns: popIn's delay + duration, so they turn once the pop lands. */
		delay?: number;
	};
	const { frame, delay = 500 }: Props = $props();

	// The frame's screws get driven home: once the dialog has popped in, each one turns a quarter
	// turn (with a little overshoot, one after the other). Each is a copy of the screw baked into
	// the frame art, drawn over it in the frame's own coordinates, so at rest nothing changes; its
	// round head hides the baked one at any angle. Lay this right over the frame <img> (same box).
	const corners = ['tl', 'tr', 'bl', 'br'] as const;
</script>

{#snippet screw(s: Screw, i: number)}
	<!-- turns about the head's centre: moved there, spun about its own origin, moved back -->
	<g transform={`translate(${s.cx} ${s.cy})`}>
		<g class="ps-turn" style={`animation-delay:${delay + i * 70}ms`}>
			<g transform={`translate(${-s.cx} ${-s.cy})`}>
				{@html s.svg}
			</g>
		</g>
	</g>
{/snippet}

{#if frame === 'rules'}
	<!-- 9-slice frame: each screw in its 82 × 82 corner, which border-image draws 1:1 at --k -->
	{#each corners as c, i (c)}
		{@const s = RULES_SCREWS[c]}
		<svg class={`ps ps--corner ps--${c}`} viewBox={`${s.ox} ${s.oy} 82 82`} aria-hidden="true">
			{@render screw(s, i)}
		</svg>
	{/each}
{:else}
	{@const f = SCREW_FRAMES[frame]}
	<svg class="ps" viewBox={`0 0 ${f.w} ${f.h}`} preserveAspectRatio={f.par} aria-hidden="true">
		{#each f.screws as s, i (i)}
			{@render screw(s, i)}
		{/each}
	</svg>
{/if}

<style>
	.ps {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.ps--corner {
		inset: auto;
		width: calc(82 * var(--k));
		height: calc(82 * var(--k));
		z-index: 3;
	}
	.ps--tl {
		left: 0;
		top: 0;
	}
	.ps--tr {
		right: 0;
		top: 0;
	}
	.ps--bl {
		left: 0;
		bottom: 0;
	}
	.ps--br {
		right: 0;
		bottom: 0;
	}
	.ps-turn {
		animation: ps-turn 0.42s cubic-bezier(0.3, 1.45, 0.55, 1) both;
	}
	@keyframes ps-turn {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(90deg);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.ps-turn {
			animation: none;
		}
	}
</style>
