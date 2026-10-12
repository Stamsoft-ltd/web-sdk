# Split Party / Blob Split — frontend v1

Reference: user-supplied pastel blob board. Game ID stays `split_party`; Blob Split
is the visual title. Math fruit IDs map to blob colors; no math/payout changes.

## Run

```sh
pnpm --filter split-party dev
# http://127.0.0.1:3021/?demo=1
pnpm --filter split-party test
pnpm --filter split-party build
```

`?demo=1` explicitly plays exported real-book **visual fixtures**, sequentially,
with a simulated balance. Not random/weighted game simulation. No live wallet calls.
Without demo or RGS launch parameters, the screen offers a preview link only.

For the actual authenticate/play/end-round code path, start the local mock:

```sh
pnpm --filter split-party mock-rgs
# http://127.0.0.1:3021/?rgs_url=127.0.0.1:4021&sessionID=split-test&lang=en
# Set MOCK_FAIL_END=1 to exercise one settlement failure + safe retry.
```

Live launch: `?rgs_url=<host>&sessionID=<session>&lang=es`. Never include a scheme
in `rgs_url` (the adapter tolerates and removes it). Live RGS integration not certified.
Replay: `?replay=true&rgs_url=<host>&game=split_party&version=1&mode=base&event=0&amount=1000000&currency=USD`.
Replay has no wallet calls and can be played again with the main button.

## Veggie Salad reference — actually checked out

`feature/veggie-salad-v1` checked out in `/private/tmp/web-sdk-veggie-reference`,
commit `3d719a197` (`fix win screen boards`). Current worktree/branch and existing
McSchmutzo edits were preserved; no commit or branch switch in the primary worktree.

Reuse:

- **Same shared `rgs-requests` package** as Veggie: authenticate, play, end-round,
  replay. Source matches the checked-out branch. No new wallet protocol.
- `src/lib/reference/currency.ts` copied from that branch's shared formatter:
  wallet currency precision vs small-win precision, GC/SC placement.
- `chrome-locales.json`: selected semantically identical UI strings extracted
  from Veggie's `magneticCommon` catalogs. Same Lingui API, English fallback,
  and English social override pattern. No Veggie costs/rules/RTP copied.
- Pending-round recovery pattern: block new plays, replay returned events, settle
  only after playback. Failed settlement retries end-round without another play.

The Split Party event player is new: Veggie's cluster/multiplier actor cannot
interpret position-bound blade events. HTML/SVG + Svelte rendering, no Pixi lifecycle.

## V1 coverage

- Responsive 7×7 board, 1–6 mini blobs per tile, highlights/split effects, recorded
  cascades, sticky bonus blade state, free-spin progress and authoritative totals.
- Five modes: base 1×, feature 50×, normal 100×, super 500×, mystery 500×.
- Bonus picker + total-cost confirmation; bet levels/balances from authentication.
- Sound toggle (procedural effect), turbo, base autoplay with stop-on-bonus/error/
  insufficient funds/manual stop. Jurisdiction locks for turbo/autoplay/feature/space.
- Read-only replay, pending-round restore, full twelve-band paytable and rules.
- Shared chrome locales; custom game copy currently EN with some ES/DE/FR labels.
  Missing game-specific translations fall back to EN. Social forces EN as Veggie does.
- Self-hosted fonts copied from existing repository assets; no Google Fonts requests.

## Verification / open gates

Contract tests: all 13 exported math fixtures, immutable event replay, correct payout
scaling, no winInfo double-counting, malformed streams rejected, actual shared RGS
request payloads, replay wallet isolation, demo recovery, currency formatting, Svelte
first render, Spanish/social localization. Production bundle builds.

**Browser visual/mobile/interactive E2E not verified**: available browser inventory
was empty; native Computer Use returned `Computer Use permissions are not granted`.
No permission workaround used. Real RGS session, embedded mobile QA, production
jurisdiction certification and finalized art/audio remain open. PRD two-tile/five-unit
interpretation unchanged; source conflict still needs product sign-off.

Main viewport presets to inspect: 1672×941, 1440×900, 390×844, 320×568, 844×390.
Check bonus dialog → purchase → 10-FS replay → settled balance; reload mid-round
against mock RGS; run replay twice with no wallet traffic; `lang=es`, `social=true`.

Math fixtures can be refreshed with:
`python3 apps/split-party/scripts/export-fixtures.py [math publish directory]`.

Verification commands completed in this workspace:

- `pnpm --filter split-party test`: **16/16 pass** (Node contract + Svelte server-render tests, not browser E2E).
- `pnpm --filter split-party check`: TS library check passes; Svelte compilation checked by build.
- `pnpm --filter split-party build`: succeeds without Svelte accessibility warnings.
- Local HTTP mock: authenticate → play → reject duplicate → authenticate pending →
  end-round → idempotent repeat; replay response + frontend HTTP 200 pass.
- Generic social source audit: **303 findings, not passed**. It scans code/real-money
  catalogs, including identifiers and 'win'; runtime overrides are unit-tested but
  this does NOT waive social/platform review. Production release remains blocked.
- Environment warns Node 22.9.0 / pnpm 9.15.9 are below root requirements; use
  Node >=22.16 and pnpm 10.5 for standard project installation.

No browser screenshot or live-platform approval is claimed.
