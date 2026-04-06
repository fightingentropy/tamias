import {
  getCustomersByIdsFromConvex,
  getCustomersPageFromConvex,
  type CustomerRecord,
} from "@tamias/app-data-convex";
import type { GetCustomersParams } from "../types";
import { buildCustomerRows } from "./metrics";
import { matchesCustomerSearch } from "./search";

const CUSTOMER_PAGE_CURSOR_PREFIX = "customer:";

type IndexedCustomerCursorState = {
  sourceCursor: string | null;
  sourceExhausted: boolean;
  bufferedIds: string[];
};

function decodeIndexedCustomerCursor(
  cursor: string | null | undefined,
): IndexedCustomerCursorState {
  if (!cursor || !cursor.startsWith(CUSTOMER_PAGE_CURSOR_PREFIX)) {
    return {
      sourceCursor: null,
      sourceExhausted: false,
      bufferedIds: [],
    };
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(
        cursor.slice(CUSTOMER_PAGE_CURSOR_PREFIX.length),
        "base64url",
      ).toString("utf8"),
    ) as Partial<IndexedCustomerCursorState>;

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

function encodeIndexedCustomerCursor(state: IndexedCustomerCursorState) {
  return `${CUSTOMER_PAGE_CURSOR_PREFIX}${Buffer.from(
    JSON.stringify(state),
    "utf8",
  ).toString("base64url")}`;
}

function getIndexedCustomerOrder(sort: GetCustomersParams["sort"]) {
  if (!sort || sort.length === 0) {
    return "desc" as const;
  }

  if (sort.length !== 2) {
    return null;
  }

  const [column, direction] = sort;

  if (
    column !== "created_at" ||
    (direction !== "asc" && direction !== "desc")
  ) {
    return null;
  }

  return direction;
}

export function canUseIndexedCustomerPage(sort?: string[] | null) {
  return getIndexedCustomerOrder(sort) !== null;
}

function getIndexedCustomerBatchSize(pageSize: number) {
  return Math.min(Math.max(pageSize * 3, 50), 200);
}

async function getCustomersByIdsInOrder(args: {
  teamId: string;
  customerIds: string[];
}) {
  if (args.customerIds.length === 0) {
    return [];
  }

  const customers = await getCustomersByIdsFromConvex({
    teamId: args.teamId,
    customerIds: args.customerIds,
  });
  const customersById = new Map(customers.map((customer) => [customer.id, customer]));

  return args.customerIds.flatMap((customerId) => {
    const customer = customersById.get(customerId);

    return customer ? [customer] : [];
  });
}

export async function getIndexedCustomersPage(params: GetCustomersParams) {
  const { teamId, sort, cursor, pageSize = 25, q } = params;
  const order = getIndexedCustomerOrder(sort) ?? "desc";
  const cursorState = decodeIndexedCustomerCursor(cursor);
  let sourceCursor = cursorState.sourceCursor;
  let sourceExhausted = cursorState.sourceExhausted;
  let bufferedIds = [...cursorState.bufferedIds];
  const eligibleCustomers: CustomerRecord[] = [];

  while (eligibleCustomers.length <= pageSize && bufferedIds.length > 0) {
    const takeCount = pageSize + 1 - eligibleCustomers.length;
    const bufferedCustomers = await getCustomersByIdsInOrder({
      teamId,
      customerIds: bufferedIds.slice(0, takeCount),
    });

    bufferedIds = bufferedIds.slice(takeCount);
    eligibleCustomers.push(
      ...bufferedCustomers.filter((customer) => matchesCustomerSearch(customer, q)),
    );
  }

  while (eligibleCustomers.length <= pageSize && !sourceExhausted) {
    const result = await getCustomersPageFromConvex({
      teamId,
      cursor: sourceCursor,
      pageSize: getIndexedCustomerBatchSize(pageSize),
      order,
    });

    eligibleCustomers.push(
      ...result.page.filter((customer) => matchesCustomerSearch(customer, q)),
    );

    sourceCursor = result.isDone ? null : result.continueCursor;
    sourceExhausted = result.isDone;

    if (result.page.length === 0) {
      break;
    }
  }

  const pagedCustomers = eligibleCustomers.slice(0, pageSize);
  const nextBufferedIds = [
    ...eligibleCustomers.slice(pageSize).map((customer) => customer.id),
    ...bufferedIds,
  ];
  const hasNextPage = nextBufferedIds.length > 0;
  const nextCursor = hasNextPage
    ? encodeIndexedCustomerCursor({
        sourceCursor,
        sourceExhausted,
        bufferedIds: nextBufferedIds,
      })
    : undefined;
  const data = await buildCustomerRows(teamId, pagedCustomers);

  return {
    meta: {
      cursor: nextCursor ?? null,
      hasPreviousPage: Boolean(cursor),
      hasNextPage,
    },
    data,
  };
}
