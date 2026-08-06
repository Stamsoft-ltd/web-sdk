<script lang="ts" module>
	import * as SPINE_PIXI from '@esotericsoftware/spine-pixi-v8';

	type SpineState = SPINE_PIXI.Spine['state'];
	type TrackEntry = SPINE_PIXI.TrackEntry;

	export type Props = Partial<TrackEntry> & {
		trackIndex: Parameters<SpineState['setAnimation']>[0];
		animationName: Parameters<SpineState['setAnimation']>[1];
	};
</script>

<script lang="ts">
	import { onDestroy } from 'svelte';

	import { propsSyncEffect } from '../utils.svelte';
	import { getContextSpine } from '../context.svelte';

	const props: Props = $props();
	const spine = getContextSpine();

	let track = $state(spine.state.tracks[props.trackIndex]);

	$effect(() => {
		if (props.trackIndex !== track?.trackIndex || props.animationName !== track?.animation?.name) {
			// Same-track changes go straight through setAnimation: it replaces the current entry by
			// itself, and is the hook Spine's crossfade (mixing) hangs off. The old unconditional
			// pre-clear — setEmptyAnimation(idx, 0) — snapped the skeleton to its SETUP POSE first,
			// so every state change rendered A's last pose → setup pose → B's first pose: a hard cut
			// with a one-frame neutral-pose flash in the middle. Only a genuine track SWITCH still
			// clears the abandoned track, which would otherwise keep playing forever. A transition
			// that still pops can pass mixDuration={0.15} (TrackEntry props sync onto the entry via
			// propsSyncEffect below) to crossfade instead of cut.
			if (track && props.trackIndex !== track.trackIndex) {
				spine.state.setEmptyAnimation(track.trackIndex, 0);
			}
			try {
				track = spine.state.setAnimation(props.trackIndex, props.animationName, props.loop);
			} catch (error) {
				console.error(error);
				const animations = spine?.state?.data?.skeletonData?.animations;
				if (animations) {
					console.log(
						'Available animation names:',
						animations.map((animation) => animation.name),
					);
				}
			}
		}
	});

	propsSyncEffect({ props, target: () => track, ignore: ['trackIndex', 'animationName'] });

	onDestroy(() => {
		// Fade to setup pose instead of snapping. Invisible when the whole Spine is being torn down
		// with us; a soft-out instead of a one-frame pop when the skeleton stays on stage.
		spine.state.setEmptyAnimation(props.trackIndex, 0.2);
	});
</script>
