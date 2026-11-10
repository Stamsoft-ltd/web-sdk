<script lang="ts">
	import { Physics } from '@esotericsoftware/spine-core';
	import { CAP_GEM_LAYOUT, winGemFrame } from '../game/winGemMotion';
	import { winEntranceFrame, winExitFrame, winTrumpetTilt } from '../game/winMotion';
	import { untrack, onMount } from 'svelte';
	import { Container, Graphics, FillGradient, Text, Matrix, Sprite } from 'pixi.js';
	import { runtime } from '../game/playback.svelte';
	import { useGpu } from '../game/gpuContext';
	import { loadRig } from '../game/spine';
	import { loadAssetImage } from '../game/imageAssets';
	import { MOTION_ROOT } from '../game/art';
	import { WIN_COMPOSITION, celebrationCount } from '../game/winLayout';
	import type { WIN_ART_VIEW } from '../game/winPresentation';
	let {
		art,
		capped = false,
		amount,
		countMs,
		format,
		viewBox,
		reduced = false,
		onready,
	}: {
		art: string;
		capped?: boolean;
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
			isCap = capped,
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
		void Promise.all([
			loadRig(`win-${tier}`, `win-${tier}`, MOTION_ROOT), document.fonts.ready,
			isCap ? Promise.all([
				loadAssetImage('./assets/the-gates/max-win/max-win.png'),
				loadAssetImage('./assets/the-gates/max-win/badge.png'),
				loadAssetImage('./assets/the-gates/stat-panels/tumble-gem.png'),
				loadAssetImage('./assets/the-gates/art/wins/legendary-crown.png'),
			]) : null,
		])
			.then(([data, , capImages]) => {
				if (dead) return;
				const pose = engine.pose(data),
					root = new Container(),
					award = new Container();
				root.addChild(pose.view, award);
				const capBadge = new Container(), capTitle = new Container(), capCrown = new Container();
				root.sortableChildren = true;
				capCrown.zIndex = 1000;
				const capGems: { view: Container; x: number; y: number; landed: boolean }[] = [];
				if (capImages) {
					const badge = new Sprite(engine.texture(capImages[1]));
					// Fit visible badge ink uniformly, compensating original transparent margins.
					badge.scale.set(800 / 547);
					badge.position.set(-400 - 11 * 800 / 547, -220 - 58 * 800 / 547);
					capBadge.addChild(badge);
					// Six decorative gems only; the badge itself has no baked-in blue gems.
					for (const [x, y, size] of CAP_GEM_LAYOUT) {
						const gem = new Sprite(engine.texture(capImages[2]));
						gem.anchor.set(0.5); gem.scale.set(size / Math.max(gem.texture.width, gem.texture.height));
						const view = new Container(), glow = new Graphics();
						for (const [radius, alpha] of [[.68,.035],[.56,.055],[.44,.075]]) glow.circle(0,0,size*radius).fill({color:0x32cfff,alpha});
						view.addChild(glow,gem); capBadge.addChild(view);
						capGems.push({view,x,y,landed:false});
					}
					const title = new Sprite(engine.texture(capImages[0]));
					title.anchor.set(0.5); title.scale.set(510 / title.texture.width);
					capTitle.addChild(title);
					const crownArt = new Sprite(engine.texture(capImages[3]));
					crownArt.anchor.set(0.5);
					crownArt.scale.set(125 / crownArt.texture.width);
					capCrown.addChild(crownArt);
					root.addChild(capBadge, capTitle, award, capCrown);
				}

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
					draw: (_dt, now) => {
						const state = untrack(() => ({
								reduced,
								finish: runtime.finishCount,
								exitAt: runtime.winExitAt,
								viewBox,
							})),
							elapsed = now - started;
						pose.begin();
						if (state.reduced) pose.actor.sample('setup', 0);
						else
							pose.actor.sample(
								'idle',
								(elapsed / 1000) % Math.max(0.001, data.findAnimation('idle')?.duration ?? 2.8),
							);
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
						const rigScale = Math.max(
							0.1,
							Math.abs(pose.actor.skeleton.findBone('celebration')!.a),
						);
						const entry = winEntranceFrame(
							elapsed,
							(engine.app.screen.width + state.viewBox.width * scale) / (scale * rigScale),
							(engine.app.screen.height + state.viewBox.height * scale) / (scale * rigScale),
							state.reduced,
						);
						pose.actor.skeleton.findBone('banner')!.y += entry.bannerY;
						pose.actor.skeleton.findBone('amount')!.y += entry.bannerY;
						pose.actor.skeleton.findBone('title')!.y += entry.titleY;
						pose.actor.skeleton.findBone('horn-left')!.x += entry.leftX;
						pose.actor.skeleton.findBone('horn-right')!.x += entry.rightX;
						for (const name of ['title', 'crown'])
							pose.actor.skeleton.findSlot(name)!.color.a *= entry.titleAlpha;
						if (isCap) {
							// Native MAX WIN art replaces both old plaque/title, never overlays duplicate copy.
							for (const slot of ['banner', 'title', 'crown']) pose.actor.skeleton.findSlot(slot)!.color.a = 0;
							pose.actor.skeleton.findBone('amount')!.y = -235 + entry.bannerY;
							pose.actor.skeleton.findBone('title')!.y -= 25;
							const crown = pose.actor.skeleton.findBone('crown')!;
							crown.y = 235 + entry.titleY;
							crown.scaleX *= 1.3;
							crown.scaleY *= 1.3;
							pose.actor.skeleton.findBone('horn-left')!.x = -310 + entry.leftX;
							pose.actor.skeleton.findBone('horn-right')!.x = 310 + entry.rightX;
						}
						const hornTilt = winTrumpetTilt(state.exitAt ? now - state.exitAt : elapsed, !!state.exitAt, state.reduced);
						pose.actor.skeleton.findBone('horn-left')!.rotation += hornTilt;
						pose.actor.skeleton.findBone('horn-right')!.rotation -= hornTilt;
						pose.actor.skeleton.updateWorldTransform(Physics.update);
						const exit = winExitFrame(
							state.exitAt ? now - state.exitAt : 0,
							engine.app.screen.height + state.viewBox.height * scale,
							state.reduced,
						);
						root.y = exit.y;
						root.alpha = entry.alpha * exit.alpha;
						pose.view.position.set(cx, cy);
						pose.view.scale.set(scale, -scale);
						if (isCap) {
							for (const [container, name] of [[capBadge, 'banner'], [capTitle, 'title'], [capCrown, 'crown']] as const) {
								const b = pose.actor.skeleton.findBone(name)!;
								container.setFromMatrix(new Matrix(scale*b.a, -scale*b.c, -scale*b.b, scale*b.d, cx+scale*b.worldX, cy-scale*b.worldY));
							}
							capGems.forEach((gem,index) => {
								const f = winGemFrame(elapsed,index,(engine.app.screen.width+850*scale)/(scale*rigScale),state.reduced);
								gem.view.visible=f.visible;
								gem.view.position.set(gem.x+f.x,gem.y+f.y);
								gem.view.scale.set(f.scale); gem.view.rotation=f.rotation;
								if(f.landed&&!gem.landed){
									gem.landed=true;
									if(!state.reduced&&!state.exitAt) engine.setBoardImpact(now);
								}
							});
							capTitle.alpha = entry.titleAlpha;
							capCrown.alpha = entry.titleAlpha;
						}
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
						return !state.reduced || elapsed < 140 || (state.exitAt > 0 && !exit.done);
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
		runtime.winExitAt;
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
