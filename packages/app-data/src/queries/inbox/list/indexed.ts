import {
  getInboxItemsByAmountRangeFromConvex,
  getInboxItemsFromConvex,
  getInboxItemsPageFromConvex,
  type InboxItemRecord,
  searchInboxItemsFromConvex,
} from "@tamias/app-data-convex";
import type { Database } from "../../../client";
import { getInboxBlocklist } from "../../inbox-blocklist";
import type { GetInboxParams } from "../types";
import {
  buildHydratedInboxPage,
  compareInboxListItems,
  decodeIndexedInboxCursor,
  encodeIndexedInboxCursor,
  getIndexedInboxBatchSize,
  getInboxQueryAmountTolerance,
  getIndexedInboxSourceOrder,
  getIndexedInboxSearchLimit,
  isAmountLikeInboxQuery,
  matchesIndexedInboxCandidate,
  matchesInboxQuery,
  normalizeInboxQuery,
  parseInboxQueryAmount,
} from "./shared";
import { separateBlocklistEntries } from "../../../utils/blocklist";

async function getIndexedInboxQueryCandidates(args: {
  teamId: string;
  query: string;
  limit: number;
}) {
  const numericAmount = isAmountLikeInboxQuery(args.query)
    ? parseInboxQueryAmount(args.query)
    : null;
  const [textCandidates, amountCandidates] = await Promise.all([
    searchInboxItemsFromConvex({
      teamId: args.teamId,
      query: args.query,
      limit: args.limit,
    }),
    numericAmount !== null
      ? getInboxItemsByAmountRangeFromConvex({
          teamId: args.teamId,
          minAmount: Math.max(
            0,
            Math.round(
              (Math.abs(numericAmount) -
                getInboxQueryAmountTolerance(numericAmount)) *
                100,
            ),
          ),
          maxAmount: Math.round(
            (Math.abs(numericAmount) +
              getInboxQueryAmountTolerance(numericAmount)) *
              100,
          ),
          limit: args.limit,
        })
      : Promise.resolve([]),
  ]);

  return [
    ...new Map(
      [...textCandidates, ...amountCandidates].map((item) => [item.id, item]),
    ).values(),
  ];
}

async function getInboxItemsByIdsInOrder(args: {
  teamId: string;
  inboxIds: string[];
}) {
  if (args.inboxIds.length === 0) {
    return [];
  }

  const items = await getInboxItemsFromConvex({
    teamId: args.teamId,
    ids: args.inboxIds,
  });
  const itemsById = new Map(items.map((item) => [item.id, item]));

  return args.inboxIds.flatMap((inboxId) => {
    const item = itemsById.get(inboxId);

    return item ? [item] : [];
  });
}

async function getIndexedInboxPage(db: Database, params: GetInboxParams) {
  const { teamId, cursor, order, pageSize = 20, status, tab } = params;
  const blocklistEntries = await getInboxBlocklist(db, { teamId });
  const { blockedDomains, blockedEmails } =
    separateBlocklistEntries(blocklistEntries);
  const cursorState = decodeIndexedInboxCursor(cursor);
  let sourceCursor = cursorState.sourceCursor;
  let sourceExhausted = cursorState.sourceExhausted;
  let bufferedIds = [...cursorState.bufferedIds];
  const eligibleItems: InboxItemRecord[] = [];
  const normalizedQuery = normalizeInboxQuery(params.q);

  while (eligibleItems.length <= pageSize && bufferedIds.length > 0) {
    const takeCount = pageSize + 1 - eligibleItems.length;
    const bufferedItems = await getInboxItemsByIdsInOrder({
      teamId,
      inboxIds: bufferedIds.slice(0, takeCount),
    });

    bufferedIds = bufferedIds.slice(takeCount);
    eligibleItems.push(
      ...bufferedItems.filter((item) =>
        matchesIndexedInboxCandidate(item, {
          status,
          tab,
          blockedDomains,
          blockedEmails,
        }),
      ),
    );
  }

  if (
    eligibleItems.length <= pageSize &&
    normalizedQuery &&
    !sourceExhausted &&
    !sourceCursor &&
    bufferedIds.length === 0
  ) {
    const searchCandidates = await getIndexedInboxQueryCandidates({
      teamId,
      query: normalizedQuery,
      limit: getIndexedInboxSearchLimit(pageSize),
    });

    eligibleItems.push(
      ...searchCandidates
        .filter((item) =>
          matchesIndexedInboxCandidate(item, {
            status,
            tab,
            blockedDomains,
            blockedEmails,
          }),
        )
        .filter((item) => matchesInboxQuery(item, normalizedQuery))
        .sort((left, right) =>
          compareInboxListItems(left, right, {
            order,
            sort: params.sort,
          }),
        ),
    );
    sourceExhausted = true;
  }

  while (eligibleItems.length <= pageSize && !sourceExhausted) {
    const result = await getInboxItemsPageFromConvex({
      teamId,
      cursor: sourceCursor,
      pageSize: getIndexedInboxBatchSize(pageSize),
      status: status ?? undefined,
      order: getIndexedInboxSourceOrder(order),
    });

    eligibleItems.push(
      ...result.page.filter((item) =>
        matchesIndexedInboxCandidate(item, {
          status,
          tab,
          blockedDomains,
          blockedEmails,
        }),
      ),
    );

    sourceCursor = result.isDone ? null : result.continueCursor;
    sourceExhausted = result.isDone;

    if (result.page.length === 0) {
      break;
    }
  }

  const pagedItems = eligibleItems.slice(0, pageSize);
  const nextBufferedIds = [
    ...eligibleItems.slice(pageSize).map((item) => item.id),
    ...bufferedIds,
  ];
  const hasNextPage = nextBufferedIds.length > 0;
  const nextCursor = hasNextPage
    ? encodeIndexedInboxCursor({
        sourceCursor,
        sourceExhausted,
        bufferedIds: nextBufferedIds,
      })
    : undefined;

  return buildHydratedInboxPage({
    teamId,
    items: pagedItems,
    cursor,
    nextCursor,
    hasNextPage,
  });
}

export { getIndexedInboxPage };
