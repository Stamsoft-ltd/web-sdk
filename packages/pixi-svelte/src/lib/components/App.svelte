<script lang="ts">
	import { onMount, onDestroy, type Snippet } from 'svelte';

	import { getContextApp } from '../context.svelte';

	import InitialiseApplication from './InitialiseApplication.svelte';
	import InitialiseParent from './InitialiseParent.svelte';
	import AssetsLoader from './AssetsLoader.svelte';

	type Props = {
		children: Snippet;
		preloadWebFont?: boolean;
		// Renderer tuning forwarded to InitialiseApplication (all optional, default = historical).
		maxResolution?: number;
		antialias?: boolean;
		rendererPreference?: 'webgpu' | 'webgl';
	};

	const props: Props = $props();
	const context = getContextApp();

	onMount(() => context.stateApp.reset());
	onDestroy(() => context.stateApp.reset());
</script>

<InitialiseApplication
	preloadWebFont={props.preloadWebFont}
	maxResolution={props.maxResolution}
	antialias={props.antialias}
	rendererPreference={props.rendererPreference}
>
	{#if context.stateApp.pixiApplication}
		<InitialiseParent>
			<AssetsLoader>
				{@render props.children()}
			</AssetsLoader>
		</InitialiseParent>
	{/if}
</InitialiseApplication>
