<script lang="ts" module>
	import * as PIXI from 'pixi.js';

	import type { OverwriteCursor } from '../types';

	export type Props = OverwriteCursor<PIXI.AnimatedSpriteOptions> & {
		animationSpeed?: PIXI.AnimatedSprite['animationSpeed'];
		loop?: PIXI.AnimatedSprite['loop'];
		play?: boolean;
	};
</script>

<script lang="ts">
	import { propsSyncEffect } from '../utils.svelte';
	import { getContextParent } from '../context.svelte';

	const props: Props = $props();

	const parentContext = getContextParent();
	const animatedSprite = new PIXI.AnimatedSprite(props.textures ?? []);

	// `textures` must NOT go through propsSyncEffect: that effect re-assigns every prop whenever
	// ANY prop changes (e.g. width/height driven by a tween), and pixi's textures setter resets
	// playback — freezing the animation on the first frame. Handle textures in a dedicated
	// effect that only re-runs when the textures value itself changes.
	propsSyncEffect({ props, target: animatedSprite, ignore: ['play', 'textures'] });

	$effect(() => {
		const textures = props.textures;
		if (textures && textures.length) {
			animatedSprite.textures = textures;
			if (props.play) animatedSprite.gotoAndPlay(0);
			else animatedSprite.gotoAndStop(0);
		}
	});

	$effect(() => {
		if (props.play) {
			animatedSprite.gotoAndPlay(0);
		} else {
			animatedSprite.gotoAndStop(0);
		}
	});

	parentContext.addToParent(animatedSprite);
</script>
