# Mega Wild clean animation sources

Project source art for the cleaner Mega Wild full-reel animation.

- `track-source.png`: generated vertical track source.
- `cart-views-source.png`: generated five-view source sheet for the compact reference cart.
- `track-clean.png`: reel-sized processed track, perspective-warped from a narrow crest to a wide foreground.
- `cart-*.png`: aligned transparent pitch views used by the runtime Spine rig.
- The existing approved plaque and plaque perspective art remain unchanged under `apps/theme-park/art/concepts/`.
- The old glossy bumper-car pitch views under `apps/theme-park/art/concepts/` are no longer used by this rig.

Regenerate processed assets:

```bash
python3 apps/theme-park/scripts/process-mega-wild-clean-assets.py
python3 apps/theme-park/scripts/build-mega-wild-full-reel-spine.py
```

Generation prompts used the supplied Theme Park board screenshot and compact cart reference. The track requested a clean front-facing purple/gold lift hill with brown ties and no cart, plaque, text, or side lights. The cart sheet requested five centered front-facing pitch views of one happy yellow duck in one shallow red/gold gondola with one purple jewel, from steep to frontal, with no yaw, track, plaque, wheels, headlights, or photoreal rendering.
