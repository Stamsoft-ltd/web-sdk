<script lang="ts">
	import { onMount } from 'svelte';
	import { useGpu } from '../game/gpuContext';
	import type { createWelcomeScene } from '../game/gpuScene';
	import {
		fitWelcome,
		WELCOME_CARDS,
		welcomeSlide,
		welcomeSwipe,
		startWelcomeRotation,
	} from '../game/welcome';
	import { t } from '../i18n';
	const gpu = useGpu();
	let host = $state<HTMLElement>();
	let renderer = $state.raw<ReturnType<typeof createWelcomeScene>>();
	let {
		width,
		height,
		reduced = false,
		demo = false,
		enter,
		leavingAt = 0,
		active = true,
		onready = () => {},
		logoTarget,
	}: {
		width: number;
		height: number;
		reduced?: boolean;
		demo?: boolean;
		enter: () => void;
		leavingAt?: number;
		active?: boolean;
		onready?: () => void;
		logoTarget?: HTMLElement;
	} = $props();
	const layout = $derived(fitWelcome(width, height));
	let slide = $state(0),
		hovered = $state(false),
		visible = $state(true),
		restart = $state(0);
	let swiped = false;
	let pointer: { id: number; x: number; y: number } | null = null;
	function move(direction: number) {
		slide = welcomeSlide(slide, direction);
		restart++;
	}
	onMount(() => {
		const changed = () => {
			visible = document.visibilityState !== 'hidden';
		};
		changed();
		document.addEventListener('visibilitychange', changed);
		return () => document.removeEventListener('visibilitychange', changed);
	});
	$effect(() => {
		void restart;
		if (!layout.portrait || reduced || hovered || !visible) return;
		return startWelcomeRotation(() => {
			slide = welcomeSlide(slide, 1);
		});
	});

	$effect(() => {
		const engine = gpu.engine,
			target = host;
		if (!engine || !target) return;
		let dead = false,
			owned: ReturnType<typeof createWelcomeScene> | undefined;
		void import('../game/gpuScene')
			.then(({ createWelcomeScene }) => {
				if (dead) return;
				owned = createWelcomeScene(
					engine,
					target,
					(error) => {
						if (!dead) gpu.error = String(error);
					},
					() => {
						if (!dead) onready();
					},
				);
				renderer = owned;
			})
			.catch((error) => {
				if (!dead) gpu.error = String(error);
			});
		return () => {
			dead = true;
			owned?.destroy();
			renderer = undefined;
		};
	});
	$effect(() => {
		renderer?.update({
			width,
			height,
			slide,
			reduced,
			demo,
			leavingAt,
			logoTarget,
			active,
			translate: t,
		});
	});
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions: full-screen button supplies keyboard access -->
<!-- Invisible HTML input targets preserve keyboard, swipe and screen-reader access. Artwork is GPU-only. -->
<div
	class="gates-welcome"
	class:leaving={!!leavingAt}
	style:pointer-events={active ? undefined : 'none'}
	bind:this={host}
	data-renderer="pixi-webgl"
	class:portrait={layout.portrait}
	onpointerdown={() => {
		swiped = false;
	}}
	onclick={(event) => {
		if (active && (!swiped || event.detail === 0)) enter();
	}}
>
	<button class="landing-enter" aria-label={t('CONTINUE')}></button>
	<div
		class="landing-stage"
		class:portrait={layout.portrait}
		class:compact={layout.compact}
		style={`width:${layout.width}px;height:${layout.height}px;zoom:${layout.scale};--entry-scale:${layout.scale}`}
	>
		<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions: carousel region supports keyboard and swipe navigation -->
		<section
			class="landing-viewport"
			aria-label={t('INTRO FEATURES')}
			aria-roledescription={layout.portrait ? t('CAROUSEL') : undefined}
			tabindex={layout.portrait ? 0 : -1}
			onpointerenter={(event) => {
				if (event.pointerType === 'mouse') hovered = true;
			}}
			onpointerleave={() => {
				hovered = false;
			}}
			onpointerdown={(event) => {
				if (layout.portrait && event.isPrimary && event.button === 0) {
					pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
					event.currentTarget.setPointerCapture(event.pointerId);
				}
			}}
			onpointerup={(event) => {
				if (pointer?.id === event.pointerId) {
					const direction = welcomeSwipe(event.clientX - pointer.x, event.clientY - pointer.y);
					if (direction) {
						swiped = true;
						move(direction);
					}
					pointer = null;
				}
			}}
			onpointercancel={() => {
				pointer = null;
			}}
			onkeydown={(event) => {
				if (layout.portrait && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
					event.preventDefault();
					event.stopPropagation();
					move(event.key === 'ArrowRight' ? 1 : -1);
				}
			}}
		>
			<div class="accessible-copy" aria-live="off">
				{#each WELCOME_CARDS as card, index}<p aria-hidden={layout.portrait && slide !== index}>
						{t(card.value)}: {t(card.text)}
					</p>{/each}
			</div>
		</section>
		{#if layout.portrait}<nav class="landing-pagination" aria-label={t('INTRO FEATURES')}>
				{#each WELCOME_CARDS as card, index}<button
						aria-label={`${t('FEATURE CARD')} ${index + 1}: ${t(card.text)}`}
						aria-current={slide === index ? 'true' : undefined}
						onclick={() => {
							slide = index;
							restart++;
						}}
					></button>{/each}
			</nav>{/if}
	</div>
</div>

<style>
	.gates-welcome {
		position: fixed;
		inset: 0;
		z-index: 80;
		display: grid;
		place-items: center;
		overflow: hidden;
		overscroll-behavior: none;
	}
	.gates-welcome.leaving {
		pointer-events: none;
	}
	.gates-welcome.leaving :global(*) {
		pointer-events: none;
	}
	.landing-stage {
		position: relative;
		flex: none;
		z-index: 1;
		pointer-events: none;
	}
	.landing-viewport {
		position: absolute;
		top: 280px;
		left: 40px;
		width: 1120px;
		height: 307px;
		touch-action: manipulation;
		pointer-events: auto;
	}
	.landing-enter {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		cursor: pointer;
	}
	button {
		background: transparent;
		color: transparent;
		padding: 0;
		border: 0;
		box-shadow: none;
		pointer-events: auto;
	}
	button:hover {
		background: transparent;
		transform: none;
	}
	.compact .landing-viewport {
		top: 167px;
		left: 80px;
		width: 800px;
		height: 220px;
	}
	.portrait .landing-viewport {
		top: 200px;
		left: 18px;
		width: 324px;
		height: 267px;
	}
	.landing-pagination {
		position: absolute;
		top: 476px;
		left: 18px;
		width: 324px;
		display: flex;
		justify-content: center;
	}
	.landing-pagination button {
		width: 40px;
		height: max(36px, calc(44px / var(--entry-scale)));
	}
	button:focus-visible,
	.landing-viewport:focus-visible {
		outline: 2px solid #7ce9df;
		outline-offset: 3px;
	}
	.accessible-copy {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
