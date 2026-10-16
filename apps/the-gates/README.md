# The Gates

New app on `feature/the-gates`, based on `feature/veggie-salad-v1`.
Native game art and authored Spine/Pixi effects; acquisition/provenance records retained.
Hybrid renderer: a base Pixi 8 WebGL canvas plus a transparent presentation canvas for
main background/logo, 30 retained symbol/pad tiles, Spine portals/gates,
win/bonus art/count/amounts, side counters, pooled win coins, landing visuals and loading progress; Svelte HTML
HUD, forms, accessibility labels and dialogs. Book playback remains authoritative.
The demand renderer stops while idle and hidden; no per-symbol canvas/ticker.
DPR is capped at 2. The full-game canvas stays mounted below the HTML HUD.
Gates/portals/celebrations render above it on the transparent presentation canvas;
both share one demand clock and decoded assets. Neither is reparented into a native dialog. The board remains a retained GPU underlay; no HTML snapshot/fallback.
Frame, mask, pads, symbols and tile geometry all live in Pixi. `Board.svelte` holds
one empty layout/accessibility host, not per-cell/reel DOM nodes. Static menu and
paytable icons remain intentional HTML UI, not duplicate gameplay fallbacks.
Landing HTML targets are invisible input/accessibility only; loading visuals/branding are Pixi.
HTML owns the semantic loading progressbar and bonus acknowledgement hints.
App/observers/jobs/listeners/textures are disposed on unmount.
The gate-completing third win gets a full 1300ms readable selection before the gate
clock begins (350ms explicit skip; 150ms reduced motion). Reward/removal book order
stays authoritative. Mobile HUD uses a single derived capsule border and heavier
spin outline; desktop controls share one centerline. Disabled controls keep opacity 1.

### Gate reward delivery

No persistent “Match 8+ symbols” caption or landing copy is rendered. Rules still
explain the verified match tiers. Gate rewards use the same shared Pixi canvas:

- +N× / N× → multiplier value; extra/retrigger spins → free-spin counter.
- Sticky Wild → one staggered flight per authoritative board position.
- Readable portal hold 1800ms; curved flight 720ms (100ms reduced motion),
  ≤232ms cell staggering, then a 300ms arrival ring. All finish within the
  shared 1300ms outro barrier before the next reward/removal.
- Panel values/cells visually settle on their own arrival. Reducer awards,
  backend event order and amounts are unchanged. Cancellation clears only the
  presentation snapshot; stale/duplicate arrivals cannot replay sounds.
- Cached, local audio uses one gesture-unlocked WebAudio context, independent SFX/music
  mute buses, hidden-page guards and bounded voices. No external audio host.
- Live GPU target coordinates are recomputed on resize; owners remove targets on teardown.
  The rainbow sticky-Wild rig follows authoritative positions and cluster-colored highlights.

### Renderer ownership (current)

| Visible component                                                         | Renderer                                         |
| ------------------------------------------------------------------------- | ------------------------------------------------ |
| Main background, Gates logo, in-game Press Play mark                      | Pixi sprites                                     |
| Board frame, mask, pads, all 30 symbols, portal/removal effects           | Pixi + native Spine                              |
| Tumbles/progress, multiplier, free-spin/total-win counters, cluster wins  | Pixi graphics/text                               |
| Gates/rewards, celebration titles/trumpets/plaques/coins                  | Pixi + native Spine                              |
| Celebration amounts/counts and bonus free-spin award                      | Pixi text                                        |
| Landing/splash background, logo, cards, symbols, text and continue prompt | Pixi; invisible HTML input/accessibility targets |
| Loading graphics/progress                                                 | Pixi; semantic HTML progressbar only             |
| HUD controls, balance/bet/win values, settings/menu                       | HTML/Svelte                                      |
| Buy/confirm/resume/rules/autoplay/error/replay modals                     | HTML/Svelte; static or Pixi icon content         |
| Accessibility text/layout anchors, diagnostic/session/legal metadata      | Non-visual HTML / HTML metadata                  |

`main .gpu-surface > canvas.game-canvas[data-testid="game-canvas"]` is the
permanent base WebGL surface; a transparent sibling canvas handles presentations above HUD. Empty `role="img"`/layout divs are semantic anchors,
not image renderers or HTML board fallbacks. Pixi scene objects live in the GPU
scene graph, not as DOM nodes.

Bonus entry and summary require explicit tap/click/Enter/Space after their transition guard.
Both show a white, slowly pulsing “Tap anywhere to continue” hint (static with reduced motion). Presentations darken the GPU scene with no blur; the HTML HUD remains at
full opacity. Win tiers scale the complete assembly and trumpets progressively;
trumpet tips render behind the title, and Legendary's title is fitted smaller.
Confirmation dialogs retain one description/price and Back/OK; no close X.
Buy/rules close controls sit at the game corner. Autoplay has exclusive speed
switches, a bounded count slider and explicit Start/Stop controls. The bonus switch
only continues **earned** bonuses (off by default), never purchases a feature.
Existing jurisdiction, funds, session and error stops remain authoritative; optional loss/single-win
thresholds are disabled. Presentation-only changes do not alter payouts or books.

### Platform / localization

Shared `Authenticate`, RGS primary machines and replay adapters remain in use.
Authenticated bet levels and wallet currency are server-owned; stepping follows
those levels, including sub-cent amounts. Wallet API units (1e6) remain separate
from book payout units (100). Missing jurisdiction flags receive safe defaults;
server restrictions and social mode cannot be disabled by URL settings.

`src/i18n/draftCatalogs.ts` contains AI-generated UI drafts for all configured
non-English locales plus Bulgarian. These are **not native-reviewed**. Common HUD,
modal, navigation and feature-card copy is translated; long-form rules/legal text
still falls back to canonical English (existing Bulgarian rules retained).
Social UI labels use native play/win wording. Unreviewed wagering-related long copy
uses English social terminology rather than leaking gambling words into social UI.
Currency formatting retains ISO metadata, social currencies and final-amount
precision. No live-RGS / native-linguist / jurisdiction release sign-off is implied.

## Run

Use Node >=22.16 and the repository's pnpm version.

```sh
pnpm install
pnpm --filter the-gates dev
# http://localhost:3020/?preview=true
pnpm --filter the-gates test
pnpm --filter the-gates build
```

### Secure launcher / mixed-content warnings

Use HTTPS when embedding in the HTTPS launcher. Do not use the HTTP dev URL there:
the browser may upgrade HTTP image requests to HTTPS, or block insecure resources.

Stop the existing server on port 3020, then run from the repository root:

```sh
pnpm --filter the-gates dev:https
# Launcher Local Testing URL: https://localhost:3020/
# Standalone art preview: https://localhost:3020/?preview=true
```

Keep existing launcher query parameters; change only the game URL scheme to HTTPS.
Asset paths remain relative, so images, CSS, fonts and Spine atlas pages use the
game's secure origin. HMR uses the same TLS server. Port conflicts fail instead of
silently moving to another port. This command does not change production builds.

The default certificate is the repository's existing **self-signed localhost-only**
mock-RGS certificate. It must already be trusted by your browser. If the browser
shows a certificate warning, stop and configure a trusted local certificate rather
than disabling security or bypassing the warning. No trust store is changed by this command.
Use your already trusted certificate/key pair instead:

```sh
GATES_TLS_CERT=/absolute/path/localhost-cert.pem \
GATES_TLS_KEY=/absolute/path/localhost-key.pem \
pnpm --filter the-gates dev:https
```

Do not point a production RGS session at a mock backend to resolve asset warnings.
This fixes mixed transport; frame-time/interaction performance still needs live profiling.

### Repeated-asset / interaction audit

Append `&assetAudit=1` to an existing **dev** game URL (or `?assetAudit=1` if no query
exists). This works with normal authentication as well as art preview. No session
data, asset URLs or RGS calls are collected or transmitted. The readout samples the
750 ms after a button click; a burst of clicks is grouped into one sample.

After startup finishes, a non-spin speed/bet button should show zero loader image
starts, zero loader fetches and no symbol remounts. Opening a previously unseen
dialog can legitimately load its art. Resource timing reports distinguish actual
transferred bytes, cache hits and unknown/blocked timing; a warning alone is not
proof of a download. A spin can legitimately change symbols, tiers and overlays.

Preloads, Spine atlas pages and coin effects now share a canonical decoded-image
cache. Successful and failed loads are retained for the page lifetime. Interactions
do not automatically retry failed assets; use explicit Reload/Retry after resolving
an unavailable asset or server. Production never mounts the audit observers.

### Upload packaging / performance

`pnpm --filter the-gates build` now validates a runtime asset dependency closure,
then removes unused art **only from generated `apps/the-gates/build`** and losslessly recompresses PNG IDAT chunks. Upload that
folder as before. Unused pre-Figma exports/pipeline were explicitly retired; retained native source exports and provenance remain in `static`.
Retained files must match their source bytes or exact lossless PNG scanlines/metadata. Missing
or stale required files fail the build; no partial pruning occurs on validation failure.

```sh
pnpm --filter the-gates build       # optimized upload package
pnpm --filter the-gates audit:bundle # read-only package validation/size report
pnpm --filter the-gates build:full  # unpruned output for acquisition/debug work
```

Static references are collected from the active app import graph. Dynamic symbol,
gate, bonus and win families are explicitly seeded in `tools/package-assets.mjs`;
atlas page dependencies and font licenses are retained. Update those seeds/tests
when adding a new dynamic art family. Existing inline JS/CSS delivery is unchanged.

Numeric fitting shares bounded font/pattern metrics and one measurement canvas.
Changing text no longer recreates its resize/font listeners. Font-load events
invalidate cached metrics. Canvas resize writes occur only when dimensions change.
Closed gates do not decode their full-screen art at startup; playback still prewarms
it before starting the visible gate clock. No payout rules or animation times changed.

`?preview=true` works **only in development**. Scripted UI fixtures, no randomness,
no real wagers, no wallet accounting, no claimed mathematical validity. Mystery's
preview deliberately demonstrates Hidden; this is NOT its selection probability.
Production requires the normal launcher parameters (`sessionID`, `rgs_url`, etc.).
Replay uses the inherited `replay=true&game=...&version=...&mode=...&event=...&amount=...` contract.

Browser QA uses the local development preview and public QA fixture below. Obsolete HTML-grid/per-symbol-canvas browser scripts were retired with their renderer.

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

| Event                 |                               Normal timing | Result                                                      |
| --------------------- | ------------------------------------------: | ----------------------------------------------------------- |
| spinStart / reveal    | Geometry-driven; normal exit + drop <520 ms | Bottom-first gravity, per-cell distance, landing impact     |
| cascadeWin            |                                      360 ms | Highlight all supplied winning positions; raw subtotal only |
| gateProgress          |                                       80 ms | One step per winning grid                                   |
| gateOpen              |                                    1,100 ms | Heavy inward rotation, thick edges and shadows              |
| gateReward            |                                    1,050 ms | Ordered value / Wild / extra-spin reward                    |
| tumbleRemove          |                     190 ms + jitter + 40 ms | Exact supplied cells disappear before next reveal           |
| spinWin               |                                      280 ms | Settled amount, not client-recomputed winnings              |
| bonus intro / summary |   120 ms guard; summary auto-close 1,800 ms | Intro Continue; summary count-up and auto-close             |
| maxWin                |          120 ms guard + 2,400 ms auto-close | Authoritative cap; dismissible                              |

Quick mode never skips entry scatters, events, rewards or acknowledgement.
Reduced motion removes spatial effects but retains minimum text-reading times.
Unmount cancels waits and acknowledgement, stops actor/autoplay and removes listeners.

## Validation / release gates

- Unit suite: event reduction, quarter units, cap, ordinal free-spin counters,
  extensions, two-reward order, immutable sticky placement, every-cursor restoration.
- Browser suite uses **mocked** RGS only. It does not validate the live backend or math.
- Shared baseline `Authenticate.svelte` still has four Svelte/TypeScript diagnostics:
  `stateConfig` lacks declared min/max/step/default bet fields. No game-local diagnostics.
  Unused shared carousel compilation is avoided through narrow component/catalog imports.
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
`static/assets/the-gates/figma-20261012/asset-manifest.json`: retained native acquisition hashes/provenance.
`reports/asset-source-cleanup.json`: deleted-file byte counts and hashes.

Math source contract: `../math-sdk/games/0_0_the_gates/EVENT_CONTRACT.md`
(from repository parent). Math source and upstream RGS validator were not changed
in this UI phase; no math generation or validation executed.

### Local platform QA (no real wallet)

`node --experimental-strip-types tools/qa-rgs.mjs` starts a loopback-only fixture
on port 3044. With dev server on 3020, use
`?sessionID=gates-qa-kwd&rgs_url=127.0.0.1:3044&lang=de` (no `preview=true`).
Other public fixture IDs: `gates-qa-social`, `gates-qa-resume`.
The fixture rejects all other sessions and non-local origins. Never pass a real
session, live wallet or production RGS credentials to it. Its outcomes are hand-
authored contract probes, not validated math. Stop the fixture after QA.

### Latest responsive polish

Task log and verification: [`reports/UI-REFINEMENTS-2026-10-14.md`](reports/UI-REFINEMENTS-2026-10-14.md).
Mobile board uses equal-inset Pixi Graphics gold/orange rim; HTML HUD keeps opaque disabled controls and independent touch targets. Autoplay detents reach 1000, optional loss/single-win thresholds are disabled using shared Infinity sentinels (mandatory stops unchanged). Rules use fixed-aspect cards, original nine-sliced legal frames and supplied arrow artwork. Bonus intro waits for entry settlement, then uses native doors/portal; summary reverses into portal before doors restore base scenery. Presentation-only scene override never changes reducer outcomes. Wild trumpet alignment deferred by user until clean banner art arrives.

### Asset cleanup / build encoding

See [`reports/ASSET-CLEANUP-2026-10-14.md`](reports/ASSET-CLEANUP-2026-10-14.md) for before/after measurements.

- `pnpm --filter the-gates audit:assets`: read-only runtime + current-authoring source audit.
- `node --experimental-strip-types tools/clean-assets.mjs --execute`: **explicit destructive cleanup**, never automatic on ordinary builds. Saves deletion hashes first; excludes all runtime/current-authoring dependencies and licenses. Do not run against unregistered future asset families.
- `pnpm --filter the-gates build`: validates/prunes generated output, then dependency-free PNG IDAT recompression. Original pixels, palette, filters, metadata and acquisition PNG bytes remain unchanged. Build encoding details: `build/asset-encoding.json`.
- `pnpm --filter the-gates audit:bundle`: accepts unchanged bytes or verified exact PNG scanline/non-IDAT equivalence; refuses altered images.
- `pnpm --filter the-gates build:motion`: current native rigs + optional workbench. Canvas2D preview adapter resides under `tools/`, not production gameplay. Legacy renderer/shard/fire/win asset authoring is retired; Wild's current atlas/rig stays intact.

The shared inline-bundle delivery contract is unchanged; no unmeasured FPS claim or lossy artwork changes.

## Release preparation — 2026-10-16

- All four HUD/buy-menu bet +/− controls step once on press, then repeat after 350ms at 80ms
  intervals. Release/cancel/blur/hidden/disable/unmount stops repeat; bounds/locks are rechecked.
- Autoplay stop reasons map to allowlisted localized/social-safe text, never raw actor keys.
- Gates opts into exact settled-win/replay precision (up to 8 decimals); normal wallets and other
  titles retain their prior currency formatting policy.
- Source cleanup preserves runtime/authoring/license dependencies. Build removes non-runtime
  exports and recompresses PNGs losslessly; no resolution/art changes.

See [release verification and outstanding gates](reports/release-prep-20261016/README.md).
This is a production **build**, not publication clearance: music/SFX soundbank rights, native-social
review, physical-device/art sign-off, full live-RGS replay matrix and Studio max-win-frequency
acceptance remain open. User explicitly requested retaining approved audio and v8 maths unchanged.
