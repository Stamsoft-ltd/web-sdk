<script lang="ts">
	import { onMount, type Snippet } from 'svelte';
	import Icon from './Icon.svelte';
	import { t } from '../i18n';
	import { UI_ART_ROOT } from '../game/art';
	import { installModalFocus } from '../game/modalFocus';
	let {
		title,
		close,
		children,
		locked = false,
		wide = false,
		presentation = false,
		scrollable = false,
		rules = false,
		compact = false,
		framed = false,
		fitted,
	}: {
		title: string;
		close: () => void;
		children: Snippet;
		locked?: boolean;
		wide?: boolean;
		presentation?: boolean;
		scrollable?: boolean;
		rules?: boolean;
		compact?: boolean;
		framed?: boolean;
		fitted?: { width: number; height: number; scale: number; columns: number };
	} = $props();
	let overlay: HTMLDivElement;
	onMount(() => installModalFocus(overlay, { close, locked }));
</script>

<div
	class="modal-overlay"
	bind:this={overlay}
	role="dialog"
	aria-modal="true"
	aria-label={title}
	tabindex="-1"
	data-pixi-overlay
>
	{#if !locked}<button
			class="modal-screen-close icon-button"
			aria-label={t('CLOSE')}
			onclick={close}><Icon name="close" /></button
		>{/if}
	<div
		class="cartoon-modal"
		class:asset-confirm={framed}
		class:rules
		class:long-content={scrollable}
		class:wide
		class:presentation
		class:compact-confirm={compact}
		class:fit-wide={!!fitted}
		style={fitted
			? `width:${fitted.width * fitted.scale}px;height:${fitted.height * fitted.scale}px;--buy-columns:${fitted.columns}`
			: undefined}
	>
		<div
			class="modal-content"
			class:fitted={!!fitted}
			style={fitted
				? `width:${fitted.width}px;height:${fitted.height}px;zoom:${fitted.scale}`
				: undefined}
		>
			<div class="modal-frame" aria-hidden="true">
				<img src={`${UI_ART_ROOT}51301.png`} alt="" />
			</div>
			<div class="modal-head"><h2>{title}</h2></div>
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="modal-body"
				tabindex={scrollable ? 0 : undefined}
				role={scrollable ? 'region' : undefined}
				aria-label={scrollable ? title : undefined}
			>
				{@render children()}
			</div>
		</div>
	</div>
</div>

<style>
	.modal-content {
		display: contents;
	}
	.modal-content.fitted {
		display: flex;
		flex-direction: column;
		padding: 24px;
	}
</style>
