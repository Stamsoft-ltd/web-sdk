import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fitSceneImage } from '../src/game/sceneLayout.ts';
const source = (name) => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');

test('scene cover/contain keep native aspect and stay centered across device sizes', () => {
	for (const [width, height] of [
		[320, 568],
		[390, 844],
		[844, 390],
		[1200, 680],
		[1920, 1080],
	]) {
		for (const cover of [false, true]) {
			const box = { x: 23, y: 41, width, height },
				fitted = fitSceneImage(1478, 1215, box, cover);
			assert.ok(Math.abs(fitted.width / fitted.height - 1478 / 1215) < 1e-10);
			assert.ok(Math.abs(fitted.x + fitted.width / 2 - (box.x + width / 2)) < 1e-9);
			assert.ok(Math.abs(fitted.y + fitted.height / 2 - (box.y + height / 2)) < 1e-9);
			if (cover) assert.ok(fitted.width >= width - 1e-9 && fitted.height >= height - 1e-9);
			else assert.ok(fitted.width <= width + 1e-9 && fitted.height <= height + 1e-9);
		}
	}
});

test('main scene, welcome and loading share the owned GPU renderer without visual HTML fallbacks', () => {
	const game = source('components/Game.svelte'),
		welcome = source('components/Welcome.svelte'),
		gpu = source('game/gpuScene.ts');
	assert.match(game, /<MainScene\s+src=\{scene\}/);
	assert.match(game, /<LoadingScene\s+progress=\{loadingProgress\}/);
	assert.doesNotMatch(game, /<img class="game-backdrop"|<FigmaLogo|class="loading-line"/);
	assert.doesNotMatch(welcome, /<img|<canvas|background:.*url/);
	assert.match(welcome, /Invisible HTML input targets/);
	assert.match(
		welcome,
		/renderer\?\.update\(\{\s*width,\s*height,\s*slide,\s*reduced,\s*demo,\s*leavingAt,\s*logoTarget,\s*active,\s*translate: t,?\s*\}\)/,
	);
	assert.match(gpu, /priority: -10,\s*underlay: true/);
	assert.match(gpu, /overlay: host,\s*priority: 40/);
	assert.match(gpu, /overlay: host,\s*priority: 50/);
	assert.match(gpu, /landingIntroFrame/);
	assert.match(gpu, /landingExitFrame/);
	assert.doesNotMatch(gpu, /new Application|requestAnimationFrame|setInterval/);
	for (const name of ['MainScene', 'LoadingScene', 'Welcome']) {
		const component = source(`components/${name}.svelte`);
		assert.match(component, /owned\?\.destroy\(\)/);
		assert.match(component, /dead = true/);
	}
	assert.doesNotMatch(source('components/LoadingScene.svelte'), /<img/);
	assert.match(gpu, /press_play_wordmark.webp/);
	assert.match(game, /loadingProgress \+= 0\.8 \/ assets\.length/);
});

test('canvas is permanently mounted in main; presentation is GPU visibility and a GPU shade, not DOM reparenting', () => {
	const engine = source('game/gpuRenderer.ts'),
		game = source('components/Game.svelte');
	assert.equal((engine.match(/appendChild\(this.app.canvas\)/g) || []).length, 1);
	assert.doesNotMatch(engine, /prepend\(this.app.canvas\)|insertBefore\(this.app.canvas/);
	assert.match(engine, /readonly shade = new Graphics\(\)/);
	assert.match(engine, /dataset.pixiShade === 'true'/);
	assert.match(engine, /job.root.alpha = 1/);
	assert.match(game, /<main[\s\S]*<GpuSurface context=\{gpu\}/);
	assert.match(game, /scene-entry > \.figma-layout/);
	assert.doesNotMatch(
		game,
		/class="(?:left-hud|meter-panel|multiplier-panel|free-spins|board-caption|inline-win)"/,
	);
	assert.doesNotMatch(game, /<img[^>]*studio-(?:wordmark|icon)/);
	const panels = source('game/gpuPanels.ts');
	assert.match(panels, /new Text/);
	assert.match(panels, /underlay: true/);
	assert.match(panels, /draw: \(_dt, now\) =>/);
	assert.match(panels, /if \(!flight\) return !arrival.done/);
	assert.match(panels, /flight = null/);
	assert.match(source('components/ScenePanels.svelte'), /observer.disconnect\(\)/);
});

test('mobile panel rail centers both counters below the board and keeps transient copy clear', () => {
	const panels = source('game/gpuPanels.ts');
	assert.match(panels, /statPanelLayout\(/);
	assert.match(panels, /tb.width \/ 2 \+ \(i - 1\)/);
	assert.match(panels, /mb.width \/ 2/);
	assert.match(panels, /caption.visible = !portrait && !compact/);
	assert.match(panels, /padding: 0,[\s\S]*trim: true/);
});

test('game clock replaces the version footer and owns timer cleanup', () => {
	const game = source('components/Game.svelte');
	assert.match(game, /THE GATES \| \{wallClock\}/);
	assert.match(game, /clearInterval\(clockTimer\)/);
	assert.doesNotMatch(game, /THE GATES v1/);
});

test('portrait counters gain height while the HUD and wallet keep separate space', () => {
	const panels = source('game/gpuPanels.ts'),
		css = source('figma.css');
	assert.match(panels, /portrait \? 33 : tb.height/);
	assert.match(
		css,
		/\.figma-layout.portrait \.hud-button-rail\s*\{[^}]*top: var\(--portrait-hud-top\)/,
	);
	assert.match(
		css,
		/\.figma-layout.portrait \.hud-metrics > div\s*\{[^}]*top: var\(--portrait-metrics-top\)/,
	);
	const geometry = source('game/panelLayout.ts');
	assert.match(geometry, /cardHeight: 48/);
	assert.match(geometry, /controlGap: 18/);
});
