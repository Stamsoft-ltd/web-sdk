<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import { t } from '../i18n';
	let {
		title,
		close,
		children,
		locked = false,
		wide = false,
		presentation = false,
	}: {
		title: string;
		close: () => void;
		children: Snippet;
		locked?: boolean;
		wide?: boolean;
		presentation?: boolean;
	} = $props();
	let dialog: HTMLDialogElement;
	onMount(() => {
		const prior = document.activeElement as HTMLElement | null;
		dialog.showModal();
		return () => {
			dialog.close();
			prior?.focus();
		};
	});
</script>

<dialog
	bind:this={dialog}
	class:wide
	class:presentation
	aria-label={title}
	oncancel={(e) => {
		e.preventDefault();
		if (!locked) close();
	}}
>
	<div class="modal-head">
		<h2>{title}</h2>
		{#if !locked}<button class="icon-button" aria-label={t('CLOSE')} onclick={close}
				><Icon name="close" /></button
			>{/if}
	</div>
	<div class="modal-body">{@render children()}</div>
</dialog>
