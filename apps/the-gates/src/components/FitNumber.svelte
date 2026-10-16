<script lang="ts">
	import { untrack } from 'svelte';
	import { numericSlotEm, numericTextEm } from '../game/numberFit';
	import { measureNumericEm, invalidateNumericMeasurements } from '../game/numberMeasure';
	let { text, finalText = text }: { text: string; finalText?: string } = $props();
	let element = $state<HTMLSpanElement>();
	let measured = $state<{ text: string; em: number }>();
	const reserve = $derived(numericTextEm(text) > numericTextEm(finalText) ? text : finalText);
	const em = $derived(measured?.text === reserve ? measured.em : numericSlotEm(text, finalText));
	let remeasure = () => {};
	$effect(() => {
		const node = element;
		if (!node) return;
		let disposed = false;
		const measure = () => {
			if (disposed) return;
			const value = untrack(() => reserve);
			const font = getComputedStyle(node),
				base = parseFloat(font.fontSize);
			if (!base) return;
			const width = measureNumericEm(
				`${font.fontStyle} ${font.fontWeight} ${font.fontSize} ${font.fontFamily}`,
				base,
				value,
			);
			if (width !== undefined)
				untrack(() => {
					if (measured?.text !== value || measured.em !== width)
						measured = { text: value, em: width };
				});
		};
		remeasure = measure;
		untrack(measure);
		const observer = new ResizeObserver(measure);
		observer.observe(node);
		const fontLoaded = (event: object) => {
			if (disposed) return;
			invalidateNumericMeasurements(event);
			measure();
		};
		document.fonts.ready.then(fontLoaded);
		document.fonts.addEventListener('loadingdone', fontLoaded);
		return () => {
			disposed = true;
			remeasure = () => {};
			observer.disconnect();
			document.fonts.removeEventListener('loadingdone', fontLoaded);
		};
	});
	$effect(() => {
		reserve;
		element;
		untrack(() => remeasure());
	});
</script>

<!-- Inline inheritance avoids legacy HUD span styles treating these digits as labels. -->
<span
	class="number-fit"
	bind:this={element}
	data-fitted-number={text}
	style={`--number-em:${em};display:block;width:100%;min-width:0;max-width:100%;font:inherit;color:inherit;letter-spacing:0;line-height:inherit;margin:0;text-transform:none;`}
>
	<span
		class="number-glyphs"
		style="display:block;font:inherit;font-size:min(1em,calc(94cqw / var(--number-em)));color:inherit;letter-spacing:0;line-height:inherit;margin:0;text-transform:none;"
		>{text}</span
	>
</span>

<style>
	.number-fit {
		display: block;
		width: 100%;
		min-width: 0;
		max-width: 100%;
		container-type: inline-size;
		text-align: inherit;
	}
	.number-glyphs {
		display: block;
		white-space: nowrap;
		font-variant-numeric: tabular-nums;
	}
</style>
