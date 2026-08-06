<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		amount: number;
		children: Snippet<[{ alpha: number }]>;
	};

	const props: Props = $props();
</script>

<!--
	The amount fade is OFF: children are always rendered fully opaque. The tweened alpha this used to
	compute (fade in on amount > 0, fade out on amount <= 0) was already discarded by the hardcoded
	`alpha: 1` below, so none of it ever reached the screen. Removed rather than left reading as
	live; restore it from git history if the fade is ever wanted back.
-->
{@render props.children({ alpha: 1 })}
