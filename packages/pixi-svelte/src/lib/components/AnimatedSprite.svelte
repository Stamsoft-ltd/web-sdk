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
	const animatedSprite = new PIXI.AnimatedSprite(props.textures ?? []);

	propsSyncEffect({ props, target: animatedSprite, ignore: ['play', 'startFrame'] });

	$effect(() => {
		const frame = (props.startFrame ?? 0) % Math.max(1, animatedSprite.totalFrames);
		if (props.play) {
			animatedSprite.gotoAndPlay(frame);
		} else {
			animatedSprite.gotoAndStop(frame);
		}
	});

	parentContext.addToParent(animatedSprite);
</script>
