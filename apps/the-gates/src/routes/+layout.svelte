<script lang="ts">
	import type { Snippet } from 'svelte';
	let { children }: { children: Snippet } = $props();
	import { page } from '$app/state';
	import { dev } from '$app/environment';
	import Authenticate from 'components-shared/src/components/Authenticate.svelte';
	import LoadI18n from 'components-shared/src/components/LoadI18n.svelte';
	import messagesMap from '../i18n';
	import Game from '../components/Game.svelte';
	import '../style.css';
	import '../figma.css';
	const demo = $derived(dev && page.url.searchParams.get('preview') === 'true');
</script>

{#if demo}<LoadI18n {messagesMap}><Game demo /></LoadI18n>
{:else}<Authenticate><LoadI18n {messagesMap}><Game /></LoadI18n></Authenticate>{/if}

{@render children()}
