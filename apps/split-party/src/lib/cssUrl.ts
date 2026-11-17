// A url() for a CSS custom property. A relative url() inside a variable resolves against the
// stylesheet that reads var(), which in a build is assets/index-*.css, so `./splash/x.webp`
// became assets/splash/x.webp and 404'd on Stake (review 2026-11-06). Resolve against the page.
export const cssUrl = (path: string) => `url("${new URL(path, document.baseURI).href}")`;
