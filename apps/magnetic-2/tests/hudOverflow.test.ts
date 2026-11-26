import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('HUD viewport containment', () => {
	it('clips the game shell without creating a scroll container', () => {
		const source = readFileSync(new URL('../src/components/Game.svelte', import.meta.url), 'utf8');
		const shell = source.match(/\.magnetic-shell\s*\{([^}]+)\}/)?.[1] ?? '';
		const overflow = [...shell.matchAll(/\boverflow\s*:\s*([^;]+);/g)].map((match) => match[1].trim());

		// Hidden allows focus restoration to scroll the shell after closing a modal
		// and rotating: the canvas/HUD previously moved 46px above the viewport.
		expect(overflow.at(-1)).toBe('clip');
	});
});
