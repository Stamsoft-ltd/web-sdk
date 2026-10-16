import { Container, Graphics, Text } from 'pixi.js';
import type { GpuEngine } from './gpuRenderer';
import type { SkeletonData } from '@esotericsoftware/spine-core';
import {
	deliveryTargets,
	rewardFlight,
	rewardFlightPoint,
	type RewardDelivery,
} from './rewardDelivery';
/** Retained reward labels + arrival rings on the existing canvas; no independent clock. */
export function createRewardFlight(
	engine: GpuEngine,
	parent: Container,
	arrive: (id: string, index: number) => void,
	wildData: SkeletonData,
) {
	const root = new Container(),
		rings = new Graphics();
	parent.addChild(root);
	root.addChild(rings);
	let id = '',
		labels: Container[] = [];
	const clear = () => {
		for (const label of labels) {
			root.removeChild(label);
			label.destroy({ children: true });
		}
		labels = [];
		rings.clear();
	};
	return {
		draw(
			delivery: RewardDelivery | null,
			text: string,
			now: number,
			scale: number,
			reduced: boolean,
		) {
			if (!delivery) {
				root.visible = false;
				return;
			}
			root.visible = true;
			if (id !== delivery.id) {
				clear();
				id = delivery.id;
				labels = deliveryTargets(delivery).map(() => {
					if (delivery.reward.kind === 'stickyWild') {
						const symbol = new Container(),
							pose = engine.pose(wildData);
						pose.begin();
						pose.actor.sample('idle', 0);
						pose.view.scale.set(0.48, -0.48);
						symbol.addChild(pose.view);
						root.addChild(symbol);
						return symbol;
					}
					const label = new Text({
						text,
						style: {
							fontFamily: 'GatesCartoon',
							fontSize: 64,
							fill: 0xfff6ae,
							stroke: { color: 0x331346, width: 6, join: 'round' },
							align: 'center',
						},
					});
					label.anchor.set(0.5);
					root.addChild(label);
					return label;
				});
			}
			rings.clear();
			const age = (now - delivery.startedAt) * (delivery.speedFactor ?? 1);
			deliveryTargets(delivery).forEach((key, index) => {
				const flight = rewardFlight(age, index, reduced),
					label = labels[index],
					target = engine.rewardTargets.get(key);
				label.visible = flight.started && !flight.arrived && !!target && !reduced;
				if (!target) return;
				const from = { x: engine.app.screen.width / 2, y: engine.app.screen.height / 2 },
					p = rewardFlightPoint(from, target, flight.progress);
				const bounds = label.getLocalBounds(),
					start = scale * Math.min(1, 185 / Math.max(1, bounds.width)),
					end = Math.min(
						(target.width * 0.85) / Math.max(1, bounds.width),
						(target.height * 0.8) / Math.max(1, bounds.height),
					);
				label.position.set(p.x, p.y);
				label.scale.set(start + (end - start) * flight.progress);
				label.rotation = reduced
					? 0
					: Math.sin(flight.progress * Math.PI) * 0.15 * (index % 2 ? -1 : 1);
				if (flight.arrived) {
					if (!delivery.arrived.includes(index)) arrive(delivery.id, index);
					if (flight.pulse < 1) {
						const pulse = flight.pulse,
							alpha = (1 - pulse) * 0.95,
							radius =
								Math.max(12, Math.min(target.width, target.height) * 0.65) * (1 + pulse * 0.8);
						rings
							.circle(target.x, target.y, radius)
							.stroke({ color: 0xffe24a, width: Math.max(2, radius * 0.06), alpha });
						if (!reduced)
							for (let ray = 0; ray < 6; ray++) {
								const angle = (ray * Math.PI) / 3,
									distance = radius * (1.15 + pulse * 0.4);
								rings
									.moveTo(
										target.x + Math.cos(angle) * distance,
										target.y + Math.sin(angle) * distance,
									)
									.lineTo(
										target.x + Math.cos(angle) * (distance + 8 * (1 - pulse)),
										target.y + Math.sin(angle) * (distance + 8 * (1 - pulse)),
									)
									.stroke({ color: 0xfff7bb, width: 2, alpha });
							}
					}
				}
			});
		},
		destroy() {
			clear();
			root.destroy({ children: true });
		},
	};
}
