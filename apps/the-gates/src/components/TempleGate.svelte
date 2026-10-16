<script lang="ts">
	import { playGameSound } from '../game/audio';
	import { untrack } from 'svelte';
	import { Container, Text, Matrix } from 'pixi.js';
	import { createRewardFlight } from '../game/gpuRewardFlight';
	import { REWARD_FLIGHT_START_MS } from '../game/rewardDelivery';
	import { dingRewardArrival } from '../game/rewardAudio';
	import { runtime, arriveGateReward } from '../game/playback.svelte';
	import { MOTION_ROOT, PORTRAIT_ART_ROOT, BASE_GATE_ROOT, artTier } from '../game/art';
	import { loadRig } from '../game/spine';
	import { useGpu } from '../game/gpuContext';
	import { gateCycleTracks, GATE_CYCLE } from '../game/gateAnimation';
	import { gatePresentationFrame } from '../game/gatePlayback';
	import { projectFullscreenGate } from '../game/gateViewport';
	import { t } from '../i18n';
	let { rewardText }: { rewardText: string } = $props();
	const gpu = useGpu(),
		skin = $derived(
			(runtime.sceneTierOverride ? runtime.sceneTierOverride.tier : runtime.game.tier) === null
				? 'base'
				: artTier(runtime.sceneTierOverride ? runtime.sceneTierOverride.tier : runtime.game.tier),
		),
		gateOpen = $derived(runtime.game.gateOpen && runtime.phase !== 'removing'),
		gateEvent = $derived(`${runtime.roundId}:${runtime.game.gateEventId}`);
	let overlay = $state<HTMLDivElement>();
	$effect(() => {
		const engine = gpu.engine,
			element = overlay,
			event = gateEvent,
			tier = skin;
		if (!engine || !element || !gateOpen) return;
		let dead = false,
			remove = () => {},
			destroyFlight = () => {};
		void Promise.all([
			loadRig(
				`gate-${tier}`,
				`gate-${tier}`,
				tier === 'base'
					? BASE_GATE_ROOT
					: engine.app.screen.width < engine.app.screen.height
						? PORTRAIT_ART_ROOT
						: MOTION_ROOT,
				{ cycle: gateCycleTracks(event) },
			),
			loadRig('WILD', 'symbols'),
		])
			.then(([data, wildData]) => {
				if (dead) return;
				const pose = engine.pose(data),
					root = new Container(),
					award = new Container();
				root.addChild(pose.view, award);
				const label = new Text({
					text: '',
					style: {
						fontFamily: 'GatesCartoon',
						fontSize: 64,
						fill: 0xfff6ae,
						stroke: { color: 0x331346, width: 9 },
						align: 'center',
					},
				});
				label.anchor.set(0.5);
				award.addChild(label);
				const wild = engine.pose(wildData);
				wild.begin();
				wild.actor.sample('idle', 0);
				wild.view.position.set(46, 0);
				wild.view.scale.set(0.42, -0.42);
				award.addChild(wild.view);
				const flight = createRewardFlight(
					engine,
					root,
					(id, index) => {
						if (arriveGateReward(id, index))
							dingRewardArrival(index, runtime.rewardDelivery?.reward.kind);
					},
					wildData,
				);
				destroyFlight = () => flight.destroy();
				const audioBeats = new Set<string>();
				remove = engine.register({
					root,
					overlay: element,
					priority: 30,
					layout: () => {},
					draw: (_dt, now) => {
						const state = untrack(() => ({
							factor: runtime.gateSpeedFactor,
							open: runtime.game.gateOpen,
							order: runtime.game.rewardOrder,
							count: runtime.game.rewardCount,
							start: runtime.gateStartedAt,
							reward: runtime.gateRewardStartedAt,
							reduced: runtime.reduced,
							text: rewardText,
							delivery: runtime.rewardDelivery,
						}));
						const frame = gatePresentationFrame(
								state.start + (now - state.start) * state.factor,
								state.start,
								state.reward === null
									? null
									: state.start + (state.reward - state.start) * state.factor,
								state.order,
								state.count,
							),
							time = frame.time;
						if (state.open && !state.reduced) {
							for (const [cue, at] of [
								['gate-close', GATE_CYCLE.impact],
								['portal', GATE_CYCLE.openStart],
							] as const) {
								if (time >= at && !audioBeats.has(cue)) {
									audioBeats.add(cue);
									if (time - at < 0.15) playGameSound(cue);
								}
							}
						}
						pose.begin();
						pose.actor.sample(
							state.open ? 'cycle' : 'setup',
							state.open
								? state.reduced && time < GATE_CYCLE.rewardHoldEnd
									? GATE_CYCLE.rewardStart
									: time
								: 0,
						);
						if (frame.doorsHidden)
							for (const name of ['door-left', 'door-right']) {
								const slot = pose.actor.skeleton.findSlot(name);
								if (slot) slot.color.a = 0;
							}
						if (frame.portalStable) {
							const portal = pose.actor.skeleton.findBone('portal-root');
							if (portal) {
								portal.scaleX = 1;
								portal.scaleY = 1;
							}
							for (const name of ['portal-rim', 'portal-vortex']) {
								const slot = pose.actor.skeleton.findSlot(name);
								if (slot) slot.color.a = 1;
							}
						}
						if (frame.ended) for (const slot of pose.actor.skeleton.slots) slot.color.a = 0;
						element.style.setProperty('--gate-shade', String(frame.backdrop));
						const width = engine.app.screen.width,
							height = engine.app.screen.height,
							scale = projectFullscreenGate(pose.actor.skeleton, width, height);
						pose.view.position.set(width / 2, height / 2);
						pose.view.scale.set(scale, -scale);
						const bone = pose.actor.skeleton.findBone('reward'),
							slot = pose.actor.skeleton.findSlot('reward');
						const sticky = state.delivery?.reward.kind === 'stickyWild';
						wild.view.visible = sticky;
						const rewardLabel = sticky
							? `${state.delivery!.reward.kind === 'stickyWild' ? state.delivery!.reward.positions.length : 0}×`
							: state.text;
						if (label.text !== rewardLabel) label.text = rewardLabel;
						label.x = sticky ? -53 : 0;
						const flying =
							!!state.delivery &&
							(now - state.delivery.startedAt) * (state.delivery.speedFactor ?? 1) >=
								REWARD_FLIGHT_START_MS;
						award.visible = !!bone && state.order > 0 && !frame.ended && !flying;
						flight.draw(state.delivery, state.text, now, scale, state.reduced);
						if (bone) {
							const fit = Math.min(
								1,
								(sticky ? 80 : 185) / Math.max(1, label.getLocalBounds().width),
							);
							label.scale.set(fit);
							award.setFromMatrix(
								new Matrix(
									scale * bone.a,
									-scale * bone.c,
									-scale * bone.b,
									scale * bone.d,
									width / 2 + scale * bone.worldX,
									height / 2 - scale * bone.worldY,
								),
							);
							award.alpha = slot?.color.a ?? 1;
						}
						element.dataset.gateTime = time.toFixed(3);
						element.dataset.gateEnded = String(frame.ended);
						element.dataset.rewardOrder = String(state.order);
						element.dataset.rewardDelivery = flying ? 'flying' : 'portal';
						element.dataset.rewardArrivals = String(state.delivery?.arrived.length ?? 0);
						element.dataset.renderer = 'pixi-webgl';
						return state.open && !frame.ended;
					},
				});
			})
			.catch((error) => {
				if (!dead) {
					gpu.error = String(error);
					console.error('Pixi gate unavailable', error);
				}
			});
		return () => {
			dead = true;
			destroyFlight();
			remove();
		};
	});
	$effect(() => {
		runtime.game.rewardOrder;
		runtime.gateRewardStartedAt;
		runtime.reduced;
		rewardText;
		gpu.engine?.invalidate();
	});
</script>

<div
	bind:this={overlay}
	class="temple-gate"
	data-pixi-overlay
	data-pixi-shade="true"
	class:open={gateOpen}
	data-skin={skin}
	aria-hidden={!gateOpen}
	role="img"
	aria-label={`${t('GATE')} · ${t(runtime.game.tier ? skin.toUpperCase() : 'BASE')}${runtime.game.gateOpen && runtime.game.rewardOrder > 0 ? ` · ${rewardText}` : ''}`}
></div>

<style>
	.temple-gate {
		position: fixed;
		inset: 0;
		z-index: 30;
		overflow: hidden;
		pointer-events: none;
		visibility: hidden;
	}
	.temple-gate.open {
		visibility: visible;
	}
</style>
