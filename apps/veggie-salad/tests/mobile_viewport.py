"""Mobile viewport / iframe fit regression. Local Vite; mocked auth, no wagers."""
import json
import os
from pathlib import Path
from playwright.sync_api import sync_playwright
from responsive_layout import MOCK_AUTH, FIXTURE, MEASURE, assert_geometry

BASE = os.environ.get('RESPONSIVE_BASE_URL', 'http://localhost:3018').rstrip('/')
OUT = Path(os.environ.get('RESPONSIVE_ARTIFACTS', '/tmp/veggie-mobile-viewport'))
OUT.mkdir(exist_ok=True)
VIEWPORT = '''() => ({inner:[innerWidth,innerHeight],client:[document.documentElement.clientWidth,document.documentElement.clientHeight],visual:visualViewport && {width:visualViewport.width,height:visualViewport.height,scale:visualViewport.scale,offsetLeft:visualViewport.offsetLeft,offsetTop:visualViewport.offsetTop},dpr:devicePixelRatio,scene:(()=>{const r=document.querySelector('.scene').getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}})()})'''

def main():
    reports=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
        try:
            for embedded in [False,True]:
                page=browser.new_page(viewport={'width':956,'height':440},screen={'width':440,'height':956},is_mobile=True,has_touch=True,device_scale_factor=3,reduced_motion='reduce')
                page.route('**/wallet/authenticate',lambda r:r.fulfill(json=MOCK_AUTH))
                url=f'{BASE}/?rgs_url=localhost&sessionID=mobile-fit-test'
                if embedded:
                    html=f'''<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{{margin:0;width:100%;height:100%;overflow:hidden}}iframe{{display:block;border:0;width:100%;height:100%}}</style><iframe src="{url}"></iframe>'''
                    if os.environ.get('RESPONSIVE_CROPPED_HOST') == '1':
                        html=html.replace('iframe{display:block;', 'iframe{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);').replace('border:0;width:100%;height:100%', 'border:0;width:1200px;height:675px')
                    page.route('**/__mobile_host',lambda r:r.fulfill(content_type='text/html',body=html))
                    page.goto(f'{BASE}/__mobile_host',wait_until='networkidle')
                    target=page.frames[1]
                else:
                    page.goto(url,wait_until='networkidle')
                    target=page
                target.get_by_role('button',name='CLICK ANYWHERE TO CONTINUE',exact=True).click(timeout=30000)
                target.locator('.board .cell').first.wait_for()
                target.evaluate('''() => {window.__responsiveStateUrl=performance.getEntriesByType('resource').map(e=>e.name).filter(u=>new URL(u).pathname==='/src/game/stateGame.svelte.ts').at(-1)}''')
                target.evaluate(FIXTURE,'base')
                page.wait_for_timeout(1000)
                report={'embedded':embedded,'viewport':target.evaluate(VIEWPORT),'geometry':target.evaluate(MEASURE)}
                reports.append(report)
                print(json.dumps(report),flush=True)
                page.screenshot(path=str(OUT/f'{"iframe" if embedded else "direct"}.png'))
                geometry=report['geometry']
                geometry.update(name='iframe' if embedded else 'direct',mode='base',width=956,height=440)
                # Bounds use the real visible host, not the child's possibly oversized innerWidth.
                assert report['viewport']['inner'] == [956,440], 'Host frame is oversized; resize the iframe, not its clipping wrapper'
                assert_geometry(geometry,target)
                page.close()
        finally:
            (OUT/'geometry.json').write_text(json.dumps(reports,indent=2))
            browser.close()

if __name__=='__main__': main()
