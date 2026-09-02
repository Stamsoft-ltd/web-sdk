// Shared golden gradients for canvas (Pixi) text fills, clipped to glyphs like CSS background-clip:text.
//
// FillGradient comes from pixi-svelte's re-export, never from 'pixi.js' directly: a direct import
// resolves against the workspace root and fails in svelte-check / editor tooling.
import { FillGradient } from 'pixi-svelte';

// Figma "golden-gradient": linear-gradient(184deg, #FFA90E 15.26%, #EE960B 69.74%, #D18005 92.88%).
// 184deg ≈ vertical (top → bottom), so a straight vertical gradient matches.
export const GOLD_GRADIENT = new FillGradient({
	type: 'linear',
	start: { x: 0.5, y: 0 },
	end: { x: 0.5, y: 1 },
	colorStops: [
		{ offset: 0.1526, color: 0xffa90e },
		{ offset: 0.6974, color: 0xee960b },
		{ offset: 0.9288, color: 0xd18005 },
	],
	textureSpace: 'local',
});

// Figma --Icon-stroke: linear-gradient(180deg, #00FCFF 0%, #0046A9 100%). Used for the "YOU WON"
// label on both congratulations panels (bonus intro + outro).
export const ICON_STROKE_GRADIENT = new FillGradient({
	type: 'linear',
	start: { x: 0.5, y: 0 },
	end: { x: 0.5, y: 1 },
	colorStops: [
		{ offset: 0, color: 0x00fcff },
		{ offset: 1, color: 0x0046a9 },
	],
	textureSpace: 'local',
});

// Win-amount gradient: linear-gradient(182deg, #E2D981 17.62%, #FBC503 60.04%, #D98503 102.47%).
// 182deg ≈ vertical (top → bottom); the 2° tilt is sub-pixel across a text run, so it is dropped.
//
// The final stop sits at 102.47%, PAST the end of the gradient box — CSS never actually paints
// #D98503, it stops at whatever the ramp has reached by 100%. Pinning #D98503 to offset 1 (what
// this used to do) therefore over-darkened the bottom of every glyph. #DB8903 is the interpolated
// colour at 100%: 94.18% of the way from #FBC503 (60.04%) to #D98503 (102.47%).
// Offsets below the first stop clamp to its colour in both CSS and FillGradient, so the flat
// #E2D981 lead-in over 0–17.62% needs no explicit stop.
export const WIN_GRADIENT = new FillGradient({
	type: 'linear',
	start: { x: 0.5, y: 0 },
	end: { x: 0.5, y: 1 },
	colorStops: [
		{ offset: 0.1762, color: 0xe2d981 },
		{ offset: 0.6004, color: 0xfbc503 },
		{ offset: 1.0, color: 0xdb8903 },
	],
	textureSpace: 'local',
});
