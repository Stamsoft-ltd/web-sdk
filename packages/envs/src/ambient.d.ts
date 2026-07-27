// SvelteKit's `$env/static/public` module is ambient only inside an app's generated
// .svelte-kit types — this package is checked standalone (e.g. via an app's svelte-check
// following the import), so declare the shape of the variables it reads here.
declare module '$env/static/public' {
	export const PUBLIC_SITE_MODE: string | undefined;
	export const PUBLIC_SENTRY_DSN: string | undefined;
	export const PUBLIC_CHROMATIC: string | undefined;
}
