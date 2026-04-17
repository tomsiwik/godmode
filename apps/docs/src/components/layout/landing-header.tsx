import { Button, buttonVariants } from '@godmode-cli/ui';
import { Github } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { cn } from '../../lib/cn';
import { gitConfig } from '@/lib/layout.shared';

const githubUrl = `https://github.com/${gitConfig.user}/${gitConfig.repo}`;

export function LandingHeader() {
  return (
    <header className="sticky top-0 z-40 backdrop-blur-sm bg-fd-background/80 border-b border-fd-border/50">
      <div className="mx-auto max-w-(--fd-layout-width) flex items-center px-4 md:px-6 h-18">
        <a href="/" aria-label="home" className="flex items-center">
          <img src="/godmode-nav.svg" alt="godmode" className="h-7 dark:invert" />
        </a>
        <div className="flex flex-1 items-center justify-end gap-2">
          <a
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className={cn(
              buttonVariants({ size: 'icon-sm', color: 'ghost' }),
              'text-fd-muted-foreground',
            )}>
            <Github className="size-4" />
          </a>
          <ThemeToggle mode="light-dark-system" />
          <Button asChild size="sm">
            <a href="/usage">
              <span>Documentation</span>
            </a>
          </Button>
        </div>
      </div>
    </header>
  );
}
