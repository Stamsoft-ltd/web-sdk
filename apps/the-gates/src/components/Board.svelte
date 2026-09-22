<script lang="ts">
	import { runtime } from '../game/playback.svelte';
	import { cellMotion } from '../game/motion';
	import { posKey } from '../game/contract';
	import Symbol from './Symbol.svelte';
	const winning = $derived(new Set(runtime.game.wins.flatMap((w) => w.positions.map(posKey))));
	const removed = $derived(new Set(runtime.removed.map(posKey)));
	const sticky = $derived(new Set(runtime.game.sticky.map(posKey)));
</script>

<div class="board-shell" class:gate-flash={runtime.phase === 'gate'}>
	<span class="corner tl"></span><span class="corner tr"></span><span class="corner bl"></span><span
		class="corner br"
	></span>
	<div class="runes" aria-hidden="true">ᚷ · ᛟ · ᚹ · ᚠ · ᛞ · ᚷ · ᛟ · ᚹ · ᚠ · ᛞ</div>
	<div
		class="board"
		role="img"
		aria-label="6 columns, 5 rows. Pay anywhere."
		data-testid="board"
		data-phase={runtime.phase}
		data-skipped={runtime.skipRequested}
		data-wave-speed={runtime.wave.speed}
		class:spinning={runtime.phase === 'spinning'}
	>
		{#each runtime.game.board as col, reel}<div class="reel">
				{#each col as cell, row}
					{@const key = `${reel}:${row}`}
					{@const offset = runtime.game.fallOffsets[reel][row]}
					{@const motion = cellMotion(runtime.wave, reel, row, offset)}
					<div
						class="cell"
						class:winning={winning.has(key)}
						class:removing={removed.has(key)}
						class:sticky={sticky.has(key)}
						class:key-symbol={cell?.name === 'KEY'}
						data-symbol={cell?.name ?? 'EMPTY'}
					>
						{#if sticky.has(key)}<div class="symbol-motion"><Symbol name="WILD" decorative /></div>
						{:else}{#key runtime.game.revealId}<div
									class="symbol-motion"
									class:drop={runtime.phase === 'dropping' && offset !== 0}
									style={`--motion-delay:${motion.delay}ms;--motion-duration:${motion.duration}ms;--drop:${motion.offset}%;--impact-delay:${motion.delay + motion.duration}ms;--impact-duration:${motion.impact}ms;`}
								>
									{#if cell}<Symbol name={cell.name} decorative />{/if}
								</div>{/key}{/if}
						{#if cell?.name === 'WILD'}<span class="symbol-tag">WILD</span>{/if}
					</div>
				{/each}
			</div>{/each}
	</div>
	<div class="runes bottom" aria-hidden="true">◆ ━━━━━━━━━ ◆ ━━━━━━━━━ ◆</div>
</div>
