<script lang="ts">
	let { name }: { name: 'sound' | 'music' | 'info' } = $props();
</script>

<svg
	viewBox="0 0 32 32"
	aria-hidden="true"
	fill="white"
	stroke="#031e3d"
	stroke-width="1.4"
	stroke-linejoin="round"
>
	{#if name === 'sound'}
		<path d="M4 12h6l8-7v22l-8-7H4a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z" />
		<path
			d="M22 10a9 9 0 0 1 0 12l-2-3a5 5 0 0 0 0-6Zm4-4a15 15 0 0 1 0 20l-2-3a11 11 0 0 0 0-14Z"
		/>
	{:else if name === 'music'}
		<path d="M12 5 29 2v20c0 7-10 9-10 2 0-4 4-6 7-5V9L15 11v13c0 7-11 9-11 2 0-4 5-7 8-5Z" />
	{:else}<circle cx="16" cy="7" r="4.5" /><rect x="12" y="14" width="8" height="16" rx="4" />{/if}
</svg>
