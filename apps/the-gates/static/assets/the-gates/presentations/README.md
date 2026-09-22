# Bonus presentation art

Original OpenAI built-in image_gen output, no art from other games:
- `normal-crest.png`: cyan sun / guardian wings, NORMAL BONUS lettering.
- `super-crest.png`: amethyst sacred eye, SUPER BONUS lettering.
- `hidden-crest.png`: amber lion / sun crown, HIDDEN BONUS lettering.
- `complete-crest.png`: emerald winged sun, BONUS COMPLETE lettering.

Titles are illustrated English lettering. Spin counts, win totals, supporting
labels and controls remain live UI; accessible names use existing localization.
One crest displayed at a time. Each 1774×887 RGBA source is about 6 MiB decoded.
Lossless PNG re-export preserves every RGBA pixel and fixes Chromium compatibility.

Exact prompts, source files and hashes: `../presentation-art-provenance.json`.
`BonusScreen.svelte`: 420ms entry, tier-colored aura; reduced motion disables both.
Positive summaries reuse the bounded coin canvas. Native modal focus/Escape,
120ms input guard, count-up snapping and auto-close remain unchanged. Short screens
scale the crest; dialog scroll is available if content still exceeds the viewport.

QA: six intro and six end viewport sizes for each bonus; no clipped controls,
page scroll, missing assets or page errors in mocked production browser tests.
No hardware frame-rate benchmark performed.
