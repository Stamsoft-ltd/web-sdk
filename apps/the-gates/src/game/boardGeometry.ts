/** Pure renderer geometry. No DOM cells/reels or per-symbol layout reads. */
import { BOARD_WINDOW } from './figmaLayout.ts';
export function boardGeometry(width: number, height: number, mobile: boolean) {
	const field = mobile
		? { x: 7, y: 7, width: Math.max(1, width - 14), height: Math.max(1, height - 14) }
		: {
				x: width * BOARD_WINDOW.left,
				y: height * BOARD_WINDOW.top,
				width: width * BOARD_WINDOW.width,
				height: height * BOARD_WINDOW.height,
			};
	const border = mobile ? 3 : 0,
		gap = 2;
	const cellWidth = Math.max(1, (field.width - border * 2 - gap * 5) / 6);
	const cellHeight = Math.max(1, (field.height - border * 2 - gap * 4) / 5);
	return {
		field,
		border,
		cells: Array.from({ length: 30 }, (_, index) => ({
			x: field.x + border + Math.floor(index / 5) * (cellWidth + gap),
			y: field.y + border + (index % 5) * (cellHeight + gap),
			width: cellWidth,
			height: cellHeight,
			pitch: cellHeight + gap,
		})),
	};
}
