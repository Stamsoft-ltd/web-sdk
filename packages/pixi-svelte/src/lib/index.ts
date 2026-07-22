export * from './components/index';
export * from './utils.svelte';
export * from './types';
export * from './createApp.svelte';
export * from './context.svelte';

// Namespace re-export so apps never import 'pixi.js' directly: with pnpm's strict node_modules
// only packages that DECLARE pixi.js can type-resolve it, so direct app imports fail svelte-check
// ("Cannot find module 'pixi.js'"). Import { PIXI } from 'pixi-svelte' instead — a namespace
// avoids clashing with this package's own Container/Text/... component exports.
export * as PIXI from 'pixi.js';
// Frequently-needed pixi names that don't clash with this package's component exports.
export { FillGradient } from 'pixi.js';
export type { Texture } from 'pixi.js';
