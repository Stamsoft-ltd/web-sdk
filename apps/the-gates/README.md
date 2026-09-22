# The Gates — UI v1

New app on `feature/the-gates`, based on `feature/veggie-salad-v1`.
Original temple and symbol art; no reference-image assets or Veggie game rules reused.
Svelte 5 DOM/CSS renderer: thirty cells, no hidden Pixi canvas or duplicate renderer.

## Run

Use Node >=22.16 and the repository's pnpm version.

```sh
pnpm install
pnpm --filter the-gates dev
# http://localhost:3020/?preview=true
pnpm --filter the-gates test
pnpm --filter the-gates build
```

`?preview=true` works **only in development**. Scripted UI fixtures, no randomness,
no real wagers, no wallet accounting, no claimed mathematical validity. Mystery's
preview deliberately demonstrates Hidden; this is NOT its selection probability.
Production requires the normal launcher parameters (`sessionID`, `rgs_url`, etc.).
Replay uses the inherited `replay=true&game=...&version=...&mode=...&event=...&amount=...` contract.

For repeatable browser smoke tests, supply an installed Playwright module and
start the dev server first:

```sh
PLAYWRIGHT_MODULE=/absolute/path/to/playwright/index.mjs \
  node --experimental-strip-types apps/the-gates/tests/browser.mjs
```

## Implemented

- 6×5 pay-anywhere board, winning highlights, removal and movement-aware falls.
- Three-step meter, opening gate doors, ordered rewards, anchored sticky Wilds.
- Authoritative additive/multiplicative values, bonus extensions and cap messages.
- **15 starting spins** in every bonus; full entry spin before bonus presentation.
- Normal 100×, Super 300×, Mystery 400×; Chance 2× and Feature 20× persist until disabled.
- Confirmation with full price; no direct Hidden purchase or client tier lottery.
- Separate 100-scale book units and 1,000,000-scale wallet units. Quarter pays retained.
- Shared authentication, wallet requests, XState round lifecycle, replay loader,
  currency formatters and localization plumbing. New prefix reducer restores every
  prior event, including mid-cascade sticky placement; never just the last reveal.
- Replay disables wagering and does not send play, event or end-round requests.
- Autoplay limits and stop control; stop on bonus entry; Normal/Fast/Turbo speeds, reduced motion,
  operator restrictions, optional session/net/RTP display, keyboard controls.
- Paytable/rules, responsive controls and native focus-trapping dialogs.
- English catalog, partial Bulgarian game chrome, readable English fallback for other
  locales; social-English terminology. Complete native-language review remains open.

## Animation contract

| Event                 |                             Normal timing | Result                                                      |
| --------------------- | ----------------------------------------: | ----------------------------------------------------------- |
| spinStart / reveal    | Geometry-driven; normal exit + drop <520 ms | Bottom-first gravity, per-cell distance, landing impact |
| cascadeWin            |                                    360 ms | Highlight all supplied winning positions; raw subtotal only |
| gateProgress          |                                     80 ms | One step per winning grid                                   |
| gateOpen              |                                  1,100 ms | Heavy inward rotation, thick edges and shadows              |
| gateReward            |                                  1,050 ms | Ordered value / Wild / extra-spin reward                    |
| tumbleRemove          |                          190 ms + jitter + 40 ms | Exact supplied cells disappear before next reveal           |
| spinWin               |                                    280 ms | Settled amount, not client-recomputed winnings              |
| bonus intro / summary | 120 ms guard; summary auto-close 1,800 ms | Intro Continue; summary count-up and auto-close             |
| maxWin                |        120 ms guard + 2,400 ms auto-close | Authoritative cap; dismissible                              |

Quick mode never skips entry scatters, events, rewards or acknowledgement.
Reduced motion removes spatial effects but retains minimum text-reading times.
Unmount cancels waits and acknowledgement, stops actor/autoplay and removes listeners.

## Validation / release gates

- Unit suite: event reduction, quarter units, cap, ordinal free-spin counters,
  extensions, two-reward order, immutable sticky placement, every-cursor restoration.
- Browser suite uses **mocked** RGS only. It does not validate the live backend or math.
- Shared baseline `Authenticate.svelte` still has four Svelte/TypeScript diagnostics:
  `stateConfig` lacks declared min/max/step/default bet fields. No game-local diagnostics.
  Shared `GameInfoCarousel` also produces 17 existing unused-selector warnings.
- Generated math books, weighting/simulation, live RGS acceptance of 0.25× increments,
  and release/compliance sign-off remain pending. User runs math generation/validation.
- No audio has been authored. Full locale translations and final art/UX review pending.
- `minimumRoundDuration` is treated as seconds; confirm this against the target
  operator's non-default configuration during live integration review.

## Files / ownership

`game/contract.ts`: symbols, paytable, costs, event types.
`game/reducer.ts`: deterministic reconstruction, no payouts generated.
`game/playback.svelte.ts`: timed event presentation and cancellable waits.
`game/actor.ts`: inherited request/settlement lifecycle adapter.
`components/`: new game shell, atlas sprites, board, accessible dialogs.
`state/gatesStake.svelte.ts`: adapted replay support; corrected buy prices and
book-derived payout multiple to avoid mixing RGS/book scales.
`static/assets/the-gates/provenance.json`: exact original image-generation prompts.

Math source contract: `../math-sdk/games/0_0_the_gates/EVENT_CONTRACT.md`
(from repository parent). Math source and upstream RGS validator were not changed
in this UI phase; no math generation or validation executed.

### UI revision — 2026-09-22

- Larger board; shared studio HUD order: utilities/features, balance/win/bet,
  stepper/spin/speed/auto. Tumble-win panel retained.
- Horizontal five-card feature menu, swipeable on narrow screens. 2× Chance
  activates directly; 20× Feature and 100/300/400× buys confirm. Active toggles
  deactivate directly without another purchase dialog.
- Approved door textures retained. Four generated complete environments:
  `static/assets/the-gates/scene-{base,normal,super,hidden}.png`.
  Each includes its **sculpted frame and generated open chamber**; no CSS frame.
  `TempleGate.svelte` positions closed leaves in the same image coordinate system
  as the aperture. Responsive layouts crop/transform that whole world together.
  Source opening registration: x1130..1340, y213..700, 1536×1024 canvas.
- Art generated with built-in imagegen; full prompts in `provenance.json`.
- Standard reveals 520 ms, refill 330 ms, highlights 480 ms, removal 230 + 40 ms,
  gate opening 1100 ms (all speeds; 150 ms reduced-motion), rewards 1050 ms (700 ms floor), settle 450 ms.
  Fast/Turbo shorten spatial animations and waits by 2×/3×, subject to exposure floors. Gate weight and reward reading times stay protected.
- Win/bonus/max-win Continue becomes available after **120 ms**. Ordinary wins
  auto-close 1800 ms later; max wins 2400 ms later. Bonus intro requires
  acknowledgement; bonus summaries count up and auto-close after 1800 ms. Dismissing presentation never skips book events or round floors.
- Dialog scroll stays inside the modal; root scrolling locked while open.
  Presentation layouts compact on short screens; Continue has stable reserved space.

### Studio mechanisms revision

- Press Play logo copied unchanged from Veggie Salad; incorrect Stamsoft mark removed.
- Same exclusive flags/cycle as Veggie Salad: Normal → Fast → Turbo → Normal.
  Respect `disabledTurbo` and `disabledSuperTurbo`; bonus entry resets both flags.
- Space prevents focused HUD-button activation and requests a spin instead.
  Form fields and other dialogs retain native keyboard interaction. No held-key
  duplicate wagers and no scatter/event skipping.
- Fixed-height dynamic viewport shell reserves HUD/header/status first; a
  ResizeObserver fits only the gameplay content in the remainder. HUD stays full-size.
- Win celebration appears only for **strictly greater than 10× base stake**.
  <=10× payouts still settle and display in HUD. Bonus-end summaries remain regardless
  of payout, avoiding loss of bonus completion feedback.
- Svelte `Tween` + `cubicOut`, matching Veggie's counter mechanism: 1050 ms count-up,
  reduced-motion instant final value. First Continue/Space during counting snaps to
  total over 120 ms; next dismisses. Timed auto-dismiss does not require input.
- Doors retain approved artwork and background registration, now with 3D backs,
  thick edges/top surfaces and changing shadows. 1100 ms slow-start inward swing.
- KEY caption removed, actual KEY symbol retained; WILD caption unchanged.

### Tumble / live-speed revision

- Reused Veggie Salad's gravity (`sqrt(distance)`), bottom-first stagger, no-fade
  drop, squash/bounce landing and trapdoor exit. Tuned for 6×5; normal exit **plus**
  drop fits the previous 520 ms drop budget. Survivor positions remain still.
- Space during playback fast-forwards the current spin's tumbles, never jumps to
  a final result. Active waits re-evaluate every <=24 ms; in-flight cells finish
  within a 130 ms tail (or earlier). Already-landed cells never restart.
- Skip resets at each new spin, including free spins. Operator `disabledSlamstop`
  and `disabledSpacebar` restrictions still apply. Gate opening/reward reading
  floors, scatter reveals, bonus acknowledgement and minimum round time remain.
- Normal → Fast → Turbo remains available during bonus playback. Faster selection
  accelerates the current motion wave; slower selection takes effect on the next
  wave to avoid rewinding cells. Selected speed survives the per-spin skip reset.
  Wagers stay locked; overlays/dialogs retain focus and temporarily lock speed.
- `game/motion.ts` supplies both CSS timing and event barriers. No separate CSS
  quick/turbo durations that could end a phase before its animation completes.

### Board / logo layout revision

- Larger board allocation; removed old viewport-height width caps. Existing stage
  fit still reserves the full HUD before scaling gameplay.
- Removed visible Base game strip. Smaller logo belongs to `board-area`, centered
  on the board rather than the viewport; bonus tier labels remain beneath it.
- Studio branding no longer consumes a desktop header row. Portrait keeps a small
  branding row; compact phones reclaim gate-placeholder height for the symbols.
- Narrow landscape explicitly assigns the board its own flexible grid column.
- Layout regression covers 16 viewport sizes: centered logo, frame clearance,
  board minimum size, studio/HUD clearance and no page scrolling.

### Verification snapshot — latest source

- Production build passed; **29 unit tests passed** (reducer, live timers, abort
  cleanup, gravity/stagger/skip-tail, timing budget, speeds/restrictions, >10× panels).
  TypeScript passed. Svelte check retains four inherited shared-auth errors and
  17 inherited carousel CSS warnings; no game-local diagnostics.
- Final mock-RGS browser runs passed: live skip, all three bonus speeds, per-spin
  skip reset, operator restrictions, unchanged ordered reveals/payout and exactly
  one play/end-round. Final pacing profile verified, not just the earlier build.
- Studio mechanism suite passed: Press Play, focused-button Space, KEY caption,
  >10× threshold, count-up/snap/auto-close and 14 HUD viewport sizes.
- All three bonus skins passed six intro + six summary layouts each (36 checks),
  win/cap early dismissal and asset checks; no page errors or layout findings.
  Previous overlay teardown bug is now browser-verified fixed.
- Production wallet/replay smoke passed: fractional payout, wallet units and replay
  with no wallet requests.
- Browser scripts: `browser-motion.mjs` (live skip / bonus speeds), `browser.mjs`
  (dev/full, or production wallet/replay with `GATES_PRODUCTION=1`),
  `browser-presentations.mjs` (bonus layouts), `browser-studio-mechanisms.mjs`
  (interaction/counting/HUD), `browser-layout-audit.mjs` (16 board/logo/HUD layouts).
  Supply `PLAYWRIGHT_MODULE` and optionally `GATES_ORIGIN`; production defaults
  to port 3022, dev scripts to 3020. Tests use fake outcomes, no real wagers.
- Live resume, non-default operator integration and production-host/subpath smoke
  remain release checks. No math source or generated books changed in this UI phase.

### Left HUD spacing revision

- Desktop/landscape tumble count, multiplier and tumble-win stack now center in
  the actual screen-edge-to-board gap, including the stage's responsive scale.
  Board/logo placement and portrait's above-board HUD stay unchanged.
- Layout regression adds equal-gap assertions and the supplied 2366×1046 viewport.
- Build and TypeScript passed. Browser rerun blocked by automatic approval review:
  workspace out of credits. Latest left-HUD geometry remains browser-unverified;
  prior layout passes above predate this translation change.
