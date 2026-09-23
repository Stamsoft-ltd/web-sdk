"""Read-only PNG measurement -> atlas/pivot metadata. Never edits image pixels."""
import json
from pathlib import Path
from PIL import Image

root = Path(__file__).resolve().parents[1] / 'static/assets/the-gates/spine'
result = {}
for path in [*root.glob('hq-*.png'), *root.glob('burn-*.png')]:
    image = Image.open(path).convert('RGBA')
    alpha = image.getchannel('A')
    bounds = alpha.point(lambda value: 255 if value > 180 else 0).getbbox()
    item = {'size': list(image.size), 'bounds': list(bounds)}
    if path.stem.startswith('burn-'):
        frames = []
        for row in range(3):
            for col in range(4):
                x, y = round(col * image.width / 4), round(row * image.height / 3)
                w, h = round((col + 1) * image.width / 4) - x, round((row + 1) * image.height / 3) - y
                pixels = alpha.load()
                coverage = [sum(pixels[x + i, y + j] > 180 for i in range(w)) for j in range(h)]
                baseline = max(j for j, count in enumerate(coverage) if count > w * .2) + 1
                # Center on the coal bed, not on a leaning flame tip's silhouette.
                points = [i for j in range(max(0, baseline - 10), baseline)
                          for i in range(w) if pixels[x + i, y + j] > 180]
                center = (min(points) + max(points) + 1) / 2
                frames.append({'region': [x, y, w, h], 'baseline': baseline, 'centerX': center})
        item['frames'] = frames
    result[path.stem] = item
(root / 'art-layout.json').write_text(json.dumps(result, indent=2) + '\n')
