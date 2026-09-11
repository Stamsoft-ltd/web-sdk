"""Local rules, recovery, replay and unfinished-round UI bounds. Never starts a round."""
import os
from playwright.sync_api import sync_playwright
from responsive_layout import MOCK_AUTH, SIZES
from responsive_screens import BASE, OUT, dom_inside, snapshot

BIND = '''async () => {
 const urls=performance.getEntriesByType('resource').map(e=>e.name);
 const get=suffix=>{const url=urls.filter(u=>new URL(u).pathname.endsWith(suffix)).at(-1);
 if(!url)throw new Error('Module not loaded: '+suffix);return import(url)};
 window.shared=await get('/packages/state-shared/index.ts');
 window.stake=await get('/src/state/veggieStake.svelte.ts');
}'''


def enter(page):
    page.goto(f'{BASE}/?rgs_url=localhost&sessionID=dialog-test', wait_until='domcontentloaded')
    page.locator('.splash-screen').wait_for(timeout=30000)
    page.evaluate(BIND)


def main():
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
                enter(page)
                page.locator('.splash-screen').click()
                page.locator('.hud-left .utility').click()
                page.get_by_role('menuitem', name='INFO', exact=True).click()
                # Every rules page; stop at the disabled Next control.
                for i in range(10):
                    page.wait_for_timeout(150)
                    snapshot(page, name, f'rules-{i+1}')
                    # The popup also mounts an off-stage measurement clone. Inspect the real layer.
                    dom_inside(page, '.pop-up-wrap .info-stage, .pop-up-wrap .pinfo-stage', w, h)
                    next_button = page.locator('.pop-up-wrap button[aria-label="Next page"]:visible')
                    if not next_button.count() or next_button.first.is_disabled():
                        break
                    next_button.first.click()
                page.evaluate('() => shared.stateModal.modal=null')
                page.evaluate('''() => {
                    stake.veggieStakeState.pendingRoundDetected=true;
                    stake.veggieStakeState.bootStatus='error';
                    stake.veggieStakeState.bootError='Connection interrupted. Please retry your unfinished round.';
                }''')
                page.locator('.recovery-card').wait_for()
                snapshot(page, name, 'recovery')
                dom_inside(page, '.recovery-card', w, h)
                page.locator('.recovery-card button').scroll_into_view_if_needed()
                dom_inside(page, '.recovery-card button', w, h)
                page.evaluate('''() => {
                    stake.veggieStakeState.pendingRoundDetected=false;
                    stake.veggieStakeState.bootStatus='ready';
                    stake.veggieStakeState.bootError='';
                    stake.veggieStakeState.replaySnapshot={mode:'BONUS',amount:1000000,payout:149250000,payoutMultiplier:149.25,state:[]};
                    shared.stateUi.config.mode='replay';
                }''')
                page.locator('.replay-card').wait_for()
                snapshot(page, name, 'replay')
                dom_inside(page, '.replay-card', w, h)
                page.locator('.replay-card button').scroll_into_view_if_needed()
                dom_inside(page, '.replay-card button', w, h)
                # Fresh mount: exercise the real ResumeBet onMount branch without sending a resume.
                enter(page)
                page.evaluate("() => shared.stateBet.betToResume={active:true,mode:'BONUS',amount:1000000,state:[]}")
                page.locator('.splash-screen').click()
                page.locator('.resume-card').wait_for()
                snapshot(page, name, 'unfinished-round')
                dom_inside(page, '.resume-card', w, h)
                page.locator('.resume-card .primary').scroll_into_view_if_needed()
                dom_inside(page, '.resume-card .primary', w, h)
                assert not errors, (name, errors)
                print(name, 'rules / recovery / replay / resume PASS', flush=True)
                page.close()
        finally:
            browser.close()


if __name__ == '__main__':
    main()
