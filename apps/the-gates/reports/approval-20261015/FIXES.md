# The Gates — approval fixes + requested presentation changes
2026-10-15 · code/local-mock verification, not Engine submission approval.

## Status
31 PASS · 0 FAIL · 3 AT RISK · 7 NEEDS A HUMAN · 0 N/A. All41 numbered checks revisited. The seven originally identified failure mechanisms have code fixes; #77 remains AT RISK for the broader unreviewed locale/art surface, not the fixed English error leak. Human judgement and deployed RGS acceptance cannot be marked fixed by source changes.

## Requested presentation
- Sticky-Wild portal award: actual WILD rig plus n× from authoritative positions.length. One matching native Wild flies to each actual awarded cell; existing reducer/arrival barrier prevents premature cell replacement. No new RNG, outcomes, maths or reward values.
- Bonus entry and summary now wait indefinitely for explicit tap/click/Enter/Space after transition/guard. No auto-close timer; no Continue button reintroduced. Autoplay does not silently dismiss these screens. Abort still cleans acknowledgement state.
-10×–under20× wins no longer produce board overlay/pause. HUD/below-board amount remains;20×+ tier celebrations unchanged.

Visual proof: `sticky-wild-reward.png` captured from actual v8 SUPER book54: native symbol+1× before flight. A subsequent board view showed the Wild in reel0,row2. `desktop-rules.png` demonstrates updated rendered rules fit1440×900 without scrolling; smaller info regions scroll. `replay-400x225.png` shows the final small replay layout, social-safe amounts/labels and correct initial Play replay button.

## Code fixes
- RGS: preserve explicit URL scheme, add HTTPS for bare external host, loopback HTTP only on insecure local page; validate URL; bound request/body wait20s; no mutation retries; reject HTTP/API errors. Failed settlement stops autoplay, exposes recovery and rethrows, rather than silently progressing.
- Errors: allowlisted playerErrorKey→translated/social-safe messages. Never print server message/JSON to player. Visible insufficient-balance reason on HUD and every unavailable buy choice. Raw backend text remains diagnostic only.
- Rules:actual96.1% all-mode RTP/max win; correct v8 extras1/2/3/5 and15-spin retrigger; Wild substitution/max3; boost×2/3/5; sound/music and all current control descriptions; legal attribution; removed remaining rendered pending/target copy.
- Social: broader phrase replacement, explicit replay wording, translated/social-safe board accessible description. English fallback preserved.
- Replay: positive finite safe-integer amount, one-unit default if optional/invalid; selected URL amount/currency retained; malformed/empty state rejected; winnings scale from authoritative event multiplier rather than recorded wallet amount; boot no longer counts as a replay run.
- Frame: root overflow lock; touch-action manipulation across game/landing, inner rules scrolling allowed.
- Static bundle: Gates-only Vite transform removes legacy external template asset defaults; other titles' defaults untouched. Fresh bundle scan contains no staging-template/S3 asset hosts. No source art deleted.
- Console: cached CanvasSource texture upload replaces ImageSource's repeated image-conversion warnings. Still one cached GPU texture per decoded image, existing two layered canvases/shared demand clock.

### Primary source paths
- `/Users/simeonhristov/Documents/GitHub/web-sdk/packages/rgs-fetcher/src/rgsUrl.ts`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/packages/rgs-fetcher/src/rgsFetcher.ts`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/packages/utils-fetcher/src/fetcher.ts`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/packages/utils-xstate/src/createPrimaryMachines.ts:63–67`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/packages/components-shared/src/components/Authenticate.svelte`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/packages/components-shared/src/replayAmount.ts`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/apps/the-gates/src/game/uiErrors.ts`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/apps/the-gates/src/game/playback.svelte.ts:268,452,473`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/apps/the-gates/src/game/gpuRewardFlight.ts`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/apps/the-gates/src/components/TempleGate.svelte`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/apps/the-gates/src/components/Game.svelte`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/apps/the-gates/src/components/Rules.svelte`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/apps/the-gates/src/i18n/rulesCopy.ts:11,32–35`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/apps/the-gates/src/i18n/index.ts`
- `/Users/simeonhristov/Documents/GitHub/web-sdk/apps/the-gates/src/state/gatesStake.svelte.ts:121–125,179`

## Approved mock method/evidence
User approved local mock checks. No installs, live wagers, uploads, commits or branch changes. Helper `/tmp/gates-approval-mock.py`, loopback-only static build+RGS at http://127.0.0.1:3036. Real v8 compressed books, never synthetic outcome events: BASE0(loss),BASE2000(natural Normal),BASE8000(regular win),SUPER54(Wild+boost), bought witness books available but not all played. Synthetic test wallet/config/session IDs only. Browser interactions via CUA, no external Playwright driver.

Mock launch example: `http://127.0.0.1:3036/?sessionID=USD-win&rgs_url=127.0.0.1:3036&lang=en&currency=USD&device=desktop`.
Replay example: `http://127.0.0.1:3036/?replay=true&game=0_0_the_gates&version=v8&mode=SUPER&event=54&rgs_url=127.0.0.1:3036&currency=XSC&amount=1000000&social=true&lang=en`.

`mock-network.jsonl` contains fake-session request evidence; `request-counts.json` summarizes it. Key results: USD-loss2plays/0end-round; USD-win1play/1end-round; USD-resume-v2 authenticated once and ended once without another authenticate/play; USD-endfail1play/1failed end-round then explicit Continue→second authenticate/pending round. Replay traffic consists of GET replay only, no empty-session wallet requests.

`currency-matrix.json`: USD/EUR/CAD/MXN/JPY/XSC/XGC expected symbols/decimals/suffixes. Final portrait425×812 document bounds425×812; small400×225 and large800×450 likewise exact; laptop1024×576 exact. A mobile-hint1024×576 landscape view also verified. No physical touch emulator used.
Expected mocked HTTP400/500 console errors were intentional. External browser-extension warnings were observed; after CanvasSource change no unexpected game-origin errors found in inspected normal-play views. No claim of an exhaustive console sweep of every event/mode.

## Full recheck table
| ID | Verdict | Evidence / remaining check |
|---|---|---|
| 181 | PASS | Bare/schemed host unit tests; mock authenticate with bare and explicit http:// loopback. normalizeRgsUrl rejects invalid protocol/credentials; no alternate host. |
| 274 | PASS | Invalid nonlocal HTTP host shows recovery error before fetch. Real transport unit test verifies20s abort; no wallet mutation retry. |
| 183 | PASS | Mock /wallet/play sends amount1500000/session/mode and consumes real v8 book; balance/spin shown. Not deployed-RGS certification. |
| 275 | PASS | Local Press Play loader unchanged; no Engine-branded loader. |
| 213 | PASS | The Gates avoids listed restricted title terms. Uniqueness/IP remains#253. |
| 217 | NEEDS A HUMAN | Complete artwork/content review still required. No new character/art assets introduced. |
| 253 | NEEDS A HUMAN | Originality/trademark comparison is not certifiable from code. |
| 242 | PASS | RGS default1.50 and levels1.00/1.25/1.50/1.75/2.00 used; JPY uses separate integer levels. Existing normalization/step tests pass. |
| 187 | PASS | Mock active round1.75 overrides default1.50; Skip round settles once without reload and leaves selected1.75. request-counts.json. |
| 219 | PASS | Seven-currency launch matrix: $,€,CA$,MX$,¥zero decimals,SC/GC suffixes. currency-matrix.json. Physical layout sign-off remains#194. |
| 273 | PASS | Shared exact win formatter unchanged; sub-cent unit coverage passes. |
| 221 | PASS | Two zero-win plays →0 end-round. Paying round →1 end-round. Forced end-round500 locks controls; Continue reloads to pending round. Primary catch now rethrows. |
| 222 | PASS | Zero-funds Spin blocked, Space sends no play, clear visible explanation. Unaffordable bonus options display Low balance and expose title/disabled state. |
| 228 | PASS | Window hotkey guard retained; zero-funds Space tested through focused Menu. No wager sent. |
| 227 | PASS | Root scrolling locked; measured document dimensions equal viewports1024×576,400×225,800×450,425×812. Inner info scrolling intentionally remains. |
| 104 | PASS | Autoplay opens count/speed confirmation panel; no play sent merely opening/canceling. |
| 31 | PASS | 20× feature confirmation shows30.00 at base1.50; canceled without play. High-cost entries share confirmation path. |
| 107 | NEEDS A HUMAN | SFX/music gain gating remains; both toggles documented. Final listening sweep through every cue/tier still needed. |
| 25 | PASS | Rules render96.1% all modes and25,000× base-bet max; matches exact lookup audit. No target/pending text rendered in settings/HUD. |
| 24 | PASS | Regular-symbol paytable unchanged and matched to math; Keys2/10/50 explained separately. |
| 26 | PASS | Rendered Super/Hidden rules now explain×2/3/5 boost, sticky substitution/cap3, persistence, extra/retrigger rules. |
| 27 | PASS | All six modes/costs unchanged and documented; six below20-mode limit. |
| 29 | PASS | Rendered rules match v8:15 starting spins; extras1/2/3/5; retrigger15; no Keys in free spins. Stale English detailed strings corrected too. |
| 235 | PASS | Sound/Music/Stop/fullscreen/reduced-motion/Space/replay added to guide; obsolete optional stop-limit text removed. |
| 185 | PASS | Rendered three legal paragraphs now include TM/©2026 Engine attribution from supplied checklist. Studio still owns final legal approval. |
| 266 | PASS | Latest v8 weighted Mystery65/30/5 independently computed in original audit; no math changed by this patch. |
| 193 | NEEDS A HUMAN | 1024×576 representative mock spin/bonus viewed; final every-screen readability sign-off not exhaustive. |
| 195 | NEEDS A HUMAN | 400×225 and800×450 snapshots/control checks done; final tiny-text/accessibility evaluation still human. |
| 194 | NEEDS A HUMAN | 425×812 portrait and mobile-hint landscape viewed. Browser viewport capability does not emulate physical touch/iOS. |
| 223 | AT RISK | Root/body/game/landing manipulation disables double-tap zoom by code while allowing internal scrolling. Physical iOS Safari verification remains. |
| 239 | PASS | English mock UI/rules/errors/replay checked; raw backend diagnostics never render. New keys inherit English fallback. |
| 240 | PASS | lang=zz mock launch visibly falls back to English without keys/NaN. |
| 77 | AT RISK | Identified raw-error and board-aria leaks fixed; English social rules/replay/errors/bonus choices checked. Full generated native-language/baked-art wording census still required. |
| 78 | PASS | XSC/XGC show SC/GC, no$ in checked UI. Hostile raw error with$999 is replaced by safe catalog text. |
| 225 | PASS | Safe Normal/Super/Mystery/Feature/Extra chance names retained; social titles transform via t(). |
| 188 | PASS | Social Super replay labels and hostile fetch-error path checked. Errors no longer echo BUY/BET/$ from backend. |
| 171 | AT RISK | Real Super v8 book54 played/replayed, correct46.55× total, no wallet calls. Full win/loss/max/trigger matrix across all modes and actual deployed RGS remains. |
| 172 | PASS | EUR/fr amount5000000 shows5.00 base/1500.00 cost/232.75 win. Invalid/missing amount safely defaults to one unit. URL currency/amount take precedence over response wallet fields. |
| 173 | PASS | Same immutable Super snapshot replayed multiple times. Initial button now Play replay, not prematurely Play again. |
| 174 | PASS | Base amount,300× cost multiplier, real cost,payout multiplier,total result shown and scaled correctly. |
| 243 | NEEDS A HUMAN | 400×225 replay panel fully visible and control fits; final physical small-popout usability sign-off remains. |

## Validation
-270 frontend tests PASS, including real RGS transport mocked fetch/timeout/error/no-retry tests, URL variants, safe player errors, published v8 rule details, Wild native visual/target contract, bonus acknowledgement/abort, replay optional amounts and initial state, social board semantics.
-Typecheck PASS; Vite static build PASS; asset packaging dry-run PASS. Build artifacts only; no upload or commit. Logs next to report.
-Original exact weighted lookup/RTP/Mystery audit retained; maths/books unchanged by UI/approval patch.

## Remaining gates — not software defects falsely marked resolved
1. Studio artwork/IP/title originality judgement (#217/#253).
2. Both audio channels off listening sweep and audio instrument/sample licensing. Existing macOS DLS provenance still needs rights clearance. Do not publish audio assuming code can clear licensing.
3. Physical iOS/Android touch, double-tap, orientation, every modal at all sizes; small-popout readability/accessibility.
4. Full social wording review of generated native catalogs and any baked text, beyond tested English/fallback paths.
5. All-mode replay/outcome and deployed-RGS acceptance, including jurisdiction/error/session-limit matrix. Local mock is not live-platform approval.

Temporary viewport overrides reset and local mock stopped after verification. No background autoplay left running. Only report/proofs persisted.
