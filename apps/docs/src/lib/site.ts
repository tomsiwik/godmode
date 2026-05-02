// Browser-safe constants and pure helpers extracted from `./source.ts`.
// `lib/source.ts` transitively imports `fumadocs-mdx/runtime/server` (uses
// `node:path`); importing it from a universal route file leaks that chain
// into the client bundle and crashes hydration with `path.join is not a
// function`. This file holds only the pieces that are safe in a browser
// bundle so universal routes can import them without dragging the server
// runtime along.

// Canonical site URL for absolute meta tags (og:image, og:url, etc.).
// Prefer an explicit SITE_URL override, then Vercel's stable production URL,
// and finally a hardcoded fallback. VERCEL_URL is avoided because it returns
// the per-deployment preview URL (e.g. godmode-<hash>.vercel.app), which we
// don't want in og:image content served on the production domain.
//
// https://vercel.com/docs/environment-variables/system-environment-variables
export const SITE_URL =
  process.env.SITE_URL?.replace(/\/$/, '') ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? 'https://' + process.env.VERCEL_PROJECT_PRODUCTION_URL
    : 'https://godmode.so');

export function getPageImage(slugs: string[]) {
  const segments = [...slugs, 'image.webp'];
  const path = '/og/' + segments.join('/');
  return {
    segments,
    // Social crawlers need absolute URLs; relative paths are ignored.
    url: SITE_URL + path,
  };
}
