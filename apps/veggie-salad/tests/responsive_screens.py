"""Loading, landing, menus and Pixi presentations at the supplied + rotated sizes.
Local Vite only; uses mocked wallet and in-memory presentation fixtures. No wagers.
Run with the same dependencies/environment as responsive_layout.py.
"""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from responsive_layout import MOCK_AUTH, SIZES

BASE = os.environ.get('RESPONSIVE_BASE_URL', 'http://127.0.0.1:3018').rstrip('/')
OUT = Path(os.environ.get('RESPONSIVE_ARTIFACTS', '/tmp/veggie-responsive')) / 'screens'
OUT.mkdir(parents=True, exist_ok=True)

BIND = '''async () => {
 const urls=performance.getEntriesByType('resource').map(e=>e.name);
 const get=path=>{const u=urls.filter(u=>new URL(u).pathname===path).at(-1);
 if(!u)throw new Error('Live module missing: '+path);return import(u)};
 window.testGame=await get('/src/game/stateGame.svelte.ts');
 window.testApp=await get('/src/game/stateApp.ts');
}'''
PIXIBOUNDS = '''() => {
 const a=window.testApp.stateApp, out=[];
 function walk(n, alpha=1){
  const opacity=alpha*(n.alpha??1);
  if(!n.visible || opacity<.05)return;
  const key=n.texture?Object.entries(a.loadedAssets).find(([k,v])=>v===n.texture)?.[0]:null;
  // Particles/glows and full-bleed backgrounds intentionally cross screen edges.
  if((key && !/background/i.test(key)) || typeof n.text==='string'){
   const b=n.getBounds();
   out.push({key,text:n.text,x:b.minX,y:b.minY,right:b.maxX,bottom:b.maxY});
  }
  n.children?.forEach(c=>walk(c,opacity));
 }
 walk(a.pixiApplication.stage);return out;
}'''


def dom_inside(page, selector, w, h):
    for element in page.locator(selector).all():
        if not element.is_visible():
            continue
        r = element.bounding_box()
        assert r['x'] >= -1 and r['y'] >= -1, (selector, r)
        assert r['x'] + r['width'] <= w + 1, (selector, r, w)
        assert r['y'] + r['height'] <= h + 1, (selector, r, h)


def snapshot(page, name, label):
    page.screenshot(path=str(OUT / f'{name}-{label}.png'))


def main():
    reports = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True,
            args=['--use-angle=swiftshader', '--enable-unsafe-swiftshader'])
        try:
            selected = os.environ.get('RESPONSIVE_SIZES', '').split(',')
            for name, w, h in SIZES:
                if selected != [''] and name not in selected:
                    continue
                page = browser.new_page(viewport={'width': w, 'height': h}, reduced_motion='reduce')
                errors = []
                page.on('pageerror', lambda e: errors.append(str(e)))
                page.route('**/wallet/authenticate', lambda r: r.fulfill(json=MOCK_AUTH))
                page.goto(f'{BASE}/?rgs_url=localhost&sessionID=screen-test', wait_until='domcontentloaded')
                page.locator('canvas').wait_for()
                page.wait_for_timeout(100)
                snapshot(page, name, 'loading')
                dom_inside(page, 'canvas', w, h)
                page.locator('.splash-screen').wait_for(timeout=30000)
                snapshot(page, name, 'landing')
                dom_inside(page, '.studio-logo, .game-logo, .splash-panels, .continue-label', w, h)
                page.locator('.splash-screen').click()
                page.locator('.board').wait_for()
                page.evaluate(BIND)

                page.locator('.bonus-button').click()
                snapshot(page, name, 'bonus-menu')
                dom_inside(page, '.buy-panel', w, h)
                # Scroll in the actual menu, but never confirm a purchase.
                page.locator('.buy-card.mode-bonus').click()
                snapshot(page, name, 'confirm')
                dom_inside(page, '.confirm-panel', w, h)
                page.locator('.confirm-panel .cancel').click()
                if page.locator('.buy-panel').count():
                    page.locator('.buy-panel .close').click()
                page.locator('.hud .auto').click()
                snapshot(page, name, 'autoplay')
                dom_inside(page, '.auto-panel', w, h)
                page.locator('.auto-panel .close').click()
                page.locator('.hud-left .utility').click()
                snapshot(page, name, 'settings')
                dom_inside(page, '.quick-menu', w, h)
                page.locator('.hud-left .utility').click()

                cases = [
                    (f'bonus-start-{tier}', dict(kind='bonus', title='CONGRATS!', detail='',
                        bonusPresentation='start', tier=tier, freeSpins=10, gridSize=size))
                    for tier, size in [('normal', 8), ('super', 9), ('hidden', 10)]
                ]
                cases += [('bonus-end', dict(kind='win', title='CONGRATULATIONS!', detail='',
                    bonusPresentation='end', amount=14925))]
                cases += [(title.lower().replace(' ', '-'), dict(kind='win', title=title,
                    detail='', amount=2240, countDurationMs=0))
                    for title in ['WIN', 'SWEET WIN', 'WILD WIN', 'EPIC WIN', 'MYTHIC WIN', 'LEGENDARY WIN']]
                cases += [('mystery', dict(kind='mystery', title='MYSTERY BONUS', detail='SUPER BONUS')),
                          ('retrigger', dict(kind='retrigger', title='+5 FREE SPINS', detail='KEEP GROWING'))]
                for label, data in cases:
                    page.evaluate('data => {testGame.stateGame.overlay=data}', data)
                    # Allow the complete delayed plaque/veggie entrance and count-up.
                    page.wait_for_timeout(1600)
                    snapshot(page, name, label)
                    items = page.evaluate(PIXIBOUNDS)
                    assert items, (name, label, 'No rendered presentation')
                    reports.append(dict(name=name, label=label, items=items))
                    for item in items:
                        assert item['x'] >= -1 and item['y'] >= -1, (name, label, item)
                        assert item['right'] <= w + 1 and item['bottom'] <= h + 1, (name, label, item)
                    assert not errors, (name, label, errors)
                page.close()
                print(name, 'loading / landing / menus / 12 presentations PASS', flush=True)
        finally:
            (OUT / 'geometry.json').write_text(json.dumps(reports, indent=2))
            browser.close()
    print('All screen checks passed; artifacts:', OUT)


if __name__ == '__main__':
    main()
