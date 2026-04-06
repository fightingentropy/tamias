import { getPublicInvoicesPageFromConvex } from "@tamias/app-data-convex";
import type { InvoiceStatus } from "../../invoice-projections";
import { type ProjectedInvoiceRecord, getProjectedInvoicePayload } from "../shared";
import type { GetInvoicesParams } from "../types";
import { getValidInvoiceStatuses } from "./common";
import { buildInvoicePageResponse, getProjectedInvoicesByIdsInOrder } from "./records";

const INDEXED_INVOICE_CURSOR_PREFIX = "invoice:";

type IndexedInvoiceCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

export function decodeIndexedInvoiceCursor(
  cursor: string | null | undefined,
): IndexedInvoiceCursorState {
  if (!cursor || !cursor.startsWith(INDEXED_INVOICE_CURSOR_PREFIX)) {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(cursor.slice(INDEXED_INVOICE_CURSOR_PREFIX.length), "base64url").toString("utf8"),
    ) as Partial<IndexedInvoiceCursorState>;

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

export function encodeIndexedInvoiceCursor(state: IndexedInvoiceCursorState) {
  return `${INDEXED_INVOICE_CURSOR_PREFIX}${Buffer.from(JSON.stringify(state), "utf8").toString(
    "base64url",
  )}`;
}

export function getIndexedInvoiceOrder(sort: GetInvoicesParams["sort"]) {
  if (!sort || sort.length === 0) {
    return "desc" as const;
  }

  if (sort.length !== 2) {
    return null;
  }

  const [column, direction] = sort;

  if (column !== "created_at" || (direction !== "asc" && direction !== "desc")) {
    return null;
  }

  return direction;
}

export function getIndexedInvoiceBatchSize(pageSize: number) {
  return Math.min(Math.max(pageSize * 3, 100), 250);
}

function requiresIndexedInvoiceCandidateFiltering(args: {
  validStatuses: InvoiceStatus[];
  customers: GetInvoicesParams["customers"];
  start: GetInvoicesParams["start"];
  end: GetInvoicesParams["end"];
  recurring: GetInvoicesParams["recurring"];
}) {
  return (
    args.validStatuses.length > 1 ||
    Boolean(args.customers?.length) ||
    Boolean(args.start && args.end) ||
    (args.recurring !== null && args.recurring !== undefined)
  );
}

export function canUseIndexedInvoicePage(args: {
  sort: GetInvoicesParams["sort"];
  q: GetInvoicesParams["q"];
  ids: GetInvoicesParams["ids"];
  recurringIds: GetInvoicesParams["recurringIds"];
}) {
  return (
    getIndexedInvoiceOrder(args.sort) !== null &&
    !args.q &&
    !args.ids?.length &&
    !args.recurringIds?.length
  );
}

export function matchesIndexedInvoiceCandidate(
  invoice: ProjectedInvoiceRecord,
  args: {
    validStatuses: InvoiceStatus[];
    customers: GetInvoicesParams["customers"];
    start: GetInvoicesParams["start"];
    end: GetInvoicesParams["end"];
    recurring: GetInvoicesParams["recurring"];
  },
) {
  if (args.validStatuses.length > 0 && !args.validStatuses.includes(invoice.status)) {
    return false;
  }

  if (args.start && args.end) {
    if (!invoice.dueDate || invoice.dueDate < args.start || invoice.dueDate > args.end) {
      return false;
    }
  }

  if (args.customers && args.customers.length > 0) {
    const customerIdSet = new Set(args.customers);

    if (!invoice.customerId || !customerIdSet.has(invoice.customerId)) {
      return false;
    }
  }

  if (args.recurring === true && !invoice.invoiceRecurringId) {
    return false;
  }

  if (args.recurring === false && invoice.invoiceRecurringId) {
    return false;
  }

  return true;
}

export async function getIndexedInvoicesPage(params: GetInvoicesParams) {
  const {
    teamId,
    cursor,
    pageSize = 25,
    sort,
    statuses,
    start,
    end,
    customers,
    recurring,
  } = params;
  const validStatuses = getValidInvoiceStatuses(statuses);
  const singleStatus = validStatuses.length === 1 ? validStatuses[0] : undefined;
  const requiresCandidateFiltering = requiresIndexedInvoiceCandidateFiltering({
    validStatuses,
    customers,
    start,
    end,
    recurring,
  });
  const order = getIndexedInvoiceOrder(sort) ?? "desc";
  const cursorState = decodeIndexedInvoiceCursor(cursor);
  let sourceCursor = cursorState.sourceCursor;
  let sourceExhausted = cursorState.sourceExhausted;
  let bufferedIds = [...cursorState.bufferedIds];
  const eligibleInvoices: ProjectedInvoiceRecord[] = [];

  while (eligibleInvoices.length <= pageSize && bufferedIds.length > 0) {
    const takeCount = pageSize + 1 - eligibleInvoices.length;
    const bufferedInvoices = await getProjectedInvoicesByIdsInOrder({
      teamId,
      invoiceIds: bufferedIds.slice(0, takeCount),
    });

    bufferedIds = bufferedIds.slice(takeCount);
    eligibleInvoices.push(
      ...bufferedInvoices.filter((invoice) =>
        matchesIndexedInvoiceCandidate(invoice, {
          validStatuses,
          customers,
          start,
          end,
          recurring,
        }),
      ),
    );
  }

  while (eligibleInvoices.length <= pageSize && !sourceExhausted) {
    const remainingCount = pageSize + 1 - eligibleInvoices.length;
    const result = await getPublicInvoicesPageFromConvex({
      teamId,
      cursor: sourceCursor,
      pageSize: requiresCandidateFiltering ? getIndexedInvoiceBatchSize(pageSize) : remainingCount,
      status: singleStatus,
      order,
    });
    const projectedInvoices = result.page.flatMap((record) => {
      const payload = getProjectedInvoicePayload(record);

      return payload && payload.teamId === teamId ? [payload] : [];
    });

    eligibleInvoices.push(
      ...projectedInvoices.filter((invoice) =>
        matchesIndexedInvoiceCandidate(invoice, {
          validStatuses,
          customers,
          start,
          end,
          recurring,
        }),
      ),
    );

    sourceCursor = result.isDone ? null : result.continueCursor;
    sourceExhausted = result.isDone;

    if (result.page.length === 0) {
      break;
    }
  }

  const pagedInvoices = eligibleInvoices.slice(0, pageSize);
  const nextBufferedIds = [
    ...eligibleInvoices.slice(pageSize).map((invoice) => invoice.id),
    ...bufferedIds,
  ];
  const hasNextPage = nextBufferedIds.length > 0;
  const nextCursor = hasNextPage
    ? encodeIndexedInvoiceCursor({
        sourceCursor,
        sourceExhausted,
        bufferedIds: nextBufferedIds,
      })
    : undefined;

  return buildInvoicePageResponse({
    invoices: pagedInvoices,
    cursor,
    nextCursor,
    hasNextPage,
  });
}
