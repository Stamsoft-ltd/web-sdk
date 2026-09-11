# Responsive layout checks

Start Vite from the repository root:

```sh
pnpm --filter veggie-salad dev --host 127.0.0.1
```

With Python Playwright and Google Chrome installed, run in another terminal:

```sh
python3 apps/veggie-salad/tests/responsive_layout.py
```

Checks 18 viewport presets: 1469×662 (landscape reference), 292×478 (portrait reference),
1200×675, 1024×576, 400×225, 800×450,
425×812, 375×667, 320×568, 812×425, 667×375, 568×320, 932×430,
956×440, 1024×768, 1920×1080, 768×1024, and 800×800. Each runs base,
normal, super, and hidden states (72 layouts), resizing without reloading.

Authentication is mocked. Test-only Vite state fixtures populate boards and
cluster payouts; no real wagers or production preview flags are used.

Assertions cover frame/grid alignment, equal cell sizes, background aspect
ratios, visible controls, portrait composition, overflow, and runtime errors.
Every size checks six populated payout cells, six empty cells, and stable panel
bounds. Touch-phone landscape (coarse pointer, height ≤600px) and Popout S
(landscape ≤520×300, any pointer) check payouts left
of the board and a vertical HUD right of the board. Desktop and taller tablets
retain their horizontal HUD. Portrait also checks
rectangular control shells.
Touch-phone landscape also checks the reference composition: logo and bonus counters above
the pays panel, balance below it, studio logo and vertical control rail right,
win below the rail, and a separate plus / bet value / minus stack.
Use `RESPONSIVE_TOUCH=1 RESPONSIVE_SIZES=landscape-tall,landscape-m,landscape-s`
for a focused mobile run. Omit `RESPONSIVE_TOUCH` for desktop pointer tests.
Mobile HUD/stepper/metric borders must be at least 3px. Portrait checks all three
metrics (including visible balance), bonus/pays alignment, compact board spacing,
and controls unobstructed at their center points.
Portrait additionally checks top-aligned branding, minimum component gaps, and
the original 1.25:1 board aspect ratio. Spare height stays below the composition
rather than stretching the board. Popout S uses narrower side gutters and larger controls.
Screenshots and geometry go to `/tmp/veggie-responsive`; override with
`RESPONSIVE_ARTIFACTS`. Screenshots support manual visual review, not a golden-image diff.
Use `RESPONSIVE_BASE_URL` to target a separate Vite server instead of port 3018.

Do not run a production build concurrently: regenerating `.svelte-kit` can
reload the test page. These checks exercise local Chrome viewport emulation,
not live Stake embedding, real devices, or Safari.

## Mobile emulation and host clipping

`python3 apps/veggie-salad/tests/mobile_viewport.py` checks `localhost:3018`
at 956×440 with touch, mobile viewport behavior, and DPR 3, both directly and
inside a responsive iframe. Bounds are checked against the visible host size,
not just the child window's `innerWidth` / `innerHeight`.

Diagnostic negative control: set `RESPONSIVE_CROPPED_HOST=1` to center a fixed
1200×675 iframe inside that viewport. This deliberately fails and reproduces
the cropped board / HUD seen when a test toolbar keeps a desktop screen preset.
The host must resize the iframe itself, not just clip its wrapper.
