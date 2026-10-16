import {
	landingIntroFrame,
	landingExitFrame,
	interpolateBox,
	LANDING_EXIT_MS,
} from './entryMotion';
/** Scene-only GPU adapters. DOM hosts own semantics/input, never visible artwork. */
import { Container, Graphics, Sprite, Text, Texture, Rectangle } from 'pixi.js';
import type { GpuEngine } from './gpuRenderer';
import { loadAssetImage } from './imageAssets';
import { ART_ROOT, UI_ART_ROOT, SYMBOL_ART, PORTRAIT_ART_ROOT } from './art';
import { fitWelcome, WELCOME_CARDS } from './welcome';

import { fitSceneImage, type SceneBox } from './sceneLayout';

function fitSprite(sprite: Sprite, box: SceneBox, cover = false) {
	const target = fitSceneImage(sprite.texture.width, sprite.texture.height, box, cover);
	sprite.position.set(target.x, target.y);
	sprite.width = target.width;
	sprite.height = target.height;
}
async function image(engine: GpuEngine, src: string, crop?: Rectangle) {
	const base = engine.texture(await loadAssetImage(src));
	return new Sprite(crop ? new Texture({ source: base.source, frame: crop }) : base);
}
function text(value: string, size: number, color = 0xffffff, body = false) {
	const node = new Text({
		text: value,
		style: {
			fontFamily: body ? 'GatesBody, sans-serif' : 'GatesCartoon, sans-serif',
			fontSize: size,
			fontWeight: body ? '900' : 'normal',
			fill: color,
			align: 'center',
			stroke: body ? undefined : { color: 0x071b3e, width: 2, join: 'round' },
			wordWrap: true,
			wordWrapWidth: 320,
			breakWords: true,
			padding: 4,
		},
	});
	node.anchor.set(0.5);
	return node;
}
function labelFit(node: Text, value: string, size: number, width: number) {
	node.text = value;
	node.style.fontSize = size;
	node.style.wordWrapWidth = width;
	node.scale.set(1);
	node.scale.set(Math.min(1, width / Math.max(1, node.width)));
}

/** Background + game logo remain resident below the board, even during GPU overlays. */
export function createMainScene(
	engine: GpuEngine,
	host: HTMLElement,
	logoHost: HTMLElement,
	studioHost: HTMLElement,
	error: (error: unknown) => void,
) {
	const root = new Container(),
		backdrop = new Container(),
		logo = new Container(),
		studio = new Container();
	root.addChild(backdrop, logo, studio);
	let dead = false,
		current = '',
		request = 0;
	let logoTexture: Texture | undefined;
	const layout = () => {
		const origin = engine.origin,
			bounds = host.getBoundingClientRect(),
			brand = logoHost.getBoundingClientRect();
		const bg = backdrop.children[0] as Sprite | undefined;
		if (bg)
			fitSprite(
				bg,
				{
					x: bounds.left - origin.left,
					y: bounds.top - origin.top,
					width: bounds.width,
					height: bounds.height,
				},
				true,
			);
		const studioBox = studioHost.getBoundingClientRect();
		const wordmark = studio.children[0] as Sprite | undefined;
		const mark = studio.children[1] as Sprite | undefined;
		if (wordmark && mark) {
			const x = studioBox.left - origin.left,
				y = studioBox.top - origin.top;
			fitSprite(mark, { x, y, width: studioBox.width * 0.18, height: studioBox.height });
			fitSprite(wordmark, {
				x: x + studioBox.width * 0.2,
				y,
				width: studioBox.width * 0.8,
				height: studioBox.height,
			});
		}
		const badge = logo.children[0] as Sprite | undefined;
		if (badge)
			fitSprite(badge, {
				x: brand.left - origin.left,
				y: brand.top - origin.top,
				width: brand.width,
				height: brand.height,
			});
	};
	const stop = engine.register({
		root,
		priority: -10,
		underlay: true,
		layout,
		draw: (_dt, now) => {
			const entering =
				!!engine.entry &&
				now - engine.entry.startedAt < (engine.entry.reduced ? 140 : LANDING_EXIT_MS);
			logo.visible = !entering;
			return entering;
		},
	});
	void image(engine, `${ART_ROOT}logo/logo.png`, new Rectangle(11, 81, 767, 418))
		.then((badge) => {
			if (dead) {
				badge.destroy({ texture: true });
				return;
			}
			logoTexture = badge.texture;
			logo.addChild(badge);
			engine.layout();
		})
		.catch(error);
	void Promise.all([
		image(engine, `${UI_ART_ROOT}11cd1.svg`),
		image(engine, `${UI_ART_ROOT}ee395.svg`),
	])
		.then((nodes) => {
			if (dead) {
				for (const node of nodes) node.destroy();
				return;
			}
			studio.addChild(...nodes);
			engine.layout();
		})
		.catch(error);
	return {
		update(src: string) {
			if (src === current) {
				engine.layout();
				return;
			}
			current = src;
			const id = ++request;
			void image(engine, src)
				.then((sprite) => {
					if (dead || request !== id) {
						sprite.destroy();
						return;
					}
					for (const child of backdrop.removeChildren()) child.destroy();
					backdrop.addChild(sprite);
					engine.layout();
				})
				.catch(error);
		},
		resize: () => engine.layout(),
		destroy() {
			dead = true;
			stop();
			logoTexture?.destroy();
		},
	};
}

type EntryState = {
	active?: boolean;
	leavingAt?: number;
	logoTarget?: HTMLElement;
	width: number;
	height: number;
	slide: number;
	reduced: boolean;
	demo: boolean;
	translate: (key: string) => string;
};
export function createWelcomeScene(
	engine: GpuEngine,
	host: HTMLElement,
	error: (error: unknown) => void,
	ready: () => void = () => {},
) {
	const root = new Container(),
		content = new Container(),
		background = new Container(),
		cards = new Container();
	const pagination = new Graphics();
	const logoLayer = new Container(),
		decorations = new Container();
	const continueText = text('', 24),
		demoText = text('', 10, 0xffffff, true);
	root.addChild(background, content);
	content.addChild(cards, decorations, logoLayer, pagination, continueText, demoText);
	const cardNodes = WELCOME_CARDS.map(() => {
		const group = new Container(),
			title = text('', 40, 0xffd500),
			copy = text('', 19, 0xffffff, true);
		group.addChild(title, copy);
		cards.addChild(group);
		return { group, title, copy, baseX: 0, baseY: 0, frame: undefined as Sprite | undefined };
	});
	let state: EntryState | undefined,
		dead = false;
	let introStartedAt = 0,
		introInstalled = false;
	content.visible = false;
	let logoBox: SceneBox = { x: 0, y: 0, width: 1, height: 1 };
	const backgrounds = new Map<string, Sprite>();
	let logo: Sprite | undefined, frameTexture: Texture | undefined, logoTexture: Texture | undefined;
	const ornaments: Sprite[] = [];
	const layout = () => {
		if (!state) return;
		const { width, height, translate, slide, demo } = state;
		const fit = fitWelcome(width, height),
			{ portrait, compact, scale } = fit;
		const origin = engine.origin;
		content.position.set(
			(width - fit.width * scale) / 2 - origin.left,
			(height - fit.height * scale) / 2 - origin.top,
		);
		content.scale.set(scale);
		const full = { x: -origin.left, y: -origin.top, width, height };
		for (const [kind, sprite] of backgrounds) {
			sprite.visible = kind === (portrait ? 'portrait' : 'wide');
			fitSprite(sprite, full, true);
		}
		if (logo) {
			const w = portrait ? 280 : compact ? 350 : 570;
			logoBox = {
				x: (fit.width - w) / 2,
				y: portrait ? 32 : compact ? 10 : 16,
				width: w,
				height: (w * 418) / 767,
			};
			fitSprite(logo, logoBox);
		}
		const cardX = portrait ? 18 : compact ? 80 : 40,
			cardY = portrait ? 200 : compact ? 167 : 280;
		const totalWidth = portrait ? 324 : compact ? 800 : 1120;
		const cardWidth = portrait ? totalWidth : totalWidth / 3,
			cardHeight = (cardWidth * 1215) / 1478;
		for (let i = 0; i < cardNodes.length; i++) {
			const card = cardNodes[i],
				info = WELCOME_CARDS[i];
			card.group.visible = !portrait || i === slide;
			card.baseX = cardX + (portrait ? 0 : i * cardWidth);
			card.baseY = cardY;
			card.group.position.set(card.baseX, card.baseY);
			if (card.frame) fitSprite(card.frame, { x: 0, y: 0, width: cardWidth, height: cardHeight });
			labelFit(
				card.title,
				translate(info.value),
				portrait ? 25 : compact ? 21 : 28,
				cardWidth * 0.75,
			);
			card.title.position.set(cardWidth / 2, cardHeight * 0.3);
			labelFit(
				card.copy,
				translate(info.text),
				portrait ? 17 : compact ? 14 : 18,
				cardWidth * 0.74,
			);
			card.copy.position.set(cardWidth / 2, cardHeight * 0.62);
		}
		decorations.visible = !portrait;
		const ornamentSize = compact ? 60 : 80,
			clusterWidth = compact ? 120 : 160;
		ornaments.forEach((sprite, i) => {
			const local = i % 3,
				right = i >= 3;
			const offsets = [
				[0.5, -0.1],
				[0, 0.475],
				[0.8125, 0.5625],
			][local];
			sprite.anchor.set(0.5);
			sprite.scale.set(ornamentSize / Math.max(sprite.texture.width, sprite.texture.height));
			sprite.position.set(
				(right ? fit.width - 12 - clusterWidth : 12) + offsets[0] * ornamentSize + ornamentSize / 2,
				(compact ? 330 : 510) + offsets[1] * ornamentSize + ornamentSize / 2,
			);
			sprite.rotation = ([8, -12, 13][local] * Math.PI) / 180;
		});
		const bw = portrait ? 270 : compact ? 260 : 300,
			bh = compact ? 54 : 48,
			by = portrait ? 518 : compact ? 397 : 609;
		labelFit(continueText, `${translate('PRESS TO CONTINUE')} →`, compact ? 23 : 24, bw - 24);
		continueText.position.set(fit.width / 2, by + bh / 2);
		demoText.visible = demo;
		demoText.text = translate('DEMO');
		demoText.position.set(fit.width / 2, portrait ? 590 : compact ? 468 : 671);
		pagination.clear();
		if (portrait) {
			const firstX = 140;
			for (let i = 0; i < 3; i++)
				pagination
					.circle(firstX + i * 40, 494, 4.5)
					.fill(i === slide ? 0xffd500 : 0xffffff)
					.stroke({ color: 0x071f35, width: 1 });
		}
	};
	const stop = engine.register({
		root,
		overlay: host,
		priority: 40,
		layout,
		draw: (_dt, now) => {
			if (!state || !logo) return false;
			if (!state.active || !introInstalled) {
				content.visible = false;
				return false;
			}
			content.visible = true;
			if (!introStartedAt) introStartedAt = now;
			const leaving = !!state.leavingAt,
				elapsed = now - (state.leavingAt || introStartedAt || now);
			const intro = landingIntroFrame(
				leaving ? Math.max(0, state.leavingAt! - introStartedAt) : elapsed,
				state.reduced,
			);
			const exit = landingExitFrame(leaving ? elapsed : 0, state.reduced);
			const distance =
				state.height / content.scale.y + fitWelcome(state.width, state.height).height;
			for (let i = 0; i < cardNodes.length; i++) {
				const card = cardNodes[i];
				const offset = state.reduced
					? 0
					: leaving
						? exit.cards[i] * distance
						: -intro.cards[i] * distance;
				card.group.position.set(card.baseX, card.baseY + offset);
				card.group.alpha = state.reduced ? (leaving ? exit.background : intro.alpha) : 1;
			}
			decorations.y = state.reduced
				? 0
				: leaving
					? exit.cards[1] * distance
					: -intro.cards[1] * distance;
			decorations.alpha = state.reduced ? (leaving ? exit.background : intro.alpha) : 1;
			pagination.alpha =
				continueText.alpha =
				demoText.alpha =
					leaving ? exit.caption : intro.caption;
			background.alpha = leaving ? exit.background : 1;
			let from = { ...logoBox, y: logoBox.y - (state.reduced ? 0 : intro.logo * distance) };
			if (leaving && state.logoTarget) {
				const rect = state.logoTarget.getBoundingClientRect(),
					origin = engine.origin;
				const target = fitSceneImage(767, 418, {
					x: (rect.left - origin.left - content.x) / content.scale.x,
					y: (rect.top - origin.top - content.y) / content.scale.y,
					width: rect.width / content.scale.x,
					height: rect.height / content.scale.y,
				});
				from = interpolateBox(from, target, exit.logo);
			}
			fitSprite(logo, from);
			logo.alpha = state.reduced ? (leaving ? exit.background : intro.alpha) : 1;
			return leaving ? !exit.done : !intro.done;
		},
	});
	const install = async () => {
		const [wide, portrait, badge, frame] = await Promise.all([
			image(engine, `${UI_ART_ROOT}28fc1.png`),
			image(engine, `${UI_ART_ROOT}backgrounds/cloud-castle-original.png`),
			image(engine, `${ART_ROOT}logo/logo.png`, new Rectangle(11, 81, 767, 418)),
			image(engine, `${UI_ART_ROOT}fcdb7.png`, new Rectangle(130, 178, 1478, 1215)),
		]);
		if (dead) {
			wide.destroy();
			portrait.destroy();
			badge.destroy({ texture: true });
			frame.destroy({ texture: true });
			return;
		}
		backgrounds.set('wide', wide);
		backgrounds.set('portrait', portrait);
		background.addChild(wide, portrait);
		logo = badge;
		logoTexture = badge.texture;
		logoLayer.addChild(badge);
		frameTexture = frame.texture;
		frame.destroy();
		for (const card of cardNodes) {
			card.frame = new Sprite(frameTexture);
			card.group.addChildAt(card.frame, 0);
		}
		engine.layout();
		const symbols = [
			'GUARDIAN_MASK',
			'RED_GEM',
			'GREEN_GEM',
			'SUN_MEDALLION',
			'CRYSTAL_ORB',
			'PURPLE_GEM',
		] as const;
		const nodes = await Promise.all(
			symbols.map((name) => image(engine, `${ART_ROOT}symbols/${SYMBOL_ART[name]}.png`)),
		);
		if (dead) {
			for (const node of nodes) node.destroy();
			return;
		}
		ornaments.push(...nodes);
		decorations.addChild(...nodes);
		introInstalled = true;
		engine.layout();
		ready();
	};
	void install().catch(error);
	return {
		update(next: EntryState) {
			state = next;
			engine.layout();
		},
		destroy() {
			dead = true;
			stop();
			frameTexture?.destroy();
			logoTexture?.destroy();
		},
	};
}

export function createLoadingScene(engine: GpuEngine, host: HTMLElement) {
	const root = new Container(),
		shade = new Graphics(),
		fallback = new Graphics(),
		brand = new Container();
	root.addChild(fallback, shade, brand);
	let dead = false,
		progress = 0,
		base: Sprite | undefined,
		portrait: Sprite | undefined,
		p: Sprite | undefined,
		frames: Texture[] = [],
		word: Sprite | undefined;
	const layout = () => {
		const { width, height } = engine.app.screen;
		fallback.clear().rect(0, 0, width, height).fill(0x0c2340);
		if (base && portrait) {
			base.visible = width >= height;
			portrait.visible = width < height;
			fitSprite(width < height ? portrait : base, { x: 0, y: 0, width, height }, true);
		}
		shade.clear().rect(0, 0, width, height).fill({ color: 0x000000, alpha: 0.62 });
		// McSchmutzo's ten native fill frames, selected by real asset progress.
		const size = Math.max(58, Math.min(108, width * 0.08)),
			gap = Math.max(10, Math.min(26, width * 0.018)),
			wordWidth = size * 2.65,
			w = size + gap + wordWidth;
		brand.position.set((width - w) / 2, (height - size) / 2);
		if (p && word) {
			p.texture = frames[Math.min(9, Math.round(progress * 9))];
			p.position.set(0, 0);
			p.width = size;
			p.height = size;
			word.width = wordWidth;
			word.height = (word.width * 49.117) / 237.479;
			word.position.set(size + gap, (size - word.height) / 2);
		}
	};
	const stop = engine.register({
		root,
		overlay: host,
		priority: 50,
		layout,
		draw: () => false,
	});
	void Promise.all([
		image(engine, `${UI_ART_ROOT}28fc1.png`),
		image(engine, `${PORTRAIT_ART_ROOT}base-background.png`),
		...Array.from({ length: 10 }, (_, i) =>
			image(engine, `./assets/the-gates/loading/p0${i}.webp`),
		),
		image(engine, './assets/the-gates/loading/press_play_wordmark.webp'),
	])
		.then(([wide, tall, ...marks]) => {
			const wordmark = marks.pop()!;
			const mark = marks[0];
			if (dead) {
				for (const node of [wide, tall, ...marks, wordmark]) node.destroy();
				return;
			}
			base = wide;
			portrait = tall;
			frames = marks.map((node) => node.texture);
			for (const node of marks.slice(1)) node.destroy();
			p = mark;
			word = wordmark;
			root.addChildAt(wide, 1);
			root.addChildAt(tall, 2);
			brand.addChild(mark, wordmark);
			engine.layout();
		})
		.catch((error) => console.warn('Loading artwork unavailable', error));
	return {
		update(next: number) {
			progress = Math.max(0, Math.min(1, next));
			layout();
			engine.invalidate();
		},
		destroy() {
			dead = true;
			stop();
		},
	};
}
