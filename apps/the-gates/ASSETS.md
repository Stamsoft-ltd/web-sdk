# The Gates — editable assets

Start here: `static/assets/the-gates/`. All dated export folders and opaque Figma filenames have been replaced with stable names. No symlinks or duplicate compatibility copies.

## Where to edit

| Folder | Contents |
|---|---|
| `art/symbols/` | Regular symbol PNGs: `eye.png`, `envelope.png`, `pharaoh.png`, `coin.png`, `orb.png`, colored gems, `key.png` |
| `wild/` | `flower.png` (redrawn Crystal Lotus) + Wild rig/atlas |
| `symbol-parts/` | Supplied Eye/Orb/Sun/Pharaoh/Envelope components; original PNGs + provenance. Pharaoh/Key static menu SVG compositions |
| `art/backgrounds/` | Desktop bonus backgrounds: Normal, Super, Hidden |
| `ui/` | Base background, reel/modal/landing frames, button textures, desktop HUD icons, studio/logo legacy components |
| `ui/backgrounds/` | Base portrait/loader cloud-castle background |
| `portrait/` | Portrait mode backgrounds and bonus gate leaves/rigs |
| `gates-base/` | Base/Chance/Feature gate leaf, portal layers + rig |
| `art/gates/` | Desktop Normal/Super/Hidden gate leaves |
| `portals/` | Bonus portal rim/vortex sheets; region rectangles in provenance |
| `logo/` | Main animated logo: `badge.png`, `the.png`, `gates.png` |
| `max-win/` | `max-win.png` lettering + gem-free `badge.png` |
| `art/wins/` | Regular win titles, banners, crowns and trumpet halves |
| `art/bonus/` | Normal/Super/Hidden bonus headings |
| `stat-panels/` | Desktop stat frame, tumble gem, Normal-speed lightning |
| `hud/` | Mobile Spin/Bonus, Stop and stacked Turbo lightning SVGs |
| `loading/` | `frame-00.webp`–`frame-09.webp`, Press Play wordmark |
| `win-coins/` | Coin sheet/atlas + provenance |
| `sparks/` | Gate impact spark texture |
| `audio/sfx/` | Named sound effects and six reel-land sounds |
| `audio/music/` | `base.mp3`, `normal.mp3`, `super.mp3`, `hidden.mp3` |
| `licenses/` | Distribution notices; retain these |
| `art/animations/` | Spine symbol, gate, bonus and win JSON/atlases + motion preview |

Fonts: `static/fonts/title/` (Titan One), `static/fonts/body/` (Poppins Black). Keep bundled OFL licenses.

[Complete file catalog](ASSET-CATALOG.md) · [Old → new paths](reports/asset-reorganization/path-map.json)

## Replace a PNG safely

Run from `apps/the-gates` (Python 3 + Pillow required):

```sh
# Preview changes; leaves files untouched.
python3 tools/replace-asset.py art/symbols/eye.png --source ~/Downloads/eye.png

# Copy original PNG unchanged; refresh sizes, hashes, atlas pages and rig proportions.
python3 tools/replace-asset.py art/symbols/eye.png --source ~/Downloads/eye.png --execute

# Already dropped a PNG into its folder? Refresh its metadata without copying.
python3 tools/replace-asset.py art/symbols/envelope.png --execute

npm test
npm run verify:assets
npm run build
```

Prefer the same transparent canvas, aspect ratio and visible-art padding. Different padding can need layout tuning: logo crop/boxes in `src/game/logoArt.ts`; board fill in `symbolFit.ts`/`scatterFit.ts`; Max Win composition in `GpuWinArt.svelte`, six-gem positions/timing in `winGemMotion.ts`. PNG helper updates native dimensions, not hand-tuned UI crop rectangles. Cropped multi-region sheets must retain dimensions; otherwise edit their regions deliberately.

SVG: replace same file, retain viewBox/proportions; no PNG helper. Audio: replace same MP3; retain loop length/seams; update provenance/rights. WebP loader: retain native frame dimensions and ordering; update provenance hashes. All bundled audio still carries the existing music-rights release gate.

Do **not** rename symbol region IDs, Spine bone/slot/animation names, or book symbols. `SACRED_EYE` and `RUNE_CHALICE` are contract IDs, not visible art names. Atlas pages resolve relative to their `.atlas` file.

## Authoring/build rules

- Edit `static/`, never `build/` (generated and pruned on build).
- `build-figma-motion.mjs` is the established authoring entry point; it rebuilds original rigs. Existing targeted Wild/Key/base-gate patches must remain. Do not regenerate all rigs merely to swap one PNG; use helper above.
- Source cleanup: `npm run audit:assets` dry-runs. `node --experimental-strip-types tools/clean-assets.mjs --execute` explicitly applies proposed removals only; check report first.
- The asset audit retains authoring dependencies, provenance and licenses even when not directly rendered. They are not unused art.
- Historical reports intentionally keep old paths as evidence. Runtime, tools, tests, atlases and live inventories use new paths.


## Supplied-symbol revision — 2026-10-21

- Wild: `wild/flower.png`. Raw PNG unchanged; native atlas trims export padding.
  Old rainbow source archived outside public assets in `reports/concepts/symbol-redesign-20261021/archive-rainbow-wild.png`.
- Key: `art/symbols/key.png`. Raw 930×926 export retained, atlas ink crop `215,252,500,431`.
- Pharaoh: `symbol-parts/pharaoh/{body,eye-left,eye-right,brow-left,brow-right,gem}.png`.
- Envelope: `symbol-parts/envelope/{body,flap,seal-lower}.png`; complete closed source
  `art/symbols/envelope.png`. Full seal extracted once in code with approval.
- Live alignment/motion: `src/game/premiumSymbolParts.ts`, `premiumSymbolMotion.ts`.
  Wild inherits authoritative cluster color; never changes payout eligibility.
- Static menu/landing icons: generated `symbol-parts/pharaoh/rest.svg` and `symbol-parts/key/rest.svg`.
  Regenerate after replacing inputs: `node tools/build-symbol-rest-svg.mjs`.
- Preview Canvas preparation is generated from live TS, not hand-maintained copies:
  `node tools/symbol-motion-preview/build-premium-preview.mjs`.
  `--check` fails if preview is stale. No installs needed.
