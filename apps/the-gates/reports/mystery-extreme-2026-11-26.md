# Mystery Extreme and operation-specific gate rewards — 2026-11-26

## Frontend

- Keep Mystery Bonus at 400x, 65/30/5 Normal/Super/Hidden.
- Add distinct RGS mode MYSTERY_EXTREME at 400x, 50/35/15. Never alias it to MYSTERY or choose the tier in the client.
- Both are one-shot, confirmed buys; retain funds/jurisdiction/busy/replay guards and reset to BASE after playback.
- Six-card responsive buy layout; replay title/cost, mode metadata and English/Bulgarian buy/rules descriptions updated. Other languages use existing English fallback for new keys; native review pending.
- Explain separate Extreme payout distribution. More Hidden selections do not promise greater payouts.
- Add rewards: gold rounded badge, +N× label, upward pop/straight flight.
- Multiply rewards: cyan angular badge, ×N label, pulse/twist animation.
- Operation signs, colours and silhouettes are shared by portal and flight. Reduced motion removes movement, not operation cues. Existing clocks/arrival barriers, amounts, reducer and book events remain authoritative.

## Verification

391 frontend tests pass, including seven new operation/new-mode regressions. Existing expected mode/card counts intentionally updated for the sixth buy card. TypeScript and `pnpm run build-game the-gates` pass. Browser access was unavailable in this chat; no screenshot, physical-device or visual sign-off claimed. No live wallet calls or buys.

## Math candidate

Canonical extension sources: math-sdk/games/0_0_the_gates/{mystery_extreme.py,build_mystery_extreme.py,test_mystery_extreme.py,MYSTERY-EXTREME.md}.

Approved separate 400x economics: keep Normal/Super conditional laws, separately reweight Extreme Hidden to whole-round mean 47089/30 =1569.633333x. Exact new-mode mean384.4x =96.1% RTP. Original six book/lookup pairs unchanged. Same evaluated books/IDs/events/payouts, different offline Hidden selection weights for the new mode only.

Available local v14 shared-pool pilot used as an explicit candidate input, not assumed active deployment. New mode 9000 books fully replayed; exact mix/RTP, integer weights, reward/experience/concentration, max-win, tail/CVaR gates pass. Twenty million seeded finite-LUT selections: 96.0605035% sample RTP, approximate 95% interval95.9705489–96.1504581%; exact weighted RTP96.1%. Not fresh engine simulation or rare-event certification.

Candidate remains NOT UPLOADED / NOT PRODUCTION APPROVED. Confirm deployed base math version and production-volume package, quarter-unit platform compatibility and live RGS acceptance before deploying frontend and math together. Old accepted Downloads package must not be silently replaced by this pilot.

## Separate pending change

The reported long/weak SUPER bonus is not fixed by adding Extreme. Proposed 50+spin/min500x/<=1% targets still need product approval. Do not apply an unapproved economy revision to the existing routes.
