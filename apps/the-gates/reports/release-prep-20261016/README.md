# The Gates — release preparation, 2026-10-16

## Delivered
- Bonus entry **and** summary: white “Tap anywhere to continue”, 2-second gentle pulse; steady text with reduced motion. Appears only when acknowledgement is enabled. Reserved hint line avoids a layout jump; tap/keyboard acknowledgements and gate/portal guards unchanged.
- HUD and bonus-menu +/−: one RGS-level step on pointer press; after 350ms, repeat every 80ms. Release/cancel/lost capture/blur/hidden/disabled/unmount stops the timer. Keyboard/assistive clicks still work; pointer release does not add a second step. No wager dispatch or custom bet values.
- **[239] fixed:** autoplay reason enums now map to localized/social-safe allowlisted messages. Unknown reason → safe connection copy, never raw text.
- **[273] fixed:** Gates opts into exact settled wins (up to eight decimals) for micro-unit stake × hundredths book. Count-up frames respect final-target precision. Other games' four-digit policy and normal wallet rounding unchanged.
- **[172,174] fixed:** replay base stake, actual cost and HUD retain accepted precision. Example 1,250 micro-units → 0.00125 SC stake, 0.00025 SC win at real BASE book8000's 0.2×.
- Removed 11 compiler-confirmed dead scoped rules in Rules.svelte. Native atlas separators and acquired OFL notices stay byte-identical; narrow data-file whitespace attributes preserve those formats. Source asset dependency audit found no further unused files; retained authoring sources, audio masters and provenance are not obsolete runtime fallbacks.
- Distribution notices retained in `static/assets/the-gates/licenses/THIRD-PARTY.txt`, explicitly protected against asset cleanup. Includes current Spine runtime header, Pixi and other bundled-library notices; font OFLs remain alongside fonts. Notices do not confer missing editor/commercial/audio/art rights.

## Verification
- **302/302 Node tests PASS** (14 new checks); TypeScript noEmit PASS; diff whitespace check PASS.
- Production build, dependency-closure packaging and exact lossless PNG optimization PASS. See build/package/optimization artifacts alongside this file.
- Dependency closure: **175 files**. Source public assets: 187 including active authoring/provenance dependencies, **0 unused**.
- Package pruning: 11 non-runtime generated exports, 194,915 bytes. PNG optimization: 78 PNGs checked, 69 recompressed, **2,973,893 bytes saved**; pixels/metadata preserved. Art resolution/quality unchanged.
- No unused-scoped-selector compiler warnings remain. Existing relative-public-URL build notices are verified against real packaged files. The shared inline application still exceeds Vite's generic 500kB chunk advisory; this is not hidden or treated as a runtime error. No new CDN, analytics or external asset host.
- Local mock only; real v8 book BASE2000 natural Normal trigger and 15 spins tested. Bonus entry/end both waited for explicit click; prompt visible at 1024×576, 425×812, 844×390 and 400×225. Final round showed $3.50 at $1.75 stake and settled exactly once to $1,001.75.
- Fixed XSC BASE8000 replay at 400×225: stake/cost0.00125 SC, multiplier0.2×, win0.00025 SC before and after playback; no wallet request. Zero-funds social autoplay: “Balance too low for this play. Lower the play amount.” and no play request. Inspected bonus/replay/funds console errors:0.
- Pointer click integration verified in browser (1.50→1.75 once). Sustained hold cadence/cancellation/bounds verified with fake-clock action tests; physical multi-touch/hold remains part of device sign-off.
- **13/13 v8 published hashes unchanged**. No maths generation/reweighting or live wagers. Full 60k-event validator was not rerun; previously validated, hash-identical package retained.

## Approval status / outstanding gates
The earlier final review had 28 PASS,4 FAIL,2 AT RISK,7 NEEDS A HUMAN. Its four failing guideline IDs now have fixes/regressions and browser evidence above. Rolling those findings forward gives **32 PASS ·0 confirmed FAIL ·2 AT RISK ·7 NEEDS A HUMAN**; not a fresh all-mode production certification.

User explicitly chose on 2026-10-16:
1. **Keep approved audio; flag rights gate.** Music/SFX use the macOS soundbank and remain uncleared for publication. No sound redesign, audio byte changes or claim of licensing clearance.
2. **Preserve v8; confirm with Studio.** Six modes retain exact96.1% RTP and current max-win weights; max-win-frequency acceptance remains open (see original audit). No automatic “fix” of an unconfirmed platform threshold.

Remaining: **[77]** native-social catalogs/baked art/all transient states; **[171]** complete live-RGS all-mode replay/trigger/Wild/extension/max-win matrix and quarter-unit acceptance. Human sign-off: **[217,253]** content/originality, **[107]** all audio physically muted, **[193,195,194,243]** laptop/popouts/physical mobile/replay readability and reachability. Source notices do not replace required Spine Editor/runtime license eligibility. None can honestly be marked fixed by this local code/build change.

## Scope / reproducibility
- Branch: `feature/the-gates`. Commit contains pending Gates renderer/UI/assets/tests/tools and required shared RGS/replay/format helpers plus its lockfile entries. Unrelated `.npmrc` deliberately excluded.
- `pnpm --filter the-gates test`
- `pnpm --filter the-gates build` (Vite → generated-only closure pruning → lossless PNG encoding)
- `pnpm --filter the-gates audit:bundle`
- Upload artifact: `apps/the-gates/build` (ignored generated output, not checked into git).
- Approved mock helper/log scratch stayed in `/tmp/gates-release-20261016`; no installs or live-RGS actions, no push. Screenshots and fake-session evidence retained here.
