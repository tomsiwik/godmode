'use client';
import { useI18n } from 'fumadocs-ui/contexts/i18n';
import { cn } from '../../lib/cn';
import { type ComponentProps, useEffect, useRef, useState } from 'react';
import { mergeRefs } from '../../lib/merge-refs';
import { TocThumb, useTOCItems } from './index';
import * as Primitive from 'fumadocs-core/toc';

export function TOCItems({ ref, className, ...props }: ComponentProps<'div'>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const items = useTOCItems();
  const { text } = useI18n();
  const primaryAnchor = Primitive.useActiveAnchor();
  const [clickedAnchor, setClickedAnchor] = useState<string | null>(null);
  const clickTimeRef = useRef(0);
  const prevPrimaryRef = useRef(primaryAnchor);

  const handleSelect = (anchor: string) => {
    clickTimeRef.current = Date.now();
    setClickedAnchor(anchor);
  };

  useEffect(() => {
    if (primaryAnchor !== prevPrimaryRef.current) {
      prevPrimaryRef.current = primaryAnchor;
      const timeSinceClick = Date.now() - clickTimeRef.current;
      if (timeSinceClick > 500) {
        setClickedAnchor(null);
      }
    }
  }, [primaryAnchor]);

  const effectivePrimary = clickedAnchor ?? primaryAnchor;

  if (items.length === 0)
    return (
      <div className="rounded-lg border bg-fd-card p-3 text-xs text-fd-muted-foreground">
        {text.tocNoHeadings}
      </div>
    );

  return (
    <>
      <div className="absolute inset-y-0 start-0 w-px bg-fd-border" />
      <TocThumb
        containerRef={containerRef}
        className="absolute top-(--fd-top) h-(--fd-height) w-0.5 bg-gradient-to-b from-primary-muted to-transparent transition-[top,height] ease-linear"
      />
      <TocThumb
        containerRef={containerRef}
        active={effectivePrimary ? [effectivePrimary] : []}
        className="absolute top-(--fd-top) h-(--fd-height) w-0.5 bg-fd-primary transition-[top,height] ease-linear"
      />
      <div
        ref={mergeRefs(ref, containerRef)}
        className={cn('flex flex-col', className)}
        {...props}
      >
        {items.map((item) => (
          <TOCItem key={item.url} item={item} primaryAnchor={effectivePrimary} onSelect={handleSelect} />
        ))}
      </div>
    </>
  );
}

function TOCItem({
  item,
  primaryAnchor,
  onSelect,
}: {
  item: Primitive.TOCItemType;
  primaryAnchor: string | undefined;
  onSelect: (anchor: string) => void;
}) {
  const anchor = item.url.replace('#', '');
  const isPrimary = anchor === primaryAnchor;

  return (
    <Primitive.TOCItem
      href={item.url}
      onClick={() => onSelect(anchor)}
      className={cn(
        'prose py-1.5 max-xl:py-2.5 text-sm text-fd-muted-foreground transition-colors wrap-anywhere first:pt-0 last:pb-0',
        isPrimary
          ? 'text-fd-primary'
          : 'data-[active=true]:text-fd-foreground/60',
        item.depth <= 2 && 'ps-3',
        item.depth === 3 && 'ps-6',
        item.depth >= 4 && 'ps-8',
      )}
    >
      {item.title}
    </Primitive.TOCItem>
  );
}
