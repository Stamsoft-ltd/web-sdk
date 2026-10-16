<script lang="ts">
	import { UI_ART_ROOT } from '../game/art';
</script>

<!-- Native image layers + crop geometry from 11291:151713. Source pixels untouched. -->
<div class="figma-logo" role="img" aria-label="The Gates" data-design-node="11291:151713">
	<img class="badge" src={`${UI_ART_ROOT}d7111.png`} alt="" />
	{#each ['bottom', 'left', 'right', 'top'] as side}
		<img class={`gem ${side}`} src={`${UI_ART_ROOT}61f00.png`} alt="" />
	{/each}
	<div class="the"><img src={`${UI_ART_ROOT}a8485.png`} alt="" /></div>
	<div class="gates"><img src={`${UI_ART_ROOT}0f6e5.png`} alt="" /></div>
</div>

<style>
	.figma-logo {
		position: relative;
		width: 197.58px;
		height: 148px;
	}
	img {
		position: absolute;
		display: block;
		pointer-events: none;
	}
	.badge {
		inset: 0;
		width: 100%;
		height: 100%;
	}
	.gem {
		width: 37.092px;
		height: 37.092px;
	}
	.bottom {
		left: 82px;
		top: 94px;
		width: 33px;
		height: 33px;
	}
	.left {
		left: 0;
		top: 61.15px;
	}
	.right {
		left: 160.49px;
		top: 60.96px;
	}
	.top {
		left: 82px;
		top: 18px;
		width: 34px;
		height: 34px;
	}
	.the,
	.gates {
		position: absolute;
		overflow: hidden;
	}
	.the {
		left: 66.1px;
		top: 39.66px;
		width: 65.37px;
		height: 26.442px;
	}
	.gates {
		left: 28.28px;
		top: 62.8px;
		width: 141.024px;
		height: 48.476px;
	}
	.the img {
		width: 100%;
		height: 139.44%;
		top: -19.72%;
	}
	.gates img {
		width: 100%;
		height: 163.72%;
		top: -31.1%;
	}
</style>
