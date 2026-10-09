<script lang="ts">
	// The chef's body art drawn as a deformable mesh (a grid over the texture) bent each frame by the
	// game/bodyFlex field, so his torso breathes and gives instead of moving as one rigid cut-out.
	import { PIXI, getContextApp, getContextParent, type Texture } from 'pixi-svelte';
	import { flexAt, type BodyFlex, type FlexState } from '../game/bodyFlex';

	type Props = {
		key: string;
		/** the figure box (px) and the body crop inside it (figure fractions) */
		left: number;
		top: number;
		width: number;
		height: number;
		rect: { nx: number; ny: number; nw: number; nh: number };
		flex: BodyFlex;
		state: FlexState;
		zIndex?: number;
	};
	const props: Props = $props();

	const COLS = 14;
	const ROWS = 18;
	const app = getContextApp();
	const parent = getContextParent();
	const texture = $derived((app.stateApp.loadedAssets?.[props.key] as Texture | undefined) ?? PIXI.Texture.EMPTY);
	const mesh = new PIXI.MeshPlane({ texture: PIXI.Texture.EMPTY, verticesX: COLS, verticesY: ROWS });
	mesh.autoResize = false;
	parent.addToParent(mesh);

	$effect(() => {
		mesh.texture = texture;
	});
	$effect(() => {
		mesh.zIndex = props.zIndex ?? 0;
	});
	// The grid lives in the figure's px space (the mesh sits at 0,0): each vertex is its rest
	// position inside the body crop plus the field's displacement there.
	$effect(() => {
		const { left, top, width: W, height: H, rect, flex, state } = props;
		const pos = mesh.geometry.positions;
		for (let j = 0; j < ROWS; j++) {
			const ny = rect.ny + (rect.nh * j) / (ROWS - 1);
			for (let i = 0; i < COLS; i++) {
				const nx = rect.nx + (rect.nw * i) / (COLS - 1);
				const d = flexAt(flex, state, nx, ny, W, H);
				const k = (j * COLS + i) * 2;
				pos[k] = left + nx * W + d.dx;
				pos[k + 1] = top + ny * H + d.dy;
			}
		}
		mesh.geometry.getBuffer('aPosition').update();
	});
</script>
