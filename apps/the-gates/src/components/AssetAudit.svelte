<script lang="ts">
	import { onMount } from 'svelte';
	import { assetLoadActivity } from '../game/imageAssets';
	import { emptyAssetAudit, recordAssetResource } from '../game/assetAudit';
	const totals = emptyAssetAudit();
	let delta = $state({ ...totals, ...assetLoadActivity() });
	let actions = $state(0);
	onMount(() => {
		const resources = new PerformanceObserver((list) => {
			for (const entry of list.getEntries())
				recordAssetResource(totals, entry as PerformanceResourceTiming);
		});
		resources.observe({ type: 'resource', buffered: true });
		const symbolsIn = (node: Node) =>
			node instanceof Element
				? Number(node.matches('.symbol')) + node.querySelectorAll('.symbol').length
				: 0;
		const mutations = new MutationObserver((records) => {
			for (const record of records) {
				if (record.type === 'attributes' && record.target instanceof HTMLImageElement)
					totals.imageSrcChanges++;
				for (const node of record.addedNodes) totals.symbolAdds += symbolsIn(node);
				for (const node of record.removedNodes) totals.symbolRemoves += symbolsIn(node);
			}
		});
		mutations.observe(document.body, {
			subtree: true,
			childList: true,
			attributes: true,
			attributeFilter: ['src'],
		});
		let timer: ReturnType<typeof setTimeout> | undefined;
		let before = { ...totals, ...assetLoadActivity() };
		const click = (event: MouseEvent) => {
			if (!(event.target instanceof Element) || !event.target.closest('button')) return;
			if (timer === undefined) before = { ...totals, ...assetLoadActivity() };
			else clearTimeout(timer);
			timer = setTimeout(() => {
				const after = { ...totals, ...assetLoadActivity() };
				for (const key of Object.keys(after) as (keyof typeof after)[]) after[key] -= before[key];
				delta = after;
				actions++;
				timer = undefined;
			}, 750);
		};
		document.addEventListener('click', click, true);
		return () => {
			resources.disconnect();
			mutations.disconnect();
			document.removeEventListener('click', click, true);
			if (timer !== undefined) clearTimeout(timer);
		};
	});
</script>

<output data-asset-audit={JSON.stringify(delta)}>
	Action {actions}: loader images {delta.imageStarts} · fetches {delta.fetchStarts} · failed {delta.imageFailures}
	<br />Asset entries {delta.resources} · transferred {(delta.transferredBytes / 1024).toFixed(1)} KiB
	· cached {delta.cachedResources} · unknown {delta.unknownResources}
	<br />DOM image src writes {delta.imageSrcChanges} · symbols +{delta.symbolAdds}/−{delta.symbolRemoves}
</output>

<style>
	output {
		position: fixed;
		left: 4px;
		bottom: 4px;
		z-index: 100;
		pointer-events: none;
		font: 11px/1.4 monospace;
		background: #081529e8;
		color: #fff;
		padding: 5px;
	}
</style>
