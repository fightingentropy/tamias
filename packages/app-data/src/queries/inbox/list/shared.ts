import { getInboxItemsFromConvex, type InboxItemRecord } from "@tamias/app-data-convex";
import {
  compareNullableDates,
  compareNullableStrings,
  hydrateInboxItems,
  includesSearch,
  normalizeText,
} from "../shared";
import type { GetInboxParams } from "../types";

export const INBOX_PAGE_CURSOR_PREFIX = "inbox:";

export type IndexedInboxCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

export function matchesBlocklist(
  item: InboxItemRecord,
  blockedDomains: string[],
  blockedEmails: string[],
) {
  const website = normalizeText(item.website);
  const senderEmail = normalizeText(item.senderEmail);

  if (blockedDomains.some((domain) => website !== "" && website === normalizeText(domain))) {
    return false;
  }

  if (blockedEmails.some((email) => senderEmail !== "" && senderEmail === normalizeText(email))) {
    return false;
  }

  return true;
}

export function decodeIndexedInboxCursor(
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
      Buffer.from(cursor.slice(INBOX_PAGE_CURSOR_PREFIX.length), "base64url").toString("utf8"),
    ) as Partial<IndexedInboxCursorState>;

    return {
      sourceCursor: typeof parsed.sourceCursor === "string" ? parsed.sourceCursor : null,
      sourceExhausted: parsed.sourceExhausted === true,
      bufferedIds: Array.isArray(parsed.bufferedIds)
        ? parsed.bufferedIds.filter(
            (bufferedId): bufferedId is string => typeof bufferedId === "string",
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

export function encodeIndexedInboxCursor(state: IndexedInboxCursorState) {
  return `${INBOX_PAGE_CURSOR_PREFIX}${Buffer.from(JSON.stringify(state), "utf8").toString(
    "base64url",
  )}`;
}

export function getIndexedInboxSourceOrder(order: string | null | undefined) {
  return order === "desc" ? ("asc" as const) : ("desc" as const);
}

export function getIndexedInboxBatchSize(pageSize: number) {
  return Math.min(Math.max(pageSize * 3, 100), 250);
}

export function getIndexedInboxSearchLimit(pageSize: number) {
  return Math.min(Math.max(pageSize * 20, 100), 400);
}

export function normalizeInboxQuery(query: string | null | undefined) {
  const trimmed = query?.trim();
  return trimmed ? trimmed : null;
}

export function isAmountLikeInboxQuery(query: string | null | undefined) {
  const normalizedQuery = normalizeInboxQuery(query);

  if (!normalizedQuery) {
    return false;
  }

  return /[\d]/.test(normalizedQuery) && /^[\d\s,.\-+£$€]+$/.test(normalizedQuery);
}

export function parseInboxQueryAmount(query: string | null | undefined) {
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

export function getInboxQueryAmountTolerance(amount: number) {
  return Math.max(1, Math.abs(amount) * 0.1);
}

export function canUseIndexedInboxPage(args: {
  sort: string | null | undefined;
  q: string | null | undefined;
}) {
  const query = normalizeInboxQuery(args.q);

  if (query) {
    return true;
  }

  return !args.sort || args.sort === "date";
}

export function matchesInboxTab(item: InboxItemRecord, tab: GetInboxParams["tab"]) {
  return tab === "other"
    ? item.type === "other" || item.status === "other"
    : item.type !== "other" && item.status !== "other";
}

export function matchesIndexedInboxCandidate(
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

export function matchesInboxQuery(
  item: Pick<InboxItemRecord, "amount" | "description" | "displayName" | "fileName">,
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

export function compareInboxListItems(
  left: Pick<InboxItemRecord, "createdAt" | "date" | "displayName">,
  right: Pick<InboxItemRecord, "createdAt" | "date" | "displayName">,
  args: {
    order: string | null | undefined;
    sort: string | null | undefined;
  },
) {
  const { order, sort } = args;

  if (sort === "alphabetical") {
    const comparison = compareNullableStrings(left.displayName, right.displayName);
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

export async function buildHydratedInboxPage(args: {
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
