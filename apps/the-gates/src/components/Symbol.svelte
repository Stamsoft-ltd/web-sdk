<script lang="ts">
	import { SYMBOLS, type SymbolName } from '../game/contract';
	let { name, decorative = false }: { name: SymbolName; decorative?: boolean } = $props();
	const index = $derived(SYMBOLS.indexOf(name));
</script>

<span
	class="symbol"
	role={decorative ? undefined : 'img'}
	aria-label={decorative ? undefined : name.replaceAll('_', ' ')}
	aria-hidden={decorative ? 'true' : undefined}
	style={`--clip:${index >= 5 && index <= 9 ? 'inset(0 0 8%)' : 'none'};background-image:url('./assets/the-gates/symbols.png');--sx:${((index % 4) * 100) / 3}%;--sy:${Math.floor(index / 4) * 50}%`}
></span>

<style>
	.symbol {
		display: block;
		width: 100%;
		height: 100%;
		background-size: 400% 300%;
		background-position: var(--sx) var(--sy);
		background-repeat: no-repeat;
		clip-path: var(--clip);
		filter: drop-shadow(0 5px 4px #0008);
	}
</style>
