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

export const SITE_URL =
  process.env.SITE_URL?.replace(/\/$/, '') ??
  (process.env.VERCEL_URL ? 'https://' + process.env.VERCEL_URL : 'https://godmode.so');

export function getPageImage(slugs: string[]) {
  const segments = [...slugs, 'image.webp'];
  const path = '/og/' + segments.join('/');
  return {
    segments,
    // Social crawlers need absolute URLs; relative paths are ignored.
    url: SITE_URL + path,
  };
}
