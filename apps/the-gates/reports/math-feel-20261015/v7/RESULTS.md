# v7 directional pilot — 2026-10-15

Source installed in math-sdk/games/0_0_the_gates. New library: `/tmp/gates-v7-final-pilot`; existing shipped libraries unchanged. No RGS upload.

30,000 books: 5,000 per mode. All six modes pass independent event/package/weight checks and exact 96.1% weighted RTP. Tail/CVaR publication guards retained.

Super comparison (weighted):
- Identical paying-symbol transitions: 73.1363% → 0.00060470% (required <15%).
- Exactly one paying spin + 14 blanks: 70.943956% → 0.00000200% (required <5%).
- Mean paying free spins: 1.882 → 5.957.

Generator uses smaller varied palettes, secondary surviving-group completion, switched and simultaneous pays, and paced multi-spin bonus candidates. Weighted fitting retains rare paths at minimum positive weight. Extremely low repeat rates reflect that fit; blind replay review still needed to assess whether it feels too engineered. Reward-family diversity needs further weighted review.

Evidence: final-validation.log, final-metrics.json, million-draws.json. Sampling is 1M finite-library draws per mode, not independent candidate generation or 20M+ release sign-off. Python suite retains two pre-existing failures (Mystery precision expectation; missing provenance pool index); new experience tests 6/6 and contract checks 15/15 passed. Quarter-unit RGS compatibility remains unconfirmed. Full-scale regeneration and live acceptance remain outstanding.
