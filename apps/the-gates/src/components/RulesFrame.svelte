<script lang="ts">
	import { UI_ART_ROOT } from '../game/art';
	// Nine-slice the original visible frame in CSS. Native PNG bytes unchanged;
	// corners keep their aspect, only straight rails/empty centre stretch.
	const xs = [99, 199, 1120],
		ys = [135, 235, 957];
	const widths = [100, 921, 100],
		heights = [100, 722, 100];
</script>

<div class="rules-native-frame" aria-hidden="true">
	{#each ys as y, row}{#each xs as x, column}<span
				style={`background-image:url('${UI_ART_ROOT}d883a.png');background-size:${(1319 / widths[column]) * 100}% ${(1193 / heights[row]) * 100}%;background-position:${(x / (1319 - widths[column])) * 100}% ${(y / (1193 - heights[row])) * 100}%`}
			></span>{/each}{/each}
</div>

<style>
	.rules-native-frame {
		position: absolute;
		inset: 0;
		z-index: -1;
		display: grid;
		grid-template-columns: 26px minmax(0, 1fr) 26px;
		grid-template-rows: 26px minmax(0, 1fr) 26px;
		pointer-events: none;
	}
	span {
		background-repeat: no-repeat;
		min-width: 0;
		min-height: 0;
	}
</style>
