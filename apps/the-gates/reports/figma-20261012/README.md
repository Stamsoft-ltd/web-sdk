# The Gates Figma asset import — 2026-10-12

Branch: `feature/the-gates`. Asset acquisition only; UI and math unchanged.

## Verified

- 78 PNG assets, 75 usable imports + 3 reference-only exports.
- Native Chrome extension exports work; PNG decoding and SHA-256 checks pass.
- 27 additional assets acquired in resumed export session.
- Symbols, backgrounds, board frame, logo, HUD, bonus titles/panels, five win titles/banners/crowns and ten horns available.
- Exact horn source nodes/sides verified using live geometry, flip state and PNG orientation.
- Sound/info naming corrected after visual QA.
- Saved .fig contains 1,207 original images; source remains in Downloads, not repository.
- `asset-preview.jpg` is a QA contact sheet, NOT implementation artwork.

## Remaining / source limitations

- Mode-specific styled gate exports are clipped by ancestor frames. Preserve reference-only status; full original raster leaves are available. No source design edits performed.
- Updated blank buy-card still needs native export. Text-free autoplay circle and arrows now exported separately; compose with localized text.
- Wild banner frame `11145:4261` contains right horn child `11145:5329`. Native export preserved intact. Do not overlay that horn twice; fully independent animation needs author-side layer separation.
- Designers changed nodes during export. Current bonus counter is `11284:149363`; old `11152:7939`/`11152:10180` should not be trusted.
- `base-terrace.png` is current standalone background `11291:151706`, exported at full 1672×941 bounds. Older original retained separately.

## Runtime rules

Keep 15 initial bonus spins. Visible label HIDDEN; internal mode MYSTERY. No math changes.

## Inventories

`asset-inventory.json`: native source provenance and hashes.
`layout-layers.json`: geometry metadata from saved snapshot; no reconstructed vector paths.
`pending-exports.json`: remaining native extraction work.
Static asset directory contains compact `asset-manifest.json` with per-file geometry/status.

## Continuation checks

- `pnpm --filter the-gates verify:assets`: PASS, 78 PNG inventories/hashes/headers/geometry + font provenance/license; separate full PIL PNG decode audit also passes.
- `pnpm --filter the-gates test`: PASS, 46/46 existing tests. Tests validate current game, not Figma redesign.
- `pnpm --filter the-gates build`: PASS and exits normally after Gates-only Sass preprocessing cleanup. Previous persistent sass-embedded workers outlived Vite completion; modern per-call compilation + no preprocessing worker pool fixes that lifecycle. No shared config changed.
- Client CSS hash unchanged (style.zsLM2a7N.css). Emitted HTML matches after normalizing generated SvelteKit ID/version and bundle URI hash; UI/math source unchanged.
- Node 22.16.0 selected from existing nvm install; repository-pinned pnpm 10.5.0 downloaded via Corepack. Frozen-lockfile Gates dependency-closure install restored dependencies without version/lockfile changes. Gates now has its own dependency links, not a symlink into Veggie Salad.
- Titan One Regular font + OFL downloaded from official Google Fonts source and checked; not wired into UI yet.
- `implementation-preflight.json` records proposed symbol mapping, component boundaries, behavior-preservation rules and additional gaps. WILD deliberately remains unmapped until artwork is confirmed.
- Required Figma design-context API remains denied. No redesigned UI/runtime/math source changed.

### Reproduce

```sh
export PATH="$HOME/.nvm/versions/node/v22.16.0/bin:$PATH"
export COREPACK_HOME=/private/tmp/gates-corepack
corepack pnpm --filter the-gates verify:assets
corepack pnpm --filter the-gates test
corepack pnpm --filter the-gates build
```

`baseline-build.log` / `baseline-tests.log` record exact results. Existing shared-component unused-CSS/deprecated-Sass/env-export warnings are retained, not suppressed or altered.

## Standalone Spine motion assets

19 new Spine 4.2.74 rigs in `static/assets/the-gates/figma-20261012/motion/`:

- 11 symbols: neutral/setup, idle, 120ms floor-anchored landing squash, distinct paying poses, 160ms dissolve alongside a new 280ms custom shard burst. Source glyphs remain intact flattened PNGs. No claim of independent facet/face deformation.
- 5 win tiers: separately animated banner/title/crown/horns; staggered entrance, looping idle, short fade exit. Wild native banner contains right horn: render it once, not duplicated or falsely claimed independently rigged.
- 3 bonus entrances: title and blank award panel animate independently. No baked spin count or money. End/MAX WIN still pending art.
- Pure local Canvas2D workbench built with existing Spine core/renderer; no RGS, wagers, fake gameplay or final Figma geometry.

```sh
corepack pnpm --filter the-gates build:motion
corepack pnpm --filter the-gates test
python3 -m http.server 3021 --bind 127.0.0.1 --directory apps/the-gates/static
# Open http://127.0.0.1:3021/assets/the-gates/figma-20261012/motion/preview.html
```

55/55 tests pass (9 new official-runtime animation checks). Source PNG SHA-256 stays unchanged. `motion-qa.json` records bounds/limitations.

Future integration must trigger landing once after each movement, use live speed time scaling without restarting, animate only authoritative paying positions, preserve authoritative removal ordering, and clear tracks/setup pose for reduced motion. Amounts and counts remain localized dynamic UI. No game wiring was changed.

### Crown placement + custom symbol destruction

- Crowns parented to title: Sweet first E, Wild D, Epic P, Mythic T, Legendary N. Visible-alpha registration compensates transparent padding. Contact → lift → drop/rebound → settle by 900ms.
- New imagegen shard at `static/assets/the-gates/particles-20261012/crystal-shard-v1.png`; prompt, mode, hash and alpha audit in sibling `provenance.json`. No native Figma bitmap edits.
- Portable `symbol-removal.json`/`.atlas` + eventId/silhouette-aware rig factory. 32 independently animated Spine shards; staggered emission, outward travel, gravity, spin and shrink/fade. Source disappears by 160ms; shards end by 280ms (Fast 187ms / Turbo 93ms).
- Workbench adds pause + millisecond pose scrub for animation QA. Runtime/game integration remains unchanged, pending mandatory design context.

### Cartoon mini-portals (current removal design)

User rejected crystal shards. Preview now loads no shard texture/effect. New generated cartoon portal has separate atlas rim/vortex regions; native symbol draws between them. Symbol stretches, squeezes, twists and shrinks into hole, then portal pinches shut. EventId/cell seeded cosmetic twist; 400ms Normal / 267ms Fast / 133ms Turbo. Full tracks authored in Spine 4.2.

Art + prompt/provenance: `static/assets/the-gates/portals-20261012/`. QA: `portal-removal-qa.json`; 57/57 tests + static build pass. Source PNGs and runtime/game wiring unchanged. Rejected shard files retained as previous concept, explicitly marked RETIRED and not loaded in workbench.

### Gate crash/open/reward cycle (standalone)

Three new Spine rigs: `gate-normal`, `gate-super`, `gate-hidden`. Full native leaves retained; mirrored right bone. Opposite-side entry, middle collision + recoil, small eventId-seeded stage shake, sliding reopen, separately animated vortex/rim, dynamic reward preview, automatic removal/portal pinch. Impact 360ms, open 1020ms, reward gone 2020ms, clear 2180ms; fixed 750ms readable hold in all speeds.

`Play gates`/`Repeat gates`/`Closed gates` and editable demo text added to workbench. Camera/gameplay/reward-event wiring remains pending design context; no math changes. `gate-cycle-qa.json`: 63/63 tests, static build, native integrity and Chrome visual checks pass.

### Cartoon collision sparks + deeper landing

New generated yellow/orange outlined comic spark asset in `static/assets/the-gates/sparks-20261012/`; full prompt/mode/hash/alpha metadata in sibling provenance. Central flash + 12 independent Spine sparks emitted from door seam at impact, scattered on both sides with eventId seed, fully cleared before reopening. One shared texture; no changes to native PNGs.

Landing peak now 1.28× width / 0.68× height (was 1.14× / 0.82×), held 24–38ms; rebound 0.9× / 1.13×, returns neutral at120ms. Floor pivot unchanged. Existing speed scaling unchanged. `sparks-landing-qa.json`: 64/64 tests + static build + native asset integrity pass. Preview only; gameplay/math unchanged.

### Mode-matched portal art

Normal = purple/hot pink/gold; Super = blue/white/gold; Hidden = ruby red/cream/gold. Three Imagegen palette edits of the authored portal, referenced to native mode gate leaves. Rim hole remains transparent; rim/vortex are independent atlas regions. Native gate PNGs untouched. Full asset paths/prompts/tool mode in `static/assets/the-gates/portals-20261012/palette-artifacts.json`.

Gate atlas selects its own mode texture. Symbol-removal defaults Normal, with Normal/Super/Hidden preview palette selector and `symbols-<mode>.atlas` for future mode-aware wiring. Motion/holds/seeds unchanged. `portal-palettes-qa.json`: 65/65 tests + build/native integrity pass; three gate palettes and all symbol variants checked in Chrome. Game integration remains pending.
