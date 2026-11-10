# Gates frontend build — 2026-11-10

Restored the Gates stash (`f4057f89`) onto `feature/the-gates` at `e3cc3a594`.
Stash retained as a recovery copy. No maths packages or other games changed.

## Symbol scope

- Live highest premium: Pharaoh (`GUARDIAN_MASK` → `pharaoh`).
- Live chalice paytable slot: Envelope (`RUNE_CHALICE` → `envelope`).
- Knight and pink Chalice studies remain under `tools/` and `reports/` only.
- New release regression checks these mappings and excludes concept asset paths
  from the production asset dependency closure.
- Final build contains no Knight, palace, pink Chalice or symbol-preview files.

## Fresh verification

Node 22.16.0; existing workspace dependencies, no installs.

| Check | Result |
| --- | --- |
| `pnpm --filter the-gates test` | 384 passed; no skipped/failed tests |
| Symbol/eye preview `*.test.mjs` suites | 32 passed |
| TypeScript 5.8.3 `tsc --noEmit -p apps/the-gates/tsconfig.json` | PASS (TS scope, not a separate Svelte type checker) |
| `pnpm --filter the-gates verify:assets` | PASS: 50 registered art assets and bundled title-font provenance |
| `pnpm --filter the-gates build` | PASS: Vite/static adapter, dependency pruning, lossless PNG encoding |
| `pnpm --filter the-gates audit:bundle` | PASS: 220 runtime assets, source-equivalent pixels/metadata |
| `git diff --check HEAD` | PASS |

Build: 228 files, 37,842,199 bytes. Lossless PNG encoding saved 3,775,122 bytes;
source artwork unchanged. Vite reports its existing >500 kB chunk-size warning.

## Upload

Upload the **contents** of:

`/Users/simeonhristov/Documents/GitHub/web-sdk/apps/the-gates/build`

`index.html` must be at the upload root, beside `_app/`, `assets/` and `fonts/`.
Do not upload `src/`, `tools/`, `reports/` or the whole app directory.

This is frontend build verification, not live-RGS, physical-device or publication
sign-off. No new browser gameplay test, platform upload or math validation run.
Previously documented audio-rights and platform/math compatibility gates remain
separate; this build does not clear them.
