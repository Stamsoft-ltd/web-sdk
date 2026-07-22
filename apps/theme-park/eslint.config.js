import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const requireFromCustom = createRequire(require.resolve('eslint-config-custom'));
const svelte = (await import(pathToFileURL(requireFromCustom.resolve('eslint-plugin-svelte')))).default;
const tsParser = (await import(pathToFileURL(requireFromCustom.resolve('@typescript-eslint/parser')))).default;
const tsPlugin = (await import(pathToFileURL(requireFromCustom.resolve('@typescript-eslint/eslint-plugin')))).default;

const typescript = {
	plugins: { '@typescript-eslint': tsPlugin },
	languageOptions: {
		parser: tsParser,
		parserOptions: { sourceType: 'module', ecmaVersion: 2022 },
	},
	rules: tsPlugin.configs.recommended.rules,
};

export default [
	{ ignores: ['build/**', '.svelte-kit/**', 'node_modules/**'] },
	{ ...typescript, files: ['**/*.ts'], ignores: ['**/*.svelte.ts'] },
	...svelte.configs['flat/recommended'],
	{ ...typescript, files: ['**/*.svelte.ts'] },
	{
		files: ['**/*.svelte'],
		plugins: typescript.plugins,
		languageOptions: {
			parserOptions: { parser: tsParser, sourceType: 'module', ecmaVersion: 2022 },
		},
		rules: typescript.rules,
	},
	{ files: ['src/stories/**'], rules: { '@typescript-eslint/no-explicit-any': 'off' } },
];
