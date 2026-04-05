import {
  getInboxItemByIdFromConvex,
  getInboxItemsFromConvex,
  upsertInboxItemsInConvex,
  type InboxItemRecord,
} from "../../../convex";
import { getInboxAccountMap } from "./accounts";
import { toUpsertInboxItem } from "./serialization";
import { getInboxTransactionMap } from "./transactions";

export async function hydrateInboxItems(
  teamId: string,
  items: InboxItemRecord[],
) {
  const [inboxAccountMap, transactionMap] = await Promise.all([
    getInboxAccountMap(items.map((item) => item.inboxAccountId)),
    getInboxTransactionMap(
      teamId,
      items.map((item) => item.transactionId),
    ),
  ]);

  return items.map((item) => ({
    ...item,
    inboxAccount: item.inboxAccountId
      ? (inboxAccountMap.get(item.inboxAccountId) ?? null)
      : null,
    transaction: item.transactionId
      ? (transactionMap.get(item.transactionId) ?? null)
      : null,
  }));
}

export async function getRelatedInboxItems(
  teamId: string,
  item: InboxItemRecord,
) {
  const primaryInboxId = item.groupedInboxId ?? item.id;
  const [resolvedPrimaryItem, groupedItems] = await Promise.all([
    item.groupedInboxId
      ? getInboxItemByIdFromConvex({
          teamId,
          inboxId: primaryInboxId,
        })
      : Promise.resolve(item),
    getInboxItemsFromConvex({
      teamId,
      groupedInboxIds: [primaryInboxId],
    }),
  ]);
  const itemsById = new Map<string, InboxItemRecord>();

  itemsById.set((resolvedPrimaryItem ?? item).id, resolvedPrimaryItem ?? item);

  for (const groupedItem of groupedItems) {
    itemsById.set(groupedItem.id, groupedItem);
  }

  return [...itemsById.values()].sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
}

export async function markInboxItems(
  items: InboxItemRecord[],
  overrides: Partial<InboxItemRecord>,
) {
  if (items.length === 0) {
    return [];
  }

  return upsertInboxItemsInConvex({
    items: items.map((item) =>
      toUpsertInboxItem(item, {
        ...overrides,
        updatedAt: new Date().toISOString(),
      }),
    ),
  });
}
