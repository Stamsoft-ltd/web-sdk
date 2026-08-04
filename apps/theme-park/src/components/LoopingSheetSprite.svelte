<script lang="ts">
	import { AnimatedSprite, Sprite, type SpriteProps, type Texture } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = Omit<SpriteProps, 'key'> & {
		/** spriteSheet asset key — loadedAssets holds its frames as a Texture[] in playback order. */
		animationKey: string;
		/** Static sprite shown until the deferred sheet arrives. */
		fallbackKey: string;
		/** Playback rate relative to the 60 fps app ticker (sheet fps / 60). */
		animationSpeed: number;
	};

	const { animationKey, fallbackKey, animationSpeed, ...spriteProps }: Props = $props();
	const context = getContext();
	const frames = $derived((context.stateApp.loadedAssets?.[animationKey] ?? []) as Texture[]);
	const fallbackReady = $derived(!!context.stateApp.loadedAssets?.[fallbackKey]);
</script>

<!-- No {#key}-remount to restart the clip: re-adding the pixi node would append it ABOVE later
     siblings (it painted the card over the amount text). The loop just keeps running; a tier
     change swaps the textures array, which pixi restarts from frame 0 anyway. -->
{#if frames.length > 0}
	<AnimatedSprite textures={frames} {animationSpeed} loop={true} play={true} {...spriteProps} />
{:else if fallbackReady}
	<Sprite key={fallbackKey} {...spriteProps} />
{/if}
