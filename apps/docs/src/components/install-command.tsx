import { useState } from 'react';

export interface InstallCommandProps {
  /** Command variants keyed by label. */
  commands?: ReadonlyArray<{ label: string; cmd: string }>;
  /** Optional className applied to the outer wrapper. */
  className?: string;
}

const DEFAULT_COMMANDS = [
  { label: 'npm', cmd: 'npm install -g godmode' },
  { label: 'yarn', cmd: 'yarn global add godmode' },
  { label: 'pnpm', cmd: 'pnpm install -g godmode' },
  { label: 'bun', cmd: 'bun install -g godmode' },
] as const;

/**
 * Tabbed install-command box with a copy-to-clipboard action.
 * Used both on the landing page and inside MDX pages.
 */
export function InstallCommand({
  commands = DEFAULT_COMMANDS,
  className = '',
}: InstallCommandProps) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(commands[active].cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className={`w-full rounded-lg border border-fd-border bg-fd-muted/40 overflow-hidden ${className}`}
    >
      <div className="flex border-b border-fd-border bg-fd-muted">
        {commands.map((c, i) => (
          <button
            key={c.label}
            type="button"
            onClick={() => setActive(i)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              i === active
                ? 'text-fd-foreground bg-fd-background'
                : 'text-fd-muted-foreground hover:text-fd-foreground'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 px-4 py-3 font-mono text-sm">
        <span className="text-fd-foreground">{commands[active].cmd}</span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 text-fd-muted-foreground hover:text-fd-foreground transition-colors text-xs"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
