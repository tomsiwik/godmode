"use client";
import type { HTMLAttributes } from "react";
import { getItemKey } from "../../../lib/item-key";
import { type LinkItemType, useLinkItemActive } from "../link-item";
import type * as Base from "./base";

type InternalComponents = Pick<
  typeof Base,
  | "SidebarFolder"
  | "SidebarFolderLink"
  | "SidebarFolderContent"
  | "SidebarFolderTrigger"
  | "SidebarItem"
>;

export function SidebarLinkItem({
  item,
  components,
  ...props
}: HTMLAttributes<HTMLElement> & {
  item: Exclude<LinkItemType, { type: "icon" }>;
  components: InternalComponents;
}) {
  const {
    SidebarFolder,
    SidebarFolderContent,
    SidebarFolderLink,
    SidebarFolderTrigger,
    SidebarItem,
  } = components;
  const active = useLinkItemActive(item);
  if (item.type === "custom") return <div {...props}>{item.children}</div>;

  if (item.type === "menu")
    return (
      <SidebarFolder {...props}>
        {item.url ? (
          <SidebarFolderLink
            href={item.url}
            active={active}
            external={item.external}
          >
            {item.icon}
            {item.text}
          </SidebarFolderLink>
        ) : (
          <SidebarFolderTrigger>
            {item.icon}
            {item.text}
          </SidebarFolderTrigger>
        )}
        <SidebarFolderContent>
          {item.items.map((child) => (
            <SidebarLinkItem
              key={getItemKey(child)}
              item={child}
              components={components}
            />
          ))}
        </SidebarFolderContent>
      </SidebarFolder>
    );

  return (
    <SidebarItem
      href={item.url}
      icon={item.icon}
      external={item.external}
      active={active}
      {...props}
    >
      {item.text}
    </SidebarItem>
  );
}
