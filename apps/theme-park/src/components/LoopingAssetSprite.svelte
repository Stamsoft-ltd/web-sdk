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

<Sprite key={renderedKey} {...spriteProps} />
