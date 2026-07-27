<script lang="ts">
	import { fade } from 'svelte/transition';
	import { onMount } from 'svelte';

	import { waitForTimeout } from 'utils-shared/wait';

	import LoaderImage from './LoaderImage.svelte';

	type Props = {
		maxWidth: number;
		backgroundColor: string;
		timeout: number;
		src: string;
		/** Optional readiness gate: when provided, the loader stays up until this is true (on top of the
		 *  branding minimum), so it never hides onto a not-yet-rendered (black) game. Omit to keep the
		 *  original fixed-timer behaviour. */
		ready?: boolean;
		oncomplete?: () => void;
	};

	const props: Props = $props();

	let loading = $state(true);
	let minElapsed = $state(false);
	let forceHide = $state(false);

	// Safety cap: never hold the loader longer than this even if `ready` never arrives (e.g. a failed
	// asset load) — better to surface the game than to hang on the loader forever.
	onMount(() => {
		const id = setTimeout(() => (forceHide = true), 20000);
		return () => clearTimeout(id);
	});

	$effect(() => {
		if (loading && (forceHide || (minElapsed && (props.ready ?? true)))) {
			loading = false;
			props.oncomplete?.();
		}
	});
</script>

{#if loading}
	<div class="wrap" transition:fade style="--wrap-background: {props.backgroundColor};">
		<div class="gif-loader-wrap" style="--loader-wrap-background: {props.backgroundColor};">
			<LoaderImage
				maxWidth={props.maxWidth}
				src={props.src}
				onload={async () => {
					await waitForTimeout(props.timeout);
					minElapsed = true;
				}}
			/>
		</div>
	</div>
{/if}

<style lang="scss">
	.wrap {
		position: absolute;
		width: 100%;
		height: 100%;
		top: 0;
		left: 0;
		z-index: 999;
		background-color: black;
		overflow: hidden;
		background-color: var(--wrap-background);
	}

	.gif-loader-wrap {
		background-color: var(--loader-wrap-background);
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		z-index: 1;
		display: flex;
		justify-content: center;
		align-items: center;
	}
</style>
