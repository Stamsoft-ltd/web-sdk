# Veggie Salad UI

First testable visual slice for the 7x7 base and 8x8/9x9/10x10 bonus boards.

```bash
pnpm --filter veggie-salad dev
```

Open `http://localhost:3018`.

Current slice:

- responsive grid-size switcher;
- day/sunset/night/rainbow mode treatments;
- supplied symbol assets;
- spin/drop and cluster/tumble preview controls;
- responsive slot HUD shell.

Next integration slice: replace preview board state with RGS `reveal`, `clusterWin`, and
`tumbleRemove` event playback.
