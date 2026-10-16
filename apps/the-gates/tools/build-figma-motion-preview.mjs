import { createRequire } from 'node:module';
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const require=createRequire(new URL('../package.json',import.meta.url));
// Use the already locked Vite build dependency, not another install or CDN runtime.
const viteRequire=createRequire(require.resolve('vite/package.json'));
const { build }=viteRequire('esbuild');
const out=fileURLToPath(new URL('../static/assets/the-gates/figma-20261012/motion/',import.meta.url));
await build({entryPoints:[fileURLToPath(new URL('./figma-motion-preview.mjs',import.meta.url))],outfile:out+'preview.js',bundle:true,format:'esm',platform:'browser',target:'es2022',minify:true,logLevel:'info'});
copyFileSync(new URL('./figma-motion-preview.html',import.meta.url),out+'preview.html');
