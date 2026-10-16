<script lang="ts">
	let { next = false }: { next?: boolean } = $props();
</script>

<svg
	class="rules-arrow"
	class:next-arrow={next}
	viewBox="0 0 52 20"
	aria-hidden="true"
	fill="none"
	stroke="white"
	stroke-width="3"
	stroke-linecap="round"
	stroke-linejoin="round"><path d="M49 10H3m9-8L3 10l9 8" /></svg
>

<style>
	.next-arrow {
		transform: rotate(180deg);
	}
</style>
