/** Searchable editor catalog; generated Markdown stays outside the shipped assets. */
import { readFile, writeFile } from 'node:fs/promises';
import { filesIn, runtimeAssets } from './package-assets.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const app=fileURLToPath(new URL('../',import.meta.url));
const root=path.join(app,'static/assets/the-gates');
const {keep}=await runtimeAssets();
let text='# Asset catalog\n\nSee [replacement guide](ASSETS.md). Stable paths; PNGs retain original bytes. Internal rig IDs remain contract-safe.\n\n';
let folder='';
for(const p of (await filesIn(root)).sort()){
 const relative=path.relative(root,p).split(path.sep).join('/');
 const group=path.posix.dirname(relative);
 if(group!==folder){folder=group;text+=`\n## ${group}\n\n| File | Size | Use |\n|---|---|---|\n`;}
 const data=await readFile(p);let size=`${(data.length/1024).toFixed(1)} KB`;
 if(p.endsWith('.png'))size=`${data.readUInt32BE(16)} × ${data.readUInt32BE(20)} · ${size}`;
 const use=keep.has('assets/the-gates/'+relative)?'Runtime / required metadata':'Authoring / provenance';
 text+=`| [${path.basename(p)}](static/assets/the-gates/${relative}) | ${size} | ${use} |\n`;
}
await writeFile(path.join(app,'ASSET-CATALOG.md'),text);
console.log('Updated ASSET-CATALOG.md');
