# v7.1 Key payout revision — 2026-10-15

Implemented: 3 Keys = 2× base bet + Normal; 4 Keys = 10× + Super; 5+ Keys = 50× + Hidden.

Paid once on the entry spin, including direct/Mystery purchase entries. Separate from Gate multiplication; included in base-game win and capped whole-round total. No Keys or Key payouts during Free Spins. `spinWin.scatterCount` and `scatterAmount` expose authoritative settlement components. Frontend never independently credits or computes these payouts; old books without the optional fields remain playable.

Version: the-gates-v7.1-scatter-diverse-paced-bonuses. Target remains exactly 96.1% for all six modes; new books and fitted weights required. Existing v7 books do not acquire the payout by changing frontend text. Do not reuse old lookups or overwrite an existing package.

10,000-books-per-mode package validation is recorded in the sibling v7.1 report. RGS upload/acceptance and full release sign-off remain separate.
