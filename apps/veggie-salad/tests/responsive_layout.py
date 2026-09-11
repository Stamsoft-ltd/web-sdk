"""Local visual regression checks for portrait and landscape viewport presets.
Run against Vite: pnpm --filter veggie-salad dev --host 127.0.0.1
Requires Python Playwright + Chrome. All wallet authentication is mocked; no real wagers.
Test-only fixtures import the local Vite state module; no production debug switch is added.
Artifacts default to /tmp/veggie-responsive (override RESPONSIVE_ARTIFACTS).
"""
import json
import os
from pathlib import Path

from playwright.sync_api import sync_playwright

SIZES = [
    ("reference", 1469, 662),
    ("desktop", 1200, 675),
    ("laptop", 1024, 576),
    ("popout-s", 400, 225),
    ("popout-l", 800, 450),
    ("mobile-l", 425, 812),
    ("mobile-m", 375, 667),
    ("mobile-s", 320, 568),
    ("portrait-reference", 292, 478),
    ("landscape-l", 812, 425),
    ("landscape-m", 667, 375),
    ("landscape-s", 568, 320),
    ("landscape-wide", 932, 430),
    ("landscape-tall", 956, 440),
    ("tablet-landscape", 1024, 768),
    ("desktop-large", 1920, 1080),
    ("tablet-portrait", 768, 1024),
    ("square", 800, 800),
]
MODES = ["base", "normal", "super", "hidden"]
MOCK_AUTH = {
    "balance": {"amount": 1000000000, "currency": "USD"},
    "config": {
        "minBet": 100000,
        "maxBet": 100000000,
        "stepBet": 100000,
        "defaultBetLevel": 1000000,
        "betLevels": [100000, 500000, 1000000, 2000000],
        "jurisdiction": {},
    },
    "round": None,
}

FIXTURE = """async mode => {
    const {stateGame:s}=await import(window.__responsiveStateUrl);
    s.bonusTier=mode==='base'?null:mode;s.gridSize=mode==='base'?7:mode==='normal'?8:mode==='super'?9:10;
    s.board=Array.from({length:s.gridSize},(_,c)=>Array.from({length:s.gridSize},(_,r)=>({name:['CORN','TOMATO','ONION','CARROT','EGGPLANT','BROCCOLI','PEPPER'][(c*3+r*5)%7]})));
    s.freeSpinTotal=mode==='base'?0:10;s.freeSpinCurrent=1;
    s.spinClusterWins=Array.from({length:6},(_,i)=>({clusterId:'layout-'+i,symbol:'TOMATO',size:5,positions:[],rawAmount:50,multiplierValues:[1],rawMultiplier:1,appliedMultiplier:1,amount:50}));
   }
"""

MEASURE = """() => {
    const rect=s=>{const e=document.querySelector(s),r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
    const cells=[...document.querySelectorAll('.board .cell')].map(e=>e.getBoundingClientRect());
    const boardStyle=getComputedStyle(document.querySelector('.board'));
    const mountainSelector=document.querySelector('.scene').classList.contains('bonus-normal')?'.normal-bonus-mountains':'.base-mountains';
    const mountain=rect(mountainSelector),mountainStyle=getComputedStyle(document.querySelector(mountainSelector));
    const frame=rect('.board-frame');
    // Actual opaque image bounds, excluding its transparent export margin.
    const frameTop=frame.y-frame.h*.052+frame.h*1.104*75/2280;
    const frameBottom=frame.y-frame.h*.052+frame.h*1.104*2206/2280;
    const frameLeft=frame.x-frame.w*.04+frame.w*1.08*87/2804;
    const frameRight=frame.x-frame.w*.04+frame.w*1.08*2718/2804;
    return {balance:rect('.metric.balance'),win:rect('.metric.win'),bet:rect('.metric.bet'),studio:rect('.studio-mark'),stepper:rect('.bet-stepper'),bonus:document.querySelector('.bonus-readouts')?rect('.bonus-readouts'):null,frameVisible:{top:frameTop,bottom:frameBottom,left:frameLeft,right:frameRight},perimeter:[boardStyle.borderTopWidth,boardStyle.paddingTop],mountain,mountainSize:mountainStyle.backgroundSize,board:rect('.board'),frame:rect('.board-frame'),cluster:rect('.cluster-panel'),hud:rect('.hud'),logo:rect('.brand'),spin:rect('.spin'),stage:rect('.game-stage'),heights:[Math.min(...cells.map(r=>r.height)),Math.max(...cells.map(r=>r.height))],widths:[Math.min(...cells.map(r=>r.width)),Math.max(...cells.map(r=>r.width))], overflow:document.documentElement.scrollWidth>innerWidth};
   }
"""


def assert_geometry(report, page):
    name, mode = report["name"], report["mode"]
    w, h = report["width"], report["height"]
    context = (name, mode)
    assert page.locator('.cluster-panel .panel-row:visible').count() == 6, (
        *context, 'cluster slot count'
    )
    assert not report["overflow"], (*context, "document overflow")
    mobile_landscape = page.evaluate("matchMedia('(orientation: landscape) and (pointer: coarse) and (max-height: 600px), (orientation: landscape) and (max-width: 520px) and (max-height: 300px)').matches")
    if mobile_landscape:
        assert report['cluster']['right'] <= report['frameVisible']['left'], (*context, 'cluster not left')
        assert report['hud']['x'] >= report['frameVisible']['right'], (*context, 'HUD not right')
        assert report['cluster']['bottom'] <= h, (*context, 'cluster overflow')
        assert report['hud']['h'] > report['hud']['w'], (*context, 'HUD not vertical')
        assert report['hud']['bottom'] <= h, (*context, 'HUD overflow')
        assert report['logo']['right'] < report['frameVisible']['left'], (*context, 'logo not left')
        assert report['studio']['x'] > report['frameVisible']['right'], (*context, 'studio not right')
        assert report['balance']['y'] >= report['cluster']['bottom'], (*context, 'balance not below pays')
        assert report['balance']['right'] < report['frameVisible']['left'], (*context, 'balance not left')
        assert report['win']['y'] >= report['hud']['bottom'], (*context, 'win not below rail')
        assert report['win']['x'] > report['frameVisible']['right'], (*context, 'win not right')
        assert report['stepper']['right'] <= report['hud']['x'], (*context, 'bet stepper not beside rail')
        if report['bonus']:
            assert report['bonus']['bottom'] < report['cluster']['y'], (*context, 'bonus counters not above pays')
            assert report['bonus']['y'] > report['logo']['bottom'], (*context, 'bonus counters overlap logo')
        plus = page.get_by_role('button', name='INCREASE BET', exact=True).bounding_box()
        minus = page.get_by_role('button', name='DECREASE BET', exact=True).bounding_box()
        assert plus['y'] + plus['height'] <= report['bet']['y'] + 1, (*context, 'plus not above bet')
        assert report['bet']['bottom'] <= minus['y'] + 1, (*context, 'minus not below bet')
        for selector in ['.hud', '.bet-stepper', '.metric.balance', '.metric.win']:
            border = page.locator(selector).evaluate('e => parseFloat(getComputedStyle(e).borderTopWidth)')
            assert border >= 3, (*context, 'thin HUD border', selector, border)
        previous_bottom = 0
        for selector in ['.hud-left .utility', '.bonus-button', '.spin', '.turbo', '.auto']:
            box = page.locator(selector).bounding_box()
            assert box['y'] >= previous_bottom, (*context, 'rail controls overlap', selector)
            previous_bottom = box['y'] + box['height']
        for selector in ['.metric.balance', '.metric.win', '.metric.bet']:
            box = page.locator(selector).bounding_box()
            assert 0 <= box['x'] and box['x'] + box['width'] <= w + 1, (*context, 'metric horizontal overflow')
            assert 0 <= box['y'] and box['y'] + box['height'] <= h + 1, (*context, 'metric vertical overflow')
    elif w > h and w >= 681:
        assert report['hud']['w'] > report['hud']['h'], (*context, 'desktop got mobile rail')
    assert page.locator('.panel-row:visible strong').count() == 6, (*context, 'filled slot count')
    for row in page.locator('.cluster-panel .panel-row:visible').all():
        box = row.bounding_box()
        panel = report['cluster']
        assert box['y'] >= panel['y'] and box['y']+box['height'] <= panel['bottom']+1, (*context, 'payout overflow')
        assert box['x'] >= panel['x'] and box['x']+box['width'] <= panel['right']+1, (*context, 'payout horizontal overflow')
    for axis in ["heights", "widths"]:
        assert report[axis][1] - report[axis][0] <= 1 / 32, (*context, axis)
    assert report["perimeter"] == ["0px", "0px"], (*context, "fixed-pixel perimeter")
    visible = report["frameVisible"]
    assert visible["top"] >= -1 and visible["bottom"] <= h + 1, (*context, visible)
    assert visible["left"] >= -1 and visible["right"] <= w + 1, (*context, visible)
    if mode in ["base", "normal"]:
        assert report["mountainSize"] == "contain", (*context, "mountain stretched")
        aspect = 5028 / (1136 if mode == "normal" else 998)
        mountain = report["mountain"]
        assert abs(mountain["w"] / mountain["h"] - aspect) < 0.005, context
    else:
        size = page.locator(f".background-{mode}").evaluate(
            "e => getComputedStyle(e).backgroundSize"
        )
        assert size == "cover", (*context, "bonus background stretched")

    for selector in [".spin", ".bonus-button", ".turbo", ".auto", ".bet-stepper button"]:
        for control in page.locator(selector).all():
            assert control.is_visible(), (*context, "hidden control", selector)
            box = control.bounding_box()
            assert box["x"] >= 0 and box["x"] + box["width"] <= w + 1, context
            assert box["y"] >= 0 and box["y"] + box["height"] <= h + 1, context
            assert control.evaluate('''e => {
                const r=e.getBoundingClientRect();
                const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
                return hit===e || e.contains(hit);
            }'''), (*context, 'control covered', selector)

    if h >= w:
        assert report['logo']['y'] < w * .1, (*context, 'excess space above logo')
        assert abs(report['frame']['w'] / report['frame']['h'] - 1.25) < .002, (*context, 'portrait board aspect ratio')
        assert report['cluster']['y'] - report['logo']['bottom'] >= w * .02, (*context, 'logo/pays too tight')
        assert report['spin']['y'] - report['frameVisible']['bottom'] >= w * .02, (*context, 'board/spin too tight')
        assert report['balance']['y'] - report['spin']['bottom'] >= w * .01, (*context, 'spin/metrics too tight')
        balance, bet, win = report['balance'], report['bet'], report['win']
        assert balance['w'] > 0 and balance['h'] > 0, (*context, 'balance hidden')
        assert balance['right'] <= bet['x'] and bet['right'] <= win['x'], (*context, 'metric order')
        assert abs(balance['y'] - win['y']) < 1, (*context, 'metrics not aligned')
        assert report['board']['y'] - report['cluster']['bottom'] < w * .07, (*context, 'gap above board')
        assert report['spin']['y'] - report['board']['bottom'] < w * .12, (*context, 'gap below board')
        if report['bonus']:
            assert report['bonus']['x'] >= report['cluster']['right'] - 1, (*context, 'bonus not beside pays')
            assert abs(report['bonus']['y'] - report['cluster']['y']) < 1, (*context, 'bonus/pays misaligned')
        for selector in ['.hud .utility', '.hud .bet-stepper button']:
            for control in page.locator(selector).all():
                shell = control.evaluate('e => {const s=getComputedStyle(e); return [s.backgroundImage,s.clipPath,s.borderRadius]}')
                assert shell == ['none', 'none', '0px'], (*context, 'non-rectangular mobile button', shell)
        assert page.locator('.cluster-panel .panel-row').nth(5).is_visible(), context
        assert report["cluster"]["bottom"] < report["board"]["y"], context
        spin = report["spin"]
        assert abs(spin["x"] + spin["w"] / 2 - w / 2) < 1, (*context, "spin off-centre")
        assert report["hud"]["bottom"] <= h, (*context, "HUD clipped")
        assert spin["y"] >= report["board"]["bottom"], (*context, "HUD overlap")
        assert page.locator(".panel-row strong").first.is_visible(), context
        assert page.locator(".panel-row span").nth(1).is_visible(), context

    # Map the transparent opening of board-frame.png through its percentage outsets.
    # A proportional bleed beneath the wood prevents seams without masking a cell row.
    f = report["frame"]
    opening_top = f["y"] - f["h"] * .052 + f["h"] * 1.104 * 148 / 2280
    opening_bottom = f["y"] - f["h"] * .052 + f["h"] * 1.104 * 2133 / 2280
    # CSS bleeds ~0.15% beneath the artwork; tolerance scales with the frame,
    # plus browser subpixel rounding, rather than failing on large monitors.
    max_bleed = f['h'] * .0016 + 1 / 32
    assert 0 <= opening_top - report["board"]["y"] <= max_bleed, (*context, "top alignment")
    assert 0 <= report["board"]["bottom"] - opening_bottom <= max_bleed, (*context, "bottom alignment")


def main():
    out = Path(os.environ.get("RESPONSIVE_ARTIFACTS", "/tmp/veggie-responsive"))
    base_url = os.environ.get("RESPONSIVE_BASE_URL", "http://127.0.0.1:3018").rstrip('/')
    out.mkdir(parents=True, exist_ok=True)
    reports, errors = [], []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel="chrome",
            headless=True,
            args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
        )
        page = browser.new_page(
            viewport={"width": 1200, "height": 675}, reduced_motion="reduce",
            is_mobile=os.environ.get("RESPONSIVE_TOUCH") == "1",
            has_touch=os.environ.get("RESPONSIVE_TOUCH") == "1"
        )
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.route("**/wallet/authenticate", lambda route: route.fulfill(json=MOCK_AUTH))
        page.goto(
            f"{base_url}/?rgs_url=localhost&sessionID=layout-test",
            wait_until="networkidle",
        )
        page.get_by_role("button", name="CLICK ANYWHERE TO CONTINUE", exact=True).click(
            timeout=30000
        )
        page.locator(".board .cell").first.wait_for()
        # Vite may import a timestamped module after an edit. Reuse that exact module,
        # rather than creating a second state singleton by importing the unversioned URL.
        page.evaluate('''() => {
            const urls=performance.getEntriesByType('resource')
                .map(entry=>entry.name)
                .filter(url=>new URL(url).pathname === '/src/game/stateGame.svelte.ts');
            if (!urls.length) throw new Error('Live state module not found');
            window.__responsiveStateUrl=urls.at(-1);
        }''')
        try:
            selected = os.environ.get('RESPONSIVE_SIZES', '').split(',')
            sizes = [size for size in SIZES if selected == [''] or size[0] in selected]
            for name, w, h in sizes:
                page.set_viewport_size({"width": w, "height": h})
                for mode in MODES:
                    page.evaluate(FIXTURE, mode)
                    expected_cells = {'base': 49, 'normal': 64, 'super': 81, 'hidden': 100}[mode]
                    page.wait_for_function(
                        "count => document.querySelectorAll('.board .cell').length === count",
                        arg=expected_cells,
                    )
                    # Finish the documented 850ms background transition and grid swap.
                    page.wait_for_timeout(950)
                    report = page.evaluate(MEASURE)
                    report.update(name=name, mode=mode, width=w, height=h)
                    reports.append(report)
                    page.screenshot(path=str(out / f"{name}-{mode}.png"))
                    assert_geometry(report, page)
                    assert not errors, (name, mode, errors)
                    page.evaluate('''async () => {
                        const {stateGame:s,CLUSTER_LOG_SIZE}=await import(window.__responsiveStateUrl);
                        if (CLUSTER_LOG_SIZE !== 6) throw new Error('Expected six retained payouts');
                        s.spinClusterWins=[];
                    }''')
                    assert page.locator('.panel-row.vacant:visible').count() == 6
                    empty_panel = page.evaluate(MEASURE)['cluster']
                    assert empty_panel == report['cluster'], (name, mode, 'empty panel changed size')
                print(name, "PASS (base / normal / super / hidden)", flush=True)
        finally:
            (out / "geometry.json").write_text(json.dumps(reports, indent=2))
            browser.close()
    print(f"{len(sizes) * len(MODES)} responsive states passed; screenshots + geometry:", out)


if __name__ == "__main__":
    main()
