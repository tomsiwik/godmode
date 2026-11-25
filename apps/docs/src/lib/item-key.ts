const itemKeys = new WeakMap<object, number>();
let nextItemKey = 0;

/** Keep list identity stable when items move, including custom React content. */
export function getItemKey(item: object): string {
  if ("$id" in item && typeof item.$id === "string") return `tree:${item.$id}`;
  if ("url" in item && typeof item.url === "string") return `url:${item.url}`;

  let key = itemKeys.get(item);
  if (key === undefined) {
    key = nextItemKey++;
    itemKeys.set(item, key);
  }
  return `item:${key}`;
}
