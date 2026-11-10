# v11: carried Super/Hidden tumble progress

## Approved behavior
- Super/Hidden: carry 0–2 winning-Cascade progress across Free Spins, including blank spins and extensions.
- Every third winning Cascade opens a Gate; remainder resets to zero. Hidden still gives two ordered rewards.
- Bonus entry starts at zero; bonus end clears progress. Normal/Base/Chance/Feature remain per-spin.
- More Gates permitted; previous Super/Hidden 6/8 averages become baseline floors, not fixed ceilings.
- RTP remains 96.1%; max win, reward-kind/inner-reward mix and tail safeguards unchanged.

## Isolation / compatibility
- New math sources: `math-sdk/games/0_0_the_gates_v11` (sibling repository).
- Existing v10 source and 500k artifacts must not be modified. Their validation remains old-mechanic validation only.
- New `spinStart.gateProgressStart` contains authoritative 0–2 meter value.
- UI accepts the optional field only for Super/Hidden Free Spins. Legacy books without it retain old per-spin reset.
- Reconnect restores the meter from the event prefix, not browser storage.
- Updated rule copy must ship with v11 books, not as a standalone old-math rules release.

## Proposal changes
- Distribute the planned initial-bonus Cascade budget across shorter 1–3-Cascade spins.
- Extension-spin proposals favor shorter/blank chains to avoid a self-amplifying Gate/extra-spin loop.
- All boards, wins and Gates still evaluated by the deterministic engine; no assigned payouts or fabricated wins.

## Gates before production
- [x] Math regression suite (67 tests).
- [x] Frontend regression suite (353 tests) / typecheck.
- [x] Rebalanced 10k/mode package at exactly 96.1% in all modes, using retained independent-mode candidates.
- [x] All 60,000 selected books fully replay-validated; hashes, weights, risk and package checks pass.
- [ ] Report measured Gate averages, per-spin Cascade distribution and bonus experience metrics.
- [ ] Fresh production books and sign-off. Do not reuse/reweight v10 event streams to simulate carry.

## Validated 10k/mode upload candidate
`math-sdk/games/0_0_the_gates_v11/library-v11-balanced-10k-20261018/publish_files`

Largest decoded file: MYSTERY, 985,047,653 bytes. All six RTPs: 96.1%. MYSTERY P(>=10,000x): 0.00449550025 (<0.005). See `configs/local_validation_report.json`. RGS acceptance/Studio review remain pending. Upload the complete package; never mix weights from other runs.

## Door-closed meter reset
Visible three-gem progress is consumed at regular Gate door impact (360ms at normal speed, scaled with the Gate clock; immediate in reduced motion), rather than waiting for the next spin. This is presentation-only: authoritative events, awards and multiplier values are not changed. Prefix restore preserves consumed-meter presentation; a new progress/spin event restores the book-supplied meter. Rules explicitly describe Super/Hidden blank-spin carry and the door-closed reset; Normal remains per-spin.
