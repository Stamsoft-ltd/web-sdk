<script lang="ts">
	import { i18n } from "@lingui/core";
	import { type Snippet } from "svelte";

	import { type Language } from 'state-shared';

	type Props = {
		lang: Language;
		children: Snippet;
	};

	const props: Props = $props();

	// Activate synchronously during setup — children render (and run their $effects) immediately,
	// so an onMount activation came too late and Lingui threw "translation without setting a locale",
	// killing the whole story tree ("Initialising..." forever).
	i18n.load('en', {});
	i18n.activate('en');
</script>

{@render props.children()}
