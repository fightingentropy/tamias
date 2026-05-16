import { type Database } from "../../../client";
import {
  getInboxItemByIdFromD1,
  getInboxItemsFromD1,
  requireInboxItemsD1,
  upsertInboxItemsInD1,
  type InboxItemRecord,
} from "../d1";
import { getInboxAccountMap } from "./accounts";
import { toUpsertInboxItem } from "./serialization";
import { getInboxTransactionMap } from "./transactions";

export async function hydrateInboxItems(db: Database, teamId: string, items: InboxItemRecord[]) {
  const [inboxAccountMap, transactionMap] = await Promise.all([
    getInboxAccountMap(items.map((item) => item.inboxAccountId)),
    getInboxTransactionMap(
      db,
      teamId,
      items.map((item) => item.transactionId),
    ),
  ]);

  return items.map((item) => ({
    ...item,
    inboxAccount: item.inboxAccountId ? (inboxAccountMap.get(item.inboxAccountId) ?? null) : null,
    transaction: item.transactionId ? (transactionMap.get(item.transactionId) ?? null) : null,
  }));
}

export async function getRelatedInboxItems(db: Database, teamId: string, item: InboxItemRecord) {
  const d1 = requireInboxItemsD1(db);
  const primaryInboxId = item.groupedInboxId ?? item.id;
  const [resolvedPrimaryItem, groupedItems] = await Promise.all([
    item.groupedInboxId
      ? getInboxItemByIdFromD1(d1, {
          teamId,
          inboxId: primaryInboxId,
        })
      : Promise.resolve(item),
    getInboxItemsFromD1(d1, {
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
  db: Database,
  items: InboxItemRecord[],
  overrides: Partial<InboxItemRecord>,
) {
  if (items.length === 0) {
    return [];
  }

  return upsertInboxItemsInD1(requireInboxItemsD1(db), {
    items: items.map((item) =>
      toUpsertInboxItem(item, {
        ...overrides,
        updatedAt: new Date().toISOString(),
      }),
    ),
  });
}
