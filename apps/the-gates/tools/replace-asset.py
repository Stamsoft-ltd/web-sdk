#!/usr/bin/env python3
"""Replace a PNG and refresh its metadata/atlas geometry. Dry-run unless --execute.
Requires Pillow (`python3 -m pip show Pillow`). Never raster-edits the source.
"""
import argparse, hashlib, json, re, shutil
from pathlib import Path
from PIL import Image

APP=Path(__file__).resolve().parents[1]
ROOT=APP/'static/assets/the-gates'

def plan(relative, source=None):
    target=(ROOT/relative).resolve()
    if not target.is_relative_to(ROOT.resolve()) or not target.is_file():
        raise ValueError('Choose an existing file inside static/assets/the-gates')
    source=Path(source).expanduser().resolve() if source else target
    if target.suffix.lower()!='.png' or source.suffix.lower()!='.png':
        raise ValueError('This helper handles PNG replacements only; SVG/audio keep native formats')
    with Image.open(source) as im:
        im.load(); width,height=im.size;bounds=list(im.convert('RGBA').getbbox() or (0,0,width,height));mode=im.mode
    data=source.read_bytes();sha=hashlib.sha256(data).hexdigest()
    changes={};regions={}
    def resolves(base,value):
        return isinstance(value,str) and any((p/value).resolve()==target for p in [base,base.parent])
    def refresh(value,base):
        if isinstance(value,list):return [refresh(v,base) for v in value]
        if not isinstance(value,dict):return value
        value={k:refresh(v,base) for k,v in value.items()}
        if resolves(base,value.get('path')) or (base.resolve()==target.parent and value.get('asset')==target.name):
            for k,v in [('width',width),('height',height),('bytes',len(data)),('sha256',sha),('alphaBounds',bounds),('mode',mode)]:
                if k in value:value[k]=v
        if base.resolve()==target.parent:
            for k,v in value.items():
                if k==target.name:
                    if isinstance(v,str) and len(v)==64:value[k]=sha
                    elif isinstance(v,dict) and 'sha256' in v:v['sha256']=sha
            if value.get('path')==target.name and 'sha256' in value:value['sha256']=sha
        return value
    for p in ROOT.rglob('*.json'):
        old=json.loads(p.read_text());new=refresh(old,p.parent)
        if new!=old:changes[p]=json.dumps(new,indent=2)+'\n'
    for p in ROOT.rglob('*.atlas'):
        text=p.read_text();blocks=text.split('\n\n');altered=False
        for i,block in enumerate(blocks):
            lines=block.splitlines()
            if not lines or (p.parent/lines[0]).resolve()!=target:continue
            size=re.search(r'^size: (\d+),(\d+)$',block,re.M)
            if not size:raise ValueError(f'Atlas size missing: {p}')
            ow,oh=map(int,size.groups())
            for j,line in enumerate(lines):
                if line.startswith('size:'):lines[j]=f'size: {width},{height}'
                if line.strip().startswith('bounds:'):
                    box=tuple(map(int,line.split(':')[1].split(',')))
                    if box==(0,0,ow,oh):
                        lines[j]=f'  bounds: 0,0,{width},{height}'
                        regions[lines[j-1]]=(ow,oh)
                    elif (width,height)!=(ow,oh):
                        raise ValueError('Cropped atlas replacement must retain original dimensions; edit crop deliberately')
            blocks[i]='\n'.join(lines);altered=True
        if altered:
            new='\n\n'.join(blocks)
            if new!=text:changes[p]=new
    for p in ROOT.rglob('*.json'):
        d=json.loads(changes.get(p,p.read_text()));altered=False
        for skin in d.get('skins',[]):
            for attachments in skin.get('attachments',{}).values():
                for a in attachments.values():
                    if a.get('path') in regions and 'width' in a and 'height' in a:
                        if p.stem in ('SACRED_EYE','RUNE_CHALICE','GUARDIAN_MASK','SUN_MEDALLION','CRYSTAL_ORB') or p.stem.endswith('_GEM'):
                            fit=max(a['width'],a['height'])/max(width,height)
                        else:fit=a['width']/width
                        a.update(width=width*fit,height=height*fit);altered=True
                        if a.get('path') in ('SACRED_EYE-art','RUNE_CHALICE-art','GUARDIAN_MASK-art','SUN_MEDALLION-art','CRYSTAL_ORB-art') or p.stem.endswith('_GEM'):
                            floor=(height/2-bounds[3])*fit
                            for b in d['bones']:
                                if b['name']=='impact':b['y']=floor
                                if b['name']=='body':b['y']=-floor
        if altered:changes[p]=json.dumps(d,indent=2)+'\n'
    return target,source,data,changes

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('asset',help='Path relative to static/assets/the-gates')
    p.add_argument('--source',help='New PNG; omit if already replaced manually')
    p.add_argument('--execute',action='store_true')
    a=p.parse_args();target,source,data,changes=plan(a.asset,a.source)
    print(json.dumps({'asset':str(target.relative_to(ROOT)),'metadataFiles':[str(p.relative_to(ROOT)) for p in changes],'execute':a.execute},indent=2))
    if a.execute:
        if source!=target:target.write_bytes(data)
        for path,text in changes.items():path.write_text(text)
