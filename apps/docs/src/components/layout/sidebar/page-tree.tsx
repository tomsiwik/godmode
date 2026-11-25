import { usePathname } from "fumadocs-core/framework";
import type * as PageTree from "fumadocs-core/page-tree";
import { useTreeContext, useTreePath } from "fumadocs-ui/contexts/tree";
import { createContext, type FC, type ReactNode, use, useMemo } from "react";
import { getItemKey } from "../../../lib/item-key";
import { isActive } from "../../../lib/urls";
import type * as Base from "./base";

export interface SidebarPageTreeComponents {
  Item: FC<{ item: PageTree.Item }>;
  Folder: FC<{ item: PageTree.Folder; children: ReactNode }>;
  Separator: FC<{ item: PageTree.Separator }>;
}

const RendererContext = createContext<
  | (Partial<SidebarPageTreeComponents> & {
      pathname: string;
      components: InternalComponents;
    })
  | null
>(null);

type InternalComponents = Pick<
  typeof Base,
  | "SidebarSeparator"
  | "SidebarFolder"
  | "SidebarFolderLink"
  | "SidebarFolderContent"
  | "SidebarFolderTrigger"
  | "SidebarItem"
>;

function renderList(nodes: PageTree.Node[]) {
  return nodes.map((node) => (
    <PageTreeNode key={getItemKey(node)} node={node} />
  ));
}

function PageTreeNode({ node }: { node: PageTree.Node }) {
  const context = use(RendererContext);
  const path = useTreePath();
  if (!context)
    throw new Error("PageTreeNode must be rendered inside SidebarPageTree");
  const { Separator, Item, Folder, pathname, components } = context;
  const {
    SidebarFolder,
    SidebarFolderContent,
    SidebarFolderLink,
    SidebarFolderTrigger,
    SidebarSeparator,
    SidebarItem,
  } = components;

  if (node.type === "separator") {
    if (Separator) return <Separator item={node} />;
    return (
      <SidebarSeparator>
        {node.icon}
        {node.name}
      </SidebarSeparator>
    );
  }
  if (node.type === "folder") {
    if (Folder) return <Folder item={node}>{renderList(node.children)}</Folder>;
    return (
      <SidebarFolder
        collapsible={node.collapsible}
        active={path.includes(node)}
        defaultOpen={node.defaultOpen}
      >
        {node.index ? (
          <SidebarFolderLink
            href={node.index.url}
            active={isActive(node.index.url, pathname)}
            external={node.index.external}
          >
            {node.icon}
            {node.name}
          </SidebarFolderLink>
        ) : (
          <SidebarFolderTrigger>
            {node.icon}
            {node.name}
          </SidebarFolderTrigger>
        )}
        <SidebarFolderContent>{renderList(node.children)}</SidebarFolderContent>
      </SidebarFolder>
    );
  }
  if (Item) return <Item item={node} />;
  return (
    <SidebarItem
      href={node.url}
      external={node.external}
      active={isActive(node.url, pathname)}
      icon={node.icon}
    >
      {node.name}
    </SidebarItem>
  );
}

export function SidebarPageTree({
  components,
  Folder,
  Item,
  Separator,
}: Partial<SidebarPageTreeComponents> & { components: InternalComponents }) {
  const { root } = useTreeContext();
  const pathname = usePathname();
  return (
    <RendererContext
      value={useMemo(
        () => ({ Folder, Item, Separator, pathname, components }),
        [Folder, Item, Separator, pathname, components],
      )}
    >
      {renderList(root.children)}
    </RendererContext>
  );
}
