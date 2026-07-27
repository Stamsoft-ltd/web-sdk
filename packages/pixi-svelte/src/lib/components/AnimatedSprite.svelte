<script lang="ts" module>
	import * as PIXI from 'pixi.js';

	import type { OverwriteCursor } from '../types';

	export type Props = OverwriteCursor<PIXI.AnimatedSpriteOptions> & {
		animationSpeed?: PIXI.AnimatedSprite['animationSpeed'];
		loop?: PIXI.AnimatedSprite['loop'];
		play?: boolean;
		// Frame to start playback from (wrapped into the frame count). Lets sibling looping sprites
		// (e.g. a board of idle symbols) start out of phase instead of animating in lockstep.
		startFrame?: number;
	};
</script>

<script lang="ts">
	import { propsSyncEffect } from '../utils.svelte';
	import { getContextParent } from '../context.svelte';

	const props: Props = $props();

	const parentContext = getContextParent();
	// Pixi's constructor reads textures[0].texture, so an empty array (asset failed to
	// load / bad key) is a hard crash during mount — degrade to an empty texture instead.
	const animatedSprite = new PIXI.AnimatedSprite(
		props.textures?.length ? props.textures : [PIXI.Texture.EMPTY],
	);

	// `textures` is handled in the effect below (NOT via propsSyncEffect) so the play state can be
	// restored in the SAME effect run. PIXI's AnimatedSprite `set textures()` calls gotoAndStop(0)
	// internally, so any textures reassignment freezes the sprite on frame 0. Letting propsSyncEffect
	// own it meant every unrelated prop change (e.g. width/height during a win pop) re-ran the setter
	// and froze a looping sprite, and a genuine textures swap (deferred assets merging into
	// loadedAssets hands the parent a fresh array) left it stopped with nothing to restart it.
	propsSyncEffect({ props, target: animatedSprite, ignore: ['play', 'startFrame', 'textures'] });

	$effect(() => {
		// Only reassign when the array reference actually changed — avoids a redundant gotoAndStop(0).
		const textures = props.textures;
		if (textures?.length && textures !== animatedSprite.textures) {
			animatedSprite.textures = textures;
		}
		const frame = (props.startFrame ?? 0) % Math.max(1, animatedSprite.totalFrames);
		if (props.play) {
			animatedSprite.gotoAndPlay(frame);
		} else {
			animatedSprite.gotoAndStop(frame);
		}
	});

	parentContext.addToParent(animatedSprite);
</script>
