/**
 * Sanity Studio runs Vite from this folder; PostCSS would otherwise walk up and
 * load the root Next.js Tailwind v4 config, which breaks here.
 */
export default {
	plugins: [],
};
