#!/usr/bin/env python3
"""
The dialogs' screws, lifted out of their frame art so they can turn (PopupScrews.svelte): once a
dialog has popped in, each screw is driven a quarter turn home.

The screws stay baked into the frame SVGs; PopupScrews draws an exact copy of each one over it in
the frame's own coordinates, so at rest nothing changes, and the copy's round head hides the baked
one at any angle while it turns. This script copies every screw's markup out of the frame SVGs and
works out the centre of its head, the point it turns about:

  frame.svg, autospin-frame.svg, card-frame.svg — four screws each, a white head (Vector_3/5/7/9)
    and its dark slot (Vector_4/6/8/10); frame.svg draws its paths under a rotate(-90) group.
  rules-frame.svg — a 9-slice (border-image-slice 82), so its screws are cut per CORNER: each is a
    nested <svg> group (head circle cx 19.31, cy 18.39 of its 36.56 box) plus, mostly, a separate
    slot <svg>; PopupScrews draws them in four 82 x 82 corner boxes.

Writes src/game/popupScrews.ts.

    python3 scripts/build-popup-screws.py
"""
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
POPUP = os.path.join(HERE, '..', 'static', 'assets', 'mcschmutzo', 'popup')
OUT = os.path.join(HERE, '..', 'src', 'game', 'popupScrews.ts')


def path_bbox(d):
    nums = list(map(float, re.findall(r'-?\d*\.?\d+(?:e-?\d+)?', d)))
    xs, ys = nums[0::2], nums[1::2]
    return min(xs), min(ys), max(xs), max(ys)


def path_frame(name):
    s = open(os.path.join(POPUP, name)).read()
    root = re.search(r'<svg[^>]*>', s).group(0)
    w, h = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', root).groups())
    par = 'none' if 'preserveAspectRatio="none"' in root else 'xMidYMid meet'
    tm = re.search(r'<g transform="([^"]*)"', s)
    tf = tm.group(1) if tm else ''
    paths = {m.group(1): m.group(0) for m in re.finditer(r'<path id="(Vector_\d+)"[^>]*/>', s)}
    screws = []
    for head, slot in ((3, 4), (5, 6), (7, 8), (9, 10)):
        hp = paths[f'Vector_{head}']
        x0, y0, x1, y1 = path_bbox(re.search(r'\sd="([^"]+)"', hp).group(1))
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        if tf:  # translate(0 H) rotate(-90): (x, y) -> (y, H - x)
            th = float(re.search(r'translate\(0 ([\d.]+)\)', tf).group(1))
            cx, cy = cy, th - cx
        markup = hp + paths[f'Vector_{slot}']
        if tf:
            markup = f'<g transform="{tf}">{markup}</g>'
        screws.append({'cx': round(cx, 2), 'cy': round(cy, 2), 'svg': strip_ids(markup)})
    return {'w': w, 'h': h, 'par': par, 'screws': screws}


def strip_ids(markup):
    return re.sub(r'\s(id|mask)="[^"]*"', '', markup)


def top_children(s):
    """The root <svg>'s direct child elements, as markup strings."""
    i = s.index('>') + 1
    depth, start, out = 0, None, []
    for m in re.finditer(r'<(/?)(svg|g)\b[^>]*?(/?)>', s[i:]):
        close, selfc = m.group(1) == '/', m.group(3) == '/'
        if not close and not selfc:
            if depth == 0:
                start = m.start()
            depth += 1
        elif close:
            depth -= 1
            if depth == 0:
                out.append(s[i + start:i + m.end()])
    return out


def rules_frame():
    s = open(os.path.join(POPUP, 'rules-frame.svg')).read()
    w, h = map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', s).groups())
    kids = top_children(s)
    attrs = lambda k: dict((a, float(v)) for a, v in re.findall(r'\s(x|y|width|height)="([\d.]+)"', k[:200]))
    heads = [k for k in kids if '<circle' in k]
    slots = [k for k in kids if '<circle' not in k and attrs(k)['width'] < 20]
    corners = {}
    for hd in heads:
        a = attrs(hd)
        vb = list(map(float, re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', hd).groups()))
        c = re.search(r'<circle[^>]*cx="([\d.]+)" cy="([\d.]+)"', hd)
        cx = a['x'] + float(c.group(1)) * a['width'] / vb[0]
        cy = a['y'] + float(c.group(2)) * a['height'] / vb[1]
        # (minus its outer ring group, pN_Vector: the frame draws over that ring, so a copy of it would
        # show a dark rim the dialog never has)
        hd = re.sub(r'<g id="p\d+_Vector">.*?</g>', '', hd, flags=re.S)
        markup = hd + ''.join(
            sl for sl in slots if abs(attrs(sl)['x'] + attrs(sl)['width'] / 2 - cx) < 12 and abs(attrs(sl)['y'] + attrs(sl)['height'] / 2 - cy) < 12
        )
        key = ('t' if cy < h / 2 else 'b') + ('l' if cx < w / 2 else 'r')
        # the corner box (82 x 82 frame units) it is drawn in
        ox = 0 if key[1] == 'l' else w - 82
        oy = 0 if key[0] == 't' else h - 82
        corners[key] = {'ox': round(ox, 3), 'oy': round(oy, 3), 'cx': round(cx, 2), 'cy': round(cy, 2), 'svg': strip_ids(markup)}
    return corners


data = {
    'confirm': path_frame('frame.svg'),
    'autospin': path_frame('autospin-frame.svg'),
    'card': path_frame('card-frame.svg'),
}
rules = rules_frame()
with open(OUT, 'w') as f:
    f.write('// Generated by scripts/build-popup-screws.py — the dialog frames\' screws (PopupScrews.svelte).\n')
    f.write('// Each copy sits exactly over the screw baked into the frame art; cx/cy = its head\'s centre.\n\n')
    f.write('export type Screw = { cx: number; cy: number; svg: string };\n')
    f.write('export type ScrewFrame = { w: number; h: number; par: string; screws: Screw[] };\n')
    f.write('export type ScrewCorner = Screw & { ox: number; oy: number };\n\n')
    f.write(f'export const SCREW_FRAMES: Record<\'confirm\' | \'autospin\' | \'card\', ScrewFrame> = {json.dumps(data)};\n\n')
    f.write('/** rules-frame.svg is a 9-slice (slice 82): its screws by corner, in 82 x 82 corner boxes. */\n')
    f.write(f'export const RULES_SCREWS: Record<\'tl\' | \'tr\' | \'bl\' | \'br\', ScrewCorner> = {json.dumps(rules)};\n')
for k, v in data.items():
    print(k, v['w'], v['h'], v['par'], [(s['cx'], s['cy']) for s in v['screws']])
for k, v in rules.items():
    print('rules', k, v['cx'], v['cy'], len(v['svg']))
