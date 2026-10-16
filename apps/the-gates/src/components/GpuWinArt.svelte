<script lang="ts">
	import { untrack, onMount } from 'svelte';
	import { Container, Graphics, FillGradient, Text, Matrix } from 'pixi.js';
	import { runtime } from '../game/playback.svelte';
	import { useGpu } from '../game/gpuContext';
	import { loadRig } from '../game/spine';
	import { MOTION_ROOT } from '../game/art';
	import { WIN_COMPOSITION, celebrationCount } from '../game/winLayout';
	import type { WIN_ART_VIEW } from '../game/winPresentation';
	let {
		art,
		amount,
		countMs,
		format,
		viewBox,
		reduced = false,
		onready,
	}: {
		art: string;
		amount: number;
		countMs: number;
		format: (value: number, target?: number) => string;
		viewBox: typeof WIN_ART_VIEW;
		reduced?: boolean;
		onready?: (value: boolean) => void;
	} = $props();
	const gpu = useGpu();
	let host = $state<HTMLDivElement>(),
		ready = $state(false);
	onMount(() => {
		runtime.counting = !reduced;
		return () => {
			runtime.counting = false;
		};
	});
	$effect(() => {
		const engine = gpu.engine,
			element = host,
			tier = art,
			target = amount,
			duration = countMs;
		if (!engine || !element) return;
		let dead = false,
			remove = () => {},
			bounds: DOMRect,
			gradient: FillGradient | undefined;
		const layout = () => {
			bounds = element.getBoundingClientRect();
		};
		const observer = new ResizeObserver(() => {
			layout();
			engine.invalidate();
		});
		observer.observe(element);
		void Promise.all([loadRig(`win-${tier}`, `win-${tier}`, MOTION_ROOT), document.fonts.ready])
			.then(([data]) => {
				if (dead) return;
				const pose = engine.pose(data),
					root = new Container(),
					award = new Container();
				root.addChild(pose.view, award);
				pose.actor.playIntro('enter', 'idle');
				const width = WIN_COMPOSITION.amountWidth,
					height = WIN_COMPOSITION.amountHeight;
				gradient = new FillGradient({
					start: { x: 0, y: 0 },
					end: { x: 0, y: 1 },
					colorStops: [
						{ offset: 0, color: 0xffe950 },
						{ offset: 0.45, color: 0xffd100 },
						{ offset: 1, color: 0xff8a00 },
					],
				});
				const plate = new Graphics()
					.roundRect(-width / 2, -height / 2, width, height, height / 2)
					.fill(gradient)
					.stroke({ color: 0x051e39, width: 4 });
				plate
					.roundRect(-width / 2 + 15, -height / 2 + 12, width - 30, height - 24, (height - 24) / 2)
					.stroke({ color: 0x051e39, width: 2.5 });
				const finalText = untrack(() => format(target, target));
				const label = new Text({
					text: finalText,
					style: {
						fontFamily: 'GatesCartoon',
						fontSize: 34,
						fontWeight: '400',
						fill: 0xf4fbff,
						stroke: { color: 0x052746, width: 5, join: 'round' },
						align: 'center',
						dropShadow: { color: 0x052746, alpha: 1, blur: 0, distance: 2, angle: Math.PI / 2 },
					},
				});
				label.anchor.set(0.5);
				const reserve = label.getLocalBounds().width;
				label.scale.set(Math.min(1, (width - 42) / Math.max(1, reserve)));
				element.dataset.displayedAmount = finalText;
				award.addChild(plate, label);
				const started = performance.now();
				let finishAt: number | null = null;
				remove = engine.register({
					root,
					overlay: element.closest<HTMLElement>('[data-pixi-overlay]'),
					priority: 20,
					layout,
					draw: (dt, now) => {
						const state = untrack(() => ({ reduced, finish: runtime.finishCount, viewBox })),
							elapsed = now - started;
						pose.begin();
						if (state.reduced) pose.actor.sample('setup', 0);
						else pose.actor.update(dt);
						if (state.finish && finishAt === null) finishAt = elapsed;
						const count = celebrationCount(target, elapsed, duration, state.reduced, finishAt);
						if (count.done && runtime.counting) runtime.counting = false;
						const text = untrack(() => format(count.value, target));
						if (label.text !== text) {
							label.text = text;
							label.scale.set(
								Math.min(1, (width - 42) / Math.max(1, reserve, label.getLocalBounds().width)),
							);
							element.dataset.displayedAmount = text;
						}
						const origin = engine.origin,
							scale = Math.min(
								bounds.width / state.viewBox.width,
								bounds.height / state.viewBox.height,
							);
						const cx = bounds.left - origin.left + bounds.width / 2,
							cy =
								bounds.top - origin.top + bounds.height / 2 + (state.viewBox.offsetY ?? 0) * scale;
						pose.view.position.set(cx, cy);
						pose.view.scale.set(scale, -scale);
						const bone = pose.actor.skeleton.findBone('amount')!;
						award.setFromMatrix(
							new Matrix(
								scale * bone.a,
								-scale * bone.c,
								-scale * bone.b,
								scale * bone.d,
								cx + scale * bone.worldX,
								cy - scale * bone.worldY,
							),
						);
						award.alpha = pose.actor.skeleton.findSlot('amount')?.color.a ?? 1;
						element.dataset.spinePlaying =
							pose.actor.state.getCurrent(0)?.animation?.name ?? 'setup';
						if (!ready) ready = true;
						return !state.reduced;
					},
				});
			})
			.catch((error) => {
				if (!dead) gpu.error = String(error);
			});
		return () => {
			dead = true;
			observer.disconnect();
			remove();
			gradient?.destroy();
			ready = false;
			runtime.counting = false;
		};
	});
	$effect(() => {
		reduced;
		gpu.engine?.invalidate();
	});
	$effect(() => onready?.(ready));
</script>

<div
	bind:this={host}
	class="gpu-win-art"
	data-renderer="pixi-webgl"
	data-spine-rig={`win-${art}`}
	data-final-amount={amount}
	role="img"
	aria-label={format(amount, amount)}
></div>

<style>
	.gpu-win-art {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
</style>
