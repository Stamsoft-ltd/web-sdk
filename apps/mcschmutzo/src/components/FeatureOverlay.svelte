<script lang="ts">
	import { Graphics, Sprite } from 'pixi-svelte';

	import { getContext } from '../game/context';
	import { boardLogoLayout } from '../game/boardLogo';
	import { LOGO_WORD, logoSplashShapes } from '../game/logoSplash';

	const context = getContext();
	// Portrait draws its logo (+ Press Play) as an HTML header above the board (see HudHtml .pt-top),
	// so the pixi board logo is desktop/landscape only. (The old pixi bonus wheel that lived here was
	// replaced by the HTML WheelBonus overlay and has been removed.)
	const isPortrait = $derived(context.stateLayoutDerived.layoutType() === 'portrait');
	const logo = $derived(boardLogoLayout(context));
	const cx = $derived(logo.x);
	const cy = $derived(logo.bottom - logo.height / 2);

	// The splats at rest — the same frame the splash logo settles on, so its flight lands exactly on
	// this. Static: the board logo doesn't animate.
	const SPLATS = logoSplashShapes(Infinity);
	const drawSplats = (g: any) => {
		g.clear();
		const u = logo.width;
		for (const s of SPLATS) {
			if (s.kind === 'poly') g.poly(s.pts.map((v, i) => (i % 2 === 0 ? cx + v * u : cy + v * u)), true).fill({ color: s.color, alpha: s.alpha });
			else if (s.kind === 'circle') g.circle(cx + s.x * u, cy + s.y * u, s.r * u).fill({ color: s.color, alpha: s.alpha });
			else g.ellipse(cx + s.x * u, cy + s.y * u, s.rx * u, s.ry * u).fill({ color: s.color, alpha: s.alpha });
		}
	};
</script>

<!-- Board logo = the Figma wordmark over its code-drawn ketchup splats (game/logoSplash), placed by
     boardLogoLayout. It sits OUTSIDE the board's drop-in container (see Game): the splash logo flies
     onto exactly this spot during the camera pan, so it must already be at rest when the splash
     fades. Portrait uses .pt-top. -->
{#if !isPortrait}
	<Graphics draw={drawSplats} zIndex={1000} />
	<Sprite
		key="mcschmutzoWord"
		x={cx + LOGO_WORD.x * logo.width}
		y={cy + LOGO_WORD.y * logo.width}
		anchor={0.5}
		width={LOGO_WORD.w * logo.width}
		height={(LOGO_WORD.w * logo.width) / LOGO_WORD.aspect}
		zIndex={1000}
	/>
{/if}
