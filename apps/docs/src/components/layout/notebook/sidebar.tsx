'use client';
import * as Base from '../sidebar/base';
import { cn } from '../../../lib/cn';
import { type ComponentProps, createContext, type ReactNode, use, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { cva } from 'class-variance-authority';
import { LayoutContext } from './client';
import { createPageTreeRenderer } from '../sidebar/page-tree';
import { createLinkItemRenderer } from '../sidebar/link-item';
import { mergeRefs } from '../../../lib/merge-refs';
import Link, { type LinkProps } from 'fumadocs-core/link';
import { animate, motion } from 'motion/react';
import type * as PageTree from 'fumadocs-core/page-tree';

// Module-level — survives component remounts caused by tree deserialization
let lastActiveScrollTop: number | null = null;

function getScrollTop(el: HTMLElement): number | null {
  const viewport = el.closest('[data-radix-scroll-area-viewport]');
  if (!viewport) return null;
  return el.getBoundingClientRect().top - viewport.getBoundingClientRect().top + viewport.scrollTop;
}

const SidebarHoverContext = createContext<{
  hoveredItem: string | null;
  setHoveredItem: (v: string | null) => void;
} | null>(null);

function SidebarHoverProvider({ children }: { children: ReactNode }) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  return (
    <SidebarHoverContext value={useMemo(() => ({ hoveredItem, setHoveredItem }), [hoveredItem])}>
      {children}
    </SidebarHoverContext>
  );
}

const itemVariants = cva(
  'relative flex flex-row items-center gap-2 rounded-lg p-2 text-start text-fd-muted-foreground wrap-anywhere [&_svg]:size-3.5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        link: 'transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none data-[active=true]:bg-fd-primary/10 data-[active=true]:text-fd-primary data-[active=true]:hover:transition-colors',
        button:
          'transition-colors hover:bg-fd-accent/50 hover:text-fd-accent-foreground/80 hover:transition-none',
      },
      highlight: {
        true: "data-[active=true]:before:content-[''] data-[active=true]:before:bg-fd-primary data-[active=true]:before:absolute data-[active=true]:before:w-px data-[active=true]:before:inset-y-2.5 data-[active=true]:before:start-2.5",
      },
    },
  },
);

function getItemOffset(depth: number) {
  return `calc(${2 + 3 * depth} * var(--spacing))`;
}

export function Sidebar(props: ComponentProps<typeof Base.SidebarProvider>) {
  return <Base.SidebarProvider {...props} />;
}

export function SidebarFolder(props: ComponentProps<typeof Base.SidebarFolder>) {
  return <Base.SidebarFolder {...props} />;
}

export function SidebarCollapseTrigger(props: ComponentProps<typeof Base.SidebarCollapseTrigger>) {
  return <Base.SidebarCollapseTrigger {...props} />;
}

export function SidebarViewport(props: ComponentProps<typeof Base.SidebarViewport>) {
  return (
    <SidebarHoverProvider>
      <Base.SidebarViewport {...props} />
    </SidebarHoverProvider>
  );
}

export function SidebarTrigger(props: ComponentProps<typeof Base.SidebarTrigger>) {
  return <Base.SidebarTrigger {...props} />;
}

export function SidebarContent({
  ref: refProp,
  className,
  children,
  ...props
}: ComponentProps<'aside'>) {
  const { navMode } = use(LayoutContext)!;
  const ref = useRef<HTMLElement>(null);

  return (
    <Base.SidebarContent>
      {({ collapsed, hovered, ref: asideRef, ...rest }) => (
        <div
          data-sidebar-placeholder=""
          className={cn(
            'sticky z-20 [grid-area:sidebar] pointer-events-none *:pointer-events-auto md:layout:[--fd-sidebar-width:268px] max-md:hidden',
            navMode === 'auto'
              ? 'top-(--fd-docs-row-1) h-[calc(var(--fd-docs-height)-var(--fd-docs-row-1))]'
              : 'top-(--fd-docs-row-2) h-[calc(var(--fd-docs-height)-var(--fd-docs-row-2))]',
          )}
        >
          {collapsed && <div className="absolute start-0 inset-y-0 w-4" {...rest} />}
          <aside
            id="nd-sidebar"
            ref={mergeRefs(ref, refProp, asideRef)}
            data-collapsed={collapsed}
            data-hovered={collapsed && hovered}
            className={cn(
              'absolute flex flex-col w-full start-0 inset-y-0 items-end text-sm duration-250 *:w-(--fd-sidebar-width)',
              navMode === 'auto' && 'bg-fd-card',
              collapsed && [
                'inset-y-2 rounded-xl bg-fd-card transition-transform w-(--fd-sidebar-width)',
                hovered
                  ? 'shadow-lg translate-x-2 rtl:-translate-x-2'
                  : '-translate-x-(--fd-sidebar-width) rtl:translate-x-full',
              ],
              ref.current &&
                (ref.current.getAttribute('data-collapsed') === 'true') !== collapsed &&
                'transition-[width,inset-block,translate,background-color]',
              className,
            )}
            {...props}
            {...rest}
          >
            {children}
          </aside>
        </div>
      )}
    </Base.SidebarContent>
  );
}

export function SidebarDrawer({
  children,
  className,
  ...props
}: ComponentProps<typeof Base.SidebarDrawerContent>) {
  return (
    <>
      <Base.SidebarDrawerOverlay className="fixed z-40 inset-0 backdrop-blur-xs data-[state=open]:animate-fd-fade-in data-[state=closed]:animate-fd-fade-out" />
      <Base.SidebarDrawerContent
        className={cn(
          'fixed text-[0.9375rem] flex flex-col shadow-lg border-s end-0 inset-y-0 w-[85%] max-w-[380px] z-40 bg-fd-background data-[state=open]:animate-fd-sidebar-in data-[state=closed]:animate-fd-sidebar-out',
          className,
        )}
        {...props}
      >
        {children}
      </Base.SidebarDrawerContent>
    </>
  );
}

export function SidebarSeparator({ className, style, children, ...props }: ComponentProps<'p'>) {
  const depth = Base.useFolderDepth();

  return (
    <Base.SidebarSeparator
      className={cn('[&_svg]:size-4 [&_svg]:shrink-0', className)}
      style={{
        paddingInlineStart: getItemOffset(depth),
        ...style,
      }}
      {...props}
    >
      {children}
    </Base.SidebarSeparator>
  );
}

export function SidebarItem({
  className,
  style,
  children,
  icon,
  active = false,
  inSection = true,
  ...linkProps
}: LinkProps & {
  active?: boolean;
  icon?: ReactNode;
  inSection?: boolean;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const { prefetch } = Base.useSidebar();
  const hoverCtx = use(SidebarHoverContext);
  const isHovered = hoverCtx?.hoveredItem === linkProps.href;
  Base.useAutoScroll(active, ref);

  useLayoutEffect(() => {
    if (!active || !ref.current) return;
    const el = ref.current;
    const scrollTop = getScrollTop(el);
    if (scrollTop === null) return;

    if (lastActiveScrollTop !== null && indicatorRef.current) {
      const offset = lastActiveScrollTop - scrollTop;
      if (Math.abs(offset) >= 5) {
        animate(indicatorRef.current, { y: [offset, 0] }, { type: 'spring', stiffness: 700, damping: 40 });
      }
    }
    lastActiveScrollTop = scrollTop;

    return () => {
      lastActiveScrollTop = getScrollTop(el) ?? lastActiveScrollTop;
    };
  }, [active]);

  return (
    <Link
      {...linkProps}
      ref={ref}
      data-active={active}
      prefetch={prefetch}
      className={cn(
        'relative flex flex-row items-center gap-2 ml-2 py-2 text-start [&_svg]:size-3.5 [&_svg]:shrink-0',
        icon ? 'pl-6' : 'pl-4',
        className,
      )}
      style={style}
      onMouseEnter={() => hoverCtx?.setHoveredItem(linkProps.href ?? null)}
      onMouseLeave={() => hoverCtx?.setHoveredItem(null)}
    >
      <span className={cn('h-full w-px absolute left-[9px] inset-y-0', inSection ? 'bg-fd-border' : 'bg-transparent')} />

      {active && (
        <span
          ref={indicatorRef}
          className="pointer-events-none absolute z-[11] left-[8px] top-1/2 h-[56%] w-[2px] -translate-y-1/2 bg-fd-primary"
        />
      )}

      {active && !hoverCtx?.hoveredItem && (
        <motion.span
          layoutId="sidebar-hover"
          initial={false}
          className="pointer-events-none absolute z-10 left-[8px] top-1/2 h-[56%] w-[2px] -translate-y-1/2"
          transition={{ type: 'spring', stiffness: 700, damping: 40 }}
        />
      )}

      {isHovered && (
        <motion.span
          layoutId="sidebar-hover"
          initial={false}
          className="pointer-events-none absolute z-10 left-[8px] top-1/2 h-[56%] w-[2px] -translate-y-1/2 bg-fd-foreground/25"
          transition={{ type: 'spring', stiffness: 700, damping: 40 }}
        />
      )}

      {icon}
      <span
        className={cn(
          'text-sm w-full',
          icon ? '' : 'pl-3',
          active || isHovered
            ? 'text-fd-foreground'
            : 'text-fd-muted-foreground',
        )}
      >
        {children}
      </span>
    </Link>
  );
}

export function SidebarFolderTrigger({
  className,
  style,
  ...props
}: ComponentProps<typeof Base.SidebarFolderTrigger>) {
  const { depth, collapsible } = Base.useFolder()!;

  return (
    <Base.SidebarFolderTrigger
      className={cn(itemVariants({ variant: collapsible ? 'button' : null }), 'w-full', className)}
      style={{
        paddingInlineStart: getItemOffset(depth - 1),
        ...style,
      }}
      {...props}
    >
      {props.children}
    </Base.SidebarFolderTrigger>
  );
}

export function SidebarFolderLink({
  className,
  style,
  ...props
}: ComponentProps<typeof Base.SidebarFolderLink>) {
  const depth = Base.useFolderDepth();

  return (
    <Base.SidebarFolderLink
      className={cn(itemVariants({ variant: 'link', highlight: depth > 1 }), 'w-full', className)}
      style={{
        paddingInlineStart: getItemOffset(depth - 1),
        ...style,
      }}
      {...props}
    >
      {props.children}
    </Base.SidebarFolderLink>
  );
}

export function SidebarFolderContent({
  className,
  children,
  ...props
}: ComponentProps<typeof Base.SidebarFolderContent>) {
  const depth = Base.useFolderDepth();

  return (
    <Base.SidebarFolderContent
      className={cn(
        'relative',
        depth === 1 &&
          "before:content-[''] before:absolute before:w-px before:inset-y-1 before:bg-fd-border before:start-2.5",
        className,
      )}
      {...props}
    >
      {children}
    </Base.SidebarFolderContent>
  );
}
export const SidebarPageTree = createPageTreeRenderer({
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
  SidebarSeparator,
});

export const SidebarLinkItem = createLinkItemRenderer({
  SidebarFolder,
  SidebarFolderContent,
  SidebarFolderLink,
  SidebarFolderTrigger,
  SidebarItem,
});

export function AnimatedSeparator({ item }: { item: PageTree.Separator }) {
  return (
    <SidebarSeparator className="mb-4">
      {item.icon && (
        <span className="relative size-5 [&_svg]:!size-3 flex items-center justify-center bg-fd-border text-fd-muted-foreground rounded-[5px]">
          {item.icon}
          <span className="absolute left-1/2 translate-x-[calc(-50%-0.5px)] bg-fd-border w-px h-6 top-full" />
        </span>
      )}
      <span className="text-[11px] font-semibold text-fd-muted-foreground/60 uppercase">{item.name}</span>
    </SidebarSeparator>
  );
}
