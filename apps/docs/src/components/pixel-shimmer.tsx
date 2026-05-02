'use client';
import { useEffect, type ReactNode } from 'react';
import { cn } from '../lib/cn';

// Brand-violet palette tied to the docs `--color-fd-primary` (oklch 0.55..0.72 / 0.28..0.32 / 295).
// Three stops give the shimmer perceived depth: pale highlight → mid → brand.
const VIOLET_PALETTE = [
  'oklch(0.85 0.15 295)', // pale lavender
  'oklch(0.7 0.25 295)',  // mid violet
  'oklch(0.55 0.32 295)', // brand violet (deepest)
].join(',');

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'pixel-canvas': React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          'data-colors'?: string;
          'data-gap'?: string | number;
          'data-speed'?: string | number;
          'data-no-focus'?: boolean | '';
        },
        HTMLElement
      >;
    }
  }
}

/**
 * Wrap any element in a hover-triggered pixel shimmer canvas.
 *
 * Children render normally; on mouseenter/focusin the canvas behind them
 * lights up with a grid of pixels that bloom outward from the center.
 *
 * Layout: this container is `relative`; the canvas absolutely fills it.
 * The children stay above the canvas via `relative z-10` so the SVG stays
 * sharp and the shimmer reads as a backdrop.
 */
export function PixelShimmer({
  children,
  className,
  colors = VIOLET_PALETTE,
  gap = 6,
  speed = 30,
}: {
  children: ReactNode;
  className?: string;
  /** Comma-separated CSS colors. Defaults to the brand violet palette. */
  colors?: string;
  /** Pixel grid spacing in px. 4–50. */
  gap?: number;
  /** Shimmer speed. 0–100. */
  speed?: number;
}) {
  // Register the custom element only on the client. Idempotent — re-imports
  // during HMR don't redefine.
  useEffect(() => {
    void import('./pixel-canvas');
  }, []);

  return (
    <div className={cn('relative isolate', className)}>
      <pixel-canvas
        data-colors={colors}
        data-gap={String(gap)}
        data-speed={String(speed)}
        // Canvas fills the parent and sits *behind* the children.
        // pointer-events:none keeps the SVG/text fully interactive.
        style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}
      />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
