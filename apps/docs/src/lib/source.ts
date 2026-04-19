import { type InferPageType, loader } from 'fumadocs-core/source';
import { lucideIconsPlugin } from 'fumadocs-core/source/lucide-icons';
import { docs } from 'collections/server';

export const source = loader({
  source: docs.toFumadocsSource(),
  baseUrl: '/',
  plugins: [lucideIconsPlugin()],
});

export async function getLLMText(page: InferPageType<typeof source>) {
  const processed = await page.data.getText('processed');

  return `# ${page.data.title}

${processed}`;
}

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
