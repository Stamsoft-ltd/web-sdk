export * from './components/index';
export * from './utils.svelte';
export * from './types';
export * from './createApp.svelte';
export * from './context.svelte';
export { loadDemandAssets } from './assetDemand';

// Namespace re-export so apps never import 'pixi.js' directly: with pnpm's strict node_modules
// only packages that DECLARE pixi.js can type-resolve it, so direct app imports fail svelte-check
// ("Cannot find module 'pixi.js'"). Import { PIXI } from 'pixi-svelte' instead — a namespace
// avoids clashing with this package's own Container/Text/... component exports.
// NOTE: import-then-export (not `export * as`) on purpose — apps alias 'pixi.js' to a CJS entry,
// and vite dev's interop leaves a star-re-exported CJS namespace empty (PIXI.Ticker === undefined)
// while this form matches what the package's own components do and works in both dev and build.
import * as PIXI_NAMESPACE from 'pixi.js';
export const PIXI = PIXI_NAMESPACE;
// Frequently-needed pixi names that don't clash with this package's component exports.
export { FillGradient } from 'pixi.js';
export type { Texture } from 'pixi.js';
