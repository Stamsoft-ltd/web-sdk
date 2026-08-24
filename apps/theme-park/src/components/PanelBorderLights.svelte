<script lang="ts">
	import { Sprite, PIXI } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { POPUP_BORDERS, type PopupBorder } from '../lib/popupBorder';
	import { rampColour, roundedRectPoint } from '../lib/roundedRectPath';

	// The confirm dialog's running border lights, for a PIXI panel: <PopupBorderLights> draws this
	// on a DOM canvas over the HTML popups, which a canvas-drawn panel cannot use, so the congrats
	// screens get the same motion as additive spark sprites — the technique <BoardFrame> already
	// uses for its autoplay ring. Same choreography as the DOM version: a mirrored pair leaves the
	// middle of the top edge together, runs down each side, meets at the bottom, and the next pair
	// sets off from the top; they never turn round and come back.

	type Props = {
		/** Rendered panel size, in the parent's units. The parent centres the panel art on itself. */
		width: number;
		height: number;
		variant?: keyof typeof POPUP_BORDERS;
		/** Custom geometry+ramp for panels that are not one of the measured arts. */
		border?: PopupBorder;
	};
	const props: Props = $props();
	const context = getContext();

	/** Seconds for a light to run from the top of the panel to the bottom. Brisker than the DOM
	 * version's 8 — on the big congrats card the same drift read as barely moving. */
	const RUN_SECONDS = 4.5;
	const LIGHTS = [{ direction: 1 }, { direction: -1 }];
	// Fade shares of a run — see <PopupBorderLights> for why the fade-in has to be near-instant.
	const RUN_FADE_IN = 0.015;
	const RUN_FADE_OUT = 0.07;
	/** Trail length as a fraction of the perimeter, and how many glows draw it. */
	const TRAIL = 0.026;
	const TRAIL_STEPS = 8;
	/** Sprite DIAMETERS as fractions of the panel width. Larger than the DOM version's — the light
	 * has to carry on a panel that fills far more of the screen than the confirm dialog. */
	const HALO = 0.052;
	const CORE = 0.014;

	const border = $derived(props.border ?? POPUP_BORDERS[props.variant ?? 'square']);

	let run = $state(0);

	// Driven off the application ticker for the same reason as <PaylineRibbon>: a private rAF would
	// run at panel rate, out of phase with the frames <SceneAnimationDriver> actually renders.
	$effect(() => {
		const app = context.stateApp.pixiApplication;
		if (!app) return;
		const tick = () => {
			run = (run + app.ticker.deltaMS / 1000 / RUN_SECONDS) % 1;
		};
		app.ticker.add(tick, null, PIXI.UPDATE_PRIORITY.HIGH);
		return () => app.ticker.remove(tick, null);
	});

	// Rebuilt each frame as plain numbers; the sprites stay mounted and just move.
	const nodes = $derived.by(() => {
		const w = props.width;
		const h = props.height;
		const at = run;
		// Full brightness for the middle of the run, easing in at the top and out at the bottom.
		const life = Math.min(1, at / RUN_FADE_IN, (1 - at) / RUN_FADE_OUT);
		const built: { id: string; x: number; y: number; size: number; alpha: number; colour: number }[] =
			[];
		LIGHTS.forEach((light, index) => {
			// Half a lap per run: 0 at the top middle, 0.5 (the bottom middle) at the end.
			const head = at * 0.5 * light.direction;
			// Tail first, so the head's own glow lands on top of it.
			for (let i = TRAIL_STEPS; i >= 1; i -= 1) {
				const t = head - (i / TRAIL_STEPS) * TRAIL * light.direction;
				const point = roundedRectPoint(border, t, w, h, -w / 2, -h / 2);
				// Square falloff: a streak that dies quickly, not a comma.
				const fade = (1 - i / TRAIL_STEPS) ** 2;
				built.push({
					id: `${index}-${i}`,
					x: point.x,
					y: point.y,
					size: HALO * w * (0.18 + fade * 0.45),
					alpha: fade * 0.75 * life,
					colour: rampColour(border.ramp, t),
				});
			}
			// Wide halo, then a tight one at nearly full strength, then a small white centre. Most of
			// the light is the border's own colour — a big white core washes the hue out, and the
			// colour is the point.
			const point = roundedRectPoint(border, head, w, h, -w / 2, -h / 2);
			const colour = rampColour(border.ramp, head);
			built.push({ id: `${index}-halo`, x: point.x, y: point.y, size: HALO * w, alpha: 0.5 * life, colour });
			built.push({
				id: `${index}-inner`,
				x: point.x,
				y: point.y,
				size: HALO * w * 0.42,
				alpha: 0.95 * life,
				colour,
			});
			built.push({
				id: `${index}-core`,
				x: point.x,
				y: point.y,
				size: CORE * w,
				alpha: 0.8 * life,
				colour: 0xffffff,
			});
		});
		return built;
	});
</script>

{#each nodes as node (node.id)}
	<Sprite
		key="spark"
		anchor={0.5}
		blendMode="add"
		x={node.x}
		y={node.y}
		width={node.size}
		height={node.size}
		alpha={node.alpha}
		tint={node.colour}
	/>
{/each}
