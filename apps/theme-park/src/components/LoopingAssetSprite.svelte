<script lang="ts">
	import { Sprite, type SpriteProps, type Texture } from 'pixi-svelte';

	import { getContext } from '../game/context';

	type Props = Omit<SpriteProps, 'key'> & {
		animationKey: string;
		fallbackKey: string;
		restartKey?: string | number;
	};

	const { animationKey, fallbackKey, restartKey, ...spriteProps }: Props = $props();
	const context = getContext();
	const animationTexture = $derived(
		context.stateApp.loadedAssets?.[animationKey] as Texture | undefined,
	);
	const renderedKey = $derived(animationTexture ? animationKey : fallbackKey);
	// Neither key is guaranteed to exist yet: the background art now downloads in the counted pass
	// (assets.ts) rather than the preload tier, so this component mounts with <Game> before its
	// texture lands. <Sprite> logs an error for an unknown key, so draw nothing until one resolves —
	// the loading screen is opaque over this the whole time anyway.
	const ready = $derived(!!context.stateApp.loadedAssets?.[renderedKey]);

	$effect(() => {
		const resource = animationTexture?.source.resource;
		if (!(resource instanceof HTMLVideoElement)) return;
		resource.loop = true;
		resource.muted = true;
		// Reading restartKey makes a state/tier change restart the authored clip.
		void restartKey;
		resource.currentTime = 0;
		void resource.play().catch(() => {});
	});
</script>

{#if ready}
	<Sprite key={renderedKey} {...spriteProps} />
{/if}
