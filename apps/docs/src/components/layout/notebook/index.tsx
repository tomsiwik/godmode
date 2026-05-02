import { type ComponentProps, type FC, type HTMLAttributes, type ReactNode, useMemo } from 'react';
import { type BaseLayoutProps, renderTitleNav, useLinkItems } from '../shared';
import {
  AnimatedSeparator,
  Sidebar,
  SidebarCollapseTrigger,
  SidebarContent,
  SidebarDrawer,
  SidebarLinkItem,
  SidebarPageTree,
  SidebarTrigger,
  SidebarViewport,
} from './sidebar';
import { TreeContextProvider } from 'fumadocs-ui/contexts/tree';
import { cn } from '../../../lib/cn';
import { buttonVariants } from '@godmode-cli/ui';
import { Languages, Sidebar as SidebarIcon, X } from 'lucide-react';
import { LanguageToggle } from '../language-toggle';
import { ThemeToggle } from '../theme-toggle';
import type * as PageTree from 'fumadocs-core/page-tree';
import {
  LayoutBody,
  LayoutContextProvider,
  LayoutHeader,
  LayoutHeaderTabs,
  NavbarLinkItem,
} from './client';
import { LargeSearchToggle, SearchToggle } from '../search-toggle';
import { LinkItem, type LinkItemType } from '../link-item';
import type { SidebarPageTreeComponents } from '../sidebar/page-tree';
import { getSidebarTabs, type GetSidebarTabsOptions } from '../sidebar/tabs';
import { SidebarTabsDropdown, type SidebarTabWithProps } from '../sidebar/tabs/dropdown';

export interface DocsLayoutProps extends BaseLayoutProps {
  tree: PageTree.Root;
  tabMode?: 'sidebar' | 'navbar';

  nav?: BaseLayoutProps['nav'] & {
    mode?: 'top' | 'auto';
  };

  sidebar?: SidebarOptions;

  containerProps?: HTMLAttributes<HTMLDivElement>;
}

interface SidebarOptions
  extends
    ComponentProps<'aside'>,
    Pick<ComponentProps<typeof Sidebar>, 'defaultOpenLevel' | 'prefetch'> {
  components?: Partial<SidebarPageTreeComponents>;

  /**
   * Root Toggle options
   */
  tabs?: SidebarTabWithProps[] | GetSidebarTabsOptions | false;

  banner?: ReactNode | FC<ComponentProps<'div'>>;
  footer?: ReactNode | FC<ComponentProps<'div'>>;

  /**
   * Support collapsing the sidebar on desktop mode
   *
   * @defaultValue true
   */
  collapsible?: boolean;
}

export function DocsLayout(props: DocsLayoutProps) {
  const {
    tabMode = 'sidebar',
    nav = {},
    sidebar: { tabs: tabOptions, defaultOpenLevel, prefetch, ...sidebarProps } = {},
    i18n = false,
    themeSwitch = {},
    tree,
  } = props;

  const navMode = nav.mode ?? 'auto';
  const { menuItems, navItems } = useLinkItems(props);
  const tabs = useMemo(() => {
    if (Array.isArray(tabOptions)) {
      return tabOptions;
    }

    if (typeof tabOptions === 'object') {
      return getSidebarTabs(tree, tabOptions);
    }

    if (tabOptions !== false) {
      return getSidebarTabs(tree);
    }

    return [];
  }, [tabOptions, tree]);

  function sidebar() {
    const { banner, footer, components, collapsible = true, ...rest } = sidebarProps;

    const iconLinks = menuItems.filter((item) => item.type === 'icon');
    const Header =
      typeof banner === 'function'
        ? banner
        : ({ className, ...props }: ComponentProps<'div'>) => (
            <div className={cn('flex flex-col gap-3 p-4 pb-2 empty:hidden', className)} {...props}>
              {props.children}
              {banner}
            </div>
          );
    const Footer =
      typeof footer === 'function'
        ? footer
        : ({ className, ...props }: ComponentProps<'div'>) => (
            <div
              className={cn(
                'hidden flex-row text-fd-muted-foreground items-center border-t p-4 pt-2',
                iconLinks.length > 0 && 'max-lg:flex',
                className,
              )}
              {...props}
            >
              {props.children}
              {footer}
            </div>
          );
    const viewport = (
      <SidebarViewport>
        {menuItems
          .filter((item) => item.type !== 'icon')
          .map((item, i, arr) => (
            <SidebarLinkItem
              key={i}
              item={item}
              className={cn('lg:hidden', i === arr.length - 1 && 'mb-4')}
            />
          ))}

        <SidebarPageTree Separator={AnimatedSeparator} {...components} />
      </SidebarViewport>
    );

    return (
      <>
        <SidebarContent {...rest}>
          <Header>
            {navMode === 'auto' && (
              <div className="flex justify-between">
                {renderTitleNav(nav, {
                  className: 'inline-flex items-center gap-2.5 font-medium',
                })}
                {collapsible && (
                  <SidebarCollapseTrigger
                    className={cn(
                      buttonVariants({
                        color: 'ghost',
                        size: 'icon-sm',
                        className: 'mt-px mb-auto text-fd-muted-foreground',
                      }),
                    )}
                  >
                    <SidebarIcon />
                  </SidebarCollapseTrigger>
                )}
              </div>
            )}
            {tabs.length > 0 && (
              <SidebarTabsDropdown
                options={tabs}
                className={cn(tabMode === 'navbar' && 'lg:hidden')}
              />
            )}
          </Header>
          {viewport}
          <Footer>
            {iconLinks.map((item, i) => (
              <LinkItem
                key={i}
                item={item}
                className={cn(
                  buttonVariants({
                    size: 'icon-sm',
                    color: 'ghost',
                    className: 'lg:hidden',
                  }),
                )}
                aria-label={item.label}
              >
                {item.icon}
              </LinkItem>
            ))}
          </Footer>
        </SidebarContent>
        <SidebarDrawer {...rest}>
          <Header>
            <SidebarTrigger
              className={cn(
                buttonVariants({
                  size: 'icon-sm',
                  color: 'ghost',
                  className: 'ms-auto text-fd-muted-foreground',
                }),
              )}
            >
              <X />
            </SidebarTrigger>
            {tabs.length > 0 && <SidebarTabsDropdown options={tabs} />}
          </Header>
          {viewport}
          <Footer
            className={cn(
              'hidden flex-row items-center justify-end',
              (i18n || themeSwitch.enabled !== false) && 'flex',
              iconLinks.length > 0 && 'max-lg:flex',
            )}
          >
            {iconLinks.map((item, i) => (
              <LinkItem
                key={i}
                item={item}
                className={cn(
                  buttonVariants({
                    size: 'icon-sm',
                    color: 'ghost',
                  }),
                  'text-fd-muted-foreground lg:hidden',
                  i === iconLinks.length - 1 && 'me-auto',
                )}
                aria-label={item.label}
              >
                {item.icon}
              </LinkItem>
            ))}
            {i18n && (
              <LanguageToggle>
                <Languages className="size-4.5 text-fd-muted-foreground" />
              </LanguageToggle>
            )}
            {themeSwitch.enabled !== false &&
              (themeSwitch.component ?? (
                <ThemeToggle />
              ))}
          </Footer>
        </SidebarDrawer>
      </>
    );
  }

  return (
    <TreeContextProvider tree={tree}>
      <LayoutContextProvider
        navMode={nav.mode ?? 'auto'}
        tabMode={tabMode}
        navTransparentMode={nav.transparentMode}
      >
        <Sidebar defaultOpenLevel={defaultOpenLevel} prefetch={prefetch}>
          <LayoutBody {...props.containerProps}>
            {sidebar()}
            <DocsNavbar {...props} links={navItems} tabs={tabs} />
            {props.children}
          </LayoutBody>
        </Sidebar>
      </LayoutContextProvider>
    </TreeContextProvider>
  );
}

function DocsNavbar({
  links,
  tabs,
  tabMode = 'sidebar',
  sidebar: { collapsible: sidebarCollapsible = true } = {},
  searchToggle = {},
  themeSwitch = {},
  nav = {},
  i18n,
}: DocsLayoutProps & {
  links: LinkItemType[];
  tabs: SidebarTabWithProps[];
}) {
  const navMode = nav.mode ?? 'auto';
  const showLayoutTabs = tabMode === 'navbar' && tabs.length > 0;

  return (
    <LayoutHeader
      id="nd-subnav"
      className={cn(
        'sticky [grid-area:header] flex flex-col top-(--fd-docs-row-1) z-10 overflow-x-clip backdrop-blur-sm transition-colors data-[transparent=false]:bg-fd-background/80 layout:[--fd-header-height:--spacing(18)]',
        showLayoutTabs && 'lg:layout:[--fd-header-height:--spacing(32)]',
      )}
    >
      <div data-header-body="" className="relative flex px-4 md:px-6 gap-2 h-18 border-b border-fd-border/50">
        <div
          className={cn(
            'items-center',
            navMode === 'top' && 'flex flex-1',
            navMode === 'auto' && 'hidden has-data-[collapsed=true]:md:flex max-md:flex',
          )}
        >
          {sidebarCollapsible && navMode === 'auto' && (
            <SidebarCollapseTrigger
              className={cn(
                buttonVariants({
                  color: 'ghost',
                  size: 'icon-sm',
                }),
                'text-fd-muted-foreground data-[collapsed=false]:hidden max-md:hidden',
              )}
            >
              <SidebarIcon />
            </SidebarCollapseTrigger>
          )}
          {renderTitleNav(nav, {
            className: cn(
              'inline-flex items-center gap-2.5 font-semibold',
              navMode === 'auto' && 'md:hidden',
            ),
          })}
          {nav.children}
        </div>
        {searchToggle.enabled !== false &&
          (searchToggle.components?.lg ? (
            <div
              className={cn(
                'w-full my-auto max-md:hidden',
                navMode === 'top' ? 'rounded-xl max-w-sm' : 'max-w-[240px]',
              )}
            >
              {searchToggle.components.lg}
            </div>
          ) : (
            <LargeSearchToggle
              hideIfDisabled
              className={cn(
                'w-full my-auto max-md:hidden',
                navMode === 'top' ? 'rounded-xl max-w-sm ps-2.5' : 'max-w-[240px]',
              )}
            />
          ))}
        <div className="flex flex-1 items-center justify-end md:gap-2">
          <div className="flex items-center gap-6 empty:hidden max-lg:hidden">
            {links
              .filter((item) => item.type !== 'icon')
              .map((item, i) => (
                <NavbarLinkItem key={i} item={item} />
              ))}
          </div>
          {themeSwitch.enabled !== false &&
            (themeSwitch.component ?? (
              <ThemeToggle className="max-lg:hidden" />
            ))}
          {links
            .filter((item) => item.type === 'icon')
            .map((item, i) => (
              <LinkItem
                key={i}
                item={item}
                className={cn(
                  buttonVariants({ size: 'icon-sm', color: 'ghost' }),
                  'text-fd-muted-foreground max-lg:hidden',
                )}
                aria-label={item.label}
              >
                {item.icon}
              </LinkItem>
            ))}

          <div className="flex items-center lg:hidden">
            {searchToggle.enabled !== false &&
              (searchToggle.components?.sm ?? <SearchToggle hideIfDisabled className="p-2 md:hidden" />)}
            <SidebarTrigger
              className={cn(
                buttonVariants({
                  color: 'ghost',
                  size: 'icon-sm',
                  className: 'p-2 -me-1.5',
                }),
              )}
            >
              <SidebarIcon />
            </SidebarTrigger>
          </div>

          {(!showLayoutTabs) && (
            <div className="flex items-center gap-2 max-md:hidden">
              <div id="nd-page-actions" className="flex items-center gap-2" />
              {i18n && (
                <LanguageToggle>
                  <Languages className="size-4.5 text-fd-muted-foreground" />
                </LanguageToggle>
              )}
              {themeSwitch.enabled !== false &&
                (themeSwitch.component ?? (
                  <ThemeToggle />
                ))}
              {sidebarCollapsible && navMode === 'top' && (
                <SidebarCollapseTrigger
                  className={cn(
                    buttonVariants({
                      color: 'secondary',
                      size: 'icon-sm',
                    }),
                    'text-fd-muted-foreground rounded-full -me-1.5',
                  )}
                >
                  <SidebarIcon />
                </SidebarCollapseTrigger>
              )}
            </div>
          )}
        </div>
      </div>
      {showLayoutTabs && (
        <div className="relative flex items-center px-4 md:px-6 h-14 max-lg:hidden after:absolute after:bottom-0 after:-left-[100vw] after:-right-[100vw] after:border-b after:border-fd-border after:pointer-events-none after:-z-10">
          {sidebarCollapsible && navMode === 'top' && (
            <SidebarCollapseTrigger
              className={cn(
                buttonVariants({
                  color: 'ghost',
                  size: 'icon-sm',
                }),
                'text-fd-muted-foreground -ms-1.5 me-4',
              )}
            >
              <SidebarIcon />
            </SidebarCollapseTrigger>
          )}
          <LayoutHeaderTabs
            data-header-tabs=""
            className="flex-1 h-full"
            options={tabs}
          />
          <div className="flex items-center gap-2">
            <div id="nd-page-actions-tabs" className="flex items-center gap-2" />
            {i18n && (
              <LanguageToggle>
                <Languages className="size-4.5 text-fd-muted-foreground" />
              </LanguageToggle>
            )}
          </div>
        </div>
      )}
    </LayoutHeader>
  );
}
