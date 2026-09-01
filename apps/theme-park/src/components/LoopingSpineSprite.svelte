<script lang="ts">
	import { SpineProvider, SpineTrack, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = {
		assetKey: string;
		fallbackKey: string;
		animationName: string;
		overlayAnimationName?: string;
		x?: number;
		y?: number;
		width: number;
		height: number;
		alpha?: number;
		/**
		 * Seconds into the clip to start from, for clips that open on a held frame. Re-applied
		 * whenever the track's other props change, so a rig parked at timeScale 0 and then released
		 * always starts from here rather than from wherever it was left.
		 */
		startTime?: number;
		timeScale?: number;
		loop?: boolean;
		restartKey?: string | number;
	};

	const props: Props = $props();
	const context = getContext();
	const spineData = $derived(
		context.stateApp.loadedAssets?.[props.assetKey] as
			| {
					findAnimation?: (name: string) => unknown;
					animations?: { name: string }[];
			  }
			| undefined,
	);
	const hasAnimation = (animationName: string) => {
		if (!spineData) return false;
		if (typeof spineData.findAnimation === 'function') {
			return !!spineData.findAnimation(animationName);
		}
		return spineData.animations?.some(({ name }) => name === animationName) ?? false;
	};
	const ready = $derived.by(() => {
		if (!hasAnimation(props.animationName)) return false;
		return props.overlayAnimationName ? hasAnimation(props.overlayAnimationName) : true;
	});
</script>

{#if ready}
	<SpineProvider
		key={props.assetKey}
		x={props.x}
		y={props.y}
		width={props.width}
		height={props.height}
		alpha={props.alpha ?? 1}
	>
		{#key `${props.animationName}:${props.restartKey ?? ''}`}
			<SpineTrack
				trackIndex={0}
				animationName={props.animationName}
				loop={props.loop ?? true}
				trackTime={props.startTime ?? 0}
				timeScale={props.timeScale ?? 1}
			/>
		{/key}
		{#if props.overlayAnimationName}
			{#key `${props.overlayAnimationName}:${props.restartKey ?? ''}`}
				<SpineTrack
					trackIndex={1}
					animationName={props.overlayAnimationName}
					loop={props.loop ?? true}
					timeScale={props.timeScale ?? 1}
				/>
			{/key}
		{/if}
	</SpineProvider>
{:else}
	<Sprite
		key={props.fallbackKey}
		x={props.x}
		y={props.y}
		anchor={0.5}
		width={props.width}
		height={props.height}
		alpha={props.alpha ?? 1}
	/>
{/if}
