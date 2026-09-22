# The Gates math first handoff

Branch: `feature/the-gates`, based on `feature/veggie-salad-v1` as requested.
Veggie Salad source/assets remain unchanged. New UI lives in `apps/the-gates`;
shared RGS/localization plumbing reused and replay support adapted.

Math generation sources are in the sibling repo:
`math-sdk/games/0_0_the_gates/`.

Read that directory's `README.md` and `EVENT_CONTRACT.md` before implementing
the UI. The user will run `run.py` and validation; this handoff does not claim
generated or validated books.

Confirmed: 96.1% target RTP; 6x5 pay-anywhere grid; gates every three winning
cascades; 15 starting spins for every bonus; full Key entry spins on bonus buys;
Keys pay nothing; 25,000x cap measured against base bet. Preserve 0.25x / 0.75x
Purple Gem awards while live RGS compatibility is investigated. Do not change
the upstream RGS validator or hide rounding in the frontend.

Bonus boards/refills contain no Keys. Extensions/retriggers are gate rewards
only. The 15-spin revision requires regenerating/reweighting any old books;
96.1% remains a target, not a newly validated result.

Buy costs: FEATURE 20x, BONUS 100x, SUPER 300x, MYSTERY 400x. Mystery split
65/30/5 (Normal/Super/Hidden). No direct Hidden purchase.

## Frontend implementation

- Create `apps/the-gates` with Veggie Salad's auth, replay/resume, localization,
  social-language handling, responsive shell and wallet denomination support.
- Replace game-specific board mechanics and book types with The Gates contract;
  do not carry over cluster adjacency, square grids or Veggie multipliers.
- New art, not reused reference PNGs. Source direction is the user's
  `Downloads/The Gates slot_Project` folder: ancient gold/stone gates, Keys,
  Guardian Mask, Sun Medallion, Sacred Eye, Rune Chalice, Crystal Orb and five
  gem symbols. Inspect all mode references before art production.
- Animate scatter entry, pay-anywhere groups, gravity/refills, three-step gate
  progression, gate opening, ordered Hidden rewards, sticky placement,
  persistent bonus multipliers, extensions and max-win termination.
- Book math is authoritative. Keep 100-scale book values separate from
  1,000,000-scale RGS wallet amounts; purchase costs do not rescale payouts.

UI v1 and original artwork now implemented in `apps/the-gates`. See its README
for preview commands, test coverage and pending release gates. The dev-only
preview uses scripted UI fixtures, not generated/validated math books.

User confirmed continuation with 15 spins; Normal/Super buys stay fixed-tier and
Mystery keeps the agreed 65/30/5 selection. No Keys during bonuses; extensions
only through gates.
