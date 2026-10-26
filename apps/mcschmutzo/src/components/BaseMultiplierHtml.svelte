<script lang="ts">
	import { untrack } from 'svelte';
	import { stateUi } from 'state-shared';
	import { getContext } from '../game/context';
	import { potState } from '../game/potState.svelte';
	import { boardFrameScreenRect } from '../game/boardLogo';
	import { showBaseMultiplier, baseMultiplierPlacement, baseMultiplierLanding } from '../game/multiplierPresentation';
	import { i18nDerived } from '../i18n/i18nDerived';
	import { ap } from '../lib/preloadArt';
	const context = getContext();
	const potArt = ap('/assets/mcschmutzo/special-pot-v3.webp');
	const visible = $derived(
		context.stateGame.boardLanded &&
			!stateUi.freeSpinCounterShow &&
			showBaseMultiplier(
				context.stateGame.bonusMode,
				context.stateGame.lockedPositions.length,
				context.stateGame.globalMultiplier,
			),
	);
	const place = $derived(
		baseMultiplierPlacement(
			context.stateLayoutDerived.layoutType(),
			boardFrameScreenRect(context),
			context.stateLayoutDerived.canvasSizes(),
		),
	);
	// Only this base badge owns its landing target. A bonus pot may replace it during transition.
	$effect(() => {
		if (!visible) return;
		const p = place;
		return untrack(() => {
			potState.rect = {
				x: p.left + 5, y: p.top, w: Math.min(p.h * 1.1, p.w * 0.42), h: p.h,
				landing: baseMultiplierLanding(p),
			};
			potState.html = true;
			const owned = potState.rect;
			return () => {
				if (potState.rect === owned) {
					potState.rect = null;
					potState.html = false;
				}
			};
		});
	});
</script>

{#if visible}
	<div
		class="base-mult"
		data-compact={place.w < 110}
		class:covered={context.stateGame.winOver || context.stateGame.freeSpinPopupShowing}
		style={`left:${place.left}px;top:${place.top}px;width:${place.w}px;height:${place.h}px;--h:${place.h}px;--w:${place.w}px;opacity:${1 - context.stateGame.winDim}`}
		role="status"
		aria-label={`${i18nDerived.translate('INFO MULT TITLE')} ${potState.mult}×`}
	>
		{#key potState.splash?.id}
			<img class:boost={Boolean(potState.splash)} src={potArt} alt="" draggable="false" />
		{/key}
		<div>
			<span>{i18nDerived.translate('INFO MULT TITLE')}</span><strong>{potState.mult}×</strong>
		</div>
	</div>
{/if}

<style>
	.base-mult {
		position: absolute;
		z-index: 7;
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 4px 6px;
		background: #1f1f1f;
		border-top: 2px solid #605553;
		border-radius: 8px;
		box-shadow: 0 3px 12px #0008;
		pointer-events: none;
		font-family: 'Nunito', sans-serif;
		color: #fff;
		box-sizing: border-box;
	}
	.base-mult img {
		width: min(calc(var(--h) * 1.1), calc(var(--w) * 0.42));
		height: 100%;
		object-fit: contain;
		flex-shrink: 0;
	}
	.base-mult div {
		flex: 1;
		min-width: 0;
		text-align: center;
		line-height: 1.05;
	}
	.base-mult span {
		display: block;
		font-weight: 800;
		font-size: clamp(8px, calc(var(--h) * 0.15), 13px);
	}
	.base-mult strong {
		display: block;
		color: #ffe278;
		font-weight: 900;
		font-size: clamp(18px, calc(var(--h) * 0.44), 38px);
		text-shadow: 0 2px 2px #000;
		margin-top: 2px;
	}
	.base-mult[data-compact='true'] span {
		display: none;
	}
	.covered {
		visibility: hidden;
	}
	.boost {
		animation: pot-hit 0.4s ease-out;
	}
	@keyframes pot-hit {
		30% {
			transform: scale(1.14, 0.9) translateY(-3px);
		}
		70% {
			transform: scale(0.98, 1.05);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.boost {
			animation: none;
		}
	}
</style>
