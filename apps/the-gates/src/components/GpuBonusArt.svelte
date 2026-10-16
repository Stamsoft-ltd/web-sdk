<script lang="ts">
	import { PORTRAIT_ART_ROOT } from '../game/art';
	import { playGameSound } from '../game/audio';
	import { untrack, onMount } from 'svelte';
	import { Container, Text, Matrix } from 'pixi.js';
	import { useGpu } from '../game/gpuContext';
	import { runtime } from '../game/playback.svelte';
	import { MOTION_ROOT } from '../game/art';
	import { loadRig } from '../game/spine';
	import { bonusTransitionFrame } from '../game/bonusTransition';
	import { gateCycleTracks } from '../game/gateAnimation';
	import { projectFullscreenGate } from '../game/gateViewport';
	import { celebrationCount } from '../game/winLayout';
	import { t } from '../i18n';
	let {
		skin,
		summary,
		spins,
		amount,
		format,
		reduced = false,
	}: {
		skin: string;
		summary: boolean;
		spins: number;
		amount: number;
		format: (value: number, target?: number) => string;
		reduced?: boolean;
	} = $props();
	const gpu = useGpu();
	let host = $state<HTMLDivElement>();
	onMount(() => {
		runtime.counting = summary && !reduced;
		return () => {
			runtime.counting = false;
		};
	});
	$effect(() => {
		const engine = gpu.engine,
			element = host,
			tier = skin,
			isSummary = summary,
			target = amount,
			spinCount = spins;
		if (!engine || !element) return;
		let dead = false,
			remove = () => {},
			bounds: DOMRect;
		const layout = () => {
			bounds = element.getBoundingClientRect();
		};
		const observer = new ResizeObserver(() => {
			layout();
			engine.invalidate();
		});
		observer.observe(element);
		void Promise.all([
			loadRig(`bonus-${tier}`, `bonus-${tier}`, MOTION_ROOT),
			loadRig(
				`gate-${tier}`,
				`gate-${tier}`,
				engine.app.screen.width < engine.app.screen.height ? PORTRAIT_ART_ROOT : MOTION_ROOT,
				{
					cycle: gateCycleTracks(`bonus:${tier}:${isSummary}`),
				},
			),
			document.fonts.ready,
		])
			.then(([data, gateData]) => {
				if (dead) return;
				const root = new Container(),
					content = new Container(),
					gate = engine.pose(gateData),
					award = new Container(),
					pose = engine.pose(data);
				pose.actor.playIntro('enter', 'idle');
				const makeText = (text: string, size: number, color = 0xfff3ad) => {
					const label = new Text({
						text,
						style: {
							fontFamily: 'GatesCartoon',
							fontSize: size,
							fill: color,
							align: 'center',
							stroke: { color: 0x052746, width: 2, join: 'round' },
						},
					});
					label.anchor.set(0.5);
					return label;
				};
				const value = makeText(isSummary ? format(target, target) : String(spinCount), 52),
					caption = makeText(t(isSummary ? 'TOTAL WIN' : 'FREE SPINS'), 19, 0xffffff),
					heading = makeText(t('BONUS COMPLETE'), 32, 0xffdd52);
				value.position.y = -9;
				caption.position.y = 36;
				heading.visible = isSummary;
				heading.position.y = -240;
				const reserve = value.getLocalBounds().width;
				value.scale.set(Math.min(1, 210 / Math.max(1, reserve)));
				caption.scale.set(Math.min(1, 218 / Math.max(1, caption.getLocalBounds().width)));
				award.addChild(value, caption);
				root.addChild(gate.view, content);
				content.addChild(pose.view, award, heading);
				const started = performance.now();
				let finishAt: number | null = null;
				let beatId = -1;
				const playedBeats = new Set<string>();
				remove = engine.register({
					root,
					overlay: element.closest('[data-pixi-overlay]'),
					priority: 20,
					layout,
					draw: (dt, now) => {
						const state = untrack(() => ({
							reduced,
							finish: runtime.finishCount,
							transition: runtime.bonusTransition,
						}));
						pose.begin();
						if (state.reduced) pose.actor.sample('setup', 0);
						else pose.actor.update(dt * (isSummary ? 1 : 0.7));
						const elapsed = now - started;
						if (state.finish && finishAt === null) finishAt = elapsed;
						if (isSummary) {
							const count = celebrationCount(target, elapsed, 1050, state.reduced, finishAt);
							if (count.done && runtime.counting) runtime.counting = false;
							const text = untrack(() => format(count.value, target));
							if (value.text !== text) {
								value.text = text;
								value.scale.set(
									Math.min(1, 210 / Math.max(1, reserve, value.getLocalBounds().width)),
								);
							}
						}
						const scale = Math.min(bounds.width / 800, bounds.height / 600),
							origin = engine.origin,
							cx = bounds.left - origin.left + bounds.width / 2,
							cy = bounds.top - origin.top + bounds.height / 2;
						pose.view.position.set(cx, cy);
						pose.view.scale.set(scale, -scale);
						const bone = pose.actor.skeleton.findBone('award')!;
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
						award.alpha = pose.actor.skeleton.findSlot('award')?.color.a ?? 1;
						heading.position.set(cx, cy - 270 * scale);
						heading.scale.set(scale);
						const transition = bonusTransitionFrame(state.transition, now);
						if (state.transition && !state.transition.reduced) {
							const audioId = state.transition.startedAt;
							if (audioId !== beatId) {
								beatId = audioId;
								playedBeats.clear();
							}
							for (const [cue, at] of [
								['gate-close', 0.36],
								['portal', 0.58],
							] as const) {
								if (cue === 'portal' && state.transition.kind === 'exit') continue;
								if (
									(state.transition.kind === 'entry' || now - state.transition.startedAt >= 700) &&
									transition.gateTime >= at &&
									!playedBeats.has(cue)
								) {
									playedBeats.add(cue);
									if (transition.gateTime - at < 0.15) playGameSound(cue);
								}
							}
						}
						content.pivot.set(cx, cy);
						content.position.set(cx, cy);
						content.scale.set(Math.max(0.0001, transition.artScale));
						content.alpha = transition.artAlpha;
						content.rotation = transition.rotation;
						gate.view.visible = transition.gateVisible;
						if (transition.gateVisible) {
							gate.begin();
							gate.actor.sample('cycle', transition.gateTime);
							if (!transition.portalVisible) {
								for (const name of ['portal-vortex', 'portal-rim']) {
									const slot = gate.actor.skeleton.findSlot(name);
									if (slot) slot.color.a = 0;
								}
							}
							const width = engine.app.screen.width,
								height = engine.app.screen.height;
							const gateScale = projectFullscreenGate(gate.actor.skeleton, width, height);
							gate.view.position.set(width / 2, height / 2);
							gate.view.scale.set(gateScale, -gateScale);
						}
						element.dataset.bonusTransition = state.transition?.kind ?? 'hold';
						element.dataset.bonusScale = transition.artScale.toFixed(3);

						const playing = pose.actor.state.getCurrent(0)?.animation?.name ?? 'setup';
						if (element.dataset.spinePlaying !== playing) element.dataset.spinePlaying = playing;
						const text = value.text;
						if (element.dataset.displayedAmount !== text) element.dataset.displayedAmount = text;
						return !state.reduced || !transition.done;
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
			runtime.counting = false;
		};
	});
	$effect(() => {
		reduced;
		runtime.bonusTransition;
		gpu.engine?.invalidate();
	});
</script>

<div
	bind:this={host}
	class="gpu-bonus-art"
	data-renderer="pixi-webgl"
	data-spine-rig={`bonus-${skin}`}
	role="img"
	aria-label={summary
		? `${t('BONUS COMPLETE')} · ${format(amount, amount)}`
		: `${t(skin.toUpperCase())} · ${spins} ${t('FREE SPINS')}`}
></div>

<style>
	.gpu-bonus-art {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
</style>
