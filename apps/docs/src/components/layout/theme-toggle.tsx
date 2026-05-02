'use client';
import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme } from 'next-themes';
import { type ComponentProps, useEffect, useState } from 'react';
import { buttonVariants } from '@godmode-cli/ui';
import { cn } from '../../lib/cn';

/**
 * Single-icon theme toggle that visually pairs with the GitHub icon link.
 *
 * Click cycles: light → dark → system → light.
 *
 * - Explicit light → Sun
 * - Explicit dark  → Moon
 * - System         → Monitor with the resolved theme (Sun/Moon) shown at
 *   half size centered inside it — the monitor "displays" the current OS
 *   theme, signalling "OS controls this".
 */
export function ThemeToggle({ className, ...props }: ComponentProps<'button'>) {
  const { setTheme, theme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const isSystem = mounted && theme === 'system';
  const effective = mounted ? resolvedTheme : 'light';
  const Resolved = effective === 'dark' ? Moon : Sun;

  const next = theme === 'light' ? 'dark' : theme === 'dark' ? 'system' : 'light';

  // Title: full plain-language explanation on hover/focus
  const currentLabel = !mounted
    ? 'system'
    : theme === 'system'
      ? `system (currently ${effective})`
      : (theme ?? 'system');
  const title = `Theme: ${currentLabel} — click to switch to ${next}`;

  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => setTheme(next)}
      className={cn(
        buttonVariants({ size: 'icon-sm', color: 'ghost' }),
        'relative text-fd-muted-foreground',
        className,
      )}
      {...props}
    >
      {isSystem ? (
        <span aria-hidden className="relative inline-flex items-center justify-center">
          <Monitor className="size-4" />
          <Resolved
            // Resolved theme nested inside the monitor frame at half size.
            // Slight upward nudge keeps it inside the screen, not the stand.
            // `!size-2` is needed to beat the parent button's
            // `[&_svg]:size-4` from buttonVariants.
            className="absolute !size-2 -translate-y-px"
            fill="currentColor"
          />
        </span>
      ) : (
        <Resolved className="size-4" />
      )}
    </button>
  );
}
