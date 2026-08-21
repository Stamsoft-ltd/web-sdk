<script lang="ts">
	import {
		Container,
		Graphics,
		SpineBone,
		SpineProvider,
		SpineSlot,
		SpineTrack,
		Sprite,
	} from 'pixi-svelte';
	import { Tween } from 'svelte/motion';
	import { cubicOut } from 'svelte/easing';
	import { onMount, untrack } from 'svelte';
	import { stateBet } from 'state-shared';

	import { getContext } from '../game/context';
	import { BOARD_SIZES, CELL_H, CELL_W } from '../game/constants';
	import MegaWildMultiplierText from './MegaWildMultiplierText.svelte';

	type Props = {
		x: number;
		y?: number;
		multiplier: number;
		fakeMultiplier?: number;
		initialReal?: boolean;
		animationName?: 'intro' | 'idle';
		winning?: boolean;
		alpha?: number;
		originY?: number;
	};

	const props: Props = $props();
	const context = getContext();
	const ready = $derived(!!context.stateApp.loadedAssets?.megaWildFullReelSpine);
	const animationName = $derived(props.animationName ?? 'idle');
	const spineAnimationName = $derived(
		animationName === 'intro' && props.initialReal ? 'intro_real' : animationName,
	);
	const finalLabel = $derived(`${props.multiplier}X`);
	const fakeLabel = $derived(`${props.fakeMultiplier ?? props.multiplier}X`);
	// Another 30% slower than the previous 1 / 1.3 pass.
	const INTRO_TIME_SCALE = 0.7 / 1.3;
	// Turbo keeps the former shared turbo/super-turbo playback. Super turbo compresses the complete
	// expansion + cart/plaque pass to 20% of that duration instead of deleting the animation.
	const SUPER_TURBO_INTRO_FACTOR = 0.2;
	const introTimeScale = $derived(
		stateBet.isSuperTurbo ? INTRO_TIME_SCALE / SUPER_TURBO_INTRO_FACTOR : INTRO_TIME_SCALE,
	);
	const EXPAND_MS = 338;
	const expandMs = $derived(
		stateBet.isSuperTurbo ? EXPAND_MS * SUPER_TURBO_INTRO_FACTOR : EXPAND_MS,
	);
	// Exact grid-line-to-grid-line width. The shared rounded board mask and top border contain edge
	// reels; per-reel shrinking made reels 1/5 look off-centre and changed the authored proportions.
	const REEL_RENDER_WIDTH = CELL_W;
	// Use the full board height again. Keep only the small upward bias requested for top-seam cover.
	const REEL_RENDER_HEIGHT = BOARD_SIZES.height;
	// Move 0.2% of the board height back down: enough to close the bottom hairline without restoring
	// the visible top overlap.
	const REEL_VERTICAL_OFFSET_Y = -CELL_H * 0.02875 + BOARD_SIZES.height * 0.002;
	const maskLeft = -CELL_W * 0.5;
	// These are mount-state values by design. `untrack` prevents later prop changes from snapping an
	// already-expanded reel back to the trigger before Spine switches intro -> idle/win.
	const revealScaleY = new Tween(
		untrack(() => (animationName === 'intro' ? CELL_H / REEL_RENDER_HEIGHT : 1)),
	);
	const revealOffsetY = new Tween(
		untrack(() => (animationName === 'intro' ? (props.originY ?? 0) - REEL_VERTICAL_OFFSET_Y : 0)),
	);
	let plaquePulse = $state(1);

	// Pulse the plaque bone directly. Never replace/clear Spine tracks when a payline starts, because
	// even a zero-duration track swap can expose one setup-pose frame and blink the plaque texture.
	$effect(() => {
		if (!props.winning || animationName !== 'idle') {
			plaquePulse = 1;
			return;
		}
		let frame = 0;
		const started = performance.now();
		const pulse = (now: number) => {
			plaquePulse = 1.05 + Math.sin((now - started) * 0.012) * 0.06;
			frame = requestAnimationFrame(pulse);
		};
		frame = requestAnimationFrame(pulse);
		return () => cancelAnimationFrame(frame);
	});

	onMount(() => {
		if (animationName !== 'intro') return;
		void Promise.all([
			revealScaleY.set(1, { duration: expandMs, easing: cubicOut }),
			revealOffsetY.set(0, { duration: expandMs, easing: cubicOut }),
		]);
	});
</script>

<Container
	x={props.x}
	y={(props.y ?? BOARD_SIZES.height * 0.5) + REEL_VERTICAL_OFFSET_Y}
	alpha={props.alpha ?? 1}
>
	<Graphics
		isMask
		draw={(graphics) =>
			graphics
				.rect(maskLeft, -REEL_RENDER_HEIGHT * 0.5, REEL_RENDER_WIDTH, REEL_RENDER_HEIGHT)
				.fill(0xffffff)}
	/>
	<!-- Start as one complete landed cell, then grow vertically into the reel. Keeping X at 1 avoids
	     a point-pop and makes the transformation read as coming from the triggering Mega Wild. -->
	<Container y={revealOffsetY.current} scale={{ x: 1, y: revealScaleY.current }}>
		{#if ready}
			<SpineProvider
				key="megaWildFullReelSpine"
				width={REEL_RENDER_WIDTH}
				height={REEL_RENDER_HEIGHT}
			>
				<!-- Keep one track mounted. Re-keying it briefly cleared track 0 between intro/idle/win,
				     producing a random blank frame. SpineTrack already updates animationName reactively. -->
				<SpineTrack
					trackIndex={0}
					animationName={spineAnimationName}
					loop={animationName !== 'intro'}
					timeScale={animationName === 'intro' ? introTimeScale : 1}
				/>
				{#if animationName === 'idle'}
					<SpineBone boneName="plaque" scaleX={plaquePulse} scaleY={plaquePulse} />
				{/if}
				<SpineSlot slotName="fake_multiplier">
					<Container scale={0.9}>
						<MegaWildMultiplierText text={fakeLabel} />
					</Container>
				</SpineSlot>
				<SpineSlot slotName="multiplier">
					<Container scale={0.9}>
						<MegaWildMultiplierText text={finalLabel} />
					</Container>
				</SpineSlot>
			</SpineProvider>
		{:else}
			<Sprite
				key="megaWildFullReelFallback"
				anchor={0.5}
				width={REEL_RENDER_WIDTH}
				height={REEL_RENDER_HEIGHT}
			/>
			<Container scale={0.9}>
				<MegaWildMultiplierText text={finalLabel} />
			</Container>
		{/if}
	</Container>
</Container>
