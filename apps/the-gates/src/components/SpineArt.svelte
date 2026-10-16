<script lang="ts">
	import { untrack } from 'svelte';
	import { loadRig } from '../game/spine';
	import { useGpu } from '../game/gpuContext';
	import { portalRemovalTracks, PORTAL_SECONDS } from '../game/portalAnimation';
	import { landingProgress } from '../game/motion';
	import { ashProgress, type AshTiming } from '../game/symbolAsh';
	import type { GpuPose } from '../game/gpuRenderer';
	let {
		rig,
		atlas = 'symbols',
		animation = 'idle',
		intro,
		speed = 1,
		reduced = false,
		seed = 0,
		onready,
		ash,
		landing,
		assetRoot,
		portalRemoval = false,
		viewport,
		viewBox,
		anchor,
		anchorBone,
	}: {
		rig: string;
		atlas?: string;
		animation?: string;
		intro?: string;
		speed?: number;
		reduced?: boolean;
		seed?: number;
		onready?: (ready: boolean) => void;
		ash?: AshTiming;
		landing?: AshTiming;
		assetRoot?: string;
		portalRemoval?: boolean;
		viewport?: number;
		viewBox?: { width: number; height: number; offsetY?: number };
		anchor?: HTMLElement;
		anchorBone?: string;
	} = $props();
	const gpu = useGpu();
	let surface = $state<HTMLDivElement>(),
		ready = $state(false),
		pose = $state.raw<GpuPose>();
	$effect(() => {
		const engine = gpu?.engine,
			element = surface,
			name = rig,
			page = atlas,
			root = assetRoot;
		if (!engine || !element) return;
		let dead = false,
			remove = () => {},
			bounds: DOMRect;
		ready = false;
		pose = undefined;
		const layout = () => {
			bounds = element.getBoundingClientRect();
		};
		const observer = new ResizeObserver(() => {
			layout();
			engine.invalidate();
		});
		observer.observe(element);
		void loadRig(name, page, root)
			.then((data) => {
				if (dead) return;
				const owned = engine.pose(
					data,
					untrack(() => animation),
					untrack(() => seed) * 0.173,
				);
				pose = owned;
				const entered = untrack(() => intro);
				if (entered && !untrack(() => reduced))
					owned.actor.playIntro(
						entered,
						untrack(() => animation),
					);
				remove = engine.register({
					root: owned.view,
					overlay: element.closest<HTMLElement>('[data-pixi-overlay]'),
					priority: 20,
					layout,
					draw: (dt, now) => {
						const state = untrack(() => ({
							animation,
							speed,
							reduced,
							ash,
							landing,
							portalRemoval,
							viewport,
							viewBox,
							anchor,
							anchorBone,
						}));
						owned.begin();
						if (state.reduced && state.portalRemoval) owned.actor.sample('setup', 0);
						else if (state.portalRemoval && state.ash)
							owned.actor.sample('remove', ashProgress(now, state.ash) * PORTAL_SECONDS);
						else if (state.portalRemoval && state.landing) {
							const p = landingProgress(now, state.landing);
							owned.actor.sample(p === null ? 'setup' : 'land', (p ?? 0) * 0.12);
						} else {
							if (!entered) owned.actor.setAnimation(state.animation);
							owned.actor.update(state.reduced ? 0 : dt * state.speed);
						}
						const playing = owned.actor.state.getCurrent(0)?.animation?.name ?? 'setup';
						if (element.dataset.spinePlaying !== playing) element.dataset.spinePlaying = playing;
						const scale = Math.min(
							bounds.width / (state.viewBox?.width ?? state.viewport ?? data.width),
							bounds.height / (state.viewBox?.height ?? state.viewport ?? data.height),
						);
						const origin = engine.origin,
							centerY = bounds.height / 2 + (state.viewBox?.offsetY ?? 0) * scale;
						owned.view.position.set(
							bounds.left - origin.left + bounds.width / 2,
							bounds.top - origin.top + centerY,
						);
						owned.view.scale.set(scale, -scale);
						const bone = state.anchorBone ? owned.actor.skeleton.findBone(state.anchorBone) : null;
						if (state.anchor && bone) {
							state.anchor.style.left = `${50 + ((bone.worldX * scale) / bounds.width) * 100}%`;
							state.anchor.style.top = `${((centerY - bone.worldY * scale) / bounds.height) * 100}%`;
							state.anchor.style.transform = `translate(-50%,-50%) matrix(${bone.a},${-bone.c},${-bone.b},${bone.d},0,0)`;
							state.anchor.style.opacity = String(
								owned.actor.skeleton.findSlot(state.anchorBone!)?.color.a ?? 1,
							);
						}
						if (!ready) ready = true;
						return !state.reduced;
					},
				});
			})
			.catch((error) => {
				if (!dead) {
					gpu.error = String(error);
					console.error('Pixi Spine art unavailable', name, error);
				}
			});
		return () => {
			dead = true;
			observer.disconnect();
			remove();
			pose = undefined;
		};
	});
	$effect(() => {
		const actor = pose,
			timing = portalRemoval ? ash : undefined;
		const name = rig,
			page = atlas,
			root = assetRoot;
		if (!actor || !timing) return;
		let dead = false;
		void loadRig(name, page, root, { remove: portalRemovalTracks(timing.seed) }).then((data) => {
			if (!dead) {
				actor.actor.overrideAnimation(data.findAnimation('remove')!);
				gpu?.engine?.invalidate();
			}
		});
		return () => {
			dead = true;
		};
	});
	$effect(() => {
		animation;
		speed;
		reduced;
		ash;
		landing;
		viewport;
		viewBox;
		anchor;
		anchorBone;
		gpu?.engine?.invalidate();
	});
	$effect(() => {
		onready?.(ready);
	});
</script>

<div
	bind:this={surface}
	class="spine-surface"
	class:ready
	data-renderer="pixi-webgl"
	data-spine-rig={rig}
	data-spine-animation={animation}
	data-symbol-portal={ash && !reduced && portalRemoval ? 'active' : undefined}
	data-spine-root={assetRoot}
	aria-hidden="true"
></div>

<style>
	.spine-surface {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}
</style>
