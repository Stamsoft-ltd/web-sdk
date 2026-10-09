# WELOME (Figma typo) -> WELCOME: lift SCHMUTZO's C into line 1 between L and O.
from glyphs import *
d=list(get('t1.svg','#C41E0A'))[0]
sps=[(bbox(sp),sp) for sp in subpaths(d)]
l1=split_line(sps,0,40); l2=split_line(sps,45,90); l3=split_line(sps,95,135)
C=l3[1]; cb=C[0]
W,E,L,O,M,E2=l1
ov=L[0][2]-O[0][0]
push=(cb[2]-cb[0])-ov
cdx=O[0][0]-cb[0]
cdy=(O[0][1]+O[0][3])/2-(cb[1]+cb[3])/2
x0=W[0][0]; x1=E2[0][2]+push
d1=-((x0+x1)/2-99)
out=[]
for g in (W,E,L): out+=[shift(sp,d1,0) for sp in g[1]]
out+=[shift(sp,cdx+d1,cdy) for sp in C[1]]
for g in (O,M,E2): out+=[shift(sp,push+d1,0) for sp in g[1]]
for g in l2+l3: out+=[shift(sp,0,0) for sp in g[1]]
svg='<svg xmlns="http://www.w3.org/2000/svg" width="198" height="133" viewBox="0 0 198 133" fill="none">\n<path fill="#C41E0A" d="%s"/>\n</svg>\n'%''.join(out)
open('../../../static/assets/mcschmutzo/splash/title-welcome.svg','w').write(svg)
