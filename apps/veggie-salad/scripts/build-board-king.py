#!/usr/bin/env python3
"""The board's scatter king, drawn at the board's own pixel size.

The board vegetables are pixel art whose every pixel is three of the scatter king's (the king was
drawn on an 89-pixel grid across the cell, build-board-crop.py), so next to them he read as a
different, finer style ("the scatter is not pixelated or same style as other items", user
2026-09-24). Quantising his 89-grid art down to the vegetables' 30-pixel grid does not work — the
face and crown turn to noise at any grid from 30 to 45 — so he is redrawn here, procedurally, on a
30x30 grid in the vegetables' manner: flat fills with one shade, a black outline, 2x3 eyes with a
glint, blush and the small open mouth the potato has.

He is drawn in the same parts, framed the same way, as the splash rig (build-splash-king.py), so
the board's `.king-idle` / `.king-cheer` CSS moves him unchanged; each part is outlined on its own
so a part that moves carries its outline with it. Writes, NEAREST-upscaled x15 to a 450 canvas,
into static/assets/veggie-salad/pixel/board/king/:

    sprout  body (eyes shut)  body-open  crown  feet-l  feet-r  cape-l  cape-r

and the whole king as one still, pixel/board/king.webp (eyes open) and king-shut.webp. He is the
only king in the game now ("replace it in splash and all screens", user 2026-09-24): the splash,
the bonus card and the info screens draw these same files.

Run from anywhere:

    python3 apps/veggie-salad/scripts/build-board-king.py
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

OUT = Path(__file__).resolve().parents[1] / 'static/assets/veggie-salad/pixel/board/king'
UP = 15

N=30
K=(0,0,0); Y=(248,216,0); Yd=(248,152,0); Yl=(255,240,120); P=(120,0,216); Pl=(176,96,255)
G=(128,232,16); Gd=(0,160,32); ON=(248,216,0); ONd=(248,152,0); ONl=(255,236,110)
W=(248,248,248); Wd=(200,200,210); SP=(56,56,64); V=(120,0,216); Vd=(84,0,160); R=(216,0,48)
EYE=(0,0,0); GL=(255,255,255); BL=(250,140,150); MO=(236,84,110)
def blank(): return np.zeros((N,N,4),np.uint8)
def put(a,x,y,c):
    if 0<=x<N and 0<=y<N: a[y,x,:3]=c; a[y,x,3]=255
def outline(a):
    m=a[...,3]>0; o=np.zeros_like(m)
    for dy,dx in ((1,0),(-1,0),(0,1),(0,-1)):
        o|=np.roll(np.roll(m,dy,0),dx,1)
    o&=~m
    a[o,:3]=K; a[o,3]=255
    return a
# body: onion bulb
body=blank(); cx,cy,rx,ry=14.5,17.2,9.8,8.4
for y in range(N):
    for x in range(N):
        dx=(x-cx)/rx; dy=(y-cy)/ry
        # a bulb: pointier top
        if dy<0: dx*= 1+0.12*(-dy)
        if dx*dx+dy*dy<=1:
            put(body,x,y,ON)
m=body[...,3]>0
for y in range(N):
    xs=np.nonzero(m[y])[0]
    if len(xs)==0: continue
    x0,x1=xs.min(),xs.max()
    put(body,x1,y,ONd); put(body,x1-1,y,ONd); put(body,x0,y,ONd)
for y in range(N):
    xs=np.nonzero(m[y])[0]
    if y>=int(cy+ry*0.7):
        for x in xs: put(body,x,y,ONd)
# highlight
for x,y in ((8,14),(8,15),(9,13)): put(body,x,y,ONl)
outline(body)
def face(open_):
    f=body.copy()
    if open_:
        # 2x3 like the garlic's and radish's, the glint in the top outer corner.
        for ex in (10,18):
            for dx in (0,1):
                for dy in (0,1,2): put(f,ex+dx,14+dy,EYE)
            put(f,ex+1,14,GL)
    else:
        for ex in (10,18):
            put(f,ex,16,EYE); put(f,ex+1,16,EYE); put(f,ex-1,15,EYE); put(f,ex+2,15,EYE)
    for bx in (8,20):
        put(f,bx,18,BL); put(f,bx+1,18,BL)
    put(f,14,18,EYE); put(f,15,18,EYE)
    put(f,13,19,EYE); put(f,14,19,MO); put(f,15,19,MO); put(f,16,19,EYE)
    put(f,14,20,EYE); put(f,15,20,EYE)
    return f
# crown: a band on the bulb's top and three short points with gold balls
crown=blank()
for y in (9,10):
    for x in range(9,21): put(crown,x,y,Y if y==9 else Yd)
for px in (9,20):
    for y in (7,8): put(crown,px,y,Y)
    put(crown,px,6,Yl)
for x in range(13,17):
    for y in (7,8): put(crown,x,y,Y)
for x in (14,15):
    put(crown,x,6,Y); put(crown,x,5,Yl)
for x in (10,19): put(crown,x,8,Y)
put(crown,14,9,P); put(crown,15,9,Pl); put(crown,11,9,P); put(crown,18,9,P)
outline(crown)
# sprout: two leaves out of the crown's middle point
sprout=blank()
for (x,y,c) in ((12,1,G),(12,2,G),(13,2,G),(13,3,Gd),(14,4,Gd),(17,1,G),(17,2,G),(16,2,G),(16,3,Gd),(15,4,Gd),(11,1,G)):
    put(sprout,x,y,c)
outline(sprout)
# capes: a cloak flaring from the shoulders, ermine along its top edge, a gold cross
def cape(side):
    a=blank()
    for y in range(21,27):
        x0=max(2,6-(y-21)); x1=8
        for x in range(x0,x1+1): put(a,x,y,V if x>x0 else Vd)
    for y,xs in ((20,range(6,11)),(21,range(8,12)),(22,range(10,13))):
        for x in xs: put(a,x,y,W)
    for x,y in ((7,20),(9,21),(11,22)): put(a,x,y,SP)
    for x,y in ((5,23),(5,24),(4,24),(6,24),(5,25)): put(a,x,y,Y)
    outline(a)
    return a if side=='l' else a[:,::-1].copy()
capel=cape('l'); caper=cape('r')
def foot(side):
    a=blank()
    for x in (10,11,12):
        put(a,x,26,Y); put(a,x,27,Yd if x==12 else Y)
    outline(a)
    return a if side=='l' else a[:,::-1].copy()
layers={'sprout':sprout,'body':face(False),'body-open':face(True),'crown':crown,'feet-l':foot('l'),'feet-r':foot('r'),'cape-l':capel,'cape-r':caper}


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for name, layer in layers.items():
        Image.fromarray(layer).resize((N * UP, N * UP), Image.NEAREST).save(
            OUT / f'{name}.webp', lossless=True, quality=100, method=6)
    # Whole-king stills for everything that shows him as one picture (info screens, paytable,
    # cluster log, mode icon): the rest pose stacked in the rig's order, eyes open and shut.
    stack = ['sprout', 'body', 'crown', 'feet-l', 'feet-r', 'cape-l', 'cape-r']
    for name, eyes in (('king', 'body-open'), ('king-shut', 'body')):
        still = Image.new('RGBA', (N, N))
        for part in stack:
            still.alpha_composite(Image.fromarray(layers[eyes if part == 'body' else part]))
        still.resize((N * UP, N * UP), Image.NEAREST).save(
            OUT.parent / f'{name}.webp', lossless=True, quality=100, method=6)
    print('wrote', ', '.join(layers), 'to', OUT, '+ king.webp, king-shut.webp beside it')


if __name__ == '__main__':
    main()
