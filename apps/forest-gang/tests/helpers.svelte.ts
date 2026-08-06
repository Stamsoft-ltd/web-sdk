// Test helpers that need runes (hence .svelte.ts) plus the deterministic clock.
import * as PIXI from 'pixi.js';
import { onMount } from 'svelte';

import { advance } from '../src/game/sceneAnimation';

/**
 * Plan 14 section 1 — the deterministic clock, and ALL of it.
 *
 * `advance()` is the scene walk SceneAnimationDriver registers on the app ticker, driven here with
 * a fixed step instead of wall time. Its reach is exactly: playing `AnimatedSprite`s (delta in PIXI
 * frames) and `Spine`s (delta in seconds) in the subtree. It does NOT drive Board's pulse rAF,
 * Win's breathe rAF, ExpandedSymbolOverlay's rAF, Svelte `Tween`s or the sequence `setTimeout`s —
 * those keep their own wall clocks. Every assertion built on this hook must therefore be about
 * sprite/Spine liveness, nothing else.
 */
export const advanceFrames = (root: PIXI.Container, frames: number, fps = 60) => {
	for (let i = 0; i < frames; i++) advance(root as never, 1, 1 / fps);
};

/** A texture with no GPU work behind it — enough for AnimatedSprite frame bookkeeping. */
export const fakeTextures = (count: number) =>
	Array.from(
		{ length: count },
		() => new PIXI.Texture({ source: new PIXI.TextureSource({ width: 4, height: 4 }) }),
	);

/**
 * The `@@pixi_parent` context, reproduced from pixi-svelte's `createContextParent` (which can only
 * be called from inside a component). `mount()` takes contexts as a Map, so no wrapper component
 * is needed.
 */
export const parentContext = (parent: PIXI.Container) => ({
	parent,
	addToParent: (node: PIXI.ContainerChild) => {
		onMount(() => {
			parent.addChild(node);
			parent.sortChildren();
			return () => node.destroy();
		});
	},
});

/** Props object that stays reactive after `mount()`, so a prop write re-runs the component's effects. */
export const reactiveProps = <T extends object>(initial: T): T => {
	const props = $state(initial);
	return props;
};
