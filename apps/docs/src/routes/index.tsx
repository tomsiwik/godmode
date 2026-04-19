import { createFileRoute } from '@tanstack/react-router';
import { LandingHeader } from '@/components/layout/landing-header';
import { InstallCommand } from '@/components/install-command';

export const Route = createFileRoute('/')({
  component: Home,
  head: () => ({
    meta: [{ title: 'Godmode — the swiss army knife for coding agents' }],
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
