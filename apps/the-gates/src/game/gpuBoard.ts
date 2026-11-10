import { loadClusterSymbols, type ClusterSymbol } from './gpuClusterSymbols';
import { clusterClock, clusterGestureMs } from './symbolClusterMotion';
import type { Speed } from './uiPolicy';
import { PORTAL_CLOSE_MS, portalPalette } from './portalClose';
import { applyPortalClose, drawPortalClose } from './portalCloseVfx';
import { winGemBoardShake } from './winGemMotion';
import { tumbleLabelAnchors } from './tumbleLabels';
import { gameArrivalFrame } from './entryMotion';
import type { Win } from './contract';
import {
	scatterCelebrationFrame,
	isCelebratingScatter,
	type ScatterCelebration,
} from './scatterCelebration';
import { playGameSound, type SoundCue } from './audio';
import { createReelAudioTracker } from './reelAudio';
import { Container, Graphics, FillGradient, Sprite, Text } from 'pixi.js';
import type { Board, SymbolName } from './contract';
import { MOTION_ROOT, UI_ART_ROOT } from './art';
import { loadAssetImage } from './imageAssets';
import { symbolViewport } from './symbolFit';
import { scatterCellScale, scatterOverFrame, wildCellScale } from './scatterFit';
import { boardGeometry } from './boardGeometry';
import { ambientSymbolGlow, payingSymbolGlow } from './symbolGlow';
import { loadRig } from './spine';
import { cellMotion, sampleTileTravel, landingProgress, type Wave } from './motion';
import { portalRemovalTracks, PORTAL_SECONDS } from './portalAnimation';
import type { GpuEngine, GpuPose } from './gpuRenderer';
export type BoardView = {
	motionSpeed?: Speed;
	scatterCelebration?: null | ScatterCelebration;
	wins?: Win[];
	multiplier?: number;
	multiplierActive?: boolean;
	formatAmount?: (amount: number) => string;
	board: Board;
	offsets: number[][];
	sticky: string[];
	winning: string[];
	removed: string[];
	phase: string;
	wave: Wave;
	startedAt: number;
	roundId: string;
	revealId: number;
	palette: string;
	reduced: boolean;
	paused: boolean;
	mobile: boolean;
};
type Tile = {
	cluster?: ClusterSymbol;
	root: Container;
	pad: Graphics;
	fx: Graphics;
	pose?: GpuPose;
	name?: SymbolName;
	request: string;
	revision: number;
	removal: string;
	x: number;
	y: number;
	width: number;
	height: number;
	pitch: number;
};
export function createGpuBoard(
	engine: GpuEngine,
	host: HTMLElement,
	ready: (value: boolean) => void,
	failed: (error: unknown) => void,
) {
	const root = new Container(),
		mask = new Graphics(),
		background = new Graphics(),
		frame = new Sprite();
	const field = new Container();
	// Landed Keys/Wilds bypass the frame. Moving symbols share the same masked-field guard.
	const keyLayer = new Container();
	const labels: Text[] = [];
	const payouts = new Container();
	// Amounts must cover even landed Keys/Wilds in the over-frame layer.
	field.sortableChildren = true;
	root.addChild(background, field, mask, frame, keyLayer, payouts);
	field.mask = mask;
	payouts.mask = mask;
	const mobileGold = new FillGradient({
		start: { x: 0, y: 0 },
		end: { x: 0, y: 1 },
		colorStops: [
			{ offset: 0, color: 0xedbd4f },
			{ offset: 0.5, color: 0xfdcb02 },
			{ offset: 1, color: 0xf67f00 },
		],
	});
	let frameReady = false;
	let clusterArt: Awaited<ReturnType<typeof loadClusterSymbols>> | undefined;
	let payingKey = '',
		payingAge = 0;
	const updateReady = () =>
		ready(
			!!state &&
				!!clusterArt &&
				(state.mobile || frameReady) &&
				tiles.every((t) => !t.name || !!t.pose),
		);
	void loadAssetImage(`${UI_ART_ROOT}reel-frame.png`)
		.then((image) => {
			if (dead) return;
			frame.texture = engine.texture(image);
			frameReady = true;
			geometry();
			updateReady();
			engine.invalidate();
		})
		.catch((error) => {
			if (!dead) {
				failed(error);
				console.error('Pixi board frame unavailable', error);
			}
		});
	const tiles: Tile[] = Array.from({ length: 30 }, () => {
		const root = new Container(),
			pad = new Graphics(),
			fx = new Graphics();
		root.addChild(pad);
		field.addChild(fx);
		fx.zIndex = 11;
		field.addChild(root);
		return {
			root,
			pad,
			fx,
			request: '',
			revision: 0,
			removal: '',
			x: 0,
			y: 0,
			width: 0,
			height: 0,
			pitch: 0,
		};
	});
	const gradients = new Map<string, FillGradient>();
	let state: BoardView,
		dead = false,
		dirty = true;
	const clusterReady = loadClusterSymbols().then((art) => {
		if (dead) {
			art.destroy();
			return undefined;
		}
		clusterArt = art;
		updateReady();
		engine.invalidate();
		return art;
	});
	// Per-symbol promise consumers report errors; observe the shared request too.
	void clusterReady.catch((error) => {
		if (!dead) failed(error);
	});
	let baseY = 0,
		baseX = 0;
	const geometry = () => {
		if (!state || dead) return;
		dirty = true;
		const origin = engine.origin,
			bounds = host.getBoundingClientRect();
		const width = Math.max(1, host.clientWidth),
			height = Math.max(1, host.clientHeight);
		baseY = bounds.top - origin.top;
		baseX = bounds.left - origin.left;
		root.position.set(baseX, baseY);
		root.scale.set(bounds.width / width, bounds.height / height);
		const { field: opening, border, cells } = boardGeometry(width, height, state.mobile);
		background.clear();
		if (state.mobile)
			background
				.roundRect(1.5, 1.5, width - 3, height - 3, 17.5)
				.fill(mobileGold)
				.stroke({ width: 3, color: 0x021d42 });
		background
			.roundRect(
				opening.x + border / 2,
				opening.y + border / 2,
				opening.width - border,
				opening.height - border,
				state.mobile ? 10.5 : 16,
			)
			.fill(0x0d223f);
		if (border) background.stroke({ width: border, color: 0x071b2d });
		mask
			.clear()
			.roundRect(
				opening.x + border,
				opening.y + border,
				opening.width - border * 2,
				opening.height - border * 2,
				state.mobile ? 9 : 16,
			)
			.fill(0xffffff);
		frame.visible = !state.mobile && frameReady;
		frame.position.set(0, 0);
		if (frameReady) {
			frame.width = width;
			frame.height = height;
		}
		cells.forEach((cell, index) => {
			Object.assign(tiles[index], cell);
			engine.rewardTargets.set(`cell:${Math.floor(index / 5)}:${index % 5}`, {
				x: root.x + (cell.x + cell.width / 2) * root.scale.x,
				y: root.y + (cell.y + cell.height / 2) * root.scale.y,
				width: cell.width * root.scale.x,
				height: cell.height * root.scale.y,
			});
		});
		paint();
	};
	function paint() {
		if (!state) return;
		tiles.forEach((tile, index) => {
			const key = `${Math.floor(index / 5)}:${index % 5}`,
				name = tile.name;
			tile.root.zIndex = name === 'KEY' || name === 'WILD' ? 10 : 0;
			const highlight = state.winning.includes(key) && ['winning', 'gate'].includes(state.phase);
			const color = highlight
				? name
					? payingSymbolGlow(name, key, state.wins)
					: 0xffd52c
				: ambientSymbolGlow(name);
			const gradientKey = `${name ?? 'empty'}:${highlight ? 'pay' : 'idle'}:${color}:${tile.width}:${tile.height}`;
			let gradient = gradients.get(gradientKey);
			if (!gradient) {
				gradient = new FillGradient({
					type: 'radial',
					textureSpace: 'global',
					center: { x: tile.width / 2, y: tile.height / 2 },
					innerRadius: 0,
					outerCenter: { x: tile.width / 2, y: tile.height / 2 },
					outerRadius: Math.max(tile.width, tile.height) * (highlight ? 0.72 : 0.8),
					colorStops: [
						{ offset: 0, color },
						{ offset: highlight ? 0.45 : 0.24, color },
						{ offset: 1, color: 0x0b192c },
					],
				});
				gradients.set(gradientKey, gradient);
			}
			if (name === 'KEY' || name === 'WILD') {
				const w = tile.width,
					h = tile.height,
					radius = Math.min(8, w * 0.08);
				tile.pad
					.clear()
					.roundRect(0, 0, w, h, radius)
					.fill(0x031222)
					.roundRect(2, 2, Math.max(1, w - 4), Math.max(1, h - 4), radius)
					.fill(0xffd52c)
					.roundRect(4, 4, Math.max(1, w - 8), Math.max(1, h - 8), Math.max(1, radius - 2))
					.fill(0x031222)
					.roundRect(5.5, 5.5, Math.max(1, w - 11), Math.max(1, h - 11), Math.max(1, radius - 3))
					.fill(name === 'WILD' && highlight ? gradient : 0x0753c5);
				return;
			}
			tile.pad
				.clear()
				.roundRect(
					0.5,
					0.5,
					Math.max(1, tile.width - 1),
					Math.max(1, tile.height - 1),
					Math.min(8, tile.width * 0.06),
				)
				.fill(gradient)
				.stroke({
					width: 1,
					color: highlight ? 0xfbd332 : 0x46617e,
					alpha: highlight ? 1 : 0.65,
				});
		});
	}
	const landedReels = createReelAudioTracker();
	let keySoundWave = '';
	const remove = engine.register({
		root,
		underlay: true,
		layout: geometry,
		draw: (dt, now) => {
			if (!state) return false;
			const entry = engine.entry,
				arrival = gameArrivalFrame(entry ? now - entry.startedAt : 99999, entry?.reduced);
			const impact = winGemBoardShake(
				engine.boardImpactAt === null ? 99999 : now - engine.boardImpactAt,
				state.reduced,
			);
			root.x = baseX + impact.x;
			root.y = baseY - (engine.app.screen.height + host.clientHeight) * arrival.offset + impact.y;
			root.alpha = arrival.alpha;
			if (state.phase === 'dropping' && !state.paused) {
				for (const reel of landedReels(
					`${state.roundId}:${state.revealId}:${state.startedAt}`,
					state.wave,
					state.offsets,
					state.sticky,
					now - state.startedAt,
					state.reduced,
				)) {
					playGameSound(`reel-${reel + 1}` as SoundCue, { group: 'reel', speed: state.wave.speed });
					const waveId = `${state.roundId}:${state.revealId}:${state.startedAt}`;
					if (
						keySoundWave !== waveId &&
						state.board[reel]?.some(
							(cell, row) => cell?.name === 'KEY' && !!state!.offsets[reel]?.[row],
						)
					) {
						keySoundWave = waveId;
						playGameSound('key', { gain: 0.45 });
					}
				}
			}
			if (
				!dirty &&
				arrival.done &&
				!state.scatterCelebration &&
				(state.paused ||
					state.reduced ||
					!['spinning', 'dropping', 'removing', 'winning', 'gate'].includes(state.phase))
			)
				return !impact.done;
			dirty = false;
			const amounts =
				state.phase === 'removing' &&
				(state.reduced || now - state.startedAt >= cellMotion(state.wave, 0, 0, 0).duration * 0.78)
					? tumbleLabelAnchors(state.wins ?? [])
					: [];
			while (labels.length < amounts.length) {
				const label = new Text({
					text: '',
					style: {
						fontFamily: 'GatesCartoon',
						fontSize: 32,
						fill: 0xffffff,
						stroke: { color: 0x021d42, width: 5, join: 'round' },
						align: 'center',
					},
				});
				label.anchor.set(0.5);
				labels.push(label);
				payouts.addChild(label);
			}
			labels.forEach((label, i) => {
				const entry = amounts[i];
				label.visible = !!entry;
				if (!entry) return;
				const tile = tiles[entry.position.reel * 5 + entry.position.row];
				const base = state.formatAmount?.(entry.rawAmount) ?? String(entry.rawAmount / 100);
				label.text =
					base + (state.multiplierActive && state.multiplier! > 1 ? ` × ${state.multiplier}` : '');
				label.position.set(tile.x + tile.width / 2, tile.y + tile.height * 0.55);
				label.scale.set(1);
				label.scale.set(Math.min(1, (tile.width * 2.1) / Math.max(1, label.width)));
			});
			if (payingKey && ['winning', 'gate'].includes(state.phase))
				payingAge = clusterClock(
					payingAge,
					dt * 1000,
					state.motionSpeed ?? state.wave.speed,
					state.paused || state.reduced || state.phase === 'gate',
				);
			let moving = !arrival.done || !impact.done;
			for (let index = 0; index < tiles.length; index++) {
				const tile = tiles[index],
					reel = Math.floor(index / 5),
					row = index % 5,
					key = `${reel}:${row}`;
				const contact = cellMotion(state.wave, reel, row, state.offsets[reel]?.[row] ?? 0);
				const travel =
					['spinning', 'dropping'].includes(state.phase) &&
					!state.sticky.includes(key) &&
					(state.phase === 'spinning' || !!state.offsets[reel]?.[row]);
				const elapsed = now - state.startedAt;
				tile.root.position.set(
					tile.x,
					tile.y +
						(travel && !state.reduced
							? sampleTileTravel(contact, elapsed, state.phase === 'spinning') * tile.pitch
							: 0),
				);
				moving ||=
					travel && !state.reduced && elapsed < contact.delay + contact.duration + contact.impact;
				tile.fx.clear();
				tile.root.scale.set(1);
				tile.root.rotation = 0;
				const celebration = state.scatterCelebration;
				const celebrating = isCelebratingScatter(celebration, key, tile.name);
				if (celebrating && celebration) {
					const f = scatterCelebrationFrame(
						now - celebration.startedAt,
						celebration.duration,
						state.reduced,
					);
					const cx = tile.root.x + tile.width / 2,
						cy = tile.root.y + tile.height / 2,
						r = Math.min(tile.width, tile.height) * 0.42;
					for (let i = 3; i >= 1; i--)
						tile.fx
							.circle(cx, cy, r * (1 + i * 0.22))
							.fill({ color: 0xffd94b, alpha: f.glow * 0.05 * i });
					tile.fx
						.roundRect(tile.root.x + 2, tile.root.y + 2, tile.width - 4, tile.height - 4, 8)
						.stroke({ color: 0xffed96, width: 3, alpha: f.glow });
					if (!state.reduced)
						for (let i = 0; i < 7; i++) {
							const angle = (i * Math.PI * 2) / 7 + f.progress * 2,
								dist = r * (0.65 + f.progress * 0.8);
							const x = cx + Math.cos(angle) * dist,
								y = cy + Math.sin(angle) * dist;
							tile.fx
								.moveTo(x - 3, y)
								.lineTo(x + 3, y)
								.moveTo(x, y - 3)
								.lineTo(x, y + 3)
								.stroke({ color: 0xfff1a6, width: 2, alpha: 1 - f.progress * 0.65 });
						}
					moving ||= !state.reduced;
				}
				const pose = tile.pose;
				if (!pose) continue;
				pose.begin();
				if (state.reduced || (state.paused && !celebrating)) pose.actor.sample('setup', 0);
				else if (state.phase === 'removing' && state.removed.includes(key)) {
					const progress = Math.max(0, Math.min(1, (elapsed - contact.delay) / contact.duration));
					const closeMs = Math.min(PORTAL_CLOSE_MS[state.wave.speed], contact.duration * 0.65);
					const symbolMs = Math.max(1, contact.duration - closeMs);
					const age = Math.max(0, elapsed - contact.delay);
					pose.actor.sample('remove', Math.min(0.87, (age / symbolMs) * 0.87) * PORTAL_SECONDS);
					if (age >= symbolMs) {
						const closing = Math.min(1, (age - symbolMs) / closeMs);
						applyPortalClose(pose.actor.skeleton, closing);
						drawPortalClose(
							tile.fx,
							closing,
							tile.x + tile.width / 2,
							tile.y + tile.height / 2,
							Math.min(tile.width, tile.height) * 0.5,
							portalPalette(state.palette),
						);
					}
					moving ||= progress < 1;
				} else if (state.phase === 'dropping' && travel) {
					const progress = landingProgress(now, {
						startedAt: state.startedAt,
						delay: contact.delay + contact.duration,
						duration: contact.impact,
					});
					pose.actor.sample(progress === null ? 'setup' : 'land', (progress ?? 0) * 0.12);
				} else if (['winning', 'gate'].includes(state.phase) && state.winning.includes(key)) {
					if (tile.cluster) pose.actor.sample('setup', 0);
					else {
						pose.actor.setAnimation('paying');
						pose.actor.update(dt);
					}
					moving ||= !tile.cluster || payingAge < clusterGestureMs(tile.name!);
				} else pose.actor.sample('setup', 0);
				const viewport =
						tile.name === 'WILD'
							? Math.max(pose.actor.data.width, pose.actor.data.height)
							: symbolViewport(tile.name),
					scale =
						tile.name === 'KEY'
							? scatterCellScale(tile.width, tile.height)
							: tile.name === 'WILD'
								? wildCellScale(tile.width, tile.height)
								: Math.min(tile.width, tile.height) / viewport;
				const overFrame =
						(tile.name === 'KEY' || tile.name === 'WILD') &&
						scatterOverFrame(state.phase, travel, state.reduced, elapsed, contact),
					parent = overFrame ? keyLayer : tile.root;
				if (pose.view.parent !== parent) parent.addChild(pose.view);
				pose.view.position.set(
					overFrame ? tile.root.x + tile.width / 2 : tile.width / 2,
					overFrame ? tile.root.y + tile.height / 2 : tile.height / 2,
				);
				pose.view.visible = tile.root.visible;
				pose.view.scale.set(scale, -scale);
				if (celebrating && celebration) {
					const f = scatterCelebrationFrame(
						now - celebration.startedAt,
						celebration.duration,
						state.reduced,
					);
					pose.view.scale.set(scale * f.scale, -scale * f.scale);
					pose.view.rotation = f.rotation;
				} else pose.view.rotation = 0;
				if (tile.cluster) {
					const selected =
						state.winning.includes(key) && ['winning', 'gate', 'removing'].includes(state.phase);
					tile.cluster.update(
						pose,
						selected ? payingAge : 0,
						state.reduced,
						payingSymbolGlow(tile.name!, key, state.wins),
					);
				}
			}
			return moving;
		},
	});
	return {
		resize: () => {
			geometry();
			engine.invalidate();
		},
		update(next: BoardView) {
			state = next;
			if (state.phase === 'winning' && state.winning.length) {
				const selection = `${state.roundId}:${state.revealId}:${state.winning.join(',')}`;
				if (payingKey !== selection) {
					payingKey = selection;
					payingAge = 0;
				}
			} else if (!['gate', 'removing'].includes(state.phase)) {
				payingKey = '';
				payingAge = 0;
			}
			tiles.forEach((tile, index) => {
				const reel = Math.floor(index / 5),
					row = index % 5,
					key = `${reel}:${row}`,
					name = state.sticky.includes(key) ? 'WILD' : state.board[reel]?.[row]?.name;
				const request = `${name}:${state.palette}`;
				if (tile.request !== request) {
					tile.request = request;
					const revision = ++tile.revision;
					tile.removal = '';
					tile.name = name;
					if (tile.cluster) tile.pose?.view.removeSlotObject('body');
					tile.cluster?.destroy();
					tile.cluster = undefined;
					tile.pose?.view.destroy();
					tile.pose = undefined;
					ready(false);
					if (name)
						void Promise.all([
							loadRig(
								name,
								name === 'WILD' ? 'symbols' : `symbols-${state.palette}`,
								name === 'WILD' ? undefined : MOTION_ROOT,
							),
							clusterReady,
						])
							.then(([data, art]) => {
								if (dead || tile.request !== request || tile.revision !== revision) return;
								tile.pose = engine.pose(data);
								tile.cluster = art?.create(name);
								if (tile.cluster) tile.pose.view.addSlotObject('body', tile.cluster.view);
								dirty = true;
								tile.root.addChild(tile.pose.view);
								updateReady();
								engine.invalidate();
							})
							.catch((error) => {
								if (!dead) {
									failed(error);
									console.error('Pixi symbol unavailable', name, error);
								}
							});
				}
				if (name && state.phase === 'removing' && state.removed.includes(key)) {
					const seed = `${state.roundId}:${state.revealId}:${key}`;
					if (tile.removal !== seed) {
						tile.removal = seed;
						void loadRig(
							name,
							name === 'WILD' ? 'symbols' : `symbols-${state.palette}`,
							name === 'WILD' ? undefined : MOTION_ROOT,
							{ remove: portalRemovalTracks(seed) },
						).then((data) => {
							if (!dead && tile.removal === seed && tile.pose) {
								tile.pose.actor.overrideAnimation(data.findAnimation('remove')!);
								dirty = true;
								engine.invalidate();
							}
						});
					}
				}
			});
			geometry();
			updateReady();
			engine.invalidate();
		},
		destroy() {
			for (let i = 0; i < 30; i++)
				engine.rewardTargets.delete(`cell:${Math.floor(i / 5)}:${i % 5}`);
			dead = true;
			remove();
			clusterArt?.destroy();
			for (const gradient of gradients.values()) gradient.destroy();
			mobileGold.destroy();
		},
	};
}
