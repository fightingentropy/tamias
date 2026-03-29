import {
  getPublicInvoiceByPublicInvoiceIdFromConvex,
  getPublicInvoicesByIdsFromConvex,
  getPublicInvoicesPageFromConvex,
} from "@tamias/app-data-convex";
import type { Database, DatabaseOrTransaction } from "../../client";
import { getExchangeRatesBatch } from "../exhange-rates";
import {
  type InvoiceStatus,
  getProjectedInvoicesByFilters,
  getProjectedInvoicesForTeam,
} from "../invoice-projections";
import { getTeamById } from "../teams";
import {
  type InvoiceByIdResult,
  type ProjectedInvoiceRecord,
  getProjectedInvoicePayload,
} from "./shared";

const INVOICE_STATUSES = [
  "draft",
  "overdue",
  "paid",
  "unpaid",
  "canceled",
  "scheduled",
  "refunded",
] as const;
const INDEXED_INVOICE_CURSOR_PREFIX = "invoice:";

type IndexedInvoiceCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

export type GetInvoicesParams = {
  teamId: string;
  cursor?: string | null;
  pageSize?: number;
  q?: string | null;
  statuses?: string[] | null;
  customers?: string[] | null;
  start?: string | null;
  end?: string | null;
  sort?: string[] | null;
  ids?: string[] | null;
  recurringIds?: string[] | null;
  recurring?: boolean | null;
};

function compareNullableStrings(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  return (left ?? "").localeCompare(right ?? "");
}

function compareNullableNumbers(
  left: number | null | undefined,
  right: number | null | undefined,
) {
  return (left ?? 0) - (right ?? 0);
}

function decodeIndexedInvoiceCursor(
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
      Buffer.from(
        cursor.slice(INDEXED_INVOICE_CURSOR_PREFIX.length),
        "base64url",
      ).toString("utf8"),
    ) as Partial<IndexedInvoiceCursorState>;

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

function encodeIndexedInvoiceCursor(state: IndexedInvoiceCursorState) {
  return `${INDEXED_INVOICE_CURSOR_PREFIX}${Buffer.from(
    JSON.stringify(state),
    "utf8",
  ).toString("base64url")}`;
}

function getValidInvoiceStatuses(
  statuses: GetInvoicesParams["statuses"],
): InvoiceStatus[] {
  return (statuses ?? []).filter((status) =>
    INVOICE_STATUSES.includes(status as InvoiceStatus),
  ) as InvoiceStatus[];
}

function getIndexedInvoiceOrder(sort: GetInvoicesParams["sort"]) {
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

function getIndexedInvoiceBatchSize(pageSize: number) {
  return Math.min(Math.max(pageSize * 3, 100), 250);
}

function canUseIndexedInvoicePage(args: {
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

function matchesIndexedInvoiceCandidate(
  invoice: ProjectedInvoiceRecord,
  args: {
    validStatuses: InvoiceStatus[];
    customers: GetInvoicesParams["customers"];
    start: GetInvoicesParams["start"];
    end: GetInvoicesParams["end"];
    recurring: GetInvoicesParams["recurring"];
  },
) {
  if (
    args.validStatuses.length > 0 &&
    !args.validStatuses.includes(invoice.status)
  ) {
    return false;
  }

  if (args.start && args.end) {
    if (
      !invoice.dueDate ||
      invoice.dueDate < args.start ||
      invoice.dueDate > args.end
    ) {
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

function toInvoiceListItem(invoice: ProjectedInvoiceRecord) {
  return {
    ...invoice,
    customer: {
      id: invoice.customer.id,
      name: invoice.customer.name,
      website: invoice.customer.website,
      email: invoice.customer.email,
    },
    team: {
      name: invoice.team.name,
    },
    recurring: {
      id: invoice.recurring.id,
      status: invoice.recurring.status,
      frequency: invoice.recurring.frequency,
      frequencyInterval: invoice.recurring.frequencyInterval,
      endType: invoice.recurring.endType,
      endCount: invoice.recurring.endCount,
      invoicesGenerated: invoice.recurring.invoicesGenerated,
      nextScheduledAt: invoice.recurring.nextScheduledAt,
    },
  };
}

function buildInvoicePageResponse(args: {
  invoices: ProjectedInvoiceRecord[];
  cursor: string | null | undefined;
  nextCursor: string | null | undefined;
  hasNextPage: boolean;
}) {
  return {
    meta: {
      cursor: args.nextCursor ?? null,
      hasPreviousPage: Boolean(args.cursor),
      hasNextPage: args.hasNextPage,
    },
    data: args.invoices.map(toInvoiceListItem),
  };
}

async function getProjectedInvoicesByIdsInOrder(args: {
  teamId: string;
  invoiceIds: string[];
}) {
  if (args.invoiceIds.length === 0) {
    return [];
  }

  const records = await getPublicInvoicesByIdsFromConvex({
    teamId: args.teamId,
    invoiceIds: args.invoiceIds,
  });
  const invoicesById = new Map(
    records.flatMap((record) => {
      const payload = getProjectedInvoicePayload(record);

      return payload && payload.teamId === args.teamId ? [[record.id, payload]] : [];
    }),
  );

  return args.invoiceIds.flatMap((invoiceId) => {
    const invoice = invoicesById.get(invoiceId);

    return invoice ? [invoice] : [];
  });
}

async function getIndexedInvoicesPage(params: GetInvoicesParams) {
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
    const result = await getPublicInvoicesPageFromConvex({
      teamId,
      cursor: sourceCursor,
      pageSize: getIndexedInvoiceBatchSize(pageSize),
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

export async function getInvoices(_db: Database, params: GetInvoicesParams) {
  const {
    teamId,
    sort,
    cursor,
    pageSize = 25,
    q,
    statuses,
    start,
    end,
    customers: customerIds,
    ids,
    recurringIds,
    recurring,
  } = params;

  if (
    canUseIndexedInvoicePage({
      sort,
      q,
      ids,
      recurringIds,
    })
  ) {
    return getIndexedInvoicesPage(params);
  }

  let data = await getProjectedInvoicesForTeam(teamId);

  if (ids && ids.length > 0) {
    const idSet = new Set(ids);
    data = data.filter((invoice) => idSet.has(invoice.id));
  }

  if (recurringIds && recurringIds.length > 0) {
    const recurringIdSet = new Set(recurringIds);
    data = data.filter(
      (invoice) =>
        !!invoice.invoiceRecurringId &&
        recurringIdSet.has(invoice.invoiceRecurringId),
    );
  }

  if (recurring === true) {
    data = data.filter((invoice) => !!invoice.invoiceRecurringId);
  } else if (recurring === false) {
    data = data.filter((invoice) => !invoice.invoiceRecurringId);
  }

  if (statuses && statuses.length > 0) {
    const validStatuses = statuses.filter((status) =>
      INVOICE_STATUSES.includes(status as InvoiceStatus),
    ) as InvoiceStatus[];

    if (validStatuses.length > 0) {
      const statusSet = new Set(validStatuses);
      data = data.filter((invoice) => statusSet.has(invoice.status));
    }
  }

  if (start && end) {
    data = data.filter(
      (invoice) =>
        !!invoice.dueDate && invoice.dueDate >= start && invoice.dueDate <= end,
    );
  }

  if (customerIds && customerIds.length > 0) {
    const customerIdSet = new Set(customerIds);
    data = data.filter(
      (invoice) =>
        !!invoice.customerId && customerIdSet.has(invoice.customerId),
    );
  }

  if (q) {
    const trimmedQuery = q.trim();
    const lowerQuery = trimmedQuery.toLowerCase();

    if (!Number.isNaN(Number.parseInt(trimmedQuery, 10))) {
      const normalizedAmount = Number(trimmedQuery).toString();
      data = data.filter(
        (invoice) =>
          invoice.amount !== null &&
          invoice.amount !== undefined &&
          Number(invoice.amount).toString() === normalizedAmount,
      );
    } else {
      data = data.filter((invoice) => {
        const invoiceNumber = invoice.invoiceNumber.toLowerCase();
        const customerName = (invoice.customerName ?? "").toLowerCase();

        return (
          invoiceNumber.includes(lowerQuery) ||
          customerName.includes(lowerQuery)
        );
      });
    }
  }

  const compareBySort = (
    left: ProjectedInvoiceRecord,
    right: ProjectedInvoiceRecord,
  ) => {
    if (sort && sort.length === 2) {
      const [column, direction] = sort;
      const multiplier = direction === "asc" ? 1 : -1;

      if (column === "customer") {
        return (
          compareNullableStrings(left.customer?.name, right.customer?.name) *
          multiplier
        );
      }

      if (column === "created_at") {
        return (
          compareNullableStrings(left.createdAt, right.createdAt) * multiplier
        );
      }

      if (column === "due_date") {
        return compareNullableStrings(left.dueDate, right.dueDate) * multiplier;
      }

      if (column === "amount") {
        return compareNullableNumbers(left.amount, right.amount) * multiplier;
      }

      if (column === "status") {
        return compareNullableStrings(left.status, right.status) * multiplier;
      }
    }

    return compareNullableStrings(right.createdAt, left.createdAt);
  };

  data = [...data].sort((left, right) => {
    const result = compareBySort(left, right);

    if (result !== 0) {
      return result;
    }

    return compareNullableStrings(right.id, left.id);
  });

  const offset = cursor ? Number.parseInt(cursor, 10) : 0;
  const pagedData = data.slice(offset, offset + pageSize);

  const nextCursor =
    pagedData.length === pageSize ? (offset + pageSize).toString() : undefined;

  return {
    ...buildInvoicePageResponse({
      invoices: pagedData,
      cursor,
      nextCursor,
      hasNextPage: pagedData.length === pageSize,
    }),
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: offset > 0,
      hasNextPage: pagedData.length === pageSize,
    },
  };
}

export type GetInvoiceByIdParams = {
  id: string;
  teamId?: string;
};

export async function getInvoiceById(
  _db: DatabaseOrTransaction,
  params: GetInvoiceByIdParams,
) {
  const { id, teamId } = params;
  const projected = await getPublicInvoiceByPublicInvoiceIdFromConvex({
    invoiceId: id,
  });
  const payload = getProjectedInvoicePayload(projected);

  if (!payload) {
    return null;
  }

  if (teamId !== undefined && payload.teamId !== teamId) {
    return null;
  }

  return payload;
}

type PaymentStatusResult = {
  score: number;
  paymentStatus: string;
};

export async function getPaymentStatus(
  _db: Database,
  teamId: string,
): Promise<PaymentStatusResult> {
  const currentDate = new Date();
  const invoiceData = (
    await getProjectedInvoicesByFilters({
      teamId,
      statuses: ["paid", "unpaid", "overdue"],
    })
  )
    .filter((invoice) => {
      if (!invoice.dueDate) {
        return false;
      }

      const dueDate = new Date(invoice.dueDate);
      const isOverdue = dueDate < currentDate;

      return (
        (invoice.status === "paid" && !!invoice.paidAt) ||
        ((invoice.status === "unpaid" || invoice.status === "overdue") &&
          !invoice.paidAt &&
          isOverdue)
      );
    })
    .sort((left, right) => {
      const leftTime = left.dueDate ? new Date(left.dueDate).getTime() : 0;
      const rightTime = right.dueDate ? new Date(right.dueDate).getTime() : 0;

      return rightTime - leftTime;
    })
    .slice(0, 50)
    .map((invoice) => ({
      due_date: invoice.dueDate,
      paid_at: invoice.paidAt,
      status: invoice.status,
      amount: invoice.amount,
      currency: invoice.currency,
    }));

  if (!Array.isArray(invoiceData) || invoiceData.length === 0) {
    return {
      score: 0,
      paymentStatus: "none",
    };
  }

  let totalWeightedDays = 0;
  let totalWeight = 0;
  let onTimeCount = 0;
  let lateCount = 0;

  for (const invoice of invoiceData) {
    if (!invoice.due_date) continue;

    const dueDate = new Date(invoice.due_date as string);
    let daysOverdue = 0;

    if (invoice.status === "paid" && invoice.paid_at) {
      const paidDate = new Date(invoice.paid_at as string);
      daysOverdue =
        (paidDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
    } else if (
      (invoice.status === "unpaid" || invoice.status === "overdue") &&
      invoice.paid_at === null
    ) {
      daysOverdue =
        (currentDate.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24);
    }

    const daysSinceDue = Math.abs(
      (Date.now() - dueDate.getTime()) / (1000 * 60 * 60 * 24),
    );
    const weight = daysSinceDue <= 90 ? 1.5 : 1.0;

    totalWeightedDays += daysOverdue * weight;
    totalWeight += weight;

    if (daysOverdue <= 3) {
      onTimeCount++;
    } else {
      lateCount++;
    }
  }

  const avgDaysOverdue = totalWeightedDays / totalWeight;
  const onTimeRate = onTimeCount / (onTimeCount + lateCount);

  let baseScore: number;

  if (avgDaysOverdue <= 3) {
    baseScore = 100;
  } else if (avgDaysOverdue <= 7) {
    baseScore = Math.round(100 - ((avgDaysOverdue - 3) / 4) * 15);
  } else if (avgDaysOverdue <= 14) {
    baseScore = Math.round(85 - ((avgDaysOverdue - 7) / 7) * 20);
  } else if (avgDaysOverdue <= 30) {
    baseScore = Math.round(65 - ((avgDaysOverdue - 14) / 16) * 25);
  } else {
    baseScore = Math.round(Math.max(0, 40 - ((avgDaysOverdue - 30) / 30) * 40));
  }

  const rateBonus = Math.round((onTimeRate - 0.5) * 20);
  const score = Math.max(0, Math.min(100, baseScore + rateBonus));

  let paymentStatus: string;
  if (score >= 80) {
    paymentStatus = "good";
  } else if (score >= 60) {
    paymentStatus = "average";
  } else {
    paymentStatus = "bad";
  }

  return {
    score,
    paymentStatus,
  };
}

export type GetInvoiceSummaryParams = {
  teamId: string;
  statuses?: (
    | "paid"
    | "canceled"
    | "overdue"
    | "unpaid"
    | "draft"
    | "scheduled"
  )[];
};

export async function getInvoiceSummary(
  db: Database,
  params: GetInvoiceSummaryParams,
) {
  const { teamId, statuses } = params;

  const team = await getTeamById(db, teamId);
  const baseCurrency = team?.baseCurrency || "USD";
  const validStatuses = getValidInvoiceStatuses(statuses);
  const invoices =
    validStatuses.length > 0
      ? await getProjectedInvoicesByFilters({
          teamId,
          statuses: validStatuses,
        })
      : await getProjectedInvoicesForTeam(teamId);
  const currencyTotals = invoices
    .filter(
      (invoice) =>
        !statuses ||
        statuses.length === 0 ||
        statuses.some((status) => status === invoice.status),
    )
    .reduce<
      Array<{
        currency: string;
        totalAmount: number;
        invoiceCount: number;
      }>
    >((accumulator, invoice) => {
      const currency = invoice.currency || baseCurrency;
      const amount = Number(invoice.amount) || 0;
      const existing = accumulator.find((entry) => entry.currency === currency);

      if (existing) {
        existing.totalAmount += amount;
        existing.invoiceCount += 1;
        return accumulator;
      }

      accumulator.push({
        currency,
        totalAmount: amount,
        invoiceCount: 1,
      });

      return accumulator;
    }, []);

  if (currencyTotals.length === 0) {
    return {
      totalAmount: 0,
      invoiceCount: 0,
      currency: baseCurrency,
    };
  }

  const foreignCurrencies = currencyTotals
    .map((row) => row.currency || baseCurrency)
    .filter((currency) => currency !== baseCurrency);

  const rateMap = new Map<string, number>();
  if (foreignCurrencies.length > 0) {
    const pairs = foreignCurrencies.map((currency) => ({
      base: currency,
      target: baseCurrency,
    }));
    const batchRates = await getExchangeRatesBatch(db, { pairs });
    for (const [key, rate] of batchRates) {
      const base = key.split(":")[0];
      if (base) rateMap.set(base, rate);
    }
  }

  let totalAmount = 0;
  let invoiceCount = 0;
  const breakdown: Array<{
    currency: string;
    originalAmount: number;
    convertedAmount: number;
    count: number;
  }> = [];

  for (const row of currencyTotals) {
    const currency = row.currency || baseCurrency;
    const amount = Number(row.totalAmount) || 0;
    const rowCount = Number(row.invoiceCount) || 0;

    if (currency === baseCurrency) {
      totalAmount += amount;
      breakdown.push({
        currency,
        originalAmount: Math.round(amount * 100) / 100,
        convertedAmount: Math.round(amount * 100) / 100,
        count: rowCount,
      });
      invoiceCount += rowCount;
    } else {
      const rate = rateMap.get(currency);
      if (rate) {
        const convertedAmount = amount * rate;
        totalAmount += convertedAmount;
        breakdown.push({
          currency,
          originalAmount: Math.round(amount * 100) / 100,
          convertedAmount: Math.round(convertedAmount * 100) / 100,
          count: rowCount,
        });
        invoiceCount += rowCount;
      }
    }
  }

  breakdown.sort((left, right) => right.originalAmount - left.originalAmount);

  return {
    totalAmount: Math.round(totalAmount * 100) / 100,
    invoiceCount,
    currency: baseCurrency,
    breakdown: breakdown.length > 1 ? breakdown : undefined,
  };
}
