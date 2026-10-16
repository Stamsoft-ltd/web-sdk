/** Read-only book presentation. All panel artwork/copy is retained Pixi; no HTML side HUD. */
import { playGameSound } from './audio';
import { gameArrivalFrame } from './entryMotion';
import { Container, Graphics, Text, Sprite, NineSliceSprite, Texture, FillGradient } from 'pixi.js';
import type { GpuEngine } from './gpuRenderer';
import { tumbleFlightTiming, tumbleDestination, tumbleFlightPoint } from './tumbleFlight';
import type { Position } from './contract';
import { loadAssetImage } from './imageAssets';
import { statPanelLayout } from './panelLayout';
export type PanelState = {
	speed?: 'normal' | 'fast' | 'turbo';
	width: number;
	reduced?: boolean;
	positions?: Position[];
	bonusWin?: string;
	bonus: boolean;
	multiplierActive: boolean;
	progress: number;
	multiplier: number;
	freeSpin: number;
	totalFs: number;
	remaining: number;
	caption: string;
	inline: string;
	translate: (key: string) => string;
};
function label(size: number, fill: number | FillGradient = 0xffffff) {
	const node = new Text({
		text: '',
		style: {
			fontFamily: 'GatesCartoon, sans-serif',
			fontSize: size,
			fill,
			align: 'center',
			stroke: { color: 0x061a3a, width: 2.5, join: 'round' },
			padding: 0,
			trim: true,
		},
	});
	node.anchor.set(0.5);
	return node;
}
function fit(node: Text, value: string, x: number, y: number, width: number, size: number) {
	node.text = value;
	node.style.fontSize = size;
	node.position.set(x, y);
	node.scale.set(1);
	node.scale.set(Math.min(1, width / Math.max(1, node.width)));
}
export function createGpuPanels(
	engine: GpuEngine,
	stage: HTMLElement,
	board: HTMLElement,
	error: (error: unknown) => void,
) {
	const root = new Container(),
		panels = new Container(),
		tumbles = new Container(),
		multiplier = new Container(),
		fs = new Container();
	const makeFrame = () => {
		const frame = new Container();
		frame.addChild(new Graphics());
		return frame;
	};
	const tumbleFrame = makeFrame(),
		multiplierFrame = makeFrame(),
		fsFrame = makeFrame();
	const titleGold = new FillGradient({
		start: { x: 0, y: 0 },
		end: { x: 0, y: 1 },
		colorStops: [
			{ offset: 0, color: 0xffef72 },
			{ offset: 0.48, color: 0xffcf12 },
			{ offset: 1, color: 0xf38a00 },
		],
	});
	const tumbleLabel = label(20, titleGold),
		multiLabel = label(20, titleGold),
		multiValue = label(30);
	const bonusTotal = new Container(),
		bonusTotalFrame = makeFrame(),
		bonusTotalLabel = label(13, titleGold),
		bonusTotalValue = label(24);
	bonusTotal.addChild(bonusTotalFrame, bonusTotalLabel, bonusTotalValue);
	panels.addChild(bonusTotal);
	const fsLabel = label(18, titleGold),
		fsValue = label(28);
	const caption = label(12),
		inline = label(27, 0xffe033),
		orbs = new Graphics();
	const orbValues = Array.from({ length: 3 }, () => {
		const gem = new Sprite(Texture.EMPTY);
		gem.anchor.set(0.5);
		return gem;
	});
	const wisp = new Graphics();
	root.addChild(panels, caption, inline, wisp);
	panels.addChild(tumbles, multiplier, fs);
	tumbles.addChild(tumbleFrame, tumbleLabel, orbs, ...orbValues);
	multiplier.addChild(multiplierFrame, multiLabel, multiValue);
	fs.addChild(fsFrame, fsLabel, fsValue);
	let dead = false;
	const mobileGold = new FillGradient({
		start: { x: 0, y: 0 },
		end: { x: 0, y: 1 },
		colorStops: [
			{ offset: 0, color: 0xfff176 },
			{ offset: 0.45, color: 0xffd300 },
			{ offset: 1, color: 0xf38b00 },
		],
	});
	// Ornamental native frames are desktop-only; mobile keeps its compact generated rim.
	const panel = (target: Container, width: number, height: number) => {
		const mobile = state?.width === 360 || state?.width === 800;
		const background = target.children[0] as Graphics;
		const frame = target.children[1] as NineSliceSprite | undefined;
		if (frame) frame.visible = !mobile;
		if (mobile) {
			const rim = Math.min(1, height / 77);
			background
				.clear()
				.roundRect(0, 0, width, height, 17 * rim)
				.fill(0x092e60)
				.stroke({ color: 0x061a33, width: 7 * rim, alignment: 0.5 })
				.roundRect(3 * rim, 3 * rim, width - 6 * rim, height - 6 * rim, 15 * rim)
				.stroke({ fill: mobileGold, width: 5 * rim, alignment: 0.5 })
				.roundRect(8 * rim, 8 * rim, width - 16 * rim, height - 16 * rim, 11 * rim)
				.stroke({ color: 0x0c61f4, width: 3 * rim });
			return;
		}
		const scale = Math.min(1, height / 90);
		// Keep the opaque fill inside the native frame, including its transparent corners.
		background
			.clear()
			.roundRect(16 * scale, 12 * scale, width - 32 * scale, height - 24 * scale, 12 * scale)
			.fill(0x092e60);
		if (frame) {
			frame.scale.set(scale);
			frame.width = width / scale;
			frame.height = height / scale;
		}
	};
	void Promise.all([
		loadAssetImage('./assets/the-gates/stat-art-20261016/stat-frame.png'),
		loadAssetImage('./assets/the-gates/stat-art-20261016/tumble-gem.png'),
	])
		.then(([frame, gem]) => {
			if (dead) return;
			const texture = engine.texture(frame);
			for (const target of [tumbleFrame, multiplierFrame, fsFrame, bonusTotalFrame])
				target.addChild(
					new NineSliceSprite({
						texture,
						leftWidth: 30,
						rightWidth: 30,
						topHeight: 24,
						bottomHeight: 24,
					}),
				);
			for (const sprite of orbValues) sprite.texture = engine.texture(gem);
			engine.layout();
		})
		.catch((reason) => {
			if (!dead) error(reason);
		});
	let state: PanelState | undefined;
	let flight: {
		target: number;
		started: number;
		positions: Position[];
		flightMs: number;
		arrivalMs: number;
		sounded?: boolean;
	} | null = null;
	const endpoints = () => {
		const origin = engine.origin,
			bounds = board.getBoundingClientRect();
		const cells = flight?.positions ?? [];
		const col = cells.length ? cells.reduce((n, p) => n + p.reel + 0.5, 0) / cells.length / 6 : 0.5;
		const row = cells.length ? cells.reduce((n, p) => n + p.row + 0.5, 0) / cells.length / 5 : 0.5;
		const target = orbValues[(flight?.target ?? 1) - 1];
		return {
			from: {
				x: bounds.left - origin.left + bounds.width * col,
				y: bounds.top - origin.top + bounds.height * row,
			},
			to: tumbles.visible
				? {
						x: panels.x + (tumbles.x + target.x) * panels.scale.x,
						y: panels.y + (tumbles.y + target.y) * panels.scale.y,
					}
				: {
						x: bounds.left - origin.left + bounds.width * 0.5,
						y: bounds.top - origin.top - 14 * panels.scale.x,
					},
		};
	};
	const layout = () => {
		if (!state) return;
		const bounds = stage.getBoundingClientRect(),
			boardBounds = board.getBoundingClientRect(),
			origin = engine.origin;
		const scale = bounds.width / state.width;
		panels.position.set(bounds.left - origin.left, bounds.top - origin.top);
		panels.scale.set(scale);
		tumbles.visible = true;
		multiplier.visible = true;
		fs.visible = state.bonus || state.totalFs > 0;
		const geometry = statPanelLayout(
				state.width,
				(boardBounds.bottom - bounds.top) / scale,
				fs.visible,
			),
			{ portrait, compact } = geometry,
			tb = geometry.tumbles,
			mb = geometry.multiplier,
			sb = geometry.freeSpins,
			wb = geometry.totalWin,
			short = compact && fs.visible,
			titleSize = portrait ? 11 : compact ? (short ? 10 : 11) : 20,
			titleY = portrait ? 14 : tb.height * (compact ? 0.3 : 0.31),
			valueY = portrait ? 33 : tb.height * (compact ? 0.68 : 0.69);
		tumbles.position.set(tb.x, tb.y);
		multiplier.position.set(mb.x, mb.y);
		panel(tumbleFrame, tb.width, tb.height);
		panel(multiplierFrame, mb.width, mb.height);
		fit(
			tumbleLabel,
			state.translate('TUMBLES').toUpperCase(),
			tb.width / 2,
			titleY,
			tb.width - 24,
			titleSize,
		);
		multiLabel.visible = true;
		fit(
			multiLabel,
			state.translate('MULTIPLIER').toUpperCase(),
			mb.width / 2,
			titleY,
			mb.width - 24,
			titleSize,
		);
		fit(
			multiValue,
			`${state.multiplier}×`,
			mb.width / 2,
			valueY,
			mb.width - 24,
			portrait ? 17 : compact ? (short ? 16 : 21) : 30,
		);
		orbs.clear();
		for (let i = 0; i < 3; i++) {
			const x = tb.width / 2 + (i - 1) * (portrait ? 23 : compact ? 25 : 41),
				y = portrait || compact ? valueY : tb.height * 0.71,
				lit =
					(flight && performance.now() - flight.started < flight.flightMs
						? flight.target - 1
						: state.progress) >=
					i + 1;
			orbs
				.circle(x, y, portrait ? 8 : compact ? (short ? 7 : 9) : 13)
				.fill(lit ? 0xffce18 : 0x123653)
				.stroke({ color: lit ? 0xfff17a : 0x576957, width: 2 });
			const size = portrait ? 13 : compact ? (short ? 11 : 14) : 22;
			orbValues[i].position.set(x, y);
			orbValues[i].width = size;
			orbValues[i].height = size;
			orbValues[i].alpha = lit ? 1 : 0.35;
			orbValues[i].tint = lit ? 0xffffff : 0x8197ad;
		}
		fs.position.set(sb.x, sb.y);
		panel(fsFrame, sb.width, sb.height);
		fit(
			fsLabel,
			state.translate('FREE SPINS').toUpperCase(),
			sb.width / 2,
			portrait ? 14 : compact ? 12 : 27,
			sb.width - 24,
			portrait ? 11 : compact ? 10 : 18,
		);
		fit(
			fsValue,
			`${state.freeSpin} / ${state.totalFs}`,
			sb.width / 2,
			portrait ? 33 : compact ? 27 : 63,
			sb.width - 24,
			portrait ? 17 : compact ? 16 : 28,
		);
		bonusTotal.visible = fs.visible;
		bonusTotal.position.set(wb.x, wb.y);
		panel(bonusTotalFrame, wb.width, wb.height);
		fit(
			bonusTotalLabel,
			state.translate('TOTAL WIN').toUpperCase(),
			wb.width / 2,
			portrait ? 14 : compact ? 12 : 27,
			wb.width - 24,
			portrait ? 11 : compact ? 10 : 15,
		);
		fit(
			bonusTotalValue,
			state.bonusWin ?? '',
			wb.width / 2,
			portrait ? 33 : compact ? 27 : 63,
			wb.width - 24,
			portrait ? 17 : compact ? 16 : 24,
		);
		engine.rewardTargets.set('multiplier', {
			x: panels.x + (multiplier.x + multiValue.x) * scale,
			y: panels.y + (multiplier.y + multiValue.y) * scale,
			width: (mb.width - 24) * scale,
			height: (portrait ? 18 : compact ? 20 : 40) * scale,
		});
		engine.rewardTargets.set('spins', {
			x: panels.x + (fs.x + fsValue.x) * scale,
			y: panels.y + (fs.y + fsValue.y) * scale,
			width: (sb.width - 24) * scale,
			height: (portrait ? 18 : compact ? 20 : 40) * scale,
		});
		caption.visible = !portrait && !compact && !!state.caption;
		fit(
			caption,
			state.caption,
			portrait
				? boardBounds.right - origin.left - 86 * scale
				: boardBounds.left - origin.left + boardBounds.width / 2,
			portrait
				? boardBounds.bottom - origin.top + 7 * scale
				: boardBounds.top - origin.top + 554 * scale,
			Math.max(1, portrait ? 156 * scale : boardBounds.width - 20 * scale),
			portrait ? 9 * scale : 12 * scale,
		);
		inline.visible = !!state.inline;
		fit(
			inline,
			state.inline,
			boardBounds.left - origin.left + boardBounds.width / 2,
			boardBounds.top - origin.top + boardBounds.height * 0.84,
			boardBounds.width * 0.8,
			27 * scale,
		);
	};
	const stop = engine.register({
		root,
		underlay: true,
		priority: 2,
		layout,
		draw: (_dt, now) => {
			wisp.clear();
			const entry = engine.entry,
				arrival = gameArrivalFrame(entry ? now - entry.startedAt : 99999, entry?.reduced);
			root.y = -engine.app.screen.height * arrival.offset;
			root.alpha = arrival.alpha;
			if (!flight) return !arrival.done;
			const elapsed = now - flight.started,
				progress = Math.min(1, elapsed / flight.flightMs);
			const { from, to } = endpoints();
			if (elapsed >= flight.flightMs) {
				if (!flight.sounded) {
					flight.sounded = true;
					if (elapsed - flight.flightMs < 120) playGameSound('wisp-arrive');
				}
				const fade = Math.max(0, 1 - (elapsed - flight.flightMs) / flight.arrivalMs);
				layout();
				wisp
					.circle(to.x, to.y, (12 + (1 - fade) * 18) * panels.scale.x)
					.stroke({ color: 0xffda32, width: 3 * panels.scale.x, alpha: fade });
				if (!fade) {
					flight = null;
					return false;
				}
			} else {
				for (let i = 0; i < 24; i++) {
					const t = progress - i * 0.012;
					if (t < 0) break;
					const p = tumbleFlightPoint(from, to, t),
						fade = (1 - i / 24) * Math.min(1, progress * 8);
					wisp
						.circle(p.x, p.y, (12 - i * 0.34) * panels.scale.x)
						.fill({ color: 0xffd52c, alpha: fade * 0.35 });
				}
				const p = tumbleFlightPoint(from, to, progress);
				wisp
					.circle(p.x, p.y, 26 * panels.scale.x)
					.fill({ color: 0xffcf21, alpha: 0.12 })
					.circle(p.x, p.y, 14 * panels.scale.x)
					.fill({ color: 0xffe360, alpha: 0.45 })
					.circle(p.x, p.y, 6 * panels.scale.x)
					.fill(0xffffe0);
			}
			return true;
		},
	});
	return {
		update(next: PanelState) {
			const target = state ? tumbleDestination(state.progress, next.progress) : null;
			if (!target && state && next.progress < state.progress) flight = null;
			if (target && !next.reduced)
				flight = {
					target,
					started: performance.now(),
					positions: [...(next.positions ?? [])],
					flightMs: tumbleFlightTiming(next.speed).flight,
					arrivalMs: tumbleFlightTiming(next.speed).arrival,
				};
			if (next.reduced) {
				flight = null;
				if (target) playGameSound('wisp-arrive');
			}
			state = next;
			engine.layout();
		},
		resize: () => engine.layout(),
		destroy() {
			engine.rewardTargets.delete('multiplier');
			engine.rewardTargets.delete('spins');
			dead = true;
			stop();
			titleGold.destroy();
			mobileGold.destroy();
		},
	};
}
