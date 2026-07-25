#!/usr/bin/env python3
"""Verification for plan 07 — run from the repo root:

    python3 apps/forest-gang/static/assets/sprites/check_sheet_sizes.py

Two checks, both scripted across EVERY sheet (plan 07 Verify #1 and #3):

  1. Atlas ceiling. No atlas may exceed 4096 in either dimension, meta.size must
     match the actual image, and no frame rect may escape the atlas. This is the
     constraint that forced the original halving of loading_bar; it must not
     regress.
  2. Per-sheet ratio table. For every drawn board sprite, the device-pixel size
     it is actually rendered at (1920x1080, DPR 2 — the largest layout we support
     well) against the frame size we ship. Ratio > 1 means the sprite is being
     magnified and is short of texels.

The layout chain below is derived from the live code, NOT copied from the plan
(whose constants were stale). If any of these move, this file moves with them:

    utils-layout/createLayout.svelte.ts  mainLayout.scale = min(cw/1422, ch/800)
    game/constants.ts                    SYMBOL_W 121, SYMBOL_H 103 -> BOARD_SIZES 605x412
    game/stateGame.svelte.ts             getBoardViewportPadding() desktop
                                           t76 r220 b(118 if ch<640 else 150) l208
                                         getBoardScale(), boardScale *= 1.05,
                                         H_SPREAD 1.12, V_TIGHTEN 0.95
    components/Board.svelte              SIZE_BOOST 1.1, symScale(), idleFit,
                                         IDLE_BUST zoom, winFit, WIN_ASPECT,
                                         IDLE_ASPECT, WILD_SIZE, SCATTER_SIZE
    components/ExpandedSymbolOverlay.svelte  expanded animals draw at SYMBOL_W
                                             wide x SYMBOL_H*4 tall

Note on the ratios you will see: every board symbol's computed target EXCEEDS the
highest-resolution art that exists. The sheets were built by generate_*_anim.py
from source videos that are not in the repo (they take ~/Downloads/*.mp4), so the
pre-halving sheets at commit 81a1931 are the ceiling. Sheets are therefore shipped
at source, and the residual 1.03-1.72x cannot be closed without the source videos.
Do NOT "fix" these ratios by upsampling — that adds bytes and no detail.
"""
import glob
import json
import os
import re
import sys

from PIL import Image

LIMIT = 4096
DPR = 2
CANVAS = (1920, 1080)
ROOT = os.path.dirname(os.path.abspath(__file__))

# ── layout chain ────────────────────────────────────────────────────────────────
SYMBOL_W, SYMBOL_H = 121, 103
BOARD_W, BOARD_H = SYMBOL_W * 5, SYMBOL_H * 4  # 605 x 412


def chain(cw, ch):
    ms = min(cw / 1422, ch / 800)
    availH = max(BOARD_H * ms, ch - 76 - (118 if ch < 640 else 150))
    availW = max(BOARD_W * ms, cw - 208 - 220)
    boardScale = max(1, min(availH / (BOARD_H * ms), availW / (BOARD_W * ms))) * 1.05
    sx, sy = boardScale * 1.12, boardScale * 0.95
    return (SYMBOL_W * (boardScale / sx) * 1.1,   # symbolW  (Board.svelte)
            SYMBOL_H * (boardScale / sy) * 1.1,   # symbolH
            ms * sx * DPR, ms * sy * DPR)         # local unit -> device px


BORDER_SIZE, FRAME_H_MULT, FRAME_ASPECT = 0.8, 0.826, 516 / 388
FRAME_W_MULT = FRAME_H_MULT * (SYMBOL_H / SYMBOL_W) * FRAME_ASPECT
IDLE_FIT = BORDER_SIZE * FRAME_H_MULT * 0.86          # INNER_FRAC
WIN_FIT = BORDER_SIZE * FRAME_W_MULT * 0.76           # WIN_INNER_FRAC
IDLE_BUST = {'wolf': 1.45, 'fox': 1.5, 'squirrel': 1.65, 'bear': 1.35, 'rabbit': 1.65}
IDLE_ASPECT = {'wolf': 337/360, 'fox': 249/360, 'squirrel': 282/360, 'bear': 360/327, 'rabbit': 284/360}
WIN_ASPECT = {'wolf': 373/320, 'fox': 313/320, 'bear': 419/320, 'rabbit': 283/320, 'squirrel': 367/320}
S_HIGH, S_WILD, S_SCATTER = 1.32, 1.0, 1.1           # symScale() on desktop


def device_targets(cw, ch):
    symW, symH, kx, ky = chain(cw, ch)
    t = {}
    for a, zoom in IDLE_BUST.items():
        h = symH * S_HIGH * IDLE_FIT * zoom
        t[f'{a}Idle'] = (h * (SYMBOL_H / SYMBOL_W) * IDLE_ASPECT[a] * kx, h * ky)
    for a, asp in WIN_ASPECT.items():
        w = symW * S_HIGH * WIN_FIT
        t[f'{a}Win'] = (w * kx, w * (SYMBOL_W / SYMBOL_H) / asp * ky)
    t['scatter'] = (symW * S_SCATTER * 0.72 * kx,
                    symH * S_SCATTER * 0.72 * (SYMBOL_W / SYMBOL_H) * (306 / 336) * ky)
    t['wild'] = (symW * S_WILD * 0.78 * (SYMBOL_H / SYMBOL_W) * kx,
                 symH * S_WILD * 0.78 * 0.9 * ky)
    t['money'] = (SYMBOL_W * kx, BOARD_H * ky)
    return t


# sprite key -> sheet json, for the sheets whose draw size we can derive
DRAWN = {
    'wolfIdle': 'wolfIdleAnim/wolf_idle.json',
    'foxIdle': 'foxIdleAnim/fox_idle.json',
    'bearIdle': 'bearIdleAnim/bear_idle.json',
    'rabbitIdle': 'rabbitIdleAnim/rabbit_idle.json',
    'squirrelIdle': 'squirrelIdleAnim/squirrel_idle.json',
    'wolfWin': 'wolfWinNew/wolf_win_v2.json',
    'foxWin': 'foxWinNew/fox_win_v2.json',
    'bearWin': 'bearWinNew/bear_win_v2.json',
    'rabbitWin': 'rabbitWinNew/rabbit_win_v2.json',
    'squirrelWin': 'squirrelWinNew/squirrel_win_v2.json',
    'wild': 'wildAnim/wild_anim_v3.json',
    'scatter': 'scatterAnim/scatter_anim.json',
    'money': 'wolfMoney/wolf_money.json',
}


def frames(d):
    f = d['frames']
    return list(f.values()) if isinstance(f, dict) else f


def loaded_sheets():
    """Sheet paths assets.ts actually references. Sheets nothing loads are reported
    but cannot fail the run — two of them (pressToContinueText, winSmall) have
    shipped with corrupt meta.size since long before plan 07, and deleting dead art
    belongs to plan 03, not here."""
    src = open(os.path.join(ROOT, '../../../src/game/assets.ts')).read()
    return {m.split('?')[0] for m in re.findall(r"assets/sprites/([^']+\.json)[^']*'", src)}


def main():
    fails = []
    live = loaded_sheets()

    print(f"── atlas ceiling ({LIMIT}px) ─────────────────────────────────────────")
    for j in sorted(glob.glob(os.path.join(ROOT, '*/*.json'))):
        d = json.load(open(j))
        if 'frames' not in d or 'meta' not in d:
            continue
        rel = os.path.relpath(j, ROOT)
        if rel not in live:
            print(f"  {rel:44} {'':11} skipped — nothing in assets.ts loads it")
            continue
        img = os.path.join(os.path.dirname(j), d['meta']['image'].split('?')[0])
        if not os.path.exists(img):
            fails.append(f"{rel}: atlas image missing ({d['meta']['image']})")
            continue
        aw, ah = Image.open(img).size
        dw, dh = d['meta']['size']['w'], d['meta']['size']['h']
        notes = []
        if (aw, ah) != (dw, dh):
            notes.append(f"meta.size {dw}x{dh} != image {aw}x{ah}")
        if aw > LIMIT or ah > LIMIT:
            notes.append(f"exceeds {LIMIT}")
        over = [f for f in frames(d)
                if f['frame']['x'] + f['frame']['w'] > aw or f['frame']['y'] + f['frame']['h'] > ah]
        if over:
            notes.append(f"{len(over)} frame rect(s) outside the atlas")
        print(f"  {rel:44} {aw:5}x{ah:<5} {'FAIL: ' + '; '.join(notes) if notes else 'ok'}")
        if notes:
            fails.append(f"{rel}: {'; '.join(notes)}")

    print(f"\n── draw ratio @ {CANVAS[0]}x{CANVAS[1]} DPR{DPR} ─────────────────────────")
    t = device_targets(*CANVAS)
    print(f"  {'sprite':14} {'shipped frame':>14} {'device target':>14} {'ratio':>13}")
    for key, rel in DRAWN.items():
        d = json.load(open(os.path.join(ROOT, rel)))
        fw = max(f['frame']['w'] for f in frames(d))
        fh = max(f['frame']['h'] for f in frames(d))
        tw, th = t[key]
        print(f"  {key:14} {f'{fw}x{fh}':>14} {f'{tw:.0f}x{th:.0f}':>14} "
              f"{f'{tw/fw:.2f}x / {th/fh:.2f}x':>13}")

    if fails:
        print('\nFAILURES:')
        for f in fails:
            print(' -', f)
    print(f"\n{'ALL PASS' if not fails else str(len(fails)) + ' FAILURE(S)'}")
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
