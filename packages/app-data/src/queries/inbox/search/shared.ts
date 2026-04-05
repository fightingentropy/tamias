import {
  getInboxItemsByAmountRangeFromConvex,
  getInboxItemsPageFromConvex,
  searchInboxItemsFromConvex,
  type InboxItemRecord,
} from "@tamias/app-data-convex";

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
  teamId: string;
  searchTerms: Array<string | null | undefined>;
  amount?: number | null;
  limit: number;
}) {
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
        searchInboxItemsFromConvex({
          teamId: args.teamId,
          query: searchTerm,
          limit: args.limit,
        }),
      ),
    ),
    amountWindow
      ? getInboxItemsByAmountRangeFromConvex({
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

export async function getRecentInboxSearchItems(teamId: string, limit: number) {
  const results: InboxItemRecord[] = [];
  let cursor: string | null = null;

  while (results.length < limit) {
    const page = await getInboxItemsPageFromConvex({
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
