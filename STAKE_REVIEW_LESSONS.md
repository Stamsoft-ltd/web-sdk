# Stake Review Lessons

Findings from Stake Engine review rejections, written as rules to apply **before** the first
submission of the next game. Every entry here cost us at least one review cycle on a shipped game.

**How to use this file**

- Read it end to end when starting a new game, and again before every submission.
- When a reviewer raises something new, append a section here in the same shape
  (Rule → Why we failed → Correct implementation → Where it applies → How to verify) and link
  the game/date it came from.
- Never delete an entry after fixing it — the fix lives in one game, the rule lives here.

| ID | Topic | Raised on | Date |
| --- | --- | --- | --- |
| R-01 | Decimal places: balance/bet vs. win values | forest-gang, then magnetic again | 2026-08-20 |
| R-02 | Social-mode prohibited words leaking from shared packages | forest-gang, then magnetic again | 2026-08-20 |
| R-03 | Hand-typed paytable cells drift from the math | magnetic | 2026-08-22 |
| R-04 | Every purchasable/activatable mode needs a Game Info entry | magnetic | 2026-08-22 |
| R-05 | The on-grid win amount must be anchored to the cluster that earned it | magnetic | 2026-08-26 |
| R-06 | An error modal the player cannot dismiss ends the session | theme-park | 2026-09-02 |
| R-07 | Error text raised outside the UI layer bypasses i18n and social overrides | theme-park | 2026-09-02 |
| R-08 | Game rules must state the free-game trigger, the reward, and the re-trigger rule | theme-park | 2026-09-02 |
| R-09 | A derived, rounded multiplier must reconcile with the money beside it | theme-park | 2026-09-02 |
| R-10 | Popout (short, wide) is a fourth layout, and a label beside a value is what breaks in it | theme-park | 2026-09-02 |
| R-11 | Every volume control must be read by something | theme-park | 2026-09-02 |
| R-12 | An overlay that stays inside the window can still cover the game | theme-park, four failed rounds | 2026-09-04 |

---

## R-01 — Balance and bet show 2 decimals; win values show up to 4

**Reviewer wording (magnetic, 2026-08-20):**

> We kindly ask that the balance and bet amount be displayed with 2 decimal places. However, in game
> values such as win animations, round sums, and spin wins must display the exact value with up to 4
> decimal places when necessary. This is particularly important for 0.01 bet amounts, as it prevents
> smaller wins from being displayed as `0.00` and ensures that low multipliers are reflected
> accurately.

Screenshot evidence: HUD reading `BALANCE $999.946` — three decimals on the wallet balance.

### The rule

Money on screen splits into exactly two classes, and they format differently:

| Class | Digits | Examples |
| --- | --- | --- |
| **Wallet money** | Exactly the currency's decimal count (2 for most, 0 for JPY/KRW/IDR, 3 for the Gulf dinars). Never more, never fewer. | Balance, bet amount, total bet/cost, buy-bonus prices, autoplay loss/win limits, bet-menu chips |
| **Win money** | Currency decimals as the *minimum*, expanding **up to 4** when needed to show the exact settled value | Spin win, round/total win, win-animation counters, big-win countups, cascade/step wins, free-spin accumulators, replay win, win capsule |

Two hard constraints that come from the same requirement:

1. A wallet value must never grow extra digits just because the underlying float is precise. Balance
   is `999.946`? Display `$999.95`. This is what got flagged.
2. A genuinely non-zero win must never render as `0.00`. At a `0.01` bet, a `0.16x` multiplier pays
   `0.0016` — that has to read `$0.0016`, not `$0.00`.

### Why we failed it (twice)

Both games route every money string through one shared helper,
`packages/utils-shared/currency.ts → formatCurrencyAmount(currency, amount, minFractionDigits?)`.

That helper calls `fractionDigitsForAmount()`, which **expands the decimal count until the value
round-trips exactly**, up to `MAX_FRACTION_DIGITS = 8`. It was written to satisfy constraint (2) —
and it does — but it was then used for *every* money surface, so it also applied precision expansion
to the balance and bet. One helper, two incompatible contracts:

- `apps/magnetic/src/state/magneticStake.svelte.ts:217` → `formatCurrencyAmount` (balance, bet, buy-bonus costs)
- `packages/utils-shared/amount.ts:36` → `numberToCurrencyString` / `bookEventAmountToCurrencyString` (wins)

Both end in the same expanding formatter. The forest-gang fix (`apps/forest-gang/src/lib/utils/currency/index.ts`)
copied the same shape, which is why the finding came back on magnetic.

Second latent bug in the same helper: the cap is 8, not 4. Nothing prevents a win rendering as
`$0.00123456`, which is also outside what the reviewer asked for.

### Correct implementation

Expose **two** named functions from the shared currency module and never let a caller pick digits
ad hoc:

```ts
const WIN_MAX_FRACTION_DIGITS = 4;

/** Wallet money: balance, bet, costs, limits. Fixed at the currency's decimal count. */
export const formatWalletAmount = (currency: string, amount: number) => {
  const meta = metaFor(currency);
  return render(currency, amount, meta.decimals, meta.decimals); // min === max, no expansion
};

/** Win money: spin/round/total wins, countups, animations. Exact value, up to 4 decimals. */
export const formatWinAmount = (currency: string, amount: number) => {
  const meta = metaFor(currency);
  const exact = fractionDigitsForAmount(amount, meta.decimals); // may exceed 4
  return render(currency, amount, meta.decimals, Math.min(exact, WIN_MAX_FRACTION_DIGITS));
};
```

Edge case worth handling explicitly: if a non-zero win rounds to all-zeros at 4 digits (e.g.
`0.00001`), constraint (2) beats the 4-digit cap — keep expanding until the first significant digit
appears rather than printing `$0.0000`. This is rare but it is exactly the failure the reviewer
is guarding against, so do not let the cap re-introduce it.

Do **not** keep a single `formatCurrencyAmount(amount, fractionDigits?)` with an optional override.
The optional argument is what let the wrong contract spread — every call site that forgot to pass a
value silently inherited the expanding behaviour.

### Where it applies (checklist for the next game)

Wallet formatting — must be exactly 2 (or the currency's decimals):

- [ ] HUD balance
- [ ] HUD bet / total bet (including multiplied bets in feature/chance modes)
- [ ] Bet menu chips and the bet-selector list
- [ ] Buy-bonus modal: every price and the "your bet" line
- [ ] Autoplay: loss limit, single-win limit, balance increase/decrease stops
- [ ] Replay HUD: bet and cost

Win formatting — currency decimals up to 4:

- [ ] HUD win readout (last round)
- [ ] Win capsule / total-win banner
- [ ] Big-win, mega-win, max-win countup animations
- [ ] Per-symbol / per-cluster / per-cascade win popups
- [ ] Free-spin and bonus-round accumulators, and the end-of-bonus congrats amount
- [ ] Replay HUD win/payout

### How to verify before submission

1. Launch with the smallest supported bet (`0.01`) — this is the case the reviewer tests.
2. Confirm the balance reads exactly 2 decimals at all times, including immediately after a
   fractional win settles (that is when the extra digit appeared in the screenshot).
3. Force a low-multiplier win (a `0.16x`-style outcome) and confirm the win readout, the win
   animation, and the round total all show the non-zero value (`$0.0016`), not `$0.00`.
4. Repeat once in a 0-decimal currency (JPY) and once in a 3-decimal currency (KWD) — the wallet
   rule is "the currency's decimals", not literally 2.
5. Keep unit tests for both functions next to the currency tests
   (`apps/magnetic/tests/currency.test.ts` is the existing pattern):

```ts
expect(formatWalletAmount('USD', 999.946)).toBe('$999.95'); // the rejected case
expect(formatWalletAmount('USD', 1.2)).toBe('$1.20');
expect(formatWinAmount('USD', 0.0016)).toBe('$0.0016');     // 0.01 bet, 0.16x
expect(formatWinAmount('USD', 1.2)).toBe('$1.20');
expect(formatWinAmount('USD', 0.00123456)).toBe('$0.0012'); // capped at 4
expect(formatWalletAmount('JPY', 1234.5)).toBe('¥1,235');
expect(formatWalletAmount('KWD', 1.2)).toBe('KD1.200');
```

### Status

Constraint (2) — sub-cent wins — was a **separate earlier rejection**:

> The game does not correctly display payouts below one cent. The payout value returned by the RGS
> requires additional decimal precision, but the game is rounding, truncating, or displaying the
> amount incorrectly.

**That half is fixed and verified in magnetic (2026-08-20).** Executed the real pipeline
(`bet × bookAmount / 100 → formatCurrencyAmount`) over book amounts 1–2000 at the 0.01 bet:

- Every value renders exactly — `book=1 → $0.0001`, `16 → $0.0016`, `160 → $0.016`.
- **Zero** cases render as `$0.00` while being non-zero (0 of 2000).
- Nothing exceeds 4 decimals at any USD bet level.

The 4-decimal ceiling is satisfied *structurally*, not by clamping: the math emits book amounts as
integers in 1/100-bet units (`int(round(...))`), so the finest possible win at a 0.01 bet is exactly
`0.0001` — 4 decimals. That is why constraint (2) and the 4-digit cap do not currently collide.

Two things that ceiling does **not** cover, worth knowing before they bite:

- A 3-decimal currency at its smallest bet can produce 5 decimals (`KWD 0.001` bet, `book=1` →
  `KD0.00001`). Outside the reviewer's stated ceiling, but only reachable if KWD bet templates go
  that low.
- `CapsulePanel.svelte:57`, `LandscapeCapsule.svelte:47` and `PortraitTopBar.svelte:43` format the
  countup as `bookEventAmountToCurrencyString(Math.round(winDisplay.current))` — rounding the
  **book** amount. Harmless today (settled book amounts are already integers, verified identical
  output), but it is a truncation waiting for the first fractional book amount: `book=16.4` would
  display `$0.0016` instead of `$0.00164`. Round the tween for display smoothness if needed, never
  the settled value.

Constraint (1) — wallet precision — is the **currently open** rejection. Confirmed by execution:
`formatCurrencyAmount('USD', 999.946, 2)` → `$999.946`, and `1234.5678` → `$1,234.5678`.

**Both constraints are now fixed (2026-08-20).** The split described above was implemented:

- `packages/utils-shared/currency.ts` — added `formatWalletAmount` (fixed at the currency decimals)
  and `formatWinAmount` (min = currency decimals, max 4, with the never-round-to-zero escape).
  `formatCurrencyAmount` is kept but `@deprecated`, since penguin-slide / press_play_template still
  import it.
- `packages/utils-shared/amount.ts` — `numberToCurrencyString` is now the wallet contract and
  `bookEventAmountToCurrencyString` the win contract, which fixes every shared HUD component at
  once (`LabelBalance`, `LabelBet`, `BetMenuAmountToggle`, `BonusCards`, `ModalBuyBonusConfirm`).
- magnetic + forest-gang — their per-game `formatCurrencyAmount` wrappers lost the optional
  `fractionDigits` argument and gained a sibling `formatWinCurrencyAmount`, used by the replay win.
- The three countup components no longer round the settled book amount (see the bullet above).

Verified by executing the assertions: 14/14 pass, including a sweep of book amounts 1–2000 at the
0.01 bet (nothing renders as `$0.00`) and the USD bet ladder (nothing exceeds 4 decimals). Both apps
build clean.

---

## R-02 — Social-mode prohibited words leak from the shared packages, not the game's own i18n map

**Reviewer wording (magnetic, 2026-08-20):**

> Additionally, please ensure that all prohibited words for the game's social mode are rephrased
> accordingly. For more information, please refer to the link below.
> https://stake-engine.com/docs/approval-guidelines/jurisdiction-requirements

Screenshot evidence: the autoplay-stop dialog reading
`INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.`
— three prohibited terms (`funds` ×2, `bet` ×2) in one sentence.

### The rule

Scrubbing the game's own `messagesMap/en.ts` is **not** sufficient. Player-facing English also comes
out of the shared workspace packages (`components-ui-html`, `utils-xstate`), and those strings never
appear in the game's message map — so a scrub audit that only reads the game's map reports clean
while the shared text renders unscrubbed on screen.

### Why we failed it (twice)

Three mechanics combine into a silent failure:

1. **In the shared packages, the translation key *is* the full English sentence.**
   `packages/components-ui-html/src/i18n/i18nDerived.ts:20`:
   ```ts
   insufficientFunds: () => stateI18nDerived.translate(
     'INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.'),
   ```
2. **Lingui returns the key verbatim when the catalog has no entry.**
   `stateI18nDerived.translate` is `i18n._(i18n.t(value))` (`packages/state-shared/src/stateI18n.svelte.ts`).
   A missing entry is not an error and leaves no marker — the raw gambling copy just renders.
3. **Our audit script only imported the game's own maps.** The documented method
   (`en.ts` + `socialOverridesEn.ts`, merge, regex the values) cannot see a string that lives in
   another package and was never added to either map.

The magnetic gap is instructive: the team *did* scrub this dialog. `messagesMap/en.ts:311`
`NO BALANCE BODY` was rewritten and given a social override
(`socialOverridesEn.ts:122`). But that key feeds the game's own `InsufficientFundsModal.svelte`,
which only intercepts `stateModal.modal.name === 'error'`. The screenshot is a **different code
path** — autoplay stopping for lack of balance sets
`{ name: 'autoSpinMessage', message: 'insufficientFunds' }`
(`packages/utils-xstate/src/createIntermediateMachineAutoBet.ts:20`), which `<Modals>` renders via
the shared `ModalAutoSpinMessage.svelte` using the unscrubbed shared string. The game's own scrubbed
dialog is bypassed entirely.

That path is also why manual QA missed it: you only reach it by running **autoplay until the balance
runs out**, not by pressing spin with a low balance.

### The complete shared-package leak set

Every translation key referenced from `components-ui-html` / `components-ui-pixi` /
`components-shared` / `utils-xstate` (scan below). These six carry prohibited substrings and **must**
be present in every game's `socialOverridesEn.ts`, regardless of whether the game appears to use them:

| Shared key | Prohibited term | Social replacement |
| --- | --- | --- |
| `BET` | bet | `PLAY` |
| `BET MENU` | bet | `PLAY MENU` |
| `SELECT YOUR BET` | bet | `SELECT YOUR PLAY AMOUNT` |
| `BUY BONUS` | buy | `GET BONUS` |
| `PAYTABLE` | pay (substring) | `WIN TABLE` |
| `INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS TO YOUR ACCOUNT OR LOWER THE BET LEVEL.` | funds, bet | `Your balance is too low for this play amount. Get more coins or lower your play amount.` |

Magnetic as of this rejection covers `BET`, `BUY BONUS`, `PAYTABLE` — and is **missing the other
three**, including the one in the screenshot.

The remaining shared keys are clean and need no override: `ADVANCED`, `AUDIO`,
`AUTO PLAY HAS STOPPED DUE TO`, `AUTO SPIN`, `AUTO SPINS`, `BALANCE`, `CONFIRM`, `DISABLE`, `EXIT`,
`FREE SPINS`, `INFO`, `LOSS LIMIT`, `LOSS LIMIT REACHED`, `MASTER VOLUME`, `MAX`, `MENU`,
`MUSIC VOLUME`, `NOTIFICATION`, `NUMBER OF ROUNDS`, `SETTINGS`, `SINGLE WIN LIMIT`,
`SINGLE WIN LIMIT REACHED`, `SOUND EFFECT VOLUME`, `SOUND OFF`, `SOUND ON`, `START AUTOPLAY`,
`STOP`, `TURBO`, `WIN`, `+`, `-`.

### Correct implementation

Add the six keys above to `socialOverridesEn.ts` verbatim — the long sentence must be copied
character-for-character, since it is matched as a key. Then extend the audit to the shared packages:

```bash
# Enumerate every translation key the shared packages can render.
grep -rhno "translate('[^']*')" --include="*.ts" --include="*.svelte" \
  packages/components-ui-html/src packages/components-ui-pixi/src \
  packages/components-shared/src packages/utils-xstate/src \
  | sed "s/.*translate('//;s/')\$//" | sort -u
```

Every key that scan returns is either (a) free of prohibited substrings, or (b) present in the
game's `socialOverridesEn.ts`. Assert that in CI — the list changes whenever the shared packages
change, and no game is notified when it does.

A better long-term fix, if we ever touch the shared packages: ship a
`socialOverridesShared.ts` inside `components-ui-html` and merge it in `SocialI18nSync.svelte`
*below* the game's own overrides. Then a new shared string is scrubbed once for every game instead
of silently leaking into all of them.

### How to verify before submission

1. Boot in social mode (`?social=true`) — see the CDP recipe in the forest-gang verification notes.
2. **Walk every modal path, not every screen.** The same logical message can have two dialogs with
   two different keys. Specifically exercise:
   - [ ] Autoplay run to zero balance (→ `ModalAutoSpinMessage`, the missed path)
   - [ ] Autoplay stopped by loss limit and by single-win limit
   - [ ] Spin pressed with insufficient balance (→ the game's own dialog)
   - [ ] Bet menu / bet selector opened
   - [ ] Buy-bonus confirm, and its cancel path
   - [ ] Every info/rules page, and the settings and audio panels
3. Dump rendered DOM text and regex it against the prohibited table — screenshots do not work for
   modals, read the DOM.
4. Remember the substring rule: reviewers match `pay` inside `payline` / `paytable`, `bet` inside
   `bet level`, `fund` inside `funds`. Whole-word regexes will pass a build the reviewer rejects.

### Status

**Fixed in magnetic 2026-08-20.** Added `BET MENU`, `SELECT YOUR BET` and the insufficient-funds
sentence to `apps/magnetic/src/i18n/socialOverridesEn.ts`, reusing forest-gang's already-approved
wording verbatim. Note what this says about the failure: forest-gang had **all three** overrides
since its own rejection — magnetic simply never inherited them. Copying a game does not copy the
compliance fixes made after the fork, so R-02 is a checklist item for every new game, not a
one-time repair.

Verified by execution: all 37 shared-package keys now render clean in social mode, and a substring
scan of the full merged map (242 keys) is clean apart from the 3 documented false positives
(`BUY CONFIRM`'s `%cost%` placeholder, `DISCLAIMER TEXT`'s required "Stake Engine" mark, and
`BUY MEGA DESC`'s "be**tw**een"). Scan values only — keys are internal identifiers and are never
rendered, so including them produces ~75 meaningless hits.

Still outstanding as a durable fix: the shared packages ship unscrubbed English with no per-game
notification mechanism. Until `components-ui-html` carries its own `socialOverridesShared.ts`, every
new game must run the grep above and copy the six overrides by hand.

---

## R-03 — A hand-typed paytable cell will drift from the math; generate or diff it

**Reviewer wording (magnetic, 2026-08-22):**

> We found a payout mismatch in the base game. The game highlighted a winning cluster of 6 chip
> symbols and paid $0.15 on a $1.00 bet. According to the paytable, the chip symbol pays 0.1x for a
> cluster of 6, so the expected win is $0.10. The paid value of 0.15x does not correspond to any chip
> cluster value in the paytable. Event ID: 204994

**Rule.** The payout was CORRECT — the printed table was wrong. Any paytable rendered as literal
strings in a component is a second source of truth for numbers the RGS already owns, and one wrong
character reads to a reviewer as a rigged payout. Either build the table from the game config at
render time, or diff it against the config in CI.

**Why we failed.** `CustomInfoModal.svelte` holds the 8x12 grid as hard-typed arrays
(`'0.08x', '0.1x', ...`). L4 (the chip) at a 6-cluster was typed `0.1x` where the math pays `0.15x`
— a dropped `5`, in one of 96 cells. Every other cell was right, so proofreading by eye had already
passed over it several times.

**Correct implementation.** Machine-diff the rendered values against `src/game/config.ts` (the app's
copy of the math paytable) AND against the published math's own
`library/configs/config_fe_<gameID>.json`, which is generated by the math repo and is the
authoritative table the RGS pays from. A 20-line script parses `makeTierPaytable([...])` bands,
expands them per cluster count, and compares. Run it whenever either side changes.

**Where it applies.** Every game with a hand-authored info/paytable screen, and every hard-typed
number in the rules: mode costs, RTP, max win, free-spin counts, multiplier value lists. All of
those exist in the config or the published math config and can be diffed the same way.

**How to verify.** Boot the game, open the info modal, dump the `<table>` text over CDP, and compare
that string against the config-derived table — verify what RENDERS, not what the source says.

**Status.** Fixed in magnetic 2026-08-22 (single cell, L4@6 -> `0.15x`). Full re-diff after the fix:
0 mismatches across all 8 symbols x cluster counts 5-49 against both the app config and the
published math config; symbol art in each row also confirmed to map to the same asset the board
renders for that symbol key.

---

## R-04 — Every mode the player can activate or buy needs its own Game Info entry

**Reviewer wording (magnetic, 2026-08-22):**

> Please add an explanation in the Game Info for the Extra Chance mode. The mode is available in the
> game and its card shows a short description and cost, but the mode is not mentioned anywhere in the
> Game Info, the Feature Buy page only lists the 50x, 100x and 500x modes, and there is no
> description, cost or RTP information for Extra Chance in the game rules.

**Rule.** The rules must describe every entry in `betModes` the player can select — including
"activate" toggles that are not bought outright — with description, cost as a multiple of the bet,
and RTP. A mode card in the buy menu is not documentation.

**Why we failed.** Magnetic ships five bet modes (BASE, CHANCE 2x, FEATURE 50x, BONUS 100x,
SUPER 500x). The Feature Buy page was built from the Figma frame, which showed three cards, so
CHANCE — the one mode that is toggled rather than bought — was never added.

**Correct implementation.** Drive the page from `config.betModes` where practical; where the layout
is hand-built, add the missing card and REUSE the buy-menu's own i18n keys
(`BUY EXTRA CHANCE TITLE` / `DESC`) instead of writing new ones. The rules page and the mode card
then cannot drift, and all 18 locales are covered without new translation work.

**Watch the layout.** Adding a fourth card to a three-card row shrinks each card ~25%. The card
frame art is fixed-height, so the copy overflows it — measured 10-21px in English and up to 33px in
Russian at 1600x900. Re-measure `scrollHeight - clientHeight` per card in the wordiest locale (ru,
then de) across desktop 16:9 / 4:3, mobile landscape and portrait after any such change. Note that
at 16:9 the clamp MAXIMUM is what renders, not the cqmin term — lowering only the coefficient does
nothing there.

**Status.** Fixed in magnetic 2026-08-22: fourth card added to page 5 of the info carousel with
COST `2x BET` and RTP `96.1%`, and the row's type/icon scale re-tuned to 0px overflow in en/de/ru
across all six viewports.


**Two more layout traps found while fixing this (same file, 2026-08-22):**

- *Equal flex halves push art through its frame.* Page 3 stacks Wild and Multiplier Wild in one
  column with `flex: 1 1 0`, i.e. equal halves regardless of copy length. Wild's description is ~3x
  longer, so its half overflowed and the magnet art rendered on top of the frame's lower rail. Fix is
  structural — `flex: 1 1 auto` so each card takes the height its content needs — plus a smaller icon
  cap and a copy step-down for the wordy card. Verify by measuring art-bottom vs frame-bottom minus
  the rail (the rail is 4.2% of the frame art's height), not by eye.
- *Popout windows are short, not narrow.* The `max-height: 490px` landscape block used
  `justify-content: space-between`, which spreads four rows across the full card in a 700x460 popout
  (content spanned 7→234px of a 241px card). Centred stacking with a small gap closes it (53→187px).
  Popout/short-viewport is a distinct case from mobile landscape; check it explicitly.

Final state: page 3 and page 5 both measure 0px overflow on every card across desktop 16:9 / 1280 /
4:3, popout 700x460 and 640x420, mobile landscape 900x480, and portrait 430x932 / 768x1024.


---

## R-05 — The win amount drawn on the grid belongs to a cluster, not to the grid

**Reviewer wording (magnetic, 2026-08-26):**

> The win displayed on the grid is not properly aligned with the symbols that form the winning
> cluster, which can cause player confusion. For example, when a new cluster with a higher payout is
> formed, the game can still display the payout from the previous cluster instead of updating to the
> new one.

**Rule.** In a cluster game, every payout drawn over the board must sit ON the cells that earned it,
must be that cluster's own amount rather than the spin total, and must be re-derived from the board
currently on screen. A single figure parked at a fixed spot is read as belonging to whatever is lit
at that moment — which, on a board where clusters grow through respins, is regularly a cluster that
no longer exists.

**Why we failed.** `Win.svelte` rendered ONE `WinAmountPlaque` at `boardLayout.x/y` — the centre of
the grid — carrying `setWin.amount`, the whole spin's total. Measured on magnetic's 7x7 board with
the paytable's own example cluster (H1 at reels 4-6, rows 0-2): the plaque centre sat **2.0 cells
left and 2.2 cells below** the cluster's centroid, i.e. on top of five unrelated symbols. With two
paying clusters the player got one number in the middle and no way to attribute it to either. The
book had the geometry all along — `winInfo.wins[]` carries `positions` and `amount` per cluster —
it was simply never used by the presentation.

**Correct implementation.**

- Capture `winInfo.wins` into module state in the book-event handler, and **clear it at the top of
  every `reveal`**. That reset is the staleness fix: a spin whose `winInfo` is suppressed (magnetic
  skips non-final ones in `superspin`) can otherwise reach `setWin` holding an older spin's clusters.
- Pass the clusters **through the `winUpdate` emitter event alongside the amount**, rather than
  letting the presentation read shared state. The figures and the cells they are drawn on then
  cannot come from different spins by construction.
- Place each plaque at the cluster's **centre of mass**, not its bounding-box centre — an L-shaped
  cluster's bbox centre can land on cells the cluster does not own.
- Size it from the cluster's reel span, clamped (magnetic: 2.3-4.2 cells), clamp the position inside
  the grid, and de-overlap multi-cluster boards by pushing later plaques clear vertically.
- Roll each plaque up on its **own** share (`clusterAmount * countUp/total`) so the settled figure is
  the cluster's real payout, and print the exact settled value on the last frame instead of the
  tween's, which can land a cent short.
- Round the **in-flight** value only. An unrounded fractional book amount renders as `$3.4893` and
  jitters — the same trap `CapsulePanel` already documents for the total-win box.

**Where it applies.** Any cluster/scatter-pays game. Line/ways games are exempt only because the
payline itself does the attribution — if a ways game shows a bare total over the reels, it has the
same defect.

**How to verify.** Do not eyeball it. Intercept `/wallet/play` in the page and substitute a book
built from `library/configs/event_config_base.json` with clusters at known positions, then read the
rendered amounts and their global bounds straight off the pixi stage (`globalThis.__PIXI_APP__`,
walk for nodes with a `text` property) and compare against the centroid you asked for. Run three
spins in sequence — two clusters, then a losing spin, then one cluster — and assert the losing spin
leaves **no** amount on the grid.

**Status.** Fixed in magnetic 2026-08-26. Verified at desktop 1728x1080 and portrait 430x932: single
cluster label centred on its cluster (was 334px away), two clusters each labelled with their own
$0.54 / $12.00, losing spin clean, roll-up printing 2-decimal values throughout.


---

## R-06 — Every error the player can recover from must be dismissible

**Reviewer wording (theme-park, 2026-09-02):**

> After the Insufficient Balance message is displayed, the game prevents any further gameplay. The
> player should be able to dismiss the message, select a lower bet level, and continue playing.

**Rule.** An error modal is dismissible unless there is genuinely nothing to return to. Split errors
into two classes at the point they are raised, not at the point they are rendered:

| Class | Example | Modal |
| --- | --- | --- |
| **Recoverable** — the state machine falls back to idle and the game is playable | insufficient balance, a failed `/wallet/play`, a network blip | Dismissible: × button, Escape, click-away |
| **Fatal** — there is no session and nothing works | `/wallet/authenticate` failed | Persistent, as before |

**Why we failed.** `ModalError.svelte` rendered `<Popup persistent>` for *every* error. `persistent`
in `components-shared/Popup.svelte` suppresses the × button **and** the Escape hotkey **and** the
click-to-close layer, so the modal had no exit at all. Meanwhile the machine underneath was fine:
`createIntermediateMachineBet` takes `fetching --onError--> end`, and the parent takes `bet --onDone-->
idle`. The game was idle and playable the whole time — the player just could not see it, because the
HUD disables input while `stateModal.modal !== null` and `.game-shell.is-modal` sets
`pointer-events: none`. A one-word prop turned a routine "lower your bet" into an ended session.

**Correct implementation.**

- Add the class to the modal *state*, not to the component: `ModalError` in
  `packages/state-shared/src/stateModal.svelte.ts` carries `recoverable?: boolean`.
- Set it where the error is raised. In `packages/utils-xstate/src/createPrimaryMachines.ts` both
  `failInsufficientFunds()` and the `handleRequestBet` catch set `recoverable: true`;
  `Authenticate.svelte` deliberately does not.
- Render `<Popup persistent={!recoverable}>`.

**Where it applies.** Every game — `ModalError` and `Popup` are shared packages, so this was the
same defect in all of them.

**How to verify.** Do not try to reach it through the UI. Boot the game under CDP, then
`Network.setBlockedURLs({urls: ['*wallet/play*']})` and press SPIN. Assert, in this order:
`[data-test="close-button"]` exists → click it → `.pop-up-wrap` is gone → `.game-shell` no longer
carries `is-modal` → unblock and spin again and the balance moves. `apps/theme-park/tests/
insufficientBalanceModal.test.ts` pins the same three properties as a unit test (dismissible when
recoverable, persistent when not, social copy) so it cannot regress silently.

---

## R-07 — Error strings raised outside the UI never reach the translator

**Reviewer wording (theme-park, 2026-09-02):**

> The Insufficient Balance message in Social Mode contains restricted terminology. Please replace it
> with appropriate wording that complies with the jurisdiction requirements.

Screenshot evidence: the modal reading `Error: INSUFFICIENT FUNDS TO PLACE THIS BET. PLEASE ADD FUNDS
TO YOUR ACCOUNT OR LOWER THE BET LEVEL.` with `FUNDS`, `BET` and `FUNDS` underlined in red.

**Rule.** A user-visible string may only be produced by code that can see the i18n catalog. Anything
raised deeper than that — a state machine, a fetch wrapper, a validator — passes a **code**, and the
component looks up the copy.

**Why we failed.** This is R-02 again, arriving by a new road. The catalog had the right entry all
along: `i18nDerived.insufficientFunds()` resolves the key that
`apps/theme-park/src/i18n/socialOverridesEn.ts` overrides to *"NOT ENOUGH BALANCE. GET MORE COINS OR
LOWER YOUR PLAY LEVEL."*. But `failInsufficientFunds()` in `utils-xstate` did
`new Error('INSUFFICIENT FUNDS TO PLACE THIS BET…')` and put the Error object straight into
`stateModal.modal.error`, and `ModalError` printed it with `{error}`. The i18n layer was never
consulted, so the override could not fire. `utils-xstate` sits below the UI and has no catalog — it
could not have got this right by editing the string.

Note the second tell: the modal also read *"Sorry, something went wrong."* over a routine balance
message. Generic error chrome on a non-error is its own quality flag.

**Correct implementation.**

- `ModalError` state carries `code?: 'insufficientFunds'`. The raiser sets the code; it may still
  throw a descriptive `Error` for the console, but the *modal* renders
  `i18nDerived.insufficientFunds()` and titles it `i18nDerived.notification()`, not "went wrong".
- Grep rule for the next game: `grep -rn "new Error('[A-Z ]" packages/ apps/` — a shouty
  capitalised Error message below the UI layer is almost always a string on its way to a player.

**Where it applies.** Every game using `utils-xstate`. Also check any `throw`/`toast`/`console`
string that a component might surface verbatim.

**How to verify.** Mount the modal with `stateConfig.jurisdiction.socialCasino = true` and assert the
rendered text contains the social wording and does **not** match `/\bFUNDS\b/i` or `/\bBET\b/i`
(see `insufficientBalanceModal.test.ts`). Reviewers match substrings, so assert on the rendered DOM,
never on the catalog.

---

## R-08 — The rules must state how the free game triggers, what it pays, and whether it re-triggers

**Reviewer wording (theme-park, 2026-09-02):**

> The game rules do not clearly explain the free game or re-trigger conditions. Please update the game
> rules to include the requirements for triggering free games and any available re-trigger conditions,
> including the rewards provided for each qualifying combination.

Screenshot evidence: the reviewer underlined *"Scatter symbols do not need to follow a payline and are
used to trigger their associated bonus features."* — true, and it answers none of the three questions.

**Rule.** The Ways-to-Win page answers, explicitly and in numbers:

1. **Trigger** — how many of which symbol, and where they may land.
2. **Reward** — the exact count awarded (*"10 Free Spins"*, not *"free spins"*).
3. **Scaling** — what more than the minimum pays, **or** a sentence saying no more is possible.
4. **Re-trigger** — the rule either way. *"Free Games cannot be retriggered"* is an answer;
   silence is not.

Point 3 and point 4 are the ones that get skipped, because "there is nothing to say" feels like a
reason to say nothing. It is the opposite: an absent rule reads as an undocumented rule.

**Why we failed.** The page described wilds, scatters, lines and multipliers, and simply had no free
-games section. The facts were all in the repo — `totalFs` is annotated `// always 10` in
`typesBookEvent.ts`, every `freeSpinTrigger` in `library/books/*.jsonl` carries exactly 3 scatter
positions, and no re-trigger event type exists — so nobody had to guess; nobody had written it down.

**Correct implementation.** Four keys (`INFO WTW FREE TITLE / TRIGGER / MAX / RETRIGGER`) added to
**all 16** locale maps plus `socialOverridesEn`, rendered between the payline diagram and the
wild-multiplier block.

**Where it applies.** Every game with a bonus. Do this from the math, not from memory.

**How to verify.** Before writing the copy, prove each number from the artifacts:
`payoutMultiplier` and the final win event agree per book; count `positions` on `freeSpinTrigger`;
grep the book-event union for a re-trigger type. Then read the rendered page back as DOM text.

---

## R-09 — A rounded multiplier next to real money is read as an equation

**Reviewer wording (theme-park, 2026-09-02):**

> For event 178 in the Ante game mode, the payout should be displayed as $50.01 rather than $50.00.
> Please review and correct the payout calculation and display.

**Rule.** If a screen shows a cost, a multiplier and a win side by side, a reviewer will multiply
them. Either the three reconcile exactly, or the multiplier is not yours to invent — take the RGS's
own `payoutMultiplier` (defined by the API as `Payout / Amount`, so it reconciles by construction).

**Why we failed.** The payout was right and the multiplier was made up. `ReplayHud` showed
`TOTAL BET COST $3.00`, `PAYOUT MULTIPLIER 16.67x`, `TOTAL WIN $50.00`, where the multiplier came
from `replayWinAmount() / replayCostAmount()` — `50.00 / 3.00 = 16.6666…` — printed with
`.toFixed(2)`. A per-total-cost multiplier on a 3x mode is a repeating decimal, so that figure can
*never* multiply back to the win; the reviewer did `16.67 × 3` and reported the cent as a payout bug.

Two smaller defects sat in the same function. `replayWinAmount()` fell back to
`stateBet.winBookEventAmount` when the round carried no `payout` — a **book** amount (100 = one times
the wagered bet) handed straight to a money formatter, so a 50.01x win would have rendered
`$5,001.00`. And the multiplier's `.toFixed(2).replace(/\.?0+$/, '')` clamps precision before
trimming, which is what made the mismatch visible in the first place.

**Correct implementation.**

- Prefer `replaySnapshot.payoutMultiplier` from the RGS; only derive as a fallback, and derive
  against the **base bet** (`payout / amount`), which is the definition the API documents.
- Convert book amounts with `bookEventAmountToNormalisedAmount()` before they touch a formatter.
- Render with `Number(value.toFixed(4))` so an exact multiplier prints exact (`50` → `50x`) instead
  of being clamped to two decimals.

**Where it applies.** The replay HUD in every game, and any "you won Nx" readout shown beside the
cost. The convention is worth writing down once: in `library/books/*.jsonl`, `payoutMultiplier` is an
integer scaled by 100 and equal to the round's final win event, expressed **against the base bet** —
`payout = baseBet × payoutMultiplier / 100`, and `round.amount` on `/bet/replay` is the base bet, not
the mode's total cost.

**How to verify.** Read `payoutMultiplier` and the last `finalWin`/`setTotalWin`/`wincap` amount out
of the shipped books and assert they are equal; then assert the rendered trio satisfies
`baseBet × multiplier == win` to the cent, at the currency's own decimals.

---

## R-10 — Popout is a fourth layout, and a label beside a value is what breaks in it

**Reviewer wording (theme-park, 2026-09-02):**

> The game does not function correctly in Popout S/L mode. Please review the game to ensure it loads
> correctly, all UI elements are displayed properly, and all gameplay interactions work as expected.

Screenshot evidence: the balance pill reading `ALANCE $100,000.00` — its left edge, and the first
letter of its label, cut off by the left edge of the window.

**Rule.** Popout windows are short *and* narrow enough that `min(width, height) ≤ 480`, so
`utils-layout` classifies them as **mobile landscape** and they inherit the phone HUD at an aspect
that phone never has (1.5:1, not 2.2:1). The side gutters that HUD puts its balance and bet in are
~90px there. Anything in that gutter must survive its longest possible content.

**Why we failed.** Four bugs, in three different mechanisms, all invisible at desktop size.

*Bug 1 and 2 — the balance pill overflowed the gutter:*

- `fitText` measured the value against `slot.clientWidth` — the whole pill — while
  `.ls-pill--balance` is a flex **row** whose `BALANCE` label already occupied 38 of its 72 usable
  px. Measured at 700×460: label 38.1px + gap 6px + a `$100,000.00` value 58.8px = 97px of content in
  a 92px box. The fitter saw 72px available, concluded the value fitted, and shrank nothing.
- `.ls-left` is positioned with `left: var(--ls-left-x)` + `translateX(-50%)`, so that 5px of
  overflow did not stop at the pill — it escaped the gutter and left the viewport entirely.

The reason this never showed in testing: the mock RGS pays a three-figure balance. At `$896.16` the
row fits exactly. The bug needs a six-figure balance to appear at all.

*Bug 3 — the control dock covered the studio mark.* `.ls-actions` is anchored `bottom: 15%` and
grows **upward**, so its height decides how far up the screen it reaches. `.press-play-mark` is
pinned to `top` / `right` — the same corner. Measured: the dock's top edge sat 3.2px into the mark at
700x460, 2.9px at 640x420, 9.6px at 900x480. It overlapped at *every* landscape size; nobody had
measured the pair because they are authored ~1300 lines apart in the stylesheet and neither rule
mentions the other. A bottom-anchored element and a top-anchored element in the same corner are a
collision waiting for a short viewport — assert the gap, do not assume it.

*Bug 4 — a fitter that resized its own container.* `fitText` observes its slot with a
`ResizeObserver` and sets the node's `font-size`. `.ls-bet__values` was `flex: 0 1 auto`, i.e. sized
to its content — so shrinking the font narrowed the slot, which re-fired the observer, which shrank
it again. It latched: the bet value rendered at **2px** against an authored 14px, in a 5px-wide slot,
and no amount of freeing up space in the row fixed it (widening the row does not widen a slot that
sizes to its 2px content). The fix is `flex: 1 1 auto` on the slot, so what is measured cannot depend
on the result of the measurement. **Any fit-to-width action has this failure mode** — check that the
observed box takes its size from the layout, never from the fitted content.

**Correct implementation.**

- `fitText` subtracts the width of siblings **on the same line** (plus the flex `column-gap`) before
  computing the available space, so a value sharing a row with a label is sized against the space it
  actually has. "Same line" is a rect-overlap test, not a child count — once the row wraps, the value
  owns a full line again and must not keep subtracting the label.
- `.ls-pill--balance` gets `flex-wrap: wrap; row-gap: 0`. A long balance drops onto its own
  full-width line — which is what the WIN pill beside it already does — instead of overflowing. This
  is a breakpoint-free fix: it engages exactly when the content stops fitting.
- The dock is lowered (`bottom: 15%` -> `12%`) and trimmed (gap, padding, and the spin ring that
  actually sets its width), which moves its top edge from y=22.7 to y=59.4 at 700x460 — clear of the
  mark — and narrows it ~11%.
- `.ls-bet__values` gets `flex: 1 1 auto`, and `.ls-step` is capped at `min(clamp(...vh...), 25%)` so
  a stepper sized off viewport *height* cannot eat a column sized off viewport *width*.

**Where it applies.** Any pill, chip or capsule that puts a label beside a number, in any layout with
a narrow gutter. Also re-read R-04's note: *popout windows are short, not narrow* — that was about
vertical space, this is the horizontal half of the same lesson.

**How to verify.** Measure, with a six-figure balance, at **640×420, 700×460, 900×480, 1000×600,
1280×800 and 430×932**. Substitute `$100,000.00` into the balance readout, re-run the fitter, then
walk every visible element under `.hud-shell` and assert none has
`rect.left < 0 || rect.right > innerWidth || rect.top < 0 || rect.bottom > innerHeight`. Headless
Chrome needs `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` or pixi never
initialises, and `Emulation.setDeviceMetricsOverride` rather than `--window-size` to get the
viewport you asked for.

Three assertions beyond "nothing is off-screen", because none of these clip anything:

- **Corner pairs do not overlap.** For every top-anchored badge and every bottom-anchored dock in the
  same corner, assert `dock.top > mark.bottom`.
- **Text renders near its authored size.** For each fitted readout compare the computed `font-size`
  against what the CSS asks for (`3.05vh` etc.). Anything under about half is a latched fitter, not
  a tight fit — the 2px bet value clipped nothing and passed every overflow check.
- **Do it with adversarial content.** A `$100,000.00` balance, the longest translated label, the
  widest currency string. The default mock data fits by luck.

---

## R-11 — A volume control nothing reads is a button that does nothing

**Reviewer wording (theme-park, 2026-09-02):**

> The Disable Music button is not functioning correctly. Please review and ensure that it properly
> enables and disables the in-game music. Sound should stop effects and background music.

**Rule.** `stateSound` has three values — master, music, effects. Every one of them must be wired to
something that reads it, and the wiring must be verified per channel, not "audio works".

**Why we failed.** `apps/theme-park/src/components/EnableSound.svelte` called `sound.enableEffect()`
and wired `volumeValueMaster` straight to `Howler.volume`/`Howler.mute` — but never called
`sound.volumeEffect()`, and never wired the channels itself. So `volumeValueMusic` and
`volumeValueSoundEffect` were written by the menu and read by nobody: the MUSIC button toggled a
number and the music played on, while the SOUND button (master) muted everything including music,
which is exactly the pair of symptoms reported.

`sound.volumeEffect()` is not a fix on its own — magnetic hit this first and left the note: `$state`
reads do not track across the `utils-sound` package boundary, so the `$effect` inside the package
never re-fires. The channel effects have to live in the app component.

**Correct implementation.** Copy the shape magnetic already proved:

- One `$effect` per channel, in the app's `EnableSound.svelte`: music → `sound.players.music.volume`,
  effects → `sound.players.loop.volume` **and** `sound.players.once.volume`.
- Apply the initial values again immediately after `sound.load(...)`. The effects run before the
  players exist and `sound.players` is not reactive, so without this every channel sits at the Howl
  default until the player first touches a slider.

**Where it applies.** Every app. `grep -L "volumeEffect\|players.music.volume" apps/*/src/components/
EnableSound.svelte` lists the ones still broken — at the time of writing, `forest-gang` and
`press_play_template`.

**How to verify.** Per channel, not in aggregate: mute MUSIC and assert effects still play and the
bed does not; mute SOUND and assert both stop; switch bed (base → free spins) **while muted** and
assert the new bed is silent too — `createPlayMusic.newMusic()` re-applies `playerVolume` through
`initSoundVolume`, and that is the path that regresses if the wiring moves.

---

## The General Game Disclaimer is a document, not a paraphrase (magnetic-2, 2026-09-03)

**Rule.** Ship Stake Engine's own disclaimer template verbatim, from
<https://stake-engine.com/docs/approval-guidelines/general-disclaimer>, in the game rules /
information popup. The closing sentence is **"TM and © 2026 Engine."** — *Engine*, never
*Stake Engine*.

**Why we failed.** The template was reproduced from memory and drifted: our copy ended
"TM and © 2026 Stake Engine.", in every one of the 17 locale files. The word "Stake" is the
operator's brand, not the platform's, and it does not belong in a game's legal text — a game is
submitted to Engine and may be distributed by any operator. It reads as the game claiming to be a
Stake product.

The docs page is a SvelteKit SPA: `curl` on the URL (and on the `.md` variant, which returns
HTTP 200) yields the app shell, and a plain fetch summarises to "Loading...". The text only exists
after JS runs — render it in headless Chrome and read `document.body.innerText`.

**Correct implementation.**

- English is the template character for character. The doc allows your own wording "so long as the
  same message is clearly conveyed", but the template is what a reviewer can diff, so use it.
- Localised catalogues translate the paragraph but keep their own rendering of the final sentence
  (`TM et © 2026 Engine.`, `TM 和 © 2026 Engine。`). Only the word "Stake" comes out.
- Do **not** add a social-mode override for it. It is jurisdiction-neutral boilerplate and Engine's
  own approved text, so the prohibited-terms pass does not apply to it — even though it contains
  "wins", "plays" and "Winnings".

**Where it applies.** Every game, every locale. `grep -rn "Stake Engine" apps/*/src/i18n/` should
return nothing but code comments.

**How to verify.** Open the rules carousel's GENERAL INFO page and diff the paragraph against the
docs page, then check the tail sentence in all 17 locale files at once:

```
grep -o 'TM[^\n]\{0,40\}Engine[.。।]' apps/<game>/src/i18n/messagesMap/*.ts
```

Every line must read `... © 2026 Engine.` and none may contain `Stake`.

---

## R-12 — An overlay that stays inside the window can still cover the game

**Reviewer wording (theme-park, 2026-09-04 — the fourth round of the same finding):**

> The game does not display replays correctly in Popout S view.

Screenshot evidence: the replay stats panel sitting over the bottom of the board, with two of the
five reel rows behind it.

**Rule.** Replay mode does not render the control bar, so every reservation the board layout makes
for that bar is reserving something that is not there — and the replay panel, which *is* there, is
reserved by nobody. Any HTML overlay that occupies a band of the viewport must be reserved by the
game's own layout, not merely kept inside the window.

**Why we failed — four times.** The panel never overflowed the viewport. Not once, at any size:

```
overflow = [...document.querySelectorAll('.replay-hud *')].filter(e => {
  const r = e.getBoundingClientRect()
  return r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight
})            // => [] at 640x420, 700x460, 856x480, 900x480, 1000x600, 1280x800, 430x932
```

The defect was an **overlap**, not an overflow, and every check we ran looked at the panel alone.
Measured against the board that was actually behind it:

| viewport | layout | board frame bottom | panel top | overlap |
| --- | --- | --- | --- | --- |
| 640x420 | landscape | 360 | 299 | **61px** |
| 700x460 | landscape | 395 | 339 | **56px** |
| 856x480 | landscape | 441 | 359 | **82px** |
| 900x480 | landscape | 441 | 359 | **82px** |
| 1000x600 | desktop | 471 | 498 | clear |
| 1280x800 | desktop | 618 | 698 | clear |

`boardLayout()`'s landscape branch reserves `LS_BOTTOM_BAR = 52` main units — about 23px at 700x460 —
for the control bar. The replay panel was 111px. Desktop was clear the whole time, which is why it
looked fine in every local check that was not done at popout size.

The second half of the failure is how it was signed off. The guarding test was this:

```js
expect(replayHud).toContain('@container (orientation: landscape) and (max-height: 520px)')
expect(replayHud).toContain('width: min(760px, calc(100% - 32px));')
expect(replayHud).toContain('grid-template-columns: repeat(3, minmax(0, 1fr));')
```

It asserts that the stylesheet *contains certain strings*. It passed on every one of the four broken
releases, because a spelling check cannot see a rectangle. **A test that greps a stylesheet is not a
layout test.** The four commits also stacked four `@container` blocks whose media conditions overlap;
the popout block was authored first and lost the cascade to a later `max-width: 720px` block, so the
composition it defined never applied at 700x460 in the first place.

**Correct implementation.**

- `game/replayViewport.svelte.ts` holds one number: the band the replay HUD occupies, in canvas px.
  `<ReplayHud>` measures the rendered panel with a `ResizeObserver` and publishes
  `innerHeight - panel.getBoundingClientRect().top + clearance`. It is measured, not derived: the
  height depends on the container breakpoint, the translated labels and the currency string.
- All three branches of `boardLayout()` reserve it — landscape against `LS_BOTTOM_BAR`, portrait
  against `padding.bottom`, desktop against the spin button's top. A branch that forgets it is a
  viewport class where the panel lands on the reels again, so the count is asserted.
- Converting that band into main-space units is **not** a division by `mainLayout.scale`. Main-space
  is drawn centred on the canvas, so on a letterboxed window its bottom edge is not the canvas's
  bottom edge — at 700x460 the 1600x900 main space renders 700x394 and leaves 33px of canvas beneath
  it. See `canvasBottomBandToMainUnits`.
- Portrait's board is sized by a **width** rule (full bleed), so on its own it cannot react to a band
  growing taller — it would keep its size and slide under the panel. In replay it takes a fit clamp.
- The effect that publishes the band must **`untrack`** its own write. `boardLayout()` reads the
  number, so publishing it re-renders the stage; reading it back to compare made the effect depend on
  its own write and it never settled — the page froze on the first measurement, hard enough that the
  CDP `Input.dispatchMouseEvent` that dismissed the splash never returned. This is R-10's latched
  fitter again in a different costume: *what you measure must not be produced by the measurement.*
  Note that a jsdom unit test does not render the component and will not catch this — it took a
  browser. When a headless run stops responding at the exact input that mounts your new component,
  suspect a reactive cycle before you suspect the harness.
- The panel's height must not change while the replay runs. The play button is unmounted for the
  duration, so `min-height` lives on the slot around it (`.replay-action`), never on the button —
  otherwise pressing play resizes the board out from under the spinning reels.
- A rect of zero height means *no measurement*, not a measurement of zero. A hidden or not-yet-laid-out
  panel reports `top: 0`, which read naively reserves the whole viewport and collapses the board to a
  sliver — we did exactly that and caught it only because the verification harness hid the panel to
  photograph the board behind it. Guard the zero rect, and cap the reservation at a fraction of the
  viewport so no measurement pathology can cost the board more than that.
- The popout composition is authored **last** in the stylesheet, and the rules it overlaps are
  bounded (`(max-width: 720px) and (min-height: 561px)`) so the cascade cannot take it away again.

**Where it applies.** Every HTML overlay drawn over the pixi stage in any game: the replay HUD, the
pending-round notice, the press-anywhere caption, any future banner. Also every mode that suppresses
part of the normal HUD — the layout reservations are written for the default mode and silently
describe the wrong thing everywhere else.

**How to verify.** Two checks, and the first one is the one that was missing.

1. *Geometry, in a unit test.* `tests/replayBoardClearance.test.ts` drives the real `boardLayout()`
   at 640x420, 700x460, 856x480, 900x480, 1000x600, 1280x800 and 430x932, for a sweep of plausible
   panel heights (48-240px), and asserts `boardFrameBottomPx() <= innerHeight - reserve` plus
   `boardScale > 0` — so a board that "cleared" by collapsing to nothing still fails. Confirm a new
   guard like this **fails on the unfixed code before you trust it**: revert the layout change,
   re-run, and check it goes red at exactly the reported sizes.
2. *Pixels, in a browser.* Boot replay in headless Chrome
   (`?replay=true&rgs_url=localhost:8788/theme-park&amount=1&game=0_0_theme_park&mode=BASE&event=123`),
   click through the splash, screenshot once with `.replay-hud{display:none}` and once without. Find
   the board frame in the first by row/column histograms of its neon magenta thresholded at 25% of
   the image dimension — that isolates the frame's own long bars from the park art behind it — and
   compare its bottom against the panel's `getBoundingClientRect().top`. Use
   `Emulation.setDeviceMetricsOverride`, not `--window-size`; `--headless=new` forces a ~500px
   minimum `innerWidth` and will silently not give you 430 or 640.

**Still open (2026-09-04).** `forest-gang`, `magnetic` and `press_play_template` all still position
their replay HUD with `position: fixed` — the bug theme-park fixed in an earlier round — and none of
them reserves the band. Both defects are live in all three; only theme-park has been repaired.

Close every CDP tab you open. Three orphaned game tabs on software WebGL saturate the machine and
the next run appears to hang on boot rather than to be starved.
