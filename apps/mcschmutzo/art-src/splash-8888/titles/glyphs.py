import re
def tok(d): return re.findall(r'[MLCHVZ]|-?\d*\.?\d+(?:e-?\d+)?',d)
def subpaths(d):
    out=[];cur=[]
    for t in tok(d):
        if t=='M' and cur: out.append(cur);cur=[]
        cur.append(t)
    if cur: out.append(cur)
    return out
def pts(sp):
    xs=[];ys=[];cmd=None;i=0;x=y=0;args=[]
    for t in sp:
        if t in 'MLCHVZ': cmd=t;args=[];continue
        v=float(t);args.append(v)
        if cmd in 'MLC' and len(args)==2: xs.append(args[0]);ys.append(args[1]);args=[]
        elif cmd=='H': xs.append(v);args=[]
        elif cmd=='V': ys.append(v);args=[]
    return xs,ys
def bbox(sp):
    xs,ys=pts(sp); return min(xs),min(ys),max(xs),max(ys)
def shift(sp,dx,dy):
    out=[];cmd=None;n=0
    for t in sp:
        if t in 'MLCHVZ': cmd=t;n=0;out.append(t);continue
        v=float(t)
        if cmd=='H': v+=dx
        elif cmd=='V': v+=dy
        else: v+= dx if n%2==0 else dy; n+=1
        out.append('%g'%round(v,3))
    s=' '.join(out); return re.sub(r' ?([MLCHVZ]) ?',r'\1',s)
def get(f,fill):
    s=open(f).read()
    for m in re.finditer(r'<path\b([^>]*)/>',s):
        a=m.group(1)
        if 'fill="%s"'%fill in a and 'mask' not in a:
            yield re.search(r' d="([^"]*)"',a).group(1)
def glyphs(d):
    """cluster subpaths into glyphs by overlapping x-range within the same line"""
    sps=[(bbox(sp),sp) for sp in subpaths(d)]
    sps.sort(key=lambda b:(round(b[0][1]/30),b[0][0]))
    gs=[]
    for bb,sp in sps:
        for g in gs:
            gb=g['bb']
            if bb[0]<gb[2]-1 and bb[2]>gb[0]+1 and bb[1]<gb[3] and bb[3]>gb[1]:
                g['sps'].append(sp);g['bb']=(min(gb[0],bb[0]),min(gb[1],bb[1]),max(gb[2],bb[2]),max(gb[3],bb[3]));break
        else: gs.append({'bb':bb,'sps':[sp]})
    gs.sort(key=lambda g:(round(g['bb'][1]/30),g['bb'][0]))
    return gs
def split_line(sps,y0,y1):
    """→ list of glyphs (main body bbox + subpaths), each small subpath joined to the nearest body that spans it"""
    line=[(b,sp) for b,sp in sps if y0<=(b[1]+b[3])/2<=y1]
    mains=sorted([[b,[sp]] for b,sp in line if b[3]-b[1]>25],key=lambda g:g[0][0])
    for b,sp in line:
        if b[3]-b[1]>25: continue
        cx=(b[0]+b[2])/2
        cand=[g for g in mains if g[0][0]-1<=cx<=g[0][2]+1] or mains
        min(cand,key=lambda g:abs((g[0][0]+g[0][2])/2-cx))[1].append(sp)
    return mains
