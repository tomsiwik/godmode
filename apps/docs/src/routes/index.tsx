import { createFileRoute } from '@tanstack/react-router';
import { LandingHeader } from '@/components/layout/landing-header';
import { InstallCommand } from '@/components/install-command';
import { SITE_URL } from '@/lib/source';

const TITLE = 'Godmode — the swiss army knife for coding agents';
const DESCRIPTION = 'One predictable CLI for every API, MCP server, and local command you install.';
const OG_IMAGE = `${SITE_URL}/og/docs/image.webp`;

export const Route = createFileRoute('/')({
  component: Home,
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:image', content: OG_IMAGE },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: OG_IMAGE },
    ],
  }),
});

function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-fd-background text-fd-foreground">
      <LandingHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <img src="/godmode-pixels.svg" alt="godmode" className="mx-auto w-full max-w-lg dark:invert" />
        <p className="max-w-xl text-balance text-lg text-fd-muted-foreground">
          The swiss army knife for coding agents, with extensions.
        </p>
        <InstallCommand className="max-w-lg" />
      </main>
    </div>
  );
}
