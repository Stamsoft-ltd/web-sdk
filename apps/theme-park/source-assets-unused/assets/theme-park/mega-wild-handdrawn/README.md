# Mega Wild hand-drawn rig sources

Production sources for `scripts/build-mega-wild-full-reel-spine.py`.

- `full-reel-background-v2.png`: Mega-Coaster-style full-height track/backdrop.
- `cart-five-view-sheet-v2.png`: Mega-Coaster-style five-pitch cart master.
- `plaque-seven-view-sheet-v2.png`: Mega-Coaster-style seven-view plaque master.
- `cart-*-v1.png`, `plaque-*-v1.png`: transparent extracts created by
  `scripts/process-mega-wild-handdrawn-assets.py`.

Rebuild:

```sh
python3 scripts/process-mega-wild-handdrawn-assets.py
python3 scripts/build-mega-wild-full-reel-spine.py
```
