import { type InboxItemRecord } from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { separateBlocklistEntries } from "../../../utils/blocklist";
import { getInboxBlocklist } from "../../inbox-blocklist";
import { getInboxItemsPaged } from "../../paged-records";
import type { GetInboxParams } from "../types";
import {
  compareInboxListItems,
  matchesBlocklist,
  matchesInboxQuery,
  matchesInboxTab,
  normalizeInboxQuery,
} from "./shared";
import { getIndexedInboxPage } from "./indexed";
import { canUseIndexedInboxPage } from "./shared";
import { hydrateInboxItems } from "../shared";

type InboxListItem = InboxItemRecord & {
  relatedCount: number;
};

export async function getInbox(db: Database, params: GetInboxParams) {
  const { teamId, cursor, order, sort, pageSize = 20, q, status, tab } = params;
  const normalizedQuery = normalizeInboxQuery(q);

  if (
    canUseIndexedInboxPage({
      sort,
      q: normalizedQuery,
    })
  ) {
    return getIndexedInboxPage(db, {
      ...params,
      q: normalizedQuery,
    });
  }

  const [items, blocklistEntries] = await Promise.all([
    getInboxItemsPaged({ teamId, order: "desc" }),
    getInboxBlocklist(db, { teamId }),
  ]);
  const relatedCountByGroupedInboxId = new Map<string, number>();

  const { blockedDomains, blockedEmails } = separateBlocklistEntries(blocklistEntries);

  for (const item of items) {
    if (!item.groupedInboxId) {
      continue;
    }

    relatedCountByGroupedInboxId.set(
      item.groupedInboxId,
      (relatedCountByGroupedInboxId.get(item.groupedInboxId) ?? 0) + 1,
    );
  }

  const filtered: InboxListItem[] = items
    .filter((item) => item.status !== "deleted")
    .filter((item) => item.groupedInboxId == null)
    .filter((item) => matchesBlocklist(item, blockedDomains, blockedEmails))
    .filter((item) => (status ? item.status === status : true))
    .filter((item) => matchesInboxTab(item, tab))
    .filter((item) => matchesInboxQuery(item, normalizedQuery))
    .map((item) => ({
      ...item,
      relatedCount: relatedCountByGroupedInboxId.get(item.id) ?? 0,
    }));

  filtered.sort((left, right) =>
    compareInboxListItems(left, right, {
      order,
      sort,
    }),
  );

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const paged: InboxListItem[] = filtered.slice(offset, offset + pageSize);
  const hydrated = await hydrateInboxItems(teamId, paged);
  const nextCursor = paged.length === pageSize ? (offset + pageSize).toString() : undefined;

  return {
    meta: {
      cursor: nextCursor,
      hasPreviousPage: offset > 0,
      hasNextPage: paged.length === pageSize,
    },
    data: hydrated.map((item) => ({
      ...item,
      relatedCount: paged.find((candidate) => candidate.id === item.id)?.relatedCount ?? 0,
    })),
  };
}
