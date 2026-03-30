import {
  getInboxItemByIdFromConvex,
  getInboxItemsByAmountRangeFromConvex,
  getInboxItemsFromConvex,
  getInboxItemsPageFromConvex,
  getInboxStatusCountSummaryFromConvex,
  type InboxItemRecord,
  searchInboxItemsFromConvex,
} from "@tamias/app-data-convex";
import { createLoggerWithContext } from "@tamias/logger";
import type { Database } from "../../client";
import { separateBlocklistEntries } from "../../utils/blocklist";
import { cacheAcrossRequests } from "../../utils/short-lived-cache";
import { normalizeTimestampBoundary } from "../date-boundaries";
import { getInboxBlocklist } from "../inbox-blocklist";
import { getInboxItemsPaged } from "../paged-records";
import { getTransactionAttachmentsByIds } from "../transaction-attachments";
import {
  compareNullableDates,
  compareNullableStrings,
  filePathEquals,
  getPendingSuggestionForInbox,
  getTeamMatchSuggestions,
  hydrateInboxItems,
  includesSearch,
  loadSuggestionMaps,
  normalizeText,
} from "./shared";

const logger = createLoggerWithContext("inbox");
const INBOX_PAGE_CURSOR_PREFIX = "inbox:";

type IndexedInboxCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

function matchesBlocklist(
  item: InboxItemRecord,
  blockedDomains: string[],
  blockedEmails: string[],
) {
  const website = normalizeText(item.website);
  const senderEmail = normalizeText(item.senderEmail);

  if (
    blockedDomains.some(
      (domain) => website !== "" && website === normalizeText(domain),
    )
  ) {
    return false;
  }

  if (
    blockedEmails.some(
      (email) => senderEmail !== "" && senderEmail === normalizeText(email),
    )
  ) {
    return false;
  }

  return true;
}

function decodeIndexedInboxCursor(
  cursor: string | null | undefined,
): IndexedInboxCursorState {
  if (!cursor?.startsWith(INBOX_PAGE_CURSOR_PREFIX)) {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(
        cursor.slice(INBOX_PAGE_CURSOR_PREFIX.length),
        "base64url",
      ).toString("utf8"),
    ) as Partial<IndexedInboxCursorState>;

    return {
      sourceCursor:
        typeof parsed.sourceCursor === "string" ? parsed.sourceCursor : null,
      sourceExhausted: parsed.sourceExhausted === true,
      bufferedIds: Array.isArray(parsed.bufferedIds)
        ? parsed.bufferedIds.filter(
            (bufferedId): bufferedId is string =>
              typeof bufferedId === "string",
          )
        : [],
    };
  } catch {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }
}

function encodeIndexedInboxCursor(state: IndexedInboxCursorState) {
  return `${INBOX_PAGE_CURSOR_PREFIX}${Buffer.from(
    JSON.stringify(state),
    "utf8",
  ).toString("base64url")}`;
}

function getIndexedInboxSourceOrder(order: string | null | undefined) {
  return order === "desc" ? ("asc" as const) : ("desc" as const);
}

function getIndexedInboxBatchSize(pageSize: number) {
  return Math.min(Math.max(pageSize * 3, 100), 250);
}

function normalizeInboxQuery(query: string | null | undefined) {
  const trimmed = query?.trim();
  return trimmed ? trimmed : null;
}

function isAmountLikeInboxQuery(query: string | null | undefined) {
  const normalizedQuery = normalizeInboxQuery(query);

  if (!normalizedQuery) {
    return false;
  }

  return (
    /[\d]/.test(normalizedQuery) && /^[\d\s,.\-+£$€]+$/.test(normalizedQuery)
  );
}

function parseInboxQueryAmount(query: string | null | undefined) {
  const normalizedQuery = normalizeInboxQuery(query);

  if (!normalizedQuery) {
    return null;
  }

  const numeric = Number.parseFloat(normalizedQuery.replace(/[^\d.-]/g, ""));

  if (Number.isNaN(numeric) || !Number.isFinite(numeric)) {
    return null;
  }

  return numeric;
}

function getInboxQueryAmountTolerance(amount: number) {
  return Math.max(1, Math.abs(amount) * 0.1);
}

function canUseIndexedInboxPage(args: {
  sort: string | null | undefined;
  q: string | null | undefined;
}) {
  const query = normalizeInboxQuery(args.q);

  if (query) {
    return true;
  }

  return !args.sort || args.sort === "date";
}

function matchesInboxTab(item: InboxItemRecord, tab: GetInboxParams["tab"]) {
  return tab === "other"
    ? item.type === "other" || item.status === "other"
    : item.type !== "other" && item.status !== "other";
}

function matchesIndexedInboxCandidate(
  item: InboxItemRecord,
  args: {
    status: GetInboxParams["status"];
    tab: GetInboxParams["tab"];
    blockedDomains: string[];
    blockedEmails: string[];
  },
) {
  return (
    item.status !== "deleted" &&
    item.groupedInboxId == null &&
    matchesBlocklist(item, args.blockedDomains, args.blockedEmails) &&
    (args.status ? item.status === args.status : true) &&
    matchesInboxTab(item, args.tab)
  );
}

function matchesInboxQuery(
  item: Pick<
    InboxItemRecord,
    "amount" | "description" | "displayName" | "fileName"
  >,
  query: string | null | undefined,
) {
  const normalizedQuery = normalizeInboxQuery(query);

  if (!normalizedQuery) {
    return true;
  }

  const numeric = isAmountLikeInboxQuery(normalizedQuery)
    ? parseInboxQueryAmount(normalizedQuery)
    : null;

  if (numeric !== null) {
    const amount = Math.abs(item.amount ?? 0);
    const tolerance = getInboxQueryAmountTolerance(numeric);

    return (
      includesSearch(item.displayName, normalizedQuery) ||
      includesSearch(item.fileName, normalizedQuery) ||
      includesSearch(item.description, normalizedQuery) ||
      Math.abs(amount - Math.abs(numeric)) <= tolerance
    );
  }

  return (
    includesSearch(item.displayName, normalizedQuery) ||
    includesSearch(item.fileName, normalizedQuery) ||
    includesSearch(item.description, normalizedQuery)
  );
}

function compareInboxListItems(
  left: Pick<InboxItemRecord, "createdAt" | "date" | "displayName">,
  right: Pick<InboxItemRecord, "createdAt" | "date" | "displayName">,
  args: {
    order: string | null | undefined;
    sort: string | null | undefined;
  },
) {
  const { order, sort } = args;

  if (sort === "alphabetical") {
    const comparison = compareNullableStrings(
      left.displayName,
      right.displayName,
    );
    return order === "desc" ? -comparison : comparison;
  }

  if (sort === "document_date") {
    const comparison = compareNullableDates(
      left.date,
      right.date,
      order === "desc" ? "desc" : "asc",
    );

    if (comparison !== 0) {
      return order === "desc" ? -comparison : comparison;
    }

    return order === "desc"
      ? right.createdAt.localeCompare(left.createdAt)
      : left.createdAt.localeCompare(right.createdAt);
  }

  return order === "desc"
    ? left.createdAt.localeCompare(right.createdAt)
    : right.createdAt.localeCompare(left.createdAt);
}

function getIndexedInboxSearchLimit(pageSize: number) {
  return Math.min(Math.max(pageSize * 20, 100), 400);
}

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

async function buildHydratedInboxPage(args: {
  teamId: string;
  items: InboxItemRecord[];
  cursor: string | null | undefined;
  nextCursor: string | null | undefined;
  hasNextPage: boolean;
}) {
  if (args.items.length === 0) {
    return {
      meta: {
        cursor: args.nextCursor ?? undefined,
        hasPreviousPage: Boolean(args.cursor),
        hasNextPage: args.hasNextPage,
      },
      data: [],
    };
  }

  const relatedItems = await getInboxItemsFromConvex({
    teamId: args.teamId,
    groupedInboxIds: args.items.map((item) => item.id),
  });
  const relatedCountByGroupedInboxId = new Map<string, number>();

  for (const item of relatedItems) {
    if (!item.groupedInboxId) {
      continue;
    }

    relatedCountByGroupedInboxId.set(
      item.groupedInboxId,
      (relatedCountByGroupedInboxId.get(item.groupedInboxId) ?? 0) + 1,
    );
  }

  const hydrated = await hydrateInboxItems(args.teamId, args.items);

  return {
    meta: {
      cursor: args.nextCursor ?? undefined,
      hasPreviousPage: Boolean(args.cursor),
      hasNextPage: args.hasNextPage,
    },
    data: hydrated.map((item) => ({
      ...item,
      relatedCount: relatedCountByGroupedInboxId.get(item.id) ?? 0,
    })),
  };
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

export type GetInboxParams = {
  teamId: string;
  cursor?: string | null;
  order?: string | null;
  sort?: string | null;
  pageSize?: number;
  q?: string | null;
  status?:
    | "new"
    | "archived"
    | "processing"
    | "done"
    | "pending"
    | "analyzing"
    | "suggested_match"
    | "no_match"
    | "other"
    | null;
  tab?: "all" | "other" | null;
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

  const { blockedDomains, blockedEmails } =
    separateBlocklistEntries(blocklistEntries);

  for (const item of items) {
    if (!item.groupedInboxId) {
      continue;
    }

    relatedCountByGroupedInboxId.set(
      item.groupedInboxId,
      (relatedCountByGroupedInboxId.get(item.groupedInboxId) ?? 0) + 1,
    );
  }

  const filtered = items
    .filter((item) => item.status !== "deleted")
    .filter((item) => item.groupedInboxId == null)
    .filter((item) => matchesBlocklist(item, blockedDomains, blockedEmails))
    .filter((item) => (status ? item.status === status : true))
    .filter((item) =>
      tab === "other"
        ? item.type === "other" || item.status === "other"
        : item.type !== "other" && item.status !== "other",
    )
    .filter((item) => {
      return matchesInboxQuery(item, normalizedQuery);
    })
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
  const paged = filtered.slice(offset, offset + pageSize);
  const hydrated = await hydrateInboxItems(teamId, paged);
  const nextCursor =
    paged.length === pageSize ? (offset + pageSize).toString() : undefined;

  return {
    meta: {
      cursor: nextCursor,
      hasPreviousPage: offset > 0,
      hasNextPage: paged.length === pageSize,
    },
    data: hydrated.map((item) => ({
      ...item,
      relatedCount:
        paged.find((candidate) => candidate.id === item.id)?.relatedCount ?? 0,
    })),
  };
}

export type GetInboxByIdParams = {
  id: string;
  teamId: string;
};

export async function getInboxById(_db: Database, params: GetInboxByIdParams) {
  const { id, teamId } = params;
  const [item, suggestion] = await Promise.all([
    getInboxItemByIdFromConvex({ teamId, inboxId: id }),
    getPendingSuggestionForInbox(teamId, id),
  ]);

  if (!item) {
    return null;
  }

  const primaryItemId = item.groupedInboxId || item.id;
  const [primaryItem, relatedItems] = await Promise.all([
    primaryItemId === item.id
      ? Promise.resolve(item)
      : getInboxItemByIdFromConvex({
          teamId,
          inboxId: primaryItemId,
        }).then((candidate) => candidate ?? item),
    getInboxItemsFromConvex({
      teamId,
      groupedInboxIds: [primaryItemId],
    }).then((items) =>
      items.filter((candidate) => candidate.status !== "deleted"),
    ),
  ]);
  const [hydratedPrimary] = await hydrateInboxItems(teamId, [primaryItem]);

  if (!hydratedPrimary) {
    return null;
  }

  if (suggestion?.transactionId) {
    const suggestionTransactionMap = await loadSuggestionMaps(teamId, [
      suggestion,
    ]);

    return {
      ...hydratedPrimary,
      meta: hydratedPrimary.meta ?? primaryItem.meta,
      suggestion: {
        id: suggestion.id,
        transactionId: suggestion.transactionId,
        confidenceScore: suggestion.confidenceScore,
        matchType: suggestion.matchType,
        status: suggestion.status,
        suggestedTransaction:
          suggestionTransactionMap.get(suggestion.transactionId) ?? null,
      },
      relatedItems: relatedItems.length > 0 ? relatedItems : undefined,
    };
  }

  return {
    ...hydratedPrimary,
    suggestion: null,
    relatedItems: relatedItems.length > 0 ? relatedItems : undefined,
  };
}

export type CheckInboxAttachmentsParams = {
  id: string;
  teamId: string;
};

export async function checkInboxAttachments(
  _db: Database,
  params: CheckInboxAttachmentsParams,
) {
  const inboxItem = await getInboxItemByIdFromConvex({
    teamId: params.teamId,
    inboxId: params.id,
  });

  if (!inboxItem) {
    return { hasAttachments: false, attachments: [] };
  }

  if (inboxItem.attachmentId && inboxItem.transactionId) {
    const attachments = await getTransactionAttachmentsByIds({
      teamId: params.teamId,
      attachmentIds: [inboxItem.attachmentId],
    });

    return {
      hasAttachments: attachments.length > 0,
      attachments,
      fileName: inboxItem.fileName,
    };
  }

  return {
    hasAttachments: false,
    attachments: [],
    fileName: inboxItem.fileName,
  };
}

export type GetInboxByFilePathParams = {
  filePath: string[];
  teamId: string;
};

export async function getInboxByFilePath(
  _db: Database,
  params: GetInboxByFilePathParams,
) {
  const { filePath, teamId } = params;
  const items = await getInboxItemsFromConvex({
    teamId,
    filePath,
  });
  const matching = items
    .filter((item) => filePathEquals(item.filePath, filePath))
    .filter((item) => item.status !== "deleted")
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  const processingItem = matching.find(
    (item) => item.status === "processing" || item.status === "new",
  );

  const item = processingItem ?? matching[0];

  if (!item) {
    return undefined;
  }

  return {
    id: item.id,
    status: item.status,
    createdAt: item.createdAt,
    contentType: item.contentType,
    displayName: item.displayName,
  };
}

export type GetStuckInboxItemsParams = {
  teamId: string;
  thresholdMinutes?: number;
};

export async function getStuckInboxItems(
  _db: Database,
  params: GetStuckInboxItemsParams,
) {
  const { teamId, thresholdMinutes = 5 } = params;
  const thresholdMs = thresholdMinutes * 60 * 1000;
  const thresholdDate = new Date(Date.now() - thresholdMs).toISOString();

  return (
    await Promise.all([
      getInboxItemsPaged({
        teamId,
        status: "processing",
        createdAtTo: thresholdDate,
      }),
      getInboxItemsPaged({
        teamId,
        status: "new",
        createdAtTo: thresholdDate,
      }),
    ])
  )
    .flat()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map((item) => ({
      id: item.id,
      status: item.status,
      createdAt: item.createdAt,
      filePath: item.filePath,
      displayName: item.displayName,
    }));
}

export type GetExistingInboxAttachmentsByReferenceIdsParams = {
  referenceIds: string[];
  teamId: string;
};

export async function getExistingInboxAttachmentsByReferenceIds(
  _db: Database,
  params: GetExistingInboxAttachmentsByReferenceIdsParams,
) {
  const validReferenceIds = params.referenceIds.filter(
    (id): id is string => id != null && id !== "",
  );

  if (validReferenceIds.length === 0) {
    return [];
  }

  logger.info("Querying for existing inbox attachments by referenceIds", {
    teamId: params.teamId,
    referenceIdsCount: validReferenceIds.length,
    sampleIds: validReferenceIds.slice(0, 3),
  });

  const results = (
    await getInboxItemsFromConvex({
      teamId: params.teamId,
      referenceIds: validReferenceIds,
    })
  )
    .filter((item) => item.status !== "deleted")
    .map((item) => ({
      referenceId: item.referenceId,
      status: item.status,
    }));

  logger.info("Found existing inbox attachments", {
    teamId: params.teamId,
    foundCount: results.length,
    foundIds: results.map((result) => result.referenceId).slice(0, 3),
  });

  return results;
}

export type GetInboxStatsParams = {
  teamId: string;
  from: string;
  to: string;
  currency?: string;
};

async function getInboxStatsImpl(_db: Database, params: GetInboxStatsParams) {
  const { teamId, from, to, currency } = params;
  const fromBoundary = normalizeTimestampBoundary(from, "start");
  const toBoundary = normalizeTimestampBoundary(to, "end");
  const [statusSummary, suggestions] = await Promise.all([
    getInboxStatusCountSummaryFromConvex({
      teamId,
      createdAtFrom: fromBoundary,
      createdAtTo: toBoundary,
      rangeStatus: "done",
    }),
    getTeamMatchSuggestions(teamId, ["pending"]),
  ]);

  const { totals, rangeCount: recentMatches } = statusSummary;
  const newItems = totals.new;
  const archivedItems = totals.archived;
  const processingItems = totals.processing;
  const doneItems = totals.done;
  const pendingItems = totals.pending;
  const analyzingItems = totals.analyzing;
  const suggestedMatchItems = totals.suggested_match;
  const noMatchItems = totals.no_match;
  const otherItems = totals.other;

  const stats = {
    newItems,
    pendingItems,
    analyzingItems,
    suggestedMatches: suggestions.length + suggestedMatchItems,
    recentMatches,
    totalItems:
      newItems +
      archivedItems +
      processingItems +
      doneItems +
      pendingItems +
      analyzingItems +
      suggestedMatchItems +
      noMatchItems +
      otherItems,
  };

  return {
    result: stats,
    meta: {
      from,
      to,
      currency,
      teamId,
    },
  };
}

export const getInboxStats = cacheAcrossRequests({
  keyPrefix: "inbox-stats",
  keyFn: (params: GetInboxStatsParams) =>
    [params.teamId, params.from, params.to, params.currency ?? ""].join(":"),
  load: getInboxStatsImpl,
});
