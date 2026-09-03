import { createApp } from 'pixi-svelte';
import assets from './pixelAssets';

// Minimal shipped manifest. Legacy Spine/spritesheet entries are deliberately excluded: those
// files do not exist in this app and used to block App startup with loader 404s.
export const { stateApp } = createApp({ assets });
