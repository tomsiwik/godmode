import { createFileRoute } from '@tanstack/react-router';
import { LandingHeader } from '@/components/layout/landing-header';
import { InstallCommand } from '@/components/install-command';
import { PixelShimmer } from '@/components/pixel-shimmer';
import { SITE_URL } from '@/lib/site';

const TITLE = 'Godmode — the swiss army knife for coding agents';
const DESCRIPTION = 'One predictable CLI for every API, MCP server, and local command you install.';
const OG_IMAGE = `${SITE_URL}/og/landing.webp`;

export const Route = createFileRoute('/')({
  component: Home,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:type', content: 'website' },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:image:secure_url', content: OG_IMAGE },
      { property: 'og:image:type', content: 'image/webp' },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:image:alt', content: TITLE },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE },
      { name: 'twitter:image:alt', content: TITLE },
    ],
  }),
});

function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-fd-background text-fd-foreground">
      <LandingHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <PixelShimmer className="mx-auto w-full max-w-lg">
          <img src="/godmode-pixels.svg" alt="godmode" className="w-full dark:invert" />
        </PixelShimmer>
        <p className="max-w-xl text-balance text-lg text-fd-muted-foreground">
          The swiss army knife for coding agents, with extensions.
        </p>
        <InstallCommand className="max-w-lg" />
      </main>
    </div>
  );
}
