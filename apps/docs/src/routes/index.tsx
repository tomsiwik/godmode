import { createFileRoute } from '@tanstack/react-router';
import { LandingHeader } from '@/components/layout/landing-header';
import { useState } from 'react';

const commands = [
  { label: 'npm', cmd: 'npm install -g godmode' },
  { label: 'yarn', cmd: 'yarn global add godmode' },
  { label: 'pnpm', cmd: 'pnpm install -g godmode' },
  { label: 'bun', cmd: 'bun install -g godmode' },
] as const;

export const Route = createFileRoute('/')({
  component: Home,
  head: () => ({
    meta: [{ title: 'Godmode — the swiss army knife for coding agents' }],
  }),
});

function Home() {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(commands[active].cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col min-h-screen bg-fd-background text-fd-foreground">
      <LandingHeader />
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
        <img src="/godmode-pixels.svg" alt="godmode" className="mx-auto w-full max-w-lg dark:invert" />
        <p className="max-w-xl text-balance text-lg text-fd-muted-foreground">
          The swiss army knife for coding agents, with extensions.
        </p>
        <div className="w-full max-w-lg rounded-lg border border-fd-border bg-fd-muted/40 overflow-hidden">
          <div className="flex border-b border-fd-border bg-fd-muted">
            {commands.map((c, i) => (
              <button
                key={c.label}
                onClick={() => setActive(i)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  i === active
                    ? 'text-fd-foreground bg-fd-background'
                    : 'text-fd-muted-foreground hover:text-fd-foreground'
                }`}>
                {c.label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between gap-2 px-4 py-3 font-mono text-sm">
            <code className="text-fd-foreground">{commands[active].cmd}</code>
            <button
              onClick={copy}
              className="shrink-0 text-fd-muted-foreground hover:text-fd-foreground transition-colors text-xs">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
