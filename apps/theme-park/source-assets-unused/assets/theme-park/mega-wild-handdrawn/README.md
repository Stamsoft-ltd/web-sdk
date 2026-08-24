# Mega Wild hand-drawn rig sources

Hand-drawn plaque sources for `scripts/build-mega-wild-full-reel-spine.py`.

- `plaque-seven-view-sheet-redrawn-v3.png`: high-resolution, from-scratch seven-view plaque master
  with true alpha and no screenshot/checker matte.
- `plaque-*-redrawn-v3.png`: transparent, halo-safe production extracts created by
  `scripts/process-mega-wild-handdrawn-assets.py`.

The builder writes the same clean processed front plaque into both the Mega Wild Spine atlas and
`static/assets/theme-park/v2/wins/small-win-plaque.png`.

Runtime 35°/60° poses derive from that exact front silhouette. Only the true edge-on pose uses
separate depth art. This removes sideways perspective drift between generated drawings.

Rebuild:

```sh
python3 scripts/process-mega-wild-handdrawn-assets.py
python3 scripts/build-mega-wild-full-reel-spine.py
```
