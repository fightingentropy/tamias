import type { Database } from "../../../client";
import {
  getInboxItemsByAmountRangeFromD1,
  getInboxItemsPageFromD1,
  requireInboxItemsD1,
  searchInboxItemsFromD1,
  type InboxItemRecord,
} from "../d1";

const INBOX_SEARCH_PAGE_SIZE = 100;

export function isInboxSearchCandidate(item: InboxItemRecord) {
  return (
    item.status !== "deleted" &&
    item.status !== "other" &&
    item.type !== "other" &&
    item.transactionId == null
  );
}

export function getInboxAmountSearchWindow(amount: number) {
  const absoluteAmount = Math.abs(amount);
  const tolerance = Math.max(1, absoluteAmount * 0.25);

  return {
    minAmount: Math.max(0, Math.round((absoluteAmount - tolerance) * 100)),
    maxAmount: Math.round((absoluteAmount + tolerance) * 100),
  };
}

export async function getIndexedInboxSearchCandidates(args: {
  db: Database;
  teamId: string;
  searchTerms: Array<string | null | undefined>;
  amount?: number | null;
  limit: number;
}) {
  const d1 = requireInboxItemsD1(args.db);
  const searchTerms = [
    ...new Set(
      args.searchTerms
        .map((searchTerm) => searchTerm?.trim())
        .filter((searchTerm): searchTerm is string => Boolean(searchTerm)),
    ),
  ];
  const amountWindow =
    args.amount !== null && args.amount !== undefined
      ? getInboxAmountSearchWindow(args.amount)
      : null;
  const [textCandidateGroups, amountCandidates] = await Promise.all([
    Promise.all(
      searchTerms.map((searchTerm) =>
        searchInboxItemsFromD1(d1, {
          teamId: args.teamId,
          query: searchTerm,
          limit: args.limit,
        }),
      ),
    ),
    amountWindow
      ? getInboxItemsByAmountRangeFromD1(d1, {
          teamId: args.teamId,
          minAmount: amountWindow.minAmount,
          maxAmount: amountWindow.maxAmount,
          limit: args.limit,
        })
      : Promise.resolve([]),
  ]);

  return [
    ...new Map(
      [...textCandidateGroups.flat(), ...amountCandidates]
        .filter(isInboxSearchCandidate)
        .map((item) => [item.id, item]),
    ).values(),
  ];
}

export async function getRecentInboxSearchItems(db: Database, teamId: string, limit: number) {
  const d1 = requireInboxItemsD1(db);
  const results: InboxItemRecord[] = [];
  let cursor: string | null = null;

  while (results.length < limit) {
    const page = await getInboxItemsPageFromD1(d1, {
      teamId,
      cursor,
      pageSize: Math.max(limit, INBOX_SEARCH_PAGE_SIZE),
      order: "desc",
    });

    for (const item of page.page) {
      if (!isInboxSearchCandidate(item)) {
        continue;
      }

      results.push(item);

      if (results.length >= limit) {
        break;
      }
    }

    if (page.isDone || results.length >= limit) {
      return results;
    }

    cursor = page.continueCursor;
  }

  return results;
}
